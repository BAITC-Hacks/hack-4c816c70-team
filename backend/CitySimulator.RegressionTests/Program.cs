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

// ---- POST /api/simulations/alternatives ----
var controlSearch = AlternativeSearch.Run(control);

await Check("alternatives: exhaustive single-swap search on the control plan", () =>
{
    Equal(265, controlSearch.CandidatesChecked);
    Equal(117, controlSearch.ValidCandidates);
    Equal("alt_M5_M3_nura", controlSearch.BestByGoal["score"]!.Id);
    Equal("alt_M5_M3_nura", controlSearch.BestByGoal["equity"]!.Id);
    Equal("alt_M5_M11_nura", controlSearch.BestByGoal["economy"]!.Id);
    var response = AlternativeAdviceService.BuildResponse(controlSearch, "score", ExplanationLocales.Russian);
    Equal(2, response.Variants.Count);
    Equal("score,equity", string.Join(",", response.Variants[0].Strategies));
    Equal(56.54, response.Original.Score);
    Equal(95, response.Original.Spent);
    Equal(57.21, response.Variants[0].Plan.Score);
    Equal("single_swap", response.SearchScope);
    Equal("Лучший найденный вариант среди замен одной меры", response.Recommendation.Title);
    return Task.CompletedTask;
});

await Check("alternatives: best per goal is the lexicographic maximum over an independent enumeration", () =>
{
    var all = new List<(ScoredPlan Plan, string Key)>();
    var original = control.Select(AlternativeSearch.ToChoice).ToList();
    for (var slot = 0; slot < 5; slot++)
        foreach (var m in ScenarioData.Measures)
            foreach (var d in m.Scope == MeasureScope.City ? new string?[] { null } : ScenarioData.Districts.Select(x => (string?)x.Id))
            {
                var set = original.ToList();
                set[slot] = new MeasureChoice(m.Id, d);
                if (set[slot] == original[slot]) continue;
                var (v, f) = ChoiceValidator.Validate(new EvaluateRequest(set));
                if (f is null) all.Add((new ScoredPlan(v!, ScoreCalculator.Simulate(v!)), $"{control[slot].Measure.Id}_{m.Id}_{d ?? "city"}"));
            }
    Equal(117, all.Count);
    Equal(all.Max(a => a.Plan.Score), controlSearch.BestByGoal["score"]!.Plan.Score);
    Equal(all.Max(a => a.Plan.MinDistrictScore), controlSearch.BestByGoal["equity"]!.Plan.MinDistrictScore);
    Equal(all.Min(a => a.Plan.Spent), controlSearch.BestByGoal["economy"]!.Plan.Spent);
    // Economy tie at spent 80: higher Score wins; M11 in Nura beats M11 elsewhere.
    var cheapest = all.Where(a => a.Plan.Spent == 80).OrderByDescending(a => a.Plan.Score).First();
    Equal("alt_" + cheapest.Key, controlSearch.BestByGoal["economy"]!.Id);
    return Task.CompletedTask;
});

// Deterministic sample of valid plans for property checks.
var samples = new List<IReadOnlyList<ValidatedChoice>> { control };
var seed = 20260923u;
while (samples.Count < 40)
{
    var pool = ScenarioData.Measures.ToList();
    var picked = new List<MeasureChoice>();
    for (var j = 0; j < 5; j++)
    {
        seed = seed * 1664525 + 1013904223;
        var m = pool[(int)(seed % (uint)pool.Count)];
        pool.Remove(m);
        seed = seed * 1664525 + 1013904223;
        picked.Add(new MeasureChoice(m.Id, m.Scope == MeasureScope.District ? ScenarioData.Districts[(int)(seed % 5)].Id : null));
    }
    var (v, f) = ChoiceValidator.Validate(new EvaluateRequest(picked));
    if (f is null) samples.Add(v!);
}

