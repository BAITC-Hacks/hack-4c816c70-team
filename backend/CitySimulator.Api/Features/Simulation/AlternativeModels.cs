namespace CitySimulator.Api.Features.Simulation;

public static class AlternativeGoals
{
    public const string Score = "score";
    public const string Equity = "equity";
    public const string Economy = "economy";

    public static readonly IReadOnlyList<string> All = [Score, Equity, Economy];
}

public static class AlternativeStatus
{
    public const string Improved = "improved";
    public const string NoImprovement = "no_improvement";
}

public sealed record AlternativesRequest(IReadOnlyList<MeasureChoice>? Choices, string? Goal);

public sealed record DistrictScore(string Id, string Name, double Score);

/// <summary>Full plan with the same rounded numbers that <c>/evaluate</c> returns for these choices.</summary>
public sealed record PlanResult(
    IReadOnlyList<MeasureChoice> Choices,
    int Spent,
    int Remaining,
    double Score,
    ScoreBreakdown Breakdown,
    IReadOnlyList<DistrictScore> Districts);

public sealed record PlanChange(string Kind, MeasureChoice Removed, MeasureChoice Added, string Text);

/// <summary>Variant minus original, each value computed from rounded displayed values.</summary>
public sealed record PlanDelta(
    double Score,
    double AverageScore,
    double MinDistrictScore,
    int CriticalCount,
    int Spent,
    IReadOnlyDictionary<string, double> Districts);

public sealed record PlanFact(string Id, string Text);

public sealed record AlternativeVariant(
    string Id,
    IReadOnlyList<string> Strategies,
    string Title,
    PlanResult Plan,
    PlanChange Change,
    PlanDelta Delta,
    IReadOnlyList<PlanFact> Arguments,
    IReadOnlyList<PlanFact> Tradeoffs);

public sealed record AlternativeRecommendation(
    string Status,
    string? VariantId,
    string Title,
    string Text,
    IReadOnlyList<PlanFact> Arguments,
    IReadOnlyList<PlanFact> Tradeoffs,
    string Source);

public sealed record AlternativesResponse(
    string Goal,
    string SearchScope,
    int CandidatesChecked,
    int ValidCandidates,
    PlanResult Original,
    IReadOnlyDictionary<string, string?> BestByGoal,
    IReadOnlyList<AlternativeVariant> Variants,
    AlternativeRecommendation Recommendation,
    string Locale);
