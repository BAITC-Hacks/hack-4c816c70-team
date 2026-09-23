using CitySimulator.Api.Features.Scenario;

namespace CitySimulator.Api.Features.Simulation;

/// <summary>
/// One swap applied on its own. <c>ReplaceDistrict</c> is where the removed measure was;
/// <c>WithDistrict</c> is where the new measure goes ("все районы" for city measures).
/// </summary>
public sealed record ReplacementOption(
    string ReplaceMeasureId,
    string ReplaceMeasureName,
    string? ReplaceDistrictId,
    string ReplaceDistrict,
    string WithMeasureId,
    string WithMeasureName,
    string? WithDistrictId,
    string WithDistrict,
    int SpentAfter,
    double ScoreAfter,
    double ScoreDelta);

/// <summary>
/// Single-swap alternatives that improve Score. Every candidate set passes <see cref="ChoiceValidator"/>
/// (budget, category limit, scope, incompatibilities) and is scored by <see cref="ScoreCalculator"/>.
/// </summary>
public static class ReplacementAdvisor
{
    public const string CityWide = "все районы";

    public static IReadOnlyList<ReplacementOption> Find(IReadOnlyList<ValidatedChoice> choices, double currentScore, int max = 5)
    {
        var current = ScoreCalculator.Round(currentScore);
        var options = new List<ReplacementOption>();

        foreach (var replaced in choices)
        {
            var others = choices.Where(c => c != replaced).ToList();
            foreach (var measure in ScenarioData.Measures)
            {
                if (others.Any(c => c.Measure.Id == measure.Id))
                {
                    continue;
                }

                var districts = measure.Scope == MeasureScope.District
                    ? ScenarioData.Districts.Cast<District?>()
                    : new District?[] { null };
                foreach (var district in districts)
                {
                    if (measure.Id == replaced.Measure.Id && district?.Id == replaced.District?.Id)
                    {
                        continue;
                    }

                    var request = new EvaluateRequest(others
                        .Select(c => new MeasureChoice(c.Measure.Id, c.District?.Id))
                        .Append(new MeasureChoice(measure.Id, district?.Id))
                        .ToList());
                    var (validated, failure) = ChoiceValidator.Validate(request);
                    if (failure is not null)
                    {
                        continue;
                    }

                    var score = ScoreCalculator.Round(ScoreCalculator.Simulate(validated!).Score);
                    var delta = ScoreCalculator.Round(score - current);
                    if (delta <= 0)
                    {
                        continue;
                    }

                    options.Add(new ReplacementOption(
                        replaced.Measure.Id,
                        replaced.Measure.Name,
                        replaced.District?.Id,
                        replaced.District?.Name ?? CityWide,
                        measure.Id,
                        measure.Name,
                        district?.Id,
                        district?.Name ?? CityWide,
                        validated!.Sum(c => c.Measure.Cost),
                        score,
                        delta));
                }
            }
        }

        // Best district per (replace, with) pair, then the strongest swaps overall.
        return options
            .GroupBy(o => (o.ReplaceMeasureId, o.WithMeasureId))
            .Select(g => g.OrderByDescending(o => o.ScoreAfter).ThenBy(o => o.WithDistrictId).First())
            .OrderByDescending(o => o.ScoreAfter)
            .ThenBy(o => o.ReplaceMeasureId, StringComparer.Ordinal)
            .ThenBy(o => o.WithMeasureId, StringComparer.Ordinal)
            .Take(max)
            .ToList();
    }
}
