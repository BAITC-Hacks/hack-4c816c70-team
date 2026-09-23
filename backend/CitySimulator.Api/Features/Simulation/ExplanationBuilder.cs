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
        IReadOnlyList<ReplacementOption> alternatives,
        string locale = ExplanationLocales.Russian)
    {
        var strengths = catalog.Strengths.ToDictionary(c => c.Id, c => c.Text);
        var risks = catalog.Risks.ToDictionary(c => c.Id, c => c.Text);
        return new Explanation(
            catalog.Summary,
            strengthOrder.Select(id => strengths[id]).ToList(),
            riskOrder.Select(id => risks[id]).ToList(),
            RecommendationBuilder.Build(alternatives, locale));
    }

    public static ClaimCatalog BuildCatalog(
        IReadOnlyList<ValidatedChoice> choices,
        SimulationOutcome baseline,
        SimulationOutcome result,
        int spent,
        string locale = ExplanationLocales.Russian)
    {
        var weakest = Weakest(result);
        var delta = ScoreCalculator.Round(result.Score) - ScoreCalculator.Round(baseline.Score);
        var summary = ExplanationText.Format(locale, "summary",
            F(result.Score, locale), F(baseline.Score, locale), Signed(delta, locale), spent, ScenarioData.Budget,
            F(result.AverageScore, locale), ExplanationText.DistrictName(weakest.District.Id, locale),
            F(result.MinDistrictScore, locale), F(ScenarioData.CriticalThreshold, locale), result.CriticalCount);

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
                    ExplanationText.Format(locale, "leading_gain", ExplanationText.DistrictName(leaders[0].District.Id, locale), Signed(leaders[0].Gain, locale)))
                : new Claim($"gain_leaders",
                    ExplanationText.Format(locale, "tied_gain", Signed(leaders[0].Gain, locale),
                        string.Join(", ", leaders.Select(x => ExplanationText.DistrictName(x.District.Id, locale))))));
            foreach (var (district, gain) in gains.Skip(leaders.Count).Take(MaxDistrictGainClaims - 1))
            {
                strengths.Add(new Claim($"gain_{district.Id}", ExplanationText.Format(locale, "district_gain",
                    ExplanationText.DistrictName(district.Id, locale), Signed(gain, locale))));
            }
        }

        foreach (var synergy in result.AppliedSynergies)
        {
            strengths.Add(new Claim(
                $"synergy_{string.Join("_", synergy.MeasureIds)}",
                ExplanationText.Format(locale, "synergy", string.Join(" + ", synergy.MeasureIds),
                    synergy.IndicatorId, Signed(synergy.Delta, locale), ExplanationText.DistrictName(synergy.DistrictId, locale))));
        }

        if (result.CriticalCount < baseline.CriticalCount)
        {
            strengths.Add(new Claim("critical_reduced",
                ExplanationText.Format(locale, "critical_reduced", baseline.CriticalCount, result.CriticalCount)));
        }

        var risks = new List<Claim>();
        foreach (var (district, indicatorId, value) in CriticalValues(result))
        {
            risks.Add(new Claim($"critical_{district.Id}_{indicatorId}",
                ExplanationText.Format(locale, "critical_risk", ExplanationText.DistrictName(district.Id, locale),
                    indicatorId, F(value, locale))));
        }

        risks.AddRange(NegativeEffects(choices, baseline, result, locale));

        risks.Add(new Claim("weakest_district",
            ExplanationText.Format(locale, "weakest_district", ExplanationText.DistrictName(weakest.District.Id, locale),
                F(weakest.Score, locale))));

        var slowMeasures = choices.Where(c => c.Measure.LagQuarters >= 3).Select(c => c.Measure.Id).ToList();
        if (slowMeasures.Count > 0)
        {
            risks.Add(new Claim("long_lag",
                ExplanationText.Format(locale, "long_lag", string.Join(", ", slowMeasures), ScenarioData.HorizonQuarters)));
        }

        // Leave-one-out contribution of every chosen measure: positive ones are strengths, the rest are risks.
        foreach (var choice in choices.OrderBy(c => int.Parse(c.Measure.Id.AsSpan(1))))
        {
            var impact = ScoreCalculator.Round(ScoreCalculator.ScoreImpact(choices, choice, result.Score));
            var where = ExplanationText.DistrictName(choice.District?.Id, locale);
            if (impact > 0)
            {
                strengths.Add(new Claim($"impact_{choice.Measure.Id}",
                    ExplanationText.Format(locale, "impact", choice.Measure.Id, where, Signed(impact, locale))));
            }
            else
            {
                risks.Add(new Claim($"low_impact_{choice.Measure.Id}",
                    ExplanationText.Format(locale, "low_impact", choice.Measure.Id, where, Signed(impact, locale))));
            }
        }

        return new ClaimCatalog(summary, strengths, risks);
    }

    /// <summary>
    /// Every negative lag-adjusted effect of every chosen measure, per affected district. The measure's own effect is
    /// reported separately from the indicator's total change, which other measures may offset. Shown even when the
    /// indicator stays above the critical threshold.
    /// </summary>
    private static IEnumerable<Claim> NegativeEffects(
        IReadOnlyList<ValidatedChoice> choices, SimulationOutcome baseline, SimulationOutcome result, string locale)
    {
        foreach (var choice in choices.OrderBy(c => int.Parse(c.Measure.Id.AsSpan(1))))
        {
            var negative = ScoreCalculator.RealizedEffects(choice.Measure)
                .Where(e => ScoreCalculator.Round(e.Value) < 0)
                .OrderBy(e => e.Key, StringComparer.Ordinal)
                .ToList();
            if (negative.Count == 0)
            {
                continue;
            }

            var districtIds = choice.District is null
                ? ScenarioData.Districts.Select(d => d.Id)
                : [choice.District.Id];
            foreach (var districtId in districtIds)
            {
                var before = baseline.Districts.First(s => s.District.Id == districtId).Indicators;
                var after = result.Districts.First(s => s.District.Id == districtId).Indicators;
                var where = choice.District is null
                    ? ExplanationText.Format(locale, "city_in_district", ExplanationText.DistrictName(districtId, locale))
                    : ExplanationText.DistrictName(districtId, locale);
                foreach (var (indicatorId, effect) in negative)
                {
                    var from = ScoreCalculator.Round(before[indicatorId]);
                    var to = ScoreCalculator.Round(after[indicatorId]);
                    var total = ScoreCalculator.Round(to - from);
                    yield return new Claim(
                        $"negative_{choice.Measure.Id}_{districtId}_{indicatorId}",
                        ExplanationText.Format(locale, total < 0 ? "negative_effect" : "negative_effect_offset",
                            choice.Measure.Id, where, indicatorId, Signed(effect, locale), Signed(total, locale),
                            F(from, locale), F(to, locale)));
                }
            }
        }
    }

    private static DistrictState Weakest(SimulationOutcome outcome) => outcome.Districts.MinBy(s => s.Score)!;

    private static IEnumerable<(District District, string IndicatorId, double Value)> CriticalValues(SimulationOutcome outcome) =>
        outcome.Districts.SelectMany(s => s.Indicators
            .Where(kv => kv.Value < ScenarioData.CriticalThreshold)
            .Select(kv => (s.District, kv.Key, kv.Value)));

}
