using CitySimulator.Api.Features.Scenario;
using Microsoft.AspNetCore.Http.HttpResults;

namespace CitySimulator.Api.Features.Simulation;

public static class SimulationEndpoints
{
    public static IEndpointRouteBuilder MapSimulationEndpoints(this IEndpointRouteBuilder app)
    {
        app.MapPost("/api/simulations/evaluate", Evaluate)
            .WithName("EvaluateSimulation")
            .WithTags("Simulation")
            .WithSummary("Проверяет набор из 5 решений и считает Astana Quality of Life Score.");

        return app;
    }

    private static Results<Ok<EvaluateResponse>, BadRequest<ErrorResponse>, UnprocessableEntity<ErrorResponse>> Evaluate(
        EvaluateRequest request)
    {
        var (choices, failure) = ChoiceValidator.Validate(request);
        if (failure is not null)
        {
            var error = new ErrorResponse(new ApiError(failure.Code, failure.Message));
            return failure.StatusCode == StatusCodes.Status422UnprocessableEntity
                ? TypedResults.UnprocessableEntity(error)
                : TypedResults.BadRequest(error);
        }

        var baseline = ScoreCalculator.Baseline;
        var result = ScoreCalculator.Simulate(choices!);
        var spent = choices!.Sum(c => c.Measure.Cost);

        var districts = result.Districts
            .Select((after, i) =>
            {
                var before = baseline.Districts[i];
                return new DistrictResult(
                    after.District.Id,
                    after.District.Name,
                    ScoreCalculator.Round(before.Score),
                    ScoreCalculator.Round(after.Score),
                    RoundAll(before.Indicators),
                    RoundAll(after.Indicators));
            })
            .ToList();

        return TypedResults.Ok(new EvaluateResponse(
            spent,
            ScenarioData.Budget - spent,
            ScoreCalculator.Round(baseline.Score),
            ScoreCalculator.Round(result.Score),
            Breakdown(result),
            Breakdown(baseline),
            districts,
            result.AppliedSynergies,
            ExplanationBuilder.Build(choices!, baseline, result, spent)));
    }

    private static ScoreBreakdown Breakdown(SimulationOutcome outcome) => new(
        ScoreCalculator.Round(outcome.AverageScore),
        ScoreCalculator.Round(outcome.MinDistrictScore),
        outcome.CriticalCount);

    private static IReadOnlyDictionary<string, double> RoundAll(IReadOnlyDictionary<string, double> values) =>
        values.ToDictionary(kv => kv.Key, kv => ScoreCalculator.Round(kv.Value));
}
