using CitySimulator.Api.Features.Scenario;
using static CitySimulator.Api.Features.Simulation.TextNumberFormat;

namespace CitySimulator.Api.Features.Simulation;

/// <summary>One scored plan; metrics are rounded to 2 decimals exactly as the API displays them.</summary>
public sealed record ScoredPlan(IReadOnlyList<ValidatedChoice> Choices, SimulationOutcome Outcome)
{
    public int Spent { get; } = Choices.Sum(c => c.Measure.Cost);
    public double Score { get; } = ScoreCalculator.Round(Outcome.Score);
    public double MinDistrictScore { get; } = ScoreCalculator.Round(Outcome.MinDistrictScore);
    public double AverageScore { get; } = ScoreCalculator.Round(Outcome.AverageScore);
    public int CriticalCount => Outcome.CriticalCount;
    public double DistrictScore(string id) => ScoreCalculator.Round(Outcome.Districts.Single(d => d.District.Id == id).Score);
}

/// <summary>A valid single-swap candidate: <c>Removed</c> is the original choice, <c>Added</c> takes its slot.</summary>
public sealed record SwapCandidate(ValidatedChoice Removed, ValidatedChoice Added, ScoredPlan Plan)
{
    public string Id => $"alt_{Removed.Measure.Id}_{Added.Measure.Id}_{Added.District?.Id ?? "city"}";
}

public sealed record AlternativeSearchResult(
    ScoredPlan Original,
    int CandidatesChecked,
    int ValidCandidates,
    IReadOnlyDictionary<string, SwapCandidate?> BestByGoal);

/// <summary>
/// Exhaustive single-swap neighbourhood of a valid plan. Unlike <see cref="ReplacementAdvisor"/> nothing is filtered by
/// Score: every candidate passes <see cref="ChoiceValidator"/> and <see cref="ScoreCalculator"/>, then each goal
/// picks its best candidate with a deterministic lexicographic order on rounded values.
/// </summary>
public static class AlternativeSearch
{
    public const string SearchScope = "single_swap";

    public static AlternativeSearchResult Run(IReadOnlyList<ValidatedChoice> choices)
    {
        var original = new ScoredPlan(choices, ScoreCalculator.Simulate(choices));
        var request = choices.Select(ToChoice).ToList();
        var candidates = new List<SwapCandidate>();
        var checkedCount = 0;

        for (var slot = 0; slot < choices.Count; slot++)
        {
            var removed = choices[slot];
            foreach (var (measure, district) in Options())
            {
                if (measure.Id == removed.Measure.Id && district?.Id == removed.District?.Id)
                {
                    continue;
                }

                checkedCount++;
                var set = request.ToList();
                set[slot] = new MeasureChoice(measure.Id, district?.Id);
                var (validated, failure) = ChoiceValidator.Validate(new EvaluateRequest(set));
                if (failure is not null)
                {
                    continue;
                }

                candidates.Add(new SwapCandidate(removed, validated![slot], new ScoredPlan(validated, ScoreCalculator.Simulate(validated))));
            }
        }

        var best = AlternativeGoals.All.ToDictionary(goal => goal, goal =>
        {
            var top = candidates.Order(Comparer(goal)).FirstOrDefault();
            return top is not null && Improves(goal, top.Plan, original) ? top : null;
        });
        return new AlternativeSearchResult(original, checkedCount, candidates.Count, best);
    }

    /// <summary>Strict improvement of the goal metric, on rounded values.</summary>
    public static bool Improves(string goal, ScoredPlan plan, ScoredPlan original) => goal switch
    {
        AlternativeGoals.Score => plan.Score > original.Score,
        AlternativeGoals.Equity => plan.MinDistrictScore > original.MinDistrictScore,
        AlternativeGoals.Economy => plan.Spent < original.Spent,
        _ => throw new ArgumentOutOfRangeException(nameof(goal)),
    };