await Check("alternatives: every returned plan re-evaluates to the same numbers and differs by one choice", () =>
{
    foreach (var plan in samples)
        foreach (var goal in AlternativeGoals.All)
        {
            var response = AlternativeAdviceService.BuildResponse(AlternativeSearch.Run(plan), goal, ExplanationLocales.English);
            foreach (var variant in response.Variants.Select(v => (Plan: v.Plan, Original: false)).Append((Plan: response.Original, Original: true)))
            {
                var (validated, failure) = ChoiceValidator.Validate(new EvaluateRequest(variant.Plan.Choices));
                True(failure is null, failure?.Message ?? "");
                var evaluated = SimulationEndpoints.BuildResponse(validated!, baseline, ScoreCalculator.Simulate(validated!),
                    new Explanation("", [], [], []), "mock");
                Equal(evaluated.Score, variant.Plan.Score);
                Equal(evaluated.Spent, variant.Plan.Spent);
                Equal(evaluated.Remaining, variant.Plan.Remaining);
                Equal(evaluated.Breakdown, variant.Plan.Breakdown);
                Equal(string.Join(";", evaluated.Districts.Select(d => $"{d.Id}={d.ScoreAfter}")),
                    string.Join(";", variant.Plan.Districts.Select(d => $"{d.Id}={d.Score}")));
            }
            foreach (var v in response.Variants)
            {
                Equal(4, v.Plan.Choices.Intersect(response.Original.Choices).Count());
                Equal(ScoreCalculator.Round(v.Plan.Score - response.Original.Score), v.Delta.Score);
                Equal(v.Plan.Spent - response.Original.Spent, v.Delta.Spent);
                foreach (var strategy in v.Strategies) Equal(v.Id, response.BestByGoal[strategy]);
                // Losses are explicit: a lower Score / weakest district always appears as a tradeoff.
                Equal(v.Delta.Score < 0, v.Tradeoffs.Any(t => t.Id == "score_down"));
                Equal(v.Delta.MinDistrictScore < 0, v.Tradeoffs.Any(t => t.Id == "min_district_down"));
                Equal(v.Delta.Score > 0, v.Arguments.Any(t => t.Id == "score_up"));
            }
            Equal(response.Variants.Count, response.Variants.Select(v => v.Id).Distinct().Count());
        }
    return Task.CompletedTask;
});

await Check("alternatives: improvement rule and explicit no_improvement", () =>
{
    var improvedSomewhere = 0;
    var economyLowersScore = 0;
    foreach (var plan in samples)
    {
        var search = AlternativeSearch.Run(plan);
        foreach (var goal in AlternativeGoals.All)
        {
            var response = AlternativeAdviceService.BuildResponse(search, goal, ExplanationLocales.Russian);
            var best = search.BestByGoal[goal];
            if (best is null)
            {
                Equal("no_improvement", response.Recommendation.Status);
                Equal<string?>(null, response.Recommendation.VariantId);
                Equal(0, response.Recommendation.Arguments.Count + response.Recommendation.Tradeoffs.Count);
                continue;
            }
            improvedSomewhere++;
            True(AlternativeSearch.Improves(goal, best.Plan, search.Original), goal);
            Equal(best.Id, response.Recommendation.VariantId);
            Equal(AlternativeSearch.GoalFactId(goal), response.Recommendation.Arguments[0].Id);
            var chosen = response.Variants.Single(v => v.Id == best.Id);
            foreach (var mandatory in chosen.Tradeoffs.Where(t => AlternativeSearch.MandatoryTradeoffs.Contains(t.Id)))
                True(response.Recommendation.Tradeoffs.Contains(mandatory), mandatory.Id);
            if (goal == "economy" && chosen.Delta.Score < 0) economyLowersScore++;
        }
    }
    True(improvedSomewhere > 0, "sample must contain improvements");
    True(economyLowersScore > 0, "sample must contain an economy option that lowers Score");

    // Hill-climb Score to a single-swap local optimum: then the score goal must report no improvement.
    var current = control;
    while (AlternativeSearch.Run(current).BestByGoal["score"] is { } next) current = next.Plan.Choices;
    var local = AlternativeAdviceService.BuildResponse(AlternativeSearch.Run(current), "score", ExplanationLocales.Russian);
    Equal("no_improvement", local.Recommendation.Status);
    Equal<string?>(null, local.BestByGoal["score"]);
    True(local.Recommendation.Text.Contains("исходный план остаётся лучшим найденным"), local.Recommendation.Text);
    return Task.CompletedTask;
});

