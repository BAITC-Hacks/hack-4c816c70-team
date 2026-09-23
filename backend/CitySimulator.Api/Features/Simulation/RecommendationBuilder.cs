using System.Globalization;
using CitySimulator.Api.Features.Scenario;

namespace CitySimulator.Api.Features.Simulation;

/// <summary>
/// Server-side recommendations from <see cref="ReplacementAdvisor"/> options only. Used in both mock and live
/// modes, so measure ids, districts, Score and cost in recommendations are never written by the LLM.
/// </summary>
public static class RecommendationBuilder
{
    public const int MaxOptions = 3;

    public static IReadOnlyList<string> Build(IReadOnlyList<ReplacementOption> alternatives)
    {
        if (alternatives.Count == 0)
        {
            return ["Ни одна допустимая замена одной меры не повышает Score — отдельной заменой набор не улучшить."];
        }

        var items = alternatives
            .Take(MaxOptions)
            .Select(a => $"{Action(a)} При этой отдельной замене Score {F(a.ScoreAfter)} ({Signed(a.ScoreDelta)}), " +
                         $"расходы {a.SpentAfter} из {ScenarioData.Budget}.")
            .ToList();
        items.Add("Варианты замен независимы и применяются по отдельности: их эффекты не суммируются.");
        return items;
    }

    private static string Action(ReplacementOption a) =>
        a.ReplaceMeasureId == a.WithMeasureId
            ? $"Перенести {a.ReplaceMeasureId}: {a.ReplaceDistrict} → {a.WithDistrict}."
            : $"Заменить {a.ReplaceMeasureId} ({a.ReplaceDistrict}) на {a.WithMeasureId} ({a.WithDistrict}).";

    private static string F(double value) =>
        ScoreCalculator.Round(value).ToString("0.##", CultureInfo.InvariantCulture);

    private static string Signed(double value) => (value >= 0 ? "+" : "−") + F(Math.Abs(value));
}
