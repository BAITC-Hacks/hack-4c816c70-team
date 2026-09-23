namespace CitySimulator.Api.Features.Simulation;

public sealed record MeasureChoice(string? MeasureId, string? DistrictId);

public sealed record EvaluateRequest(IReadOnlyList<MeasureChoice>? Choices);

public sealed record DistrictResult(
    string Id,
    string Name,
    double ScoreBefore,
    double ScoreAfter,
    IReadOnlyDictionary<string, double> IndicatorsBefore,
    IReadOnlyDictionary<string, double> IndicatorsAfter);

public sealed record AppliedSynergy(IReadOnlyList<string> MeasureIds, string DistrictId, string IndicatorId, double Delta);

public sealed record ScoreBreakdown(double AverageScore, double MinDistrictScore, int CriticalCount);

public sealed record Explanation(
    string Summary,
    IReadOnlyList<string> Strengths,
    IReadOnlyList<string> Risks,
    IReadOnlyList<string> Recommendations);

public sealed record EvaluateResponse(
    int Spent,
    int Remaining,
    double BaselineScore,
    double Score,
    ScoreBreakdown Breakdown,
    ScoreBreakdown BaselineBreakdown,
    IReadOnlyList<DistrictResult> Districts,
    IReadOnlyList<AppliedSynergy> AppliedSynergies,
    Explanation Explanation,
    string ExplanationSource);

public sealed record ApiError(string Code, string Message);

public sealed record ErrorResponse(ApiError Error);
