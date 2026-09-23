namespace CitySimulator.Api.Features.Scenario;

public static class MeasureScope
{
    public const string District = "district";
    public const string City = "city";
}

public sealed record Indicator(string Id, string Name, string Category, double Weight);

public sealed record District(
    string Id,
    string Name,
    double PopulationShare,
    IReadOnlyDictionary<string, double> Indicators);

public sealed record Measure(
    string Id,
    string Category,
    string Name,
    string Scope,
    int Cost,
    int LagQuarters,
    IReadOnlyDictionary<string, double> Effects);

public sealed record Synergy(string FirstMeasureId, string SecondMeasureId, string IndicatorId, double Bonus);

public sealed record Incompatibility(string FirstMeasureId, string SecondMeasureId, bool SameDistrictOnly, string Reason);

public sealed record ScenarioResponse(
    int Budget,
    int HorizonQuarters,
    int ChoicesRequired,
    int MaxMeasuresPerCategory,
    double CriticalThreshold,
    double BaselineScore,
    IReadOnlyList<Indicator> Indicators,
    IReadOnlyList<District> Districts,
    IReadOnlyList<Measure> Measures,
    IReadOnlyList<Synergy> Synergies,
    IReadOnlyList<Incompatibility> Incompatibilities);