    /// <summary>"Better first": goal metric, then the documented tie-breakers, then the canonical key.</summary>
    private static IComparer<SwapCandidate> Comparer(string goal) => Comparer<SwapCandidate>.Create((a, b) =>
    {
        var (x, y) = (a.Plan, b.Plan);
        var byMetrics = goal switch
        {
            AlternativeGoals.Score => First(y.Score.CompareTo(x.Score), y.MinDistrictScore.CompareTo(x.MinDistrictScore), x.Spent.CompareTo(y.Spent)),
            AlternativeGoals.Equity => First(y.MinDistrictScore.CompareTo(x.MinDistrictScore), y.Score.CompareTo(x.Score), x.Spent.CompareTo(y.Spent)),
            _ => First(x.Spent.CompareTo(y.Spent), y.Score.CompareTo(x.Score), y.MinDistrictScore.CompareTo(x.MinDistrictScore)),
        };
        return byMetrics != 0 ? byMetrics : First(
            MeasureNumber(a.Removed).CompareTo(MeasureNumber(b.Removed)),
            MeasureNumber(a.Added).CompareTo(MeasureNumber(b.Added)),
            DistrictIndex(a.Added).CompareTo(DistrictIndex(b.Added)));
    });

    private static int First(params int[] comparisons) => comparisons.FirstOrDefault(c => c != 0);

    private static int MeasureNumber(ValidatedChoice c) => int.Parse(c.Measure.Id.AsSpan(1));

    /// <summary>City measures (no district) first, then districts in dataset order.</summary>
    private static int DistrictIndex(ValidatedChoice c) =>
        c.District is null ? -1 : ScenarioData.Districts.ToList().FindIndex(d => d.Id == c.District.Id);

    private static IEnumerable<(Measure Measure, District? District)> Options() =>
        ScenarioData.Measures.SelectMany(m => m.Scope == MeasureScope.District
            ? ScenarioData.Districts.Select(d => (m, (District?)d))
            : [(m, (District?)null)]);

    public static MeasureChoice ToChoice(ValidatedChoice c) => new(c.Measure.Id, c.District?.Id);

    public static PlanResult ToPlan(ScoredPlan plan) => new(
        plan.Choices.Select(ToChoice).ToList(),
        plan.Spent,
        ScenarioData.Budget - plan.Spent,
        plan.Score,
        new ScoreBreakdown(plan.AverageScore, plan.MinDistrictScore, plan.CriticalCount),
        plan.Outcome.Districts.Select(d => new DistrictScore(d.District.Id, d.District.Name, ScoreCalculator.Round(d.Score))).ToList());

    public static PlanDelta Delta(ScoredPlan plan, ScoredPlan original) => new(
        Diff(plan.Score, original.Score),
        Diff(plan.AverageScore, original.AverageScore),
        Diff(plan.MinDistrictScore, original.MinDistrictScore),
        plan.CriticalCount - original.CriticalCount,
        plan.Spent - original.Spent,
        ScenarioData.Districts.ToDictionary(d => d.Id, d => Diff(plan.DistrictScore(d.Id), original.DistrictScore(d.Id))));

    public static PlanChange Change(SwapCandidate candidate, string locale)
    {
        var from = ExplanationText.DistrictName(candidate.Removed.District?.Id, locale);
        var to = ExplanationText.DistrictName(candidate.Added.District?.Id, locale);
        var move = candidate.Removed.Measure.Id == candidate.Added.Measure.Id;
        return new PlanChange(
            move ? "move" : "replace",
            ToChoice(candidate.Removed),
            ToChoice(candidate.Added),
            move
                ? ExplanationText.Format(locale, "move", candidate.Added.Measure.Id, from, to)
                : ExplanationText.Format(locale, "replace", candidate.Removed.Measure.Id, from, candidate.Added.Measure.Id, to));
    }

    /// <summary>ID of the fact that proves the goal is improved.</summary>
    public static string GoalFactId(string goal) => goal switch
    {
        AlternativeGoals.Score => "score_up",
        AlternativeGoals.Equity => "min_district_up",
        _ => "cost_down",
    };

    /// <summary>Losses that must never be hidden from a recommendation.</summary>
    public static readonly IReadOnlyList<string> MandatoryTradeoffs = ["score_down", "min_district_down", "critical_up"];

