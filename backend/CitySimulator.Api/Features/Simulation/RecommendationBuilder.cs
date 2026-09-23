using CitySimulator.Api.Features.Scenario;
using static CitySimulator.Api.Features.Simulation.TextNumberFormat;

namespace CitySimulator.Api.Features.Simulation;

/// <summary>
/// Server-side recommendations from <see cref="ReplacementAdvisor"/> options only, localized in both modes.
/// Measure IDs, districts, Score and cost in recommendations are never written by the LLM.
/// </summary>
public static class RecommendationBuilder
{
    public const int MaxOptions = 3;

    public static IReadOnlyList<string> Build(
        IReadOnlyList<ReplacementOption> alternatives,
        string locale = ExplanationLocales.Russian)
    {
        if (alternatives.Count == 0)
        {
            return [ExplanationText.Format(locale, "no_improvement")];
        }

        var items = alternatives
            .Take(MaxOptions)
            .Select(a => ExplanationText.Format(locale, "replacement_result", Action(a, locale),
                F(a.ScoreAfter, locale), Signed(a.ScoreDelta, locale), a.SpentAfter, ScenarioData.Budget))
            .ToList();
        items.Add(ExplanationText.Format(locale, "independent"));
        return items;
    }

    private static string Action(ReplacementOption a, string locale)
    {
        var from = ExplanationText.DistrictName(a.ReplaceDistrictId, locale);
        var to = ExplanationText.DistrictName(a.WithDistrictId, locale);
        return a.ReplaceMeasureId == a.WithMeasureId
            ? ExplanationText.Format(locale, "move", a.ReplaceMeasureId, from, to)
            : ExplanationText.Format(locale, "replace", a.ReplaceMeasureId, from, a.WithMeasureId, to);
    }
}
