using System.Net;
using System.Text;
using System.Text.Json;
using CitySimulator.Api.Features.Analysis;
using CitySimulator.Api.Features.Scenario;
using CitySimulator.Api.Features.Simulation;
using Microsoft.Extensions.Logging.Abstractions;

// Dependency-free regression runner. All HTTP responses below are in-memory fixtures, never real LLM calls.
var failures = 0;
var total = 0;
var control = Choices(new("M7", "nura"), new("M8", "nura"), new("M10", "nura"), new("M12", null), new("M5", "saryarka"));
var baseline = ScoreCalculator.Baseline;
var result = ScoreCalculator.Simulate(control);
var catalog = ExplanationBuilder.BuildCatalog(control, baseline, result, 95);
var strengthIds = catalog.Strengths.Select(c => c.Id).Reverse().ToArray();
var riskIds = catalog.Risks.Select(c => c.Id).Reverse().ToArray();
var ranking = new { strengthOrder = strengthIds, riskOrder = riskIds };
var validEnvelope = Envelope(ranking);

await Check("control calculation and exact decimal tie", () =>
{
    Equal(52.56, ScoreCalculator.Round(baseline.Score));
    Equal(56.54, ScoreCalculator.Round(result.Score));
    Equal(58.89, ScoreCalculator.Round(58.885));
    Equal(-58.89, ScoreCalculator.Round(-58.885));
    var edge = ScoreCalculator.Simulate(Choices(new("M10", "baikonur"), new("M4", "yesil"), new("M5", "almaty"), new("M1", "saryarka"), new("M14", null)));
    Equal(58.89, ScoreCalculator.Round(edge.Districts.Single(d => d.District.Id == "almaty").Score));
    Equal(53.86, ScoreCalculator.Round(edge.Score));
    return Task.CompletedTask;
});

await Check("lag-adjusted effects include all city districts and do not include synergy twice", () =>
{
    Equal(11, result.AppliedEffects.Count);
    Equal(5, result.AppliedEffects.Count(e => e.MeasureId == "M12"));
    foreach (var effect in result.AppliedEffects.Where(e => e.MeasureId == "M12")) Equal(4.375, effect.Delta);
    Equal(10.5, result.AppliedEffects.Single(e => e.MeasureId == "M10" && e.IndicatorId == "B1").Delta);
    Equal(2.0, result.AppliedSynergies.Single().Delta);
    var negative = ScoreCalculator.Simulate(Choices(new("M1", "yesil"), new("M2", null), new("M10", "nura"), new("M11", "nura"), new("M12", null)));
    Equal(-1.75, negative.AppliedEffects.Single(e => e.MeasureId == "M11" && e.IndicatorId == "T1").Delta);
    return Task.CompletedTask;
});

await Check("clamp applies after effects and retains exact bounds", () =>
{
    foreach (var (delta, expected) in new[] { (-1000.0, 0.0), (1000.0, 100.0) })
    {
        var measure = new Measure("M99", "transport", "Test only", MeasureScope.District, 0, 0, new Dictionary<string, double> { ["T1"] = delta });
        var clipped = ScoreCalculator.Simulate([new ValidatedChoice(measure, ScenarioData.DistrictsById["yesil"])]);
        Equal(expected, clipped.Districts.Single(d => d.District.Id == "yesil").Indicators["T1"]);
    }
    return Task.CompletedTask;
});

await Check("valid LLM ranking changes order, never server text", async () =>
{
    var response = await Explain(validEnvelope);
    Equal("llm", response.Source);
    Equal(catalog.Summary, response.Explanation.Summary);
    Equal(catalog.Strengths.Single(c => c.Id == strengthIds[0]).Text, response.Explanation.Strengths[0]);
    Equal(catalog.Risks.Single(c => c.Id == riskIds[0]).Text, response.Explanation.Risks[0]);
});

