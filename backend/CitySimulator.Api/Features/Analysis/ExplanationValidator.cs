using System.Text.Json;
using CitySimulator.Api.Features.Simulation;

namespace CitySimulator.Api.Features.Analysis;

public sealed record ClaimOrder(IReadOnlyList<string> StrengthOrder, IReadOnlyList<string> RiskOrder);

/// <summary>
/// Validates the LLM output before it is used: the model may only return a priority order of server claim IDs.
/// Each section must be an exact permutation of its own IDs — no unknown values, duplicates, omissions,
/// IDs from the other section or extra fields. An empty section accepts only [].
/// </summary>
public static class ExplanationValidator
{
    public const string StrengthOrderField = "strengthOrder";
    public const string RiskOrderField = "riskOrder";

    public static bool TryParse(string json, ClaimCatalog catalog, out ClaimOrder? order, out string reason)
    {
        order = null;
        JsonElement root;
        try
        {
            using var document = JsonDocument.Parse(json);
            root = document.RootElement.Clone();
        }
        catch (JsonException)
        {
            reason = "output is not valid JSON";
            return false;
        }

        if (root.ValueKind != JsonValueKind.Object)
        {
            reason = "output is not a JSON object";
            return false;
        }

        var names = root.EnumerateObject().Select(p => p.Name).ToList();
        if (names.Count != 2 || !names.Contains(StrengthOrderField) || !names.Contains(RiskOrderField))
        {
            reason = $"output fields must be exactly {StrengthOrderField} and {RiskOrderField}";
            return false;
        }

        var strengthIds = catalog.Strengths.Select(c => c.Id).ToList();
        var riskIds = catalog.Risks.Select(c => c.Id).ToList();
        if (!TryPermutation(root.GetProperty(StrengthOrderField), StrengthOrderField, strengthIds, riskIds, out var strengths, out reason)
            || !TryPermutation(root.GetProperty(RiskOrderField), RiskOrderField, riskIds, strengthIds, out var risks, out reason))
        {
            return false;
        }

        order = new ClaimOrder(strengths, risks);
        reason = string.Empty;
        return true;
    }

    private static bool TryPermutation(
        JsonElement element,
        string field,
        IReadOnlyList<string> own,
        IReadOnlyList<string> other,
        out List<string> ids,
        out string reason)
    {
        ids = [];
        if (element.ValueKind != JsonValueKind.Array)
        {
            reason = $"{field} must be an array";
            return false;
        }

        foreach (var item in element.EnumerateArray())
        {
            if (item.ValueKind != JsonValueKind.String)
            {
                reason = $"{field} must contain only string IDs";
                return false;
            }

            var id = item.GetString()!;
            if (!own.Contains(id))
            {
                reason = other.Contains(id) ? $"{field} contains an ID from the other section" : $"{field} contains an unknown ID";
                return false;
            }

            if (ids.Contains(id))
            {
                reason = $"{field} contains a duplicate ID";
                return false;
            }

            ids.Add(id);
        }

        if (ids.Count != own.Count)
        {
            reason = $"{field} omits {own.Count - ids.Count} ID(s)";
            return false;
        }

        reason = string.Empty;
        return true;
    }
}
