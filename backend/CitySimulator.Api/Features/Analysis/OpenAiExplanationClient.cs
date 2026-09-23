using System.Diagnostics;
using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;
using System.Text.Json.Nodes;
using CitySimulator.Api.Features.Simulation;

namespace CitySimulator.Api.Features.Analysis;

/// <summary>
/// Calls OpenAI Responses API (POST /v1/responses) with Structured Outputs.
/// Returns null on any failure so the caller falls back to the deterministic explanation.
/// Never logs the API key, the request body or the model text.
/// </summary>
public sealed class OpenAiExplanationClient(HttpClient http, LlmOptions options, ILogger<OpenAiExplanationClient> logger)
{
    private static readonly JsonSerializerOptions FactsJsonOptions = new(JsonSerializerDefaults.Web)
    {
        Encoder = System.Text.Encodings.Web.JavaScriptEncoder.UnsafeRelaxedJsonEscaping,
    };

    private const string Instructions = """
        Ты аналитик городского симулятора «Аким на 5 часов» (Астана). Пользователь выбрал 5 мер, сервер уже посчитал итоговый
        Astana Quality of Life Score и все изменения. Объясни результат на русском языке для городского управленца.

        Правила:
        - Используй только числа из входного JSON и копируй их без изменений. Ничего не вычисляй: не складывай, не вычитай,
          не считай проценты и доли, не прогнозируй новых значений. Если нужного числа нет во входных данных — пиши словами.
        - Не меняй Score и не оценивай набор по своей формуле; итог уже посчитан сервером.
        - summary: 2–3 предложения — итоговый Score против базового, главный фактор изменения, компромисс набора.
        - strengths: 2–4 пункта — какие меры и районы дали наибольший вклад (scoreImpact, изменения показателей, синергии).
        - risks: 2–4 пункта — оставшиеся критические значения ниже 40, самый слабый район, неполный эффект из-за лага,
          районы и направления без улучшений.
        - recommendations: 2–4 пункта. Конкретные меры предлагай только из списка alternatives: это замены одной
          выбранной меры, которые сервер уже проверил на бюджет, лимит направлений, выбор района и несовместимости,
          и посчитал для них scoreAfter и scoreDelta. Не предлагай добавить меру сверх пяти, не комбинируй несколько
          замен и не называй другие ID мер. Если alternatives пуст — дай качественные советы без ID мер.
        - В strengths и risks упоминай только выбранные меры.
        - Пиши кратко, каждый пункт — одно-два предложения, без markdown.
        """;

    private static readonly JsonObject ResponseSchema = new()
    {
        ["type"] = "object",
        ["properties"] = new JsonObject
        {
            ["summary"] = new JsonObject { ["type"] = "string" },
            ["strengths"] = StringArray(),
            ["risks"] = StringArray(),
            ["recommendations"] = StringArray(),
        },
        ["required"] = new JsonArray("summary", "strengths", "risks", "recommendations"),
        ["additionalProperties"] = false,
    };

