using CitySimulator.Api.Features.Simulation;

namespace CitySimulator.Api.Features.Scenario;

public static class ScenarioEndpoints
{
    public static IEndpointRouteBuilder MapScenarioEndpoints(this IEndpointRouteBuilder app)
    {
        app.MapGet("/api/scenario", () => TypedResults.Ok(BuildResponse()))
            .WithName("GetScenario")
            .WithTags("Scenario")
            .WithSummary("Исходные данные: бюджет, показатели, районы, меры и правила.");

        return app;
    }

    internal static ScenarioResponse BuildResponse() => new(
                ScenarioData.Budget,
                ScenarioData.HorizonQuarters,
                ScenarioData.ChoicesRequired,
                ScenarioData.MaxMeasuresPerCategory,
                ScenarioData.CriticalThreshold,
                ScoreCalculator.Round(ScoreCalculator.Baseline.Score),
                ScenarioData.Indicators,
                ScenarioData.Districts,
                ScenarioData.Measures,
                ScenarioData.Synergies,
                ScenarioData.Incompatibilities);
}
