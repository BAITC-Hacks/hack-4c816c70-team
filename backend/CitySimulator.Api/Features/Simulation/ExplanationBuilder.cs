using System.Globalization;
using CitySimulator.Api.Features.Scenario;

namespace CitySimulator.Api.Features.Simulation;

/// <summary>
/// Deterministic, template-based explanation of already computed numbers. Works without an LLM key.
/// </summary>
public static class ExplanationBuilder
{
    public static Explanation Build(
        IReadOnlyList<ValidatedChoice> choices,
        SimulationOutcome baseline,
        SimulationOutcome result,
        int spent)
    {
        var delta = ScoreCalculator.Round(result.Score) - ScoreCalculator.Round(baseline.Score);
        var summary =
            $"Итоговый Score {F(result.Score)} против базового {F(baseline.Score)} ({Signed(delta)}). " +
            $"Потрачено {spent} из {ScenarioData.Budget}. " +
            $"Средневзвешенная оценка районов {F(result.AverageScore)}, самый слабый район — {Weakest(result).District.Name} ({F(result.MinDistrictScore)}), " +
            $"критических значений ниже {F(ScenarioData.CriticalThreshold)}: {result.CriticalCount}.";

        var strengths = new List<string>();
        var gains = result.Districts
            .Select((s, i) => (State: s, Gain: s.Score - baseline.Districts[i].Score))
            .Where(x => x.Gain > 0.005)
            .OrderByDescending(x => x.Gain)
            .Take(2);
        foreach (var (state, gain) in gains)
        {
            strengths.Add($"Наибольший рост в районе {state.District.Name}: {Signed(gain)} к оценке района.");
        }

        foreach (var synergy in result.AppliedSynergies)
        {
            strengths.Add(
                $"Сработала синергия {string.Join(" + ", synergy.MeasureIds)}: {synergy.IndicatorId} {Signed(synergy.Delta)} в районе {DistrictName(synergy.DistrictId)}.");
        }

        if (result.CriticalCount < baseline.CriticalCount)
        {
            strengths.Add(
                $"Критических значений стало меньше: {baseline.CriticalCount} → {result.CriticalCount} (каждое стоит −1 балл).");
        }

        var risks = new List<string>();
        var criticals = CriticalValues(result).ToList();
        foreach (var (district, indicatorId, value) in criticals)
        {
            risks.Add($"В районе {district.Name} показатель {indicatorId} остаётся ниже порога: {F(value)}.");
        }

        var weakest = Weakest(result);
        risks.Add(
            $"Самый слабый район {weakest.District.Name} ({F(weakest.Score)}) определяет 30% итогового балла.");

        var slowMeasures = choices.Where(c => c.Measure.LagQuarters >= 3).Select(c => c.Measure.Id).ToList();
        if (slowMeasures.Count > 0)
        {
            risks.Add(
                $"Меры с долгим лагом ({string.Join(", ", slowMeasures)}) реализуют лишь часть эффекта за горизонт {ScenarioData.HorizonQuarters} кварталов.");
        }

        var recommendations = new List<string>();
        var chosenIds = choices.Select(c => c.Measure.Id).ToHashSet();
        foreach (var group in criticals.GroupBy(c => c.IndicatorId))
        {
            var options = ScenarioData.Measures
                .Where(m => !chosenIds.Contains(m.Id) && m.Effects.TryGetValue(group.Key, out var e) && e > 0)
                .Select(m => $"{m.Id} (стоимость {m.Cost})")
                .ToList();
            if (options.Count > 0)
            {
                recommendations.Add(
                    $"Для {group.Key} в районах {string.Join(", ", group.Select(c => c.District.Name))} рассмотрите: {string.Join(", ", options)}.");
            }
        }

        var remaining = ScenarioData.Budget - spent;
        if (remaining >= 10)
        {
            recommendations.Add(
                $"Остаток {remaining} не даёт бонуса — его можно направить на более дорогую меру с большим эффектом.");
        }

        if (recommendations.Count == 0)
        {
            recommendations.Add("Сравните набор с альтернативами, заменив меру с наименьшим вкладом.");
        }

        return new Explanation(summary, strengths, risks, recommendations);
    }

    private static DistrictState Weakest(SimulationOutcome outcome) => outcome.Districts.MinBy(s => s.Score)!;

    private static IEnumerable<(District District, string IndicatorId, double Value)> CriticalValues(SimulationOutcome outcome) =>
        outcome.Districts.SelectMany(s => s.Indicators
            .Where(kv => kv.Value < ScenarioData.CriticalThreshold)
            .Select(kv => (s.District, kv.Key, kv.Value)));

    private static string DistrictName(string id) => ScenarioData.DistrictsById[id].Name;

    private static string F(double value) =>
        ScoreCalculator.Round(value).ToString("0.##", CultureInfo.InvariantCulture);

    private static string Signed(double value) => (value >= 0 ? "+" : "−") + F(Math.Abs(value));
}