    /// <summary>
    /// Computed gains and losses against the original plan. Zero changes produce no fact.
    /// Order: goal fact first, then metrics, spending, critical values, districts (dataset order), synergies.
    /// </summary>
    public static (IReadOnlyList<PlanFact> Arguments, IReadOnlyList<PlanFact> Tradeoffs) Facts(
        ScoredPlan plan, ScoredPlan original, string goal, string locale)
    {
        var arguments = new List<PlanFact>();
        var tradeoffs = new List<PlanFact>();

        void Metric(string id, string key, double before, double after)
        {
            var delta = Diff(after, before);
            if (delta == 0)
            {
                return;
            }

            var up = delta > 0;
            (up ? arguments : tradeoffs).Add(new PlanFact($"{id}_{(up ? "up" : "down")}",
                ExplanationText.Format(locale, $"{key}_{(up ? "up" : "down")}", F(before, locale), F(after, locale), Signed(delta, locale))));
        }

        Metric("score", "alt_score", original.Score, plan.Score);
        Metric("min_district", "alt_min", original.MinDistrictScore, plan.MinDistrictScore);
        Metric("average", "alt_average", original.AverageScore, plan.AverageScore);

        if (plan.Spent != original.Spent)
        {
            var cheaper = plan.Spent < original.Spent;
            (cheaper ? arguments : tradeoffs).Add(new PlanFact(cheaper ? "cost_down" : "cost_up",
                ExplanationText.Format(locale, cheaper ? "alt_cost_down" : "alt_cost_up", original.Spent, plan.Spent,
                    Math.Abs(plan.Spent - original.Spent), ScenarioData.Budget - plan.Spent, ScenarioData.Budget)));
        }

        if (plan.CriticalCount != original.CriticalCount)
        {
            var fewer = plan.CriticalCount < original.CriticalCount;
            (fewer ? arguments : tradeoffs).Add(new PlanFact(fewer ? "critical_down" : "critical_up",
                ExplanationText.Format(locale, fewer ? "alt_critical_down" : "alt_critical_up",
                    F(ScenarioData.CriticalThreshold, locale), original.CriticalCount, plan.CriticalCount)));
        }

        foreach (var district in ScenarioData.Districts)
        {
            var before = original.DistrictScore(district.Id);
            var after = plan.DistrictScore(district.Id);
            var delta = Diff(after, before);
            if (delta == 0)
            {
                continue;
            }

            var up = delta > 0;
            (up ? arguments : tradeoffs).Add(new PlanFact($"district_{district.Id}_{(up ? "up" : "down")}",
                ExplanationText.Format(locale, up ? "alt_district_up" : "alt_district_down",
                    ExplanationText.DistrictName(district.Id, locale), F(before, locale), F(after, locale), Signed(delta, locale))));
        }

        static string Key(AppliedSynergy s) => $"{string.Join("_", s.MeasureIds)}_{s.DistrictId}";
        var had = original.Outcome.AppliedSynergies.ToDictionary(Key);
        var has = plan.Outcome.AppliedSynergies.ToDictionary(Key);
        foreach (var (key, synergy) in has.Where(s => !had.ContainsKey(s.Key)))
        {
            arguments.Add(new PlanFact($"synergy_gained_{key}", SynergyText("alt_synergy_gained", synergy, locale)));
        }

        foreach (var (key, synergy) in had.Where(s => !has.ContainsKey(s.Key)))
        {
            tradeoffs.Add(new PlanFact($"synergy_lost_{key}", SynergyText("alt_synergy_lost", synergy, locale)));
        }

        var goalFact = GoalFactId(goal);
        return (arguments.OrderBy(f => f.Id == goalFact ? 0 : 1).ToList(), tradeoffs);
    }

    private static string SynergyText(string key, AppliedSynergy s, string locale) =>
        ExplanationText.Format(locale, key, string.Join(" + ", s.MeasureIds), s.IndicatorId, Signed(s.Delta, locale),
            ExplanationText.DistrictName(s.DistrictId, locale));

    private static double Diff(double after, double before) => ScoreCalculator.Round(after - before);
}