var malformed = new Dictionary<string, string>
{
    ["invalid JSON"] = "{",
    ["null root"] = "null",
    ["array root"] = "[]",
    ["number root"] = "42",
    ["numeric status"] = "{\"status\":42,\"output\":{}}",
    ["incomplete"] = "{\"status\":\"incomplete\",\"output\":[]}",
    ["missing output"] = "{\"status\":\"completed\"}",
    ["object output"] = "{\"status\":\"completed\",\"output\":{}}",
    ["invalid output items"] = "{\"status\":\"completed\",\"output\":[null,42,{}]}",
    ["object content"] = "{\"status\":\"completed\",\"output\":[{\"type\":\"message\",\"content\":{}}]}",
    ["numeric text"] = "{\"status\":\"completed\",\"output\":[{\"type\":\"message\",\"content\":[{\"type\":\"output_text\",\"text\":42}]}]}",
    ["refusal"] = "{\"status\":\"completed\",\"output\":[{\"type\":\"message\",\"content\":[{\"type\":\"refusal\"}]}]}",
    ["foreign facts"] = Envelope(new { summary = "Итоговый Score 100, базовый Score 20.", strengths = new[] { "M5 улучшает воздух в Нуре." }, risks = Array.Empty<string>() }),
    ["empty orders"] = Envelope(new { strengthOrder = Array.Empty<string>(), riskOrder = Array.Empty<string>() }),
    ["unknown ID"] = Envelope(new { strengthOrder = new[] { "invented" }.Concat(strengthIds.Skip(1)), riskOrder = riskIds }),
    ["duplicate ID"] = Envelope(new { strengthOrder = new[] { strengthIds[0], strengthIds[0] }.Concat(strengthIds.Skip(2)), riskOrder = riskIds }),
    ["omitted ID"] = Envelope(new { strengthOrder = strengthIds.Skip(1), riskOrder = riskIds }),
    ["cross-section ID"] = Envelope(new { strengthOrder = new[] { riskIds[0] }.Concat(strengthIds.Skip(1)), riskOrder = riskIds }),
    ["extra prose"] = Envelope(new { strengthOrder = strengthIds, riskOrder = riskIds, summary = "Итоговый Score 9999." }),
};
foreach (var (name, payload) in malformed)
    await Check($"fallback: {name}", async () =>
    {
        var response = await Explain(payload);
        Equal("mock", response.Source);
        Equal(catalog.Summary, response.Explanation.Summary);
        Equal(catalog.Strengths.Count, response.Explanation.Strengths.Count);
        Equal(catalog.Risks.Count, response.Explanation.Risks.Count);
    });

await Check("malformed optional usage cannot crash valid output", async () =>
{
    using var document = JsonDocument.Parse(validEnvelope);
    foreach (var usage in new object?[] { null, 42, "bad", new { input_tokens = "wrong", output_tokens = 1e50, total_tokens = -1 } })
    {
        var payload = JsonSerializer.Serialize(new { status = "completed", usage, output = document.RootElement.GetProperty("output") });
        Equal("llm", (await Explain(payload)).Source);
    }
});

foreach (var status in new[] { HttpStatusCode.Unauthorized, HttpStatusCode.TooManyRequests, HttpStatusCode.ServiceUnavailable })
    await Check($"fallback: HTTP {(int)status}", async () => Equal("mock", (await Explain("{}", status)).Source));

await Check("timeout falls back without an external request", async () =>
{
    var options = LiveOptions(TimeSpan.FromMilliseconds(30));
    using var http = new HttpClient(new StubHandler(async token => { await Task.Delay(5000, token); return new(HttpStatusCode.OK); })) { BaseAddress = new Uri("http://audit.invalid/") };
    var service = new ExplanationService(options, new OpenAiExplanationClient(http, options, NullLogger<OpenAiExplanationClient>.Instance));
    Equal("mock", (await service.ExplainAsync(control, baseline, result, 95, ExplanationLocales.Russian, default)).Source);
});

Console.WriteLine($"{total - failures}/{total} regression checks passed");
return failures == 0 ? 0 : 1;

async Task Check(string name, Func<Task> check)
{
    total++;
    try { await check(); Console.WriteLine($"PASS {name}"); }
    catch (Exception error) { failures++; Console.WriteLine($"FAIL {name}: {error}"); }
}

async Task<(Explanation Explanation, string Source)> Explain(string payload, HttpStatusCode status = HttpStatusCode.OK)
{
    var options = LiveOptions(TimeSpan.FromSeconds(1));
    using var http = new HttpClient(new StubHandler(_ => Task.FromResult(new HttpResponseMessage(status)
        { Content = new StringContent(payload, Encoding.UTF8, "application/json") }))) { BaseAddress = new Uri("http://audit.invalid/") };
    var service = new ExplanationService(options, new OpenAiExplanationClient(http, options, NullLogger<OpenAiExplanationClient>.Instance));
    return await service.ExplainAsync(control, baseline, result, 95, ExplanationLocales.Russian, default);
}

static LlmOptions LiveOptions(TimeSpan timeout) => new() { Mode = "live", ApiKey = "test-only-not-a-key", Model = "test", MaxRetries = 0, TotalTimeout = timeout };
static string Envelope(object ranking) => JsonSerializer.Serialize(new { status = "completed", output = new[] { new { type = "message", content = new[] { new { type = "output_text", text = JsonSerializer.Serialize(ranking) } } } } });
static IReadOnlyList<ValidatedChoice> Choices(params MeasureChoice[] choices)
{
    var (validated, failure) = ChoiceValidator.Validate(new EvaluateRequest(choices));
    if (failure is not null) throw new Exception(failure.Message);
    return validated!;
}
static void Equal<T>(T expected, T actual)
{
    if (!EqualityComparer<T>.Default.Equals(expected, actual)) throw new Exception($"Expected {expected}; actual {actual}");
}
sealed class StubHandler(Func<CancellationToken, Task<HttpResponseMessage>> respond) : HttpMessageHandler
{
    protected override Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken cancellationToken) => respond(cancellationToken);
}
