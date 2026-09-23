using CitySimulator.Api.Features.Scenario;
using CitySimulator.Api.Features.Simulation;

namespace CitySimulator.Api.Features.Analysis;

/// <summary>
/// Everything the LLM may cite. Every number here is produced by <see cref="ScoreCalculator"/> and rounded to 2 decimals.
/// </summary>
public sealed record AnalysisFacts(
    ScenarioFacts Scenario,
    ResultFacts Result,
    IReadOnlyList<DistrictFacts> Districts,
    IReadOnlyList<MeasureFacts> Measures,
    IReadOnlyList<SynergyFacts> Synergies,
    IReadOnlyList<CriticalValueFacts> CriticalValues)
{
    public static AnalysisFacts Build(
        IReadOnlyList<ValidatedChoice> choices,
        SimulationOutcome baseline,
        SimulationOutcome result,
        int spent)
    {
        var r = ScoreCalculator.Round;
        // Deltas of already rounded values, so they match what the client displays (56.54 − 52.56 = 3.98).
        double Delta(double after, double before) => r(r(after) - r(before));
        var indicatorNames = ScenarioData.Indicators.ToDictionary(i => i.Id, i => i.Name);

        var scenario = new ScenarioFacts(
            ScenarioData.Budget,
            ScenarioData.HorizonQuarters,
            ScenarioData.CriticalThreshold,
            "Score = 0.7 × средневзвешенная по населению оценка районов + 0.3 × оценка самого слабого района − 1 × число значений показателей ниже 40.");

        var resultFacts = new ResultFacts(
            r(result.Score), r(baseline.Score), Delta(result.Score, baseline.Score),
            spent, ScenarioData.Budget - spent,
            r(result.AverageScore), r(baseline.AverageScore),
            r(result.MinDistrictScore), r(baseline.MinDistrictScore),
            result.CriticalCount, baseline.CriticalCount);

        var districts = result.Districts.Select((after, i) =>
        {
            var before = baseline.Districts[i];
            return new DistrictFacts(
                after.District.Id,
                after.District.Name,
                after.District.PopulationShare,
                r(before.Score), r(after.Score), Delta(after.Score, before.Score),
                ScenarioData.Indicators.Select(ind => new IndicatorFacts(
                    ind.Id,
                    ind.Name,
                    r(before.Indicators[ind.Id]),
                    r(after.Indicators[ind.Id]),
                    Delta(after.Indicators[ind.Id], before.Indicators[ind.Id]),
                    after.Indicators[ind.Id] < ScenarioData.CriticalThreshold)).ToList());
        }).ToList();

        var measures = choices
            .OrderBy(c => int.Parse(c.Measure.Id.AsSpan(1)))
            .Select(c => new MeasureFacts(
                c.Measure.Id,
                c.Measure.Name,
                c.Measure.Category,
                c.Measure.Scope,
                c.District?.Name ?? "все районы",
                c.Measure.Cost,
                c.Measure.LagQuarters,
                ScoreCalculator.RealizedShare(c.Measure),
                ScoreCalculator.RealizedEffects(c.Measure).ToDictionary(e => e.Key, e => r(e.Value)),
                r(ScoreCalculator.ScoreImpact(choices, c, result.Score))))
            .ToList();

        var synergies = result.AppliedSynergies
            .Select(s => new SynergyFacts(s.MeasureIds, ScenarioData.DistrictsById[s.DistrictId].Name, s.IndicatorId, s.Delta))
            .ToList();

        var critical = result.Districts
            .SelectMany(s => s.Indicators
                .Where(kv => kv.Value < ScenarioData.CriticalThreshold)
                .Select(kv => new CriticalValueFacts(s.District.Name, kv.Key, indicatorNames[kv.Key], r(kv.Value))))
            .ToList();

        return new AnalysisFacts(scenario, resultFacts, districts, measures, synergies, critical);
    }
}

public sealed record ScenarioFacts(int Budget, int HorizonQuarters, double CriticalThreshold, string Formula);

public sealed record ResultFacts(
    double Score, double BaselineScore, double ScoreDelta,
    int Spent, int Remaining,
    double AverageScore, double AverageScoreBefore,
    double MinDistrictScore, double MinDistrictScoreBefore,
    int CriticalCount, int CriticalCountBefore);

public sealed record DistrictFacts(
    string Id, string Name, double PopulationShare,
    double ScoreBefore, double ScoreAfter, double ScoreDelta,
    IReadOnlyList<IndicatorFacts> Indicators);

public sealed record IndicatorFacts(string Id, string Name, double Before, double After, double Delta, bool Critical);

public sealed record MeasureFacts(
    string Id, string Name, string Category, string Scope, string District,
    int Cost, int LagQuarters, double RealizedShare,
    IReadOnlyDictionary<string, double> RealizedEffects,
    double ScoreImpact);

public sealed record SynergyFacts(IReadOnlyList<string> MeasureIds, string District, string IndicatorId, double Delta);

public sealed record CriticalValueFacts(string District, string IndicatorId, string IndicatorName, double Value);
