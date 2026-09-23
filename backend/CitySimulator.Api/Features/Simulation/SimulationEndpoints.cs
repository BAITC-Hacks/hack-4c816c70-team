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

        app.MapPost("/api/simulations/alternatives", Alternatives)
            .WithName("FindSimulationAlternatives")
            .WithTags("Simulation")
            .WithSummary("Лучший найденный вариант среди замен одной меры (searchScope=single_swap) для цели score, equity или economy.")
            .WithDescription("Checks all 265 single-measure replacements of a valid plan (including moving a district measure) "
                + "with the same validation and Score formula as /evaluate. goal: score (max Score), equity (max weakest district score), "
                + "economy (min spent). A variant is offered only when it strictly improves its goal on 2-decimal values; otherwise "
                + "bestByGoal.<goal> is null and recommendation.status is no_improvement. Not a global optimum. "
                + "Accept-Language (ru-RU default, kk-KZ, en-US) changes only text; locale and Content-Language report it. "
                + "In live mode at most one OpenAI request selects IDs; recommendation.source is llm or mock.");

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

        var locale = ExplanationLocales.Resolve(acceptLanguage);
        var (explanation, source) = await explanationService.ExplainAsync(choices!, baseline, result, spent, locale, cancellationToken);
        httpContext.Response.Headers.ContentLanguage = locale;
        return TypedResults.Ok(BuildResponse(choices!, baseline, result, explanation, source, locale));
    }

    private static async Task<Results<Ok<AlternativesResponse>, BadRequest<ErrorResponse>, UnprocessableEntity<ErrorResponse>>> Alternatives(
        AlternativesRequest request,
        AlternativeAdviceService adviceService,
        HttpContext httpContext,
        CancellationToken cancellationToken,
        [FromHeader(Name = "Accept-Language")] string? acceptLanguage = null)
    {
        var (choices, failure) = ValidateAlternatives(request);
        if (failure is not null)
        {
            var error = new ErrorResponse(new ApiError(failure.Code, failure.Message));
            return failure.StatusCode == StatusCodes.Status422UnprocessableEntity
                ? TypedResults.UnprocessableEntity(error)
                : TypedResults.BadRequest(error);
        }

        var locale = ExplanationLocales.Resolve(acceptLanguage);
        var response = await adviceService.AdviseAsync(choices!, request.Goal!, locale, cancellationToken);
        httpContext.Response.Headers.ContentLanguage = locale;
        return TypedResults.Ok(response);
    }

    /// <summary>Presence of choices, then goal, then every /evaluate rule in the same order.</summary>
    internal static (IReadOnlyList<ValidatedChoice>? Choices, ValidationFailure? Failure) ValidateAlternatives(AlternativesRequest? request)
    {
        if (request?.Choices is null)
        {
            return ChoiceValidator.Validate(null);
        }

        if (request.Goal is null || !AlternativeGoals.All.Contains(request.Goal))
        {
            return (null, new ValidationFailure(StatusCodes.Status400BadRequest, ChoiceValidator.Codes.InvalidGoal,
                $"Поле goal должно быть одним из значений: {string.Join(", ", AlternativeGoals.All)}."));
        }

        return ChoiceValidator.Validate(new EvaluateRequest(request.Choices));
    }

    // Swagger examples and the HTTP endpoint use the same response mapping.
    public static EvaluateResponse BuildResponse(IReadOnlyList<ValidatedChoice> choices,
        SimulationOutcome baseline, SimulationOutcome result, Explanation explanation, string source,
        string locale = ExplanationLocales.Russian)
    {
        var spent = choices.Sum(c => c.Measure.Cost);
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

        return new EvaluateResponse(
            spent,
            ScenarioData.Budget - spent,
            ScoreCalculator.Round(baseline.Score),
            ScoreCalculator.Round(result.Score),
            Breakdown(result),
            Breakdown(baseline),
            districts,
            result.AppliedSynergies,
            result.AppliedEffects.Select(e => e with { Delta = ScoreCalculator.Round(e.Delta) }).ToList(),
            explanation,
            source,
            locale);
    }

    private static ScoreBreakdown Breakdown(SimulationOutcome outcome) => new(
        ScoreCalculator.Round(outcome.AverageScore),
        ScoreCalculator.Round(outcome.MinDistrictScore),
        outcome.CriticalCount);

    private static IReadOnlyDictionary<string, double> RoundAll(IReadOnlyDictionary<string, double> values) =>
        values.ToDictionary(kv => kv.Key, kv => ScoreCalculator.Round(kv.Value));
}
