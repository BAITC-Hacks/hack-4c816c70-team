using System.Diagnostics;
using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;
using System.Text.Json.Nodes;
using CitySimulator.Api.Features.Simulation;

namespace CitySimulator.Api.Features.Analysis;

/// <summary>
/// Calls OpenAI Responses API (POST /v1/responses) with Structured Outputs. The model returns only IDs of
/// server-written facts: the priority of explanation claims, or the choice of an alternative plan and its facts.
/// Returns null on any failure so the caller keeps its deterministic result.
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

    private const string AlternativeInstructions = """
        Ты аналитик городского симулятора «Аким на 5 часов» (Астана). Сервер перебрал все замены одной меры в плане
        из 5 мер и оставил только варианты, которые улучшают цель пользователя (goal). Все числа и тексты посчитаны сервером.
        Твоя задача — только выбрать ID.

        Правила:
        - variantId: один ID из variants — вариант, который лучше всего подходит под goal с учётом его потерь.
        - argumentIds: 1–3 ID из arguments ИМЕННО выбранного варианта; обязательно включи его goalFactId.
        - tradeoffIds: 0–4 ID из tradeoffs ИМЕННО выбранного варианта; обязательно включи все его mandatoryTradeoffIds.
        - Не выдумывай и не повторяй ID, не бери ID другого варианта. Текст не пиши.
        """;

    private delegate bool OutputValidator<T>(string text, out T? value, out string reason);

    /// <summary>Returns a validated priority order of the catalog claims, or null to keep the default order.</summary>
    public Task<ClaimOrder?> TryRankAsync(AnalysisFacts facts, ClaimCatalog catalog, CancellationToken cancellationToken)
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
        return TryStructuredAsync<ClaimOrder>(
            "explanation",
            Instructions,
            "Результат расчёта и проверенные утверждения (JSON):\n" + input,
            "claim_priorities",
            OrderSchema(catalog),
            (string text, out ClaimOrder? order, out string reason) => ExplanationValidator.TryParse(text, catalog, out order, out reason),
            options.MaxRetries,
            cancellationToken);
    }

    /// <summary>
    /// Exactly one request, without retries: the model picks an eligible variant and fact IDs of that variant.
    /// Returns null on any failure so the caller uses the deterministic advice.
    /// </summary>
    public Task<AlternativeSelection?> TrySelectAlternativeAsync(object input, AlternativeChoiceSet choices, CancellationToken cancellationToken) =>
        TryStructuredAsync<AlternativeSelection>(
            "alternatives",
            AlternativeInstructions,
            "Цель, исходный план и допустимые варианты (JSON):\n" + JsonSerializer.Serialize(input, InputJsonOptions),
            "alternative_selection",
            AlternativeSelectionValidator.Schema(choices),
            (string text, out AlternativeSelection? selection, out string reason) =>
                AlternativeSelectionValidator.TryParse(text, choices, out selection, out reason),
            maxRetries: 0,
            cancellationToken);

    private async Task<T?> TryStructuredAsync<T>(
        string purpose,
        string instructions,
        string input,
        string schemaName,
        JsonObject schema,
        OutputValidator<T> validate,
        int maxRetries,
        CancellationToken cancellationToken) where T : class
    {
        var body = BuildRequestBody(instructions, input, schemaName, schema);
        var total = Stopwatch.StartNew();
        var attempt = 0;

        // One deadline for all attempts and backoffs together; when it expires the caller falls back to mock.
        using var deadline = CancellationTokenSource.CreateLinkedTokenSource(cancellationToken);
        deadline.CancelAfter(options.TotalTimeout);

        try
        {
            while (attempt <= maxRetries)
            {
                attempt++;
                var isLastAttempt = attempt > maxRetries;
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
                        var text = ExtractOutputText(purpose, payload, attempt, status, stopwatch.ElapsedMilliseconds);
                        if (text is null)
                        {
                            return null;
                        }

                        if (!validate(text, out var value, out var reason))
                        {
                            logger.LogWarning("OpenAI {Purpose} rejected by validation: {Reason}", purpose, reason);
                            return null;
                        }

                        return value;
                    }

                    var transient = IsTransient(status);
                    logger.LogWarning(
                        "OpenAI {Purpose} attempt {Attempt}: HTTP {Status} in {ElapsedMs} ms, transient={Transient}",
                        purpose, attempt, status, stopwatch.ElapsedMilliseconds, transient);
                    if (!transient || isLastAttempt)
                    {
                        return null;
                    }
                }
                catch (HttpRequestException exception)
                {
                    logger.LogWarning("OpenAI {Purpose} attempt {Attempt}: network error {ErrorType} ({HttpError})",
                        purpose, attempt, exception.GetType().Name, exception.HttpRequestError);
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
                "OpenAI {Purpose}: total deadline {DeadlineSeconds} s exceeded after {Attempts} attempt(s), {ElapsedMs} ms",
                purpose, options.TotalTimeout.TotalSeconds, attempt, total.ElapsedMilliseconds);
        }
        catch (OperationCanceledException)
        {
            logger.LogInformation("OpenAI {Purpose} cancelled by client", purpose);
        }

        return null;
    }

    private string BuildRequestBody(string instructions, string input, string schemaName, JsonObject schema)
    {
        var body = new JsonObject
        {
            ["model"] = options.Model,
            ["store"] = false,
            ["max_output_tokens"] = 1000,
            ["instructions"] = instructions,
            ["input"] = input,
            ["text"] = new JsonObject
            {
                ["format"] = new JsonObject
                {
                    ["type"] = "json_schema",
                    ["name"] = schemaName,
                    ["strict"] = true,
                    ["schema"] = schema,
                },
            },
        };
        return body.ToJsonString();
    }

    /// <summary>The single structured output_text of a completed response, or null for any other shape.</summary>
    private string? ExtractOutputText(string purpose, string payload, int attempt, int status, long elapsedMs)
    {
        JsonDocument document;
        try
        {
            document = JsonDocument.Parse(payload);
        }
        catch (JsonException)
        {
            logger.LogWarning("OpenAI {Purpose} attempt {Attempt}: HTTP {Status}, response is not JSON", purpose, attempt, status);
            return null;
        }

        using var parsed = document;
        var root = parsed.RootElement;
        var responseStatus = StringProperty(root, "status");
        if (root.ValueKind != JsonValueKind.Object || responseStatus != "completed")
        {
            logger.LogWarning("OpenAI {Purpose} rejected: response is not a completed object", purpose);
            return null;
        }

        root.TryGetProperty("usage", out var usage);
        logger.LogInformation(
            "OpenAI {Purpose} attempt {Attempt}: HTTP {Status}, response status {ResponseStatus}, {ElapsedMs} ms, tokens input={InputTokens} output={OutputTokens} total={TotalTokens}",
            purpose, attempt, status, responseStatus, elapsedMs,
            TokenCount(usage, "input_tokens"), TokenCount(usage, "output_tokens"), TokenCount(usage, "total_tokens"));

        if (!root.TryGetProperty("output", out var output) || output.ValueKind != JsonValueKind.Array)
        {
            logger.LogWarning("OpenAI {Purpose} rejected: output is not an array", purpose);
            return null;
        }

        string? text = null;
        foreach (var item in output.EnumerateArray())
        {
            if (StringProperty(item, "type") != "message")
            {
                continue;
            }

            if (!item.TryGetProperty("content", out var contents) || contents.ValueKind != JsonValueKind.Array)
            {
                logger.LogWarning("OpenAI {Purpose} rejected: message content is not an array", purpose);
                return null;
            }

            foreach (var content in contents.EnumerateArray())
            {
                switch (StringProperty(content, "type"))
                {
                    case "refusal":
                        logger.LogWarning("OpenAI {Purpose} rejected: model refusal", purpose);
                        return null;
                    case "output_text":
                        // One structured answer is expected. Never guess which of several answers to trust.
                        if (text is not null || StringProperty(content, "text") is not { } answer)
                        {
                            logger.LogWarning("OpenAI {Purpose} rejected: invalid or multiple output_text values", purpose);
                            return null;
                        }
                        text = answer;
                        break;
                }
            }
        }

        if (text is null)
        {
            logger.LogWarning("OpenAI {Purpose} rejected: no output_text", purpose);
        }

        return text;
    }

    private static string? StringProperty(JsonElement element, string name) =>
        element.ValueKind == JsonValueKind.Object && element.TryGetProperty(name, out var value)
        && value.ValueKind == JsonValueKind.String ? value.GetString() : null;

    // Optional diagnostics must never make an otherwise valid response fail with a 500.
    private static int? TokenCount(JsonElement usage, string name) =>
        usage.ValueKind == JsonValueKind.Object && usage.TryGetProperty(name, out var value)
        && value.ValueKind == JsonValueKind.Number && value.TryGetInt32(out var count) && count >= 0 ? count : null;

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

    /// <summary>
    /// Array of exactly <c>claims.Count</c> IDs of this section. An empty section gets no enum (an empty enum is invalid)
    /// and minItems = maxItems = 0. Uniqueness and completeness are still enforced by <see cref="ExplanationValidator"/>.
    /// </summary>
    private static JsonObject IdArray(IReadOnlyList<Claim> claims)
    {
        var items = new JsonObject { ["type"] = "string" };
        if (claims.Count > 0)
        {
            items["enum"] = new JsonArray(claims.Select(c => (JsonNode)JsonValue.Create(c.Id)!).ToArray());
        }

        return new JsonObject
        {
            ["type"] = "array",
            ["items"] = items,
            ["minItems"] = claims.Count,
            ["maxItems"] = claims.Count,
        };
    }
}
