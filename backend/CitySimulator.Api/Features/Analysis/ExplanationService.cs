using CitySimulator.Api.Features.Simulation;

namespace CitySimulator.Api.Features.Analysis;

public static class ExplanationSource
{
    public const string Mock = "mock";
    public const string Llm = "llm";
}

/// <summary>
/// Picks the explanation text only; numbers in the response always come from <see cref="ScoreCalculator"/>.
/// Live mode falls back to the deterministic template on any LLM failure.
/// </summary>
public sealed class ExplanationService(LlmOptions options, OpenAiExplanationClient client)
{
    public async Task<(Explanation Explanation, string Source)> ExplainAsync(
        IReadOnlyList<ValidatedChoice> choices,
        SimulationOutcome baseline,
        SimulationOutcome result,
        int spent,
        CancellationToken cancellationToken)
    {
        var alternatives = ReplacementAdvisor.Find(choices, result.Score);

        if (options.IsLiveReady)
        {
            // The model writes summary/strengths/risks about the chosen set only; it never sees or phrases swaps.
            var facts = AnalysisFacts.Build(choices, baseline, result, spent);
            var allowedMeasureIds = choices.Select(c => c.Measure.Id).ToHashSet();
            var explanation = await client.TryExplainAsync(facts, allowedMeasureIds, cancellationToken);
            if (explanation is not null)
            {
                return (explanation with { Recommendations = RecommendationBuilder.Build(alternatives) }, ExplanationSource.Llm);
            }
        }

        return (ExplanationBuilder.Build(choices, baseline, result, spent, alternatives), ExplanationSource.Mock);
    }
}
