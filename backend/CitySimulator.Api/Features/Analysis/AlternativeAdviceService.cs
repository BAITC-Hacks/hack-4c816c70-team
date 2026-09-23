using CitySimulator.Api.Features.Simulation;

namespace CitySimulator.Api.Features.Analysis;

/// <summary>
/// Search is deterministic (<see cref="AlternativeSearch"/>). In live mode, and only when some variant improves the goal,
/// one OpenAI request may choose the recommended variant and its fact IDs; texts and numbers are always server-built.
/// </summary>
public sealed class AlternativeAdviceService(LlmOptions options, OpenAiExplanationClient client)
{
    public async Task<AlternativesResponse> AdviseAsync(
        IReadOnlyList<ValidatedChoice> choices, string goal, string locale, CancellationToken cancellationToken)
    {
        var search = AlternativeSearch.Run(choices);
        var draft = BuildResponse(search, goal, locale);
        if (!options.IsLiveReady || draft.Recommendation.VariantId is null)
        {
            return draft;
        }

        var eligible = Eligible(search, draft, goal);
        var set = new AlternativeChoiceSet(goal, eligible
            .Select(v => new EligibleVariant(v.Id, v.Arguments.Select(f => f.Id).ToList(), v.Tradeoffs.Select(f => f.Id).ToList()))
            .ToList());
        var input = new
        {
            goal,
            original = new
            {
                draft.Original.Score,
                draft.Original.Breakdown.MinDistrictScore,
                draft.Original.Breakdown.AverageScore,
                draft.Original.Breakdown.CriticalCount,
                draft.Original.Spent,
            },
            variants = eligible.Select(v => new
            {
                v.Id,
                v.Strategies,
                change = v.Change.Text,
                v.Plan.Score,
                v.Plan.Breakdown,
                v.Plan.Spent,
                v.Delta,
                goalFactId = set.GoalFactId,
                mandatoryTradeoffIds = set.Variants.Single(e => e.Id == v.Id).MandatoryTradeoffIds,
                arguments = v.Arguments,
                tradeoffs = v.Tradeoffs,
            }),
        };

        var selection = await client.TrySelectAlternativeAsync(input, set, cancellationToken);
        return selection is null ? draft : BuildResponse(search, goal, locale, selection, ExplanationSource.Llm);
    }

    /// <summary>Full response; without a selection the deterministic advice (best variant for the goal) is used.</summary>
    public static AlternativesResponse BuildResponse(
        AlternativeSearchResult search,
        string goal,
        string locale,
        AlternativeSelection? selection = null,
        string source = ExplanationSource.Mock)
    {
        var title = ExplanationText.Format(locale, "alt_title");
        var variants = new List<AlternativeVariant>();
        foreach (var strategy in AlternativeGoals.All)
        {
            if (search.BestByGoal[strategy] is not { } candidate)
            {
                continue;
            }

            var index = variants.FindIndex(v => v.Id == candidate.Id);
            if (index >= 0)
            {
                variants[index] = variants[index] with { Strategies = [.. variants[index].Strategies, strategy] };
                continue;
            }

            var (arguments, tradeoffs) = AlternativeSearch.Facts(candidate.Plan, search.Original, goal, locale);
            variants.Add(new AlternativeVariant(
                candidate.Id,
                [strategy],
                title,
                AlternativeSearch.ToPlan(candidate.Plan),
                AlternativeSearch.Change(candidate, locale),
                AlternativeSearch.Delta(candidate.Plan, search.Original),
                arguments,
                tradeoffs));
        }

        var goalName = ExplanationText.Format(locale, $"goal_{goal}");
        AlternativeRecommendation recommendation;
        if (search.BestByGoal[goal] is not { } best)
        {
            recommendation = new AlternativeRecommendation(
                AlternativeStatus.NoImprovement, null, title,
                ExplanationText.Format(locale, "alt_no_improvement", search.ValidCandidates, goalName, search.CandidatesChecked),
                [], [], ExplanationSource.Mock);
        }
        else
        {
            var chosen = variants.Single(v => v.Id == (selection?.VariantId ?? best.Id));
            var argumentIds = selection?.ArgumentIds ?? chosen.Arguments.Take(AlternativeSelectionValidator.MaxArguments).Select(f => f.Id).ToList();
            var tradeoffIds = selection?.TradeoffIds ?? DefaultTradeoffs(chosen);
            recommendation = new AlternativeRecommendation(
                AlternativeStatus.Improved,
                chosen.Id,
                title,
                ExplanationText.Format(locale, "alt_recommend", goalName, chosen.Change.Text),
                argumentIds.Select(id => chosen.Arguments.Single(f => f.Id == id)).ToList(),
                tradeoffIds.Select(id => chosen.Tradeoffs.Single(f => f.Id == id)).ToList(),
                selection is null ? ExplanationSource.Mock : source);
        }

        return new AlternativesResponse(
            goal,
            AlternativeSearch.SearchScope,
            search.CandidatesChecked,
            search.ValidCandidates,
            AlternativeSearch.ToPlan(search.Original),
            AlternativeGoals.All.ToDictionary(g => g, g => search.BestByGoal[g]?.Id),
            variants,
            recommendation,
            locale);
    }

    /// <summary>Returned variants that strictly improve the requested goal.</summary>
    private static List<AlternativeVariant> Eligible(AlternativeSearchResult search, AlternativesResponse response, string goal)
    {
        var candidates = search.BestByGoal.Values.OfType<SwapCandidate>().ToList();
        return response.Variants
            .Where(v => AlternativeSearch.Improves(goal, candidates.First(c => c.Id == v.Id).Plan, search.Original))
            .ToList();
    }

    /// <summary>Mandatory losses first, then the remaining losses in fact order, at most four.</summary>
    private static List<string> DefaultTradeoffs(AlternativeVariant variant) => variant.Tradeoffs
        .Select(f => f.Id)
        .OrderBy(id => AlternativeSearch.MandatoryTradeoffs.Contains(id) ? 0 : 1)
        .Take(AlternativeSelectionValidator.MaxTradeoffs)
        .ToList();
}
