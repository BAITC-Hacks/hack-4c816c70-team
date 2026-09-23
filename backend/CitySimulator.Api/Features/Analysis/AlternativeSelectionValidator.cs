using System.Text.Json;
using System.Text.Json.Nodes;
using CitySimulator.Api.Features.Simulation;

namespace CitySimulator.Api.Features.Analysis;

/// <summary>A variant the model may choose: it improves the requested goal. Fact IDs belong to this variant only.</summary>
public sealed record EligibleVariant(string Id, IReadOnlyList<string> ArgumentIds, IReadOnlyList<string> TradeoffIds)
{
    public IReadOnlyList<string> MandatoryTradeoffIds =>
        TradeoffIds.Where(id => AlternativeSearch.MandatoryTradeoffs.Contains(id)).ToList();
}

public sealed record AlternativeChoiceSet(string Goal, IReadOnlyList<EligibleVariant> Variants)
{
    public string GoalFactId => AlternativeSearch.GoalFactId(Goal);
}

public sealed record AlternativeSelection(string VariantId, IReadOnlyList<string> ArgumentIds, IReadOnlyList<string> TradeoffIds);

/// <summary>
/// The model may only return IDs. Accepted when: exactly three fields; an eligible <c>variantId</c>; 1–3 unique
/// argument IDs of that variant including the goal fact; 0–4 unique tradeoff IDs of that variant including every
/// mandatory loss (Score, weakest district, critical values) it has.
/// </summary>
public static class AlternativeSelectionValidator
{
    public const string VariantField = "variantId";
    public const string ArgumentsField = "argumentIds";
    public const string TradeoffsField = "tradeoffIds";
    public const int MaxArguments = 3;
    public const int MaxTradeoffs = 4;

    public static JsonObject Schema(AlternativeChoiceSet set) => new()
    {
        ["type"] = "object",
        ["properties"] = new JsonObject
        {
            [VariantField] = new JsonObject { ["type"] = "string", ["enum"] = Enum(set.Variants.Select(v => v.Id)) },
            [ArgumentsField] = IdArray(set.Variants.SelectMany(v => v.ArgumentIds), 1, MaxArguments),
            [TradeoffsField] = IdArray(set.Variants.SelectMany(v => v.TradeoffIds), 0, MaxTradeoffs),
        },
        ["required"] = new JsonArray(VariantField, ArgumentsField, TradeoffsField),
        ["additionalProperties"] = false,
    };

    public static bool TryParse(string json, AlternativeChoiceSet set, out AlternativeSelection? selection, out string reason)
    {
        selection = null;
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
        if (names.Count != 3 || !names.Contains(VariantField) || !names.Contains(ArgumentsField) || !names.Contains(TradeoffsField))
        {
            reason = $"output fields must be exactly {VariantField}, {ArgumentsField} and {TradeoffsField}";
            return false;
        }

        var variantElement = root.GetProperty(VariantField);
        var variant = variantElement.ValueKind == JsonValueKind.String
            ? set.Variants.FirstOrDefault(v => v.Id == variantElement.GetString())
            : null;
        if (variant is null)
        {
            reason = $"{VariantField} is not an eligible variant";
            return false;
        }

        if (!TryIds(root.GetProperty(ArgumentsField), ArgumentsField, variant.ArgumentIds, 1, MaxArguments, [set.GoalFactId], out var arguments, out reason)
            || !TryIds(root.GetProperty(TradeoffsField), TradeoffsField, variant.TradeoffIds, 0, MaxTradeoffs, variant.MandatoryTradeoffIds, out var tradeoffs, out reason))
        {
            return false;
        }

        selection = new AlternativeSelection(variant.Id, arguments, tradeoffs);
        return true;
    }

    private static bool TryIds(JsonElement element, string field, IReadOnlyList<string> own, int min, int max,
        IReadOnlyList<string> required, out List<string> ids, out string reason)
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
                reason = $"{field} contains an ID that does not belong to the selected variant";
                return false;
            }

            if (ids.Contains(id))
            {
                reason = $"{field} contains a duplicate ID";
                return false;
            }

            ids.Add(id);
        }

        if (ids.Count < min || ids.Count > max)
        {
            reason = $"{field} must contain {min}–{max} IDs";
            return false;
        }

        var selected = ids;
        if (required.FirstOrDefault(id => !selected.Contains(id)) is { } missing)
        {
            reason = $"{field} omits required ID {missing}";
            return false;
        }

        reason = string.Empty;
        return true;
    }

    private static JsonArray Enum(IEnumerable<string> ids) =>
        new(ids.Distinct().Select(id => (JsonNode)JsonValue.Create(id)!).ToArray());

    /// <summary>An empty ID set gets no enum (an empty enum is invalid) and maxItems = 0.</summary>
    private static JsonObject IdArray(IEnumerable<string> ids, int min, int max)
    {
        var values = Enum(ids);
        var items = new JsonObject { ["type"] = "string" };
        if (values.Count > 0)
        {
            items["enum"] = values;
        }

        return new JsonObject
        {
            ["type"] = "array",
            ["items"] = items,
            ["minItems"] = Math.Min(min, values.Count),
            ["maxItems"] = Math.Min(max, values.Count),
        };
    }
}
