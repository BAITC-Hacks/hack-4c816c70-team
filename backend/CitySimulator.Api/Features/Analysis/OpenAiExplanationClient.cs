using System.Diagnostics;
using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;
using System.Text.Json.Nodes;
using CitySimulator.Api.Features.Simulation;

namespace CitySimulator.Api.Features.Analysis;

/// <summary>
/// Calls OpenAI Responses API (POST /v1/responses) with Structured Outputs to prioritize server-written claims.
/// The model returns only claim IDs; returns null on any failure so the caller keeps the default order.
/// Never logs the API key, the request body or the model output.
/// </summary>
public sealed class OpenAiExplanationClient(HttpClient http, LlmOptions options, ILogger<OpenAiExplanationClient> logger)
{
    private static readonly JsonSerializerOptions InputJsonOptions = new(JsonSerializerDefaults.Web)
    {
        Encoder = System.Text.Encodings.Web.JavaScriptEncoder.UnsafeRelaxedJsonEscaping,
    };

    private const string Instructions = """
        Ты аналитик городского симулятора «Аким на 5 часов» (Астана). Пользователь выбрал 5 мер, сервер посчитал
        Astana Quality of Life Score и сформулировал проверенные утверждения (claims) о сильных сторонах и рисках.
        Твоя задача — только расставить приоритеты: упорядочить ID утверждений по важности для этого сценария.

        Правила:
        - strengthOrder: все ID из claims.strengths ровно по одному разу, от самого важного к менее важному.
        - riskOrder: все ID из claims.risks ровно по одному разу, от самого важного к менее важному.
        - Не добавляй, не пропускай и не выдумывай ID; не переноси ID между секциями. Пустая секция — [].
        - Важность оценивай по facts: влияние на Score (scoreImpact, изменение оценок районов), критические значения
          ниже 40, самый слабый район (30% итогового балла), синергии и лаг. Текст не пиши.
        """;

    /// <summary>Returns a validated priority order of the catalog claims, or null to keep the default order.</summary>
    public async Task<ClaimOrder?> TryRankAsync(AnalysisFacts facts, ClaimCatalog catalog, CancellationToken cancellationToken)
    {
        var input = JsonSerializer.Serialize(new
        {
            facts,
            claims = new
            {
                strengths = catalog.Strengths.Select(c => new { id = c.Id, text = c.Text }),
                risks = catalog.Risks.Select(c => new { id = c.Id, text = c.Text }),
            },
        }, InputJsonOptions);
        var body = BuildRequestBody(input, catalog);
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
                        return ParseResponse(payload, catalog, attempt, status, stopwatch.ElapsedMilliseconds);
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

    private string BuildRequestBody(string input, ClaimCatalog catalog)
    {
        var body = new JsonObject
        {
            ["model"] = options.Model,
            ["store"] = false,
            ["max_output_tokens"] = 1000,
            ["instructions"] = Instructions,
            ["input"] = "Результат расчёта и проверенные утверждения (JSON):\n" + input,
            ["text"] = new JsonObject
            {
                ["format"] = new JsonObject
                {
                    ["type"] = "json_schema",
                    ["name"] = "claim_priorities",
                    ["strict"] = true,
                    ["schema"] = OrderSchema(catalog),
                },
            },
        };
        return body.ToJsonString();
    }

    private ClaimOrder? ParseResponse(string payload, ClaimCatalog catalog, int attempt, int status, long elapsedMs)
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

        if (!ExplanationValidator.TryParse(text, catalog, out var order, out var reason))
        {
            logger.LogWarning("OpenAI explanation rejected by validation: {Reason}", reason);
            return null;
        }

        return order;
    }

    private static bool IsTransient(int status) => status is 408 or 409 or 429 or >= 500;

    /// <summary>Strict schema: two arrays whose items are limited to the IDs of their own section.</summary>
    private static JsonObject OrderSchema(ClaimCatalog catalog) => new()
    {
        ["type"] = "object",
        ["properties"] = new JsonObject
        {
            [ExplanationValidator.StrengthOrderField] = IdArray(catalog.Strengths),
            [ExplanationValidator.RiskOrderField] = IdArray(catalog.Risks),
        },
        ["required"] = new JsonArray(ExplanationValidator.StrengthOrderField, ExplanationValidator.RiskOrderField),
        ["additionalProperties"] = false,
    };

    private static JsonObject IdArray(IReadOnlyList<Claim> claims)
    {
        var items = new JsonObject { ["type"] = "string" };
        if (claims.Count > 0)
        {
            items["enum"] = new JsonArray(claims.Select(c => (JsonNode)JsonValue.Create(c.Id)!).ToArray());
        }

        return new JsonObject { ["type"] = "array", ["items"] = items };
    }
}