await Check("alternatives: result does not depend on request order", () =>
{
    var reversed = control.Reverse().ToList();
    var a = AlternativeSearch.Run(control);
    var b = AlternativeSearch.Run(reversed);
    foreach (var goal in AlternativeGoals.All) Equal(a.BestByGoal[goal]?.Id, b.BestByGoal[goal]?.Id);
    return Task.CompletedTask;
});

await Check("alternatives: ru/kk/en change only text", () =>
{
    var texts = new HashSet<string>();
    string? numbers = null;
    foreach (var locale in new[] { ExplanationLocales.Russian, ExplanationLocales.Kazakh, ExplanationLocales.English })
    {
        var r = AlternativeAdviceService.BuildResponse(controlSearch, "economy", locale);
        texts.Add(r.Recommendation.Title + r.Recommendation.Text + string.Join("", r.Recommendation.Tradeoffs.Select(t => t.Text)));
        var n = JsonSerializer.Serialize(new { r.Original, r.BestByGoal, plans = r.Variants.Select(v => new { v.Plan, v.Delta, a = v.Arguments.Select(x => x.Id), t = v.Tradeoffs.Select(x => x.Id) }) });
        numbers ??= n;
        Equal(numbers, n);
        Equal(locale, r.Locale);
    }
    Equal(3, texts.Count);
    True(AlternativeAdviceService.BuildResponse(controlSearch, "economy", ExplanationLocales.English).Recommendation.Arguments[0].Text.Contains("95 → 80"), "en cost");
    return Task.CompletedTask;
});

// LLM selection: in-memory HTTP double, request counter proves "at most one request".
string Selection(object value) => Envelope(value);
async Task<(AlternativesResponse Response, int Requests)> Advise(IReadOnlyList<ValidatedChoice> plan, string goal, string payload, HttpStatusCode status = HttpStatusCode.OK)
{
    var requests = 0;
    // MaxRetries = 2 for explanations; alternatives must still send exactly one request.
    var options = new LlmOptions { Mode = "live", ApiKey = "test-only-not-a-key", Model = "test", MaxRetries = 2, TotalTimeout = TimeSpan.FromSeconds(5) };
    using var http = new HttpClient(new StubHandler(_ =>
    {
        requests++;
        return Task.FromResult(new HttpResponseMessage(status) { Content = new StringContent(payload, Encoding.UTF8, "application/json") });
    })) { BaseAddress = new Uri("http://audit.invalid/") };
    var service = new AlternativeAdviceService(options, new OpenAiExplanationClient(http, options, NullLogger<OpenAiExplanationClient>.Instance));
    return (await service.AdviseAsync(plan, goal, ExplanationLocales.Russian, default), requests);
}

await Check("alternatives LLM: accepted selection may pick another eligible variant; server texts only", async () =>
{
    var (response, requests) = await Advise(control, "score", Selection(new { variantId = "alt_M5_M11_nura", argumentIds = new[] { "cost_down", "score_up" }, tradeoffIds = new[] { "average_down" } }));
    Equal(1, requests);
    Equal("llm", response.Recommendation.Source);
    Equal("alt_M5_M11_nura", response.Recommendation.VariantId);
    Equal("cost_down,score_up", string.Join(",", response.Recommendation.Arguments.Select(a => a.Id)));
    var variant = response.Variants.Single(v => v.Id == "alt_M5_M11_nura");
    Equal(variant.Arguments.Single(a => a.Id == "cost_down").Text, response.Recommendation.Arguments[0].Text);
    // Search results never depend on the model.
    Equal("alt_M5_M3_nura", response.BestByGoal["score"]);
});

