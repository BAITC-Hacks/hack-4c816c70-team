using CitySimulator.Api.Features.Analysis;
using CitySimulator.Api.Features.Scenario;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.AspNetCore.Mvc;

namespace CitySimulator.Api.Features.Simulation;

public static class SimulationEndpoints
{
    public static IEndpointRouteBuilder MapSimulationEndpoints(this IEndpointRouteBuilder app)
    {
        app.MapPost("/api/simulations/evaluate", Evaluate)
            .WithName("EvaluateSimulation")
            .WithTags("Simulation")
            .WithSummary("Проверяет набор из 5 решений и считает Astana Quality of Life Score.")
            .WithDescription("Accept-Language selects explanation text: ru-RU (default), kk-KZ or en-US. "
                + "Quality weights and short language tags are supported. "
                + "explanationLocale and Content-Language report the actual locale, including mock/fallback. "
                + "Request body and numeric results are independent of language.");

        return app;
    }

    private static async Task<Results<Ok<EvaluateResponse>, BadRequest<ErrorResponse>, UnprocessableEntity<ErrorResponse>>> Evaluate(
        EvaluateRequest request,
        ExplanationService explanationService,
        HttpContext httpContext,
        CancellationToken cancellationToken,
        [FromHeader(Name = "Accept-Language")] string? acceptLanguage = null)
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

        var locale = ExplanationLocales.Resolve(acceptLanguage);
        var (explanation, source) = await explanationService.ExplainAsync(choices!, baseline, result, spent, locale, cancellationToken);
        httpContext.Response.Headers.ContentLanguage = locale;

        return TypedResults.Ok(new EvaluateResponse(
            spent,
            ScenarioData.Budget - spent,
            ScoreCalculator.Round(baseline.Score),
            ScoreCalculator.Round(result.Score),
            Breakdown(result),
            Breakdown(baseline),
            districts,
            result.AppliedSynergies,
            explanation,
            source,
            locale));
    }

    private static ScoreBreakdown Breakdown(SimulationOutcome outcome) => new(
        ScoreCalculator.Round(outcome.AverageScore),
        ScoreCalculator.Round(outcome.MinDistrictScore),
        outcome.CriticalCount);

    private static IReadOnlyDictionary<string, double> RoundAll(IReadOnlyDictionary<string, double> values) =>
        values.ToDictionary(kv => kv.Key, kv => ScoreCalculator.Round(kv.Value));
}
