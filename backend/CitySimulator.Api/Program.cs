var builder = WebApplication.CreateBuilder(args);

builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();
builder.Services.AddCors(options =>
    options.AddPolicy("LocalFrontend", policy =>
        policy.WithOrigins("http://localhost:3000")
            .AllowAnyHeader()
            .AllowAnyMethod()));

var app = builder.Build();

app.UseCors("LocalFrontend");
app.UseSwagger();
app.UseSwaggerUI();

app.MapGet("/health", () => TypedResults.Ok(new HealthStatus("ok")))
    .WithName("GetHealth")
    .WithTags("System");

app.Run();

record HealthStatus(string Status);
