using CitySimulator.Api.Features.Scenario;
using static CitySimulator.Api.Features.Simulation.TextNumberFormat;

namespace CitySimulator.Api.Features.Simulation;

/// <summary>A verified statement: server-written text with a stable ID the LLM may only reorder.</summary>
public sealed record Claim(string Id, string Text);

public sealed record ClaimCatalog(string Summary, IReadOnlyList<Claim> Strengths, IReadOnlyList<Claim> Risks);

/// <summary>
/// Deterministic explanation of already computed numbers. Every sentence is written here from
/// <see cref="ScoreCalculator"/> output; in live mode the LLM only chooses the order of claims.
/// </summary>
public static class ExplanationBuilder
{
    private const int MaxDistrictGainClaims = 3;

    /// <summary>
    /// Explanation with claims in the given order (catalog order in mock mode). Orders must be validated permutations.
    /// </summary>
    public static Explanation Assemble(
        ClaimCatalog catalog,
        IReadOnlyList<string> strengthOrder,
        IReadOnlyList<string> riskOrder,
        IReadOnlyList<ReplacementOption> alternatives)
    {
        var strengths = catalog.Strengths.ToDictionary(c => c.Id, c => c.Text);
        var risks = catalog.Risks.ToDictionary(c => c.Id, c => c.Text);
        return new Explanation(
            catalog.Summary,
            strengthOrder.Select(id => strengths[id]).ToList(),
            riskOrder.Select(id => risks[id]).ToList(),
            RecommendationBuilder.Build(alternatives));
    }

    public static ClaimCatalog BuildCatalog(
        IReadOnlyList<ValidatedChoice> choices,
        SimulationOutcome baseline,
        SimulationOutcome result,
        int spent)
    {
        var weakest = Weakest(result);
        var delta = ScoreCalculator.Round(result.Score) - ScoreCalculator.Round(baseline.Score);
        var summary =
            $"Итоговый Score {F(result.Score)} против базового {F(baseline.Score)} ({Signed(delta)}). " +
            $"Потрачено {spent} из {ScenarioData.Budget}. " +
            $"Средневзвешенная оценка районов {F(result.AverageScore)}, самый слабый район — {weakest.District.Name} ({F(result.MinDistrictScore)}), " +
            $"критических значений ниже {F(ScenarioData.CriticalThreshold)}: {result.CriticalCount}.";

        var strengths = new List<Claim>();

        // Gains of displayed (rounded) district scores. Only the top value is "наибольший"; ties are named as a group.
        var gains = result.Districts
            .Select((s, i) => (s.District, Gain: ScoreCalculator.Round(ScoreCalculator.Round(s.Score) - ScoreCalculator.Round(baseline.Districts[i].Score))))
            .Where(x => x.Gain > 0)
            .OrderByDescending(x => x.Gain)
            .ThenBy(x => x.District.Id, StringComparer.Ordinal)
            .ToList();
        if (gains.Count > 0)
        {
            var leaders = gains.Where(x => x.Gain == gains[0].Gain).ToList();
            strengths.Add(leaders.Count == 1
                ? new Claim($"gain_{leaders[0].District.Id}",
                    $"Наибольший рост оценки района — {leaders[0].District.Name}: {Signed(leaders[0].Gain)}.")
                : new Claim($"gain_leaders",
                    $"Наибольший рост оценки района, одинаковый ({Signed(leaders[0].Gain)}), — у районов {string.Join(", ", leaders.Select(x => x.District.Name))}."));
            foreach (var (district, gain) in gains.Skip(leaders.Count).Take(MaxDistrictGainClaims - 1))
            {
                strengths.Add(new Claim($"gain_{district.Id}", $"Рост оценки района {district.Name}: {Signed(gain)}."));
            }
        }

        foreach (var synergy in result.AppliedSynergies)
        {
            strengths.Add(new Claim(
                $"synergy_{string.Join("_", synergy.MeasureIds)}",
                $"Сработала синергия {string.Join(" + ", synergy.MeasureIds)}: {synergy.IndicatorId} {Signed(synergy.Delta)} в районе {DistrictName(synergy.DistrictId)}."));
        }

        if (result.CriticalCount < baseline.CriticalCount)
        {
            strengths.Add(new Claim("critical_reduced",
                $"Критических значений стало меньше: {baseline.CriticalCount} → {result.CriticalCount} (каждое стоит −1 балл)."));
        }

        var risks = new List<Claim>();
        foreach (var (district, indicatorId, value) in CriticalValues(result))
        {
            risks.Add(new Claim($"critical_{district.Id}_{indicatorId}",
                $"В районе {district.Name} показатель {indicatorId} остаётся ниже порога: {F(value)}."));
        }

        risks.Add(new Claim("weakest_district",
            $"Самый слабый район {weakest.District.Name} ({F(weakest.Score)}) определяет 30% итогового балла."));

        var slowMeasures = choices.Where(c => c.Measure.LagQuarters >= 3).Select(c => c.Measure.Id).ToList();
        if (slowMeasures.Count > 0)
        {
            risks.Add(new Claim("long_lag",
                $"Меры с долгим лагом ({string.Join(", ", slowMeasures)}) реализуют лишь часть эффекта за горизонт {ScenarioData.HorizonQuarters} кварталов."));
        }

        // Leave-one-out contribution of every chosen measure: positive ones are strengths, the rest are risks.
        foreach (var choice in choices.OrderBy(c => int.Parse(c.Measure.Id.AsSpan(1))))
        {
            var impact = ScoreCalculator.Round(ScoreCalculator.ScoreImpact(choices, choice, result.Score));
            var where = choice.District?.Name ?? ReplacementAdvisor.CityWide;
            if (impact > 0)
            {
                strengths.Add(new Claim($"impact_{choice.Measure.Id}",
                    $"Вклад {choice.Measure.Id} ({where}) в итог: {Signed(impact)} к Score по сравнению с тем же набором без этой меры."));
            }
            else
            {
                risks.Add(new Claim($"low_impact_{choice.Measure.Id}",
                    $"{choice.Measure.Id} ({where}) не повышает Score: {Signed(impact)} по сравнению с тем же набором без этой меры."));
            }
        }

        return new ClaimCatalog(summary, strengths, risks);
    }

    private static DistrictState Weakest(SimulationOutcome outcome) => outcome.Districts.MinBy(s => s.Score)!;

    private static IEnumerable<(District District, string IndicatorId, double Value)> CriticalValues(SimulationOutcome outcome) =>
        outcome.Districts.SelectMany(s => s.Indicators
            .Where(kv => kv.Value < ScenarioData.CriticalThreshold)
            .Select(kv => (s.District, kv.Key, kv.Value)));

    private static string DistrictName(string id) => ScenarioData.DistrictsById[id].Name;
}
