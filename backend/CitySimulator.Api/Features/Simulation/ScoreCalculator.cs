using CitySimulator.Api.Features.Scenario;

namespace CitySimulator.Api.Features.Simulation;

public sealed record DistrictState(District District, IReadOnlyDictionary<string, double> Indicators, double Score);

public sealed record SimulationOutcome(
    IReadOnlyList<DistrictState> Districts,
    double AverageScore,
    double MinDistrictScore,
    int CriticalCount,
    double Score,
    IReadOnlyList<AppliedSynergy> AppliedSynergies);

/// <summary>
/// Score formula from docs/reference/district-dataset.docx, section 3. Pure and order-independent.
/// </summary>
public static class ScoreCalculator
{
    private static readonly Lazy<SimulationOutcome> BaselineOutcome = new(() => Simulate([]));

    public static SimulationOutcome Baseline => BaselineOutcome.Value;

    public static double RealizedShare(Measure measure) =>
        (double)(ScenarioData.HorizonQuarters - measure.LagQuarters) / ScenarioData.HorizonQuarters;

    public static SimulationOutcome Simulate(IReadOnlyList<ValidatedChoice> choices)
    {
        // Sorting makes floating-point summation independent of the order in which decisions were sent.
        var ordered = choices
            .OrderBy(c => int.Parse(c.Measure.Id.AsSpan(1)))
            .ToList();

        var deltas = ScenarioData.Districts.ToDictionary(
            d => d.Id,
            _ => ScenarioData.Indicators.ToDictionary(i => i.Id, _ => 0.0));

        foreach (var choice in ordered)
        {
            var share = RealizedShare(choice.Measure);
            foreach (var districtId in TargetDistricts(choice))
            {
                foreach (var (indicatorId, effect) in choice.Measure.Effects)
                {
                    deltas[districtId][indicatorId] += effect * share;
                }
            }
        }

        var appliedSynergies = new List<AppliedSynergy>();
        foreach (var synergy in ScenarioData.Synergies)
        {
            var first = ordered.FirstOrDefault(c => c.Measure.Id == synergy.FirstMeasureId);
            var second = ordered.FirstOrDefault(c => c.Measure.Id == synergy.SecondMeasureId);
            if (first is null || second is null)
            {
                continue;
            }

            foreach (var districtId in TargetDistricts(first))
            {
                deltas[districtId][synergy.IndicatorId] += synergy.Bonus;
                appliedSynergies.Add(new AppliedSynergy(
                    [synergy.FirstMeasureId, synergy.SecondMeasureId], districtId, synergy.IndicatorId, synergy.Bonus));
            }
        }

        var states = ScenarioData.Districts
            .Select(d =>
            {
                var values = ScenarioData.Indicators.ToDictionary(
                    i => i.Id,
                    i => Math.Clamp(d.Indicators[i.Id] + deltas[d.Id][i.Id], 0, 100));
                var score = ScenarioData.Indicators.Sum(i => i.Weight * values[i.Id]);
                return new DistrictState(d, values, score);
            })
            .ToList();

        var average = states.Sum(s => s.District.PopulationShare * s.Score);
        var min = states.Min(s => s.Score);
        var critical = states.Sum(s => s.Indicators.Values.Count(v => v < ScenarioData.CriticalThreshold));
        var total = ScenarioData.AverageWeight * average
                    + ScenarioData.MinDistrictWeight * min
                    - ScenarioData.CriticalPenalty * critical;

        return new SimulationOutcome(states, average, min, critical, total, appliedSynergies);
    }

    /// <summary>
    /// Leave-one-out contribution: full Score minus Score of the same set without this measure
    /// (includes synergies that the measure enables).
    /// </summary>
    public static double ScoreImpact(IReadOnlyList<ValidatedChoice> choices, ValidatedChoice measure, double fullScore) =>
        fullScore - Simulate(choices.Where(c => c != measure).ToList()).Score;

    /// <summary>Lag-adjusted effects of one measure per affected district, before clipping and synergies.</summary>
    public static IReadOnlyDictionary<string, double> RealizedEffects(Measure measure) =>
        measure.Effects.ToDictionary(e => e.Key, e => e.Value * RealizedShare(measure));

    private static IEnumerable<string> TargetDistricts(ValidatedChoice choice) =>
        choice.Measure.Scope == MeasureScope.City
            ? ScenarioData.Districts.Select(d => d.Id)
            : [choice.District!.Id];

    public static double Round(double value) => Math.Round(value, 2, MidpointRounding.AwayFromZero);
}
