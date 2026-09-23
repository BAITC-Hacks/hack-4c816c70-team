using System.Text.Json;
using CitySimulator.Api.Features.Analysis;
using CitySimulator.Api.Features.Scenario;
using CitySimulator.Api.Features.Simulation;
using Microsoft.OpenApi;
using Swashbuckle.AspNetCore.SwaggerGen;

namespace CitySimulator.Api;

/// <summary>Executable examples: values and error messages come from the actual calculation/validator.</summary>
public sealed class ApiExamplesFilter : IOperationFilter
{
    private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web);
    private static readonly MeasureChoice[] Control =
    [new("M7", "nura"), new("M8", "nura"), new("M10", "nura"), new("M12", null), new("M5", "saryarka")];

    public void Apply(OpenApiOperation operation, OperationFilterContext context)
    {
        if (context.ApiDescription.RelativePath == "api/scenario")
        {
            ResponseMedia(operation, "200").Examples = new Dictionary<string, IOpenApiExample>
            {
                ["baseline"] = Example(ScenarioEndpoints.BuildResponse(), "Полный сценарий; базовый Score 52,56"),
            };
        }
        else if (context.ApiDescription.RelativePath == "api/simulations/evaluate")
        {
            operation.RequestBody!.Content!["application/json"].Examples = new Dictionary<string, IOpenApiExample>
            {
                ["control"] = Example(new EvaluateRequest(Control), "Контрольный набор: 95 расходов, Score 56,54"),
            };
            var (choices, _) = ChoiceValidator.Validate(new EvaluateRequest(Control));
            var baseline = ScoreCalculator.Baseline;
            var result = ScoreCalculator.Simulate(choices!);
            var catalog = ExplanationBuilder.BuildCatalog(choices!, baseline, result, 95);
            var explanation = ExplanationBuilder.Assemble(catalog, catalog.Strengths.Select(c => c.Id).ToList(),
                catalog.Risks.Select(c => c.Id).ToList(), ReplacementAdvisor.Find(choices!, result.Score));
            ResponseMedia(operation, "200").Examples = new Dictionary<string, IOpenApiExample>
            {
                ["control"] = Example(SimulationEndpoints.BuildResponse(choices!, baseline, result, explanation, ExplanationSource.Mock),
                    "Полный контрольный ответ с районными показателями, эффектами и синергией"),
            };
            ResponseMedia(operation, "400").Examples = new Dictionary<string, IOpenApiExample>
            {
                ["wrongCount"] = Error(Control.Take(4).ToArray()),
                ["duplicate"] = Error([Control[0], Control[0], .. Control.Skip(2)]),
                ["unknownDistrict"] = Error([Control[0] with { DistrictId = "unknown" }, .. Control.Skip(1)]),
                ["incompatible"] = Error([new("M1", "nura"), new("M3", "yesil"), new("M10", "nura"), new("M11", "nura"), new("M12", null)]),
            };
            ResponseMedia(operation, "422").Examples = new Dictionary<string, IOpenApiExample>
            {
                ["overBudget"] = Error([Control[0], Control[1], new("M13", "almaty"), Control[3], Control[4]]),
            };
        }
        else if (context.ApiDescription.RelativePath == "api/simulations/alternatives")
        {
            var (choices, _) = ChoiceValidator.Validate(new EvaluateRequest(Control));
            var search = AlternativeSearch.Run(choices!);
            operation.RequestBody!.Content!["application/json"].Examples = AlternativeGoals.All.ToDictionary(goal => goal,
                goal => (IOpenApiExample)Example(new AlternativesRequest(Control, goal), $"Контрольный набор, goal={goal}"));
            ResponseMedia(operation, "200").Examples = AlternativeGoals.All.ToDictionary(goal => goal,
                goal => (IOpenApiExample)Example(AlternativeAdviceService.BuildResponse(search, goal, ExplanationLocales.Russian),
                    $"Контрольный набор, goal={goal}, mock (ru-RU)"));
            ResponseMedia(operation, "400").Examples = new Dictionary<string, IOpenApiExample>
            {
                ["invalidGoal"] = AlternativesError(new AlternativesRequest(Control, "fastest")),
                ["wrongCount"] = AlternativesError(new AlternativesRequest(Control.Take(4).ToArray(), AlternativeGoals.Score)),
            };
            ResponseMedia(operation, "422").Examples = new Dictionary<string, IOpenApiExample>
            {
                ["overBudget"] = AlternativesError(new AlternativesRequest(
                    [Control[0], Control[1], new("M13", "almaty"), Control[3], Control[4]], AlternativeGoals.Economy)),
            };
        }
    }

    private static OpenApiExample AlternativesError(AlternativesRequest request)
    {
        var (_, failure) = SimulationEndpoints.ValidateAlternatives(request);
        return Example(new ErrorResponse(new ApiError(failure!.Code, failure.Message)), failure.Code);
    }

    private static OpenApiMediaType ResponseMedia(OpenApiOperation operation, string status) =>
        operation.Responses![status].Content!["application/json"];

    private static OpenApiExample Error(MeasureChoice[] choices)
    {
        var (_, failure) = ChoiceValidator.Validate(new EvaluateRequest(choices));
        return Example(new ErrorResponse(new ApiError(failure!.Code, failure.Message)), failure.Code);
    }

    private static OpenApiExample Example(object value, string summary) => new()
    {
        Summary = summary,
        Value = JsonSerializer.SerializeToNode(value, JsonOptions),
    };
}
