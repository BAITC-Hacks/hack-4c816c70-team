using CitySimulator.Api.Features.Scenario;
using CitySimulator.Api.Features.Simulation;
using Microsoft.AspNetCore.Diagnostics;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();
builder.Services.AddCors(options =>
    options.AddPolicy("LocalFrontend", policy =>
        policy.WithOrigins("http://localhost:3000")
            .AllowAnyHeader()
            .AllowAnyMethod()));
// Malformed JSON or a missing body must also return the JSON error contract instead of an empty 400.
builder.Services.Configure<RouteHandlerOptions>(options => options.ThrowOnBadRequest = true);

var app = builder.Build();

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
