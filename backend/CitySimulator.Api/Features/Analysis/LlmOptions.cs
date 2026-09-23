namespace CitySimulator.Api.Features.Analysis;

/// <summary>
/// Read from environment variables. The key is never logged; only <see cref="HasApiKey"/> is.
/// </summary>
public sealed class LlmOptions
{
    public const string LiveMode = "live";
    public const string MockMode = "mock";
    public const string DefaultBaseUrl = "https://api.openai.com/v1/";

    public string Mode { get; init; } = MockMode;
    public string? ApiKey { get; init; }
    public string? Model { get; init; }
    public string BaseUrl { get; init; } = DefaultBaseUrl;
    /// <summary>Deadline for the whole live analysis, all attempts and backoffs included.</summary>
    public TimeSpan TotalTimeout { get; init; } = TimeSpan.FromSeconds(60);
    public int MaxRetries { get; init; } = 2;

    public bool HasApiKey => !string.IsNullOrWhiteSpace(ApiKey);

    public bool IsLiveReady =>
        string.Equals(Mode, LiveMode, StringComparison.OrdinalIgnoreCase) && HasApiKey && !string.IsNullOrWhiteSpace(Model);

    public static LlmOptions FromConfiguration(IConfiguration configuration)
    {
        var baseUrl = configuration["OPENAI_BASE_URL"];
        return new LlmOptions
        {
            Mode = configuration["LLM_MODE"]?.Trim().ToLowerInvariant() is { Length: > 0 } mode ? mode : MockMode,
            ApiKey = configuration["OPENAI_API_KEY"]?.Trim(),
            Model = configuration["OPENAI_MODEL"]?.Trim(),
            BaseUrl = string.IsNullOrWhiteSpace(baseUrl) ? DefaultBaseUrl : baseUrl.TrimEnd('/') + "/",
        };
    }
}
