using CitySimulator.Api;
using CitySimulator.Api.Features.Analysis;
using CitySimulator.Api.Features.Scenario;
using CitySimulator.Api.Features.Simulation;
using Microsoft.AspNetCore.Diagnostics;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen(options => options.OperationFilter<ApiExamplesFilter>());
// FRONTEND_ORIGIN: one origin or a comma-separated list, e.g. http://localhost:3001.
var frontendOrigins = (builder.Configuration["FRONTEND_ORIGIN"] ?? string.Empty)
    .Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
    .Select(origin => origin.TrimEnd('/'))
    .DefaultIfEmpty("http://localhost:3000")
    .ToArray();
builder.Services.AddCors(options =>
    options.AddPolicy("LocalFrontend", policy =>
        policy.WithOrigins(frontendOrigins)
            .AllowAnyHeader()
            .AllowAnyMethod()));
// Malformed JSON or a missing body must also return the JSON error contract instead of an empty 400.
builder.Services.Configure<RouteHandlerOptions>(options => options.ThrowOnBadRequest = true);

var llmOptions = LlmOptions.FromConfiguration(builder.Configuration);
builder.Services.AddSingleton(llmOptions);
builder.Services.AddHttpClient<OpenAiExplanationClient>(client =>
{
    client.BaseAddress = new Uri(llmOptions.BaseUrl);
    // The 60 s deadline for all attempts and retries is enforced in OpenAiExplanationClient.
    client.Timeout = Timeout.InfiniteTimeSpan;
});
builder.Services.AddScoped<ExplanationService>();
builder.Services.AddScoped<AlternativeAdviceService>();

var app = builder.Build();

app.Logger.LogInformation(
    "CORS origins={Origins}; LLM mode={Mode}, apiKeyPresent={HasKey}, model={Model}, liveReady={LiveReady}",
    string.Join(",", frontendOrigins), llmOptions.Mode, llmOptions.HasApiKey, llmOptions.Model ?? "(not set)", llmOptions.IsLiveReady);
if (llmOptions.Mode == LlmOptions.LiveMode && !llmOptions.IsLiveReady)
{
    app.Logger.LogWarning("LLM_MODE=live requires OPENAI_API_KEY and OPENAI_MODEL; using deterministic mock explanation");
}

app.UseExceptionHandler(errorApp => errorApp.Run(async context =>
{
    var exception = context.Features.Get<IExceptionHandlerFeature>()?.Error;
    var (status, code, message) = exception is BadHttpRequestException bad
        ? (bad.StatusCode, ChoiceValidator.Codes.InvalidRequest, "Некорректное тело запроса: ожидается JSON с массивом choices.")
        : (StatusCodes.Status500InternalServerError, "INTERNAL_ERROR", "Внутренняя ошибка сервера.");
    context.Response.StatusCode = status;
    await context.Response.WriteAsJsonAsync(new ErrorResponse(new ApiError(code, message)));
}));
app.UseCors("LocalFrontend");
app.UseSwagger();
app.UseSwaggerUI();

app.MapGet("/health", () => TypedResults.Ok(new HealthStatus("ok")))
    .WithName("GetHealth")
    .WithTags("System");
app.MapScenarioEndpoints();
app.MapSimulationEndpoints();

app.Run();

record HealthStatus(string Status);