    public async Task<Explanation?> TryExplainAsync(
        AnalysisFacts facts, IReadOnlySet<string> allowedMeasureIds, CancellationToken cancellationToken)
    {
        var factsJson = JsonSerializer.Serialize(facts, FactsJsonOptions);
        var body = BuildRequestBody(factsJson);
        var total = Stopwatch.StartNew();
        var attempt = 0;

        // One deadline for all attempts and backoffs together; when it expires the caller falls back to mock.
        using var deadline = CancellationTokenSource.CreateLinkedTokenSource(cancellationToken);
        deadline.CancelAfter(options.TotalTimeout);

        try
        {
            while (attempt <= options.MaxRetries)
            {
                attempt++;
                var isLastAttempt = attempt > options.MaxRetries;
                var stopwatch = Stopwatch.StartNew();

                try
                {
                    using var request = new HttpRequestMessage(HttpMethod.Post, "responses")
                    {
                        Content = new StringContent(body, Encoding.UTF8, "application/json"),
                    };
                    request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", options.ApiKey);

                    using var response = await http.SendAsync(request, deadline.Token);
                    var status = (int)response.StatusCode;

                    if (response.IsSuccessStatusCode)
                    {
                        var payload = await response.Content.ReadAsStringAsync(deadline.Token);
                        return ParseResponse(payload, factsJson, allowedMeasureIds, attempt, status, stopwatch.ElapsedMilliseconds);
                    }

                    var transient = IsTransient(status);
                    logger.LogWarning(
                        "OpenAI explanation attempt {Attempt}: HTTP {Status} in {ElapsedMs} ms, transient={Transient}",
                        attempt, status, stopwatch.ElapsedMilliseconds, transient);
                    if (!transient || isLastAttempt)
                    {
                        return null;
                    }
                }
                catch (HttpRequestException exception)
                {
                    logger.LogWarning("OpenAI explanation attempt {Attempt}: network error {ErrorType} ({HttpError})",
                        attempt, exception.GetType().Name, exception.HttpRequestError);
                    if (isLastAttempt)
                    {
                        return null;
                    }
                }

                await Task.Delay(TimeSpan.FromSeconds(attempt), deadline.Token);
            }
        }
        catch (OperationCanceledException) when (!cancellationToken.IsCancellationRequested)
        {
            logger.LogWarning(
                "OpenAI explanation: total deadline {DeadlineSeconds} s exceeded after {Attempts} attempt(s), {ElapsedMs} ms",
                options.TotalTimeout.TotalSeconds, attempt, total.ElapsedMilliseconds);
        }
        catch (OperationCanceledException)
        {
            logger.LogInformation("OpenAI explanation cancelled by client");
        }

        return null;
    }

    private string BuildRequestBody(string factsJson)
    {
        var body = new JsonObject
        {
            ["model"] = options.Model,
            ["store"] = false,
            ["max_output_tokens"] = 4000,
            ["instructions"] = Instructions,
            ["input"] = "Результат расчёта (JSON, все числа уже посчитаны сервером):\n" + factsJson,
            ["text"] = new JsonObject
            {
                ["format"] = new JsonObject
                {
                    ["type"] = "json_schema",
                    ["name"] = "scenario_explanation",
                    ["strict"] = true,
                    ["schema"] = ResponseSchema.DeepClone(),
                },
            },
        };
        return body.ToJsonString();
    }

    private Explanation? ParseResponse(
        string payload, string factsJson, IReadOnlySet<string> allowedMeasureIds, int attempt, int status, long elapsedMs)
    {
        JsonNode? root;
        try
        {
            root = JsonNode.Parse(payload);
        }
        catch (JsonException)
        {
            logger.LogWarning("OpenAI explanation attempt {Attempt}: HTTP {Status}, response is not JSON", attempt, status);
            return null;
        }

        var usage = root?["usage"];
        logger.LogInformation(
            "OpenAI explanation attempt {Attempt}: HTTP {Status}, response status {ResponseStatus}, {ElapsedMs} ms, tokens input={InputTokens} output={OutputTokens} total={TotalTokens}",
            attempt, status, root?["status"]?.GetValue<string>(), elapsedMs,
            usage?["input_tokens"]?.GetValue<int>(), usage?["output_tokens"]?.GetValue<int>(), usage?["total_tokens"]?.GetValue<int>());

        if (root?["status"]?.GetValue<string>() != "completed")
        {
            logger.LogWarning("OpenAI explanation rejected: response is not completed");
            return null;
        }

        string? text = null;
        foreach (var item in root["output"]?.AsArray() ?? [])
        {
            if (item?["type"]?.GetValue<string>() != "message")
            {
                continue;
            }

            foreach (var content in item["content"]?.AsArray() ?? [])
            {
                switch (content?["type"]?.GetValue<string>())
                {
                    case "refusal":
                        logger.LogWarning("OpenAI explanation rejected: model refusal");
                        return null;
                    case "output_text":
                        text = content["text"]?.GetValue<string>();
                        break;
                }
            }
        }

        if (text is null)
        {
            logger.LogWarning("OpenAI explanation rejected: no output_text");
            return null;
        }

        if (!ExplanationValidator.TryParse(text, factsJson, allowedMeasureIds, out var explanation, out var reason))
        {
            logger.LogWarning("OpenAI explanation rejected by validation: {Reason}", reason);
            return null;
        }

        return explanation;
    }

    private static bool IsTransient(int status) => status is 408 or 409 or 429 or >= 500;

    private static JsonObject StringArray() => new()
    {
        ["type"] = "array",
        ["items"] = new JsonObject { ["type"] = "string" },
    };
}