var rejected = new Dictionary<string, object>
{
    ["unknown variant"] = new { variantId = "alt_M1_M2_city", argumentIds = new[] { "score_up" }, tradeoffIds = Array.Empty<string>() },
    ["fact of another variant"] = new { variantId = "alt_M5_M3_nura", argumentIds = new[] { "score_up", "cost_down" }, tradeoffIds = Array.Empty<string>() },
    ["missing goal fact"] = new { variantId = "alt_M5_M3_nura", argumentIds = new[] { "min_district_up" }, tradeoffIds = Array.Empty<string>() },
    ["duplicate"] = new { variantId = "alt_M5_M3_nura", argumentIds = new[] { "score_up", "score_up" }, tradeoffIds = Array.Empty<string>() },
    ["too many"] = new { variantId = "alt_M5_M3_nura", argumentIds = new[] { "score_up", "min_district_up", "average_up", "district_nura_up" }, tradeoffIds = Array.Empty<string>() },
    ["argument as tradeoff"] = new { variantId = "alt_M5_M3_nura", argumentIds = new[] { "score_up" }, tradeoffIds = new[] { "min_district_up" } },
    ["extra prose"] = new { variantId = "alt_M5_M3_nura", argumentIds = new[] { "score_up" }, tradeoffIds = Array.Empty<string>(), text = "Score 99" },
};
foreach (var (name, value) in rejected)
    await Check($"alternatives LLM fallback: {name}", async () =>
    {
        var (response, requests) = await Advise(control, "score", Selection(value));
        Equal(1, requests);
        Equal("mock", response.Recommendation.Source);
        Equal("alt_M5_M3_nura", response.Recommendation.VariantId);
    });

await Check("alternatives LLM: HTTP 503 is not retried, falls back to mock", async () =>
{
    var (response, requests) = await Advise(control, "equity", "{}", HttpStatusCode.ServiceUnavailable);
    Equal(1, requests);
    Equal("mock", response.Recommendation.Source);
    Equal("min_district_up", response.Recommendation.Arguments[0].Id);
});

await Check("alternatives LLM: mandatory Score loss cannot be hidden", async () =>
{
    var plan = samples.First(p => AlternativeSearch.Run(p).BestByGoal["economy"] is { } e && e.Plan.Score < AlternativeSearch.Run(p).Original.Score);
    var draft = AlternativeAdviceService.BuildResponse(AlternativeSearch.Run(plan), "economy", ExplanationLocales.Russian);
    var chosen = draft.Variants.Single(v => v.Id == draft.Recommendation.VariantId);
    True(draft.Recommendation.Tradeoffs.Any(t => t.Id == "score_down"), "mock shows score_down");
    var hidden = new { variantId = chosen.Id, argumentIds = new[] { "cost_down" }, tradeoffIds = chosen.Tradeoffs.Where(t => t.Id != "score_down").Select(t => t.Id).Take(1).ToArray() };
    var (response, requests) = await Advise(plan, "economy", Selection(hidden));
    Equal(1, requests);
    Equal("mock", response.Recommendation.Source);
    True(response.Recommendation.Tradeoffs.Any(t => t.Id == "score_down"), "fallback shows score_down");
});

await Check("alternatives LLM: no eligible variant means no request", async () =>
{
    var current = control;
    while (AlternativeSearch.Run(current).BestByGoal["score"] is { } next) current = next.Plan.Choices;
    var (response, requests) = await Advise(current, "score", Selection(new { }));
    Equal(0, requests);
    Equal("no_improvement", response.Recommendation.Status);
    Equal("mock", response.Recommendation.Source);
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
static void True(bool condition, string message)
{
    if (!condition) throw new Exception(message);
}
static void Equal<T>(T expected, T actual)
{
    if (!EqualityComparer<T>.Default.Equals(expected, actual)) throw new Exception($"Expected {expected}; actual {actual}");
}
sealed class StubHandler(Func<CancellationToken, Task<HttpResponseMessage>> respond) : HttpMessageHandler
{
    protected override Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken cancellationToken) => respond(cancellationToken);
}
