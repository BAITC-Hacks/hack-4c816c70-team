using CitySimulator.Api.Features.Simulation;

namespace CitySimulator.Api.Features.Analysis;

public static class ExplanationSource
{
    public const string Mock = "mock";
    public const string Llm = "llm";
}

/// <summary>
/// All explanation text is written by the server from <see cref="ScoreCalculator"/> output.
/// In live mode the LLM only prioritizes the verified claims; "llm" source means the order came from the model.
/// Any LLM failure keeps the default order ("mock").
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
        var catalog = ExplanationBuilder.BuildCatalog(choices, baseline, result, spent);

        if (options.IsLiveReady)
        {
            var facts = AnalysisFacts.Build(choices, baseline, result, spent);
            var order = await client.TryRankAsync(facts, catalog, cancellationToken);
            if (order is not null)
            {
                return (ExplanationBuilder.Assemble(catalog, order.StrengthOrder, order.RiskOrder, alternatives), ExplanationSource.Llm);
            }
        }

        return (ExplanationBuilder.Assemble(
            catalog,
            catalog.Strengths.Select(c => c.Id).ToList(),
            catalog.Risks.Select(c => c.Id).ToList(),
            alternatives), ExplanationSource.Mock);
    }
}
