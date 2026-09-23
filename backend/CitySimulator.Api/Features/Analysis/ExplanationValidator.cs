using System.Globalization;
using System.Text.Json;
using System.Text.RegularExpressions;
using CitySimulator.Api.Features.Simulation;

namespace CitySimulator.Api.Features.Analysis;

/// <summary>
/// Validates the LLM output before it reaches the client: exact four-field shape, sane sizes,
/// and every number in the text must come from the computed facts (the LLM must not invent numbers).
/// </summary>
public static partial class ExplanationValidator
{
    public const int MaxSummaryLength = 1200;
    public const int MaxItemLength = 500;
    public const int MaxItems = 8;

    // Recommendations are built by the server (RecommendationBuilder), not by the model.
    private static readonly string[] Fields = ["summary", "strengths", "risks"];

    // Small integers (counts, quarters, measure/indicator ordinals) and the formula weights in percent.
    private static readonly double[] AlwaysAllowed = [.. Enumerable.Range(0, 21).Select(i => (double)i), 30, 70, 100];

    public static bool TryParse(
        string json,
        string factsJson,
        IReadOnlySet<string> allowedMeasureIds,
        out Explanation? explanation,
        out string reason)
    {
        explanation = null;
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
        if (names.Count != Fields.Length || !Fields.All(names.Contains))
        {
            reason = "output fields differ from summary/strengths/risks";
            return false;
        }

        var summary = root.GetProperty("summary");
        if (summary.ValueKind != JsonValueKind.String || string.IsNullOrWhiteSpace(summary.GetString())
            || summary.GetString()!.Length > MaxSummaryLength)
        {
            reason = "summary must be a non-empty string";
            return false;
        }

        var lists = new Dictionary<string, List<string>>();
        foreach (var field in Fields.Skip(1))
        {
            var element = root.GetProperty(field);
            if (element.ValueKind != JsonValueKind.Array || element.GetArrayLength() > MaxItems)
            {
                reason = $"{field} must be an array of at most {MaxItems} items";
                return false;
            }

            var items = new List<string>();
            foreach (var item in element.EnumerateArray())
            {
                if (item.ValueKind != JsonValueKind.String || string.IsNullOrWhiteSpace(item.GetString())
                    || item.GetString()!.Length > MaxItemLength)
                {
                    reason = $"{field} items must be non-empty strings";
                    return false;
                }

                items.Add(item.GetString()!.Trim());
            }

            lists[field] = items;
        }

        var candidate = new Explanation(summary.GetString()!.Trim(), lists["strengths"], lists["risks"], []);
        var texts = new[] { candidate.Summary }
            .Concat(candidate.Strengths).Concat(candidate.Risks)
            .ToList();

        // Only chosen measures may be named.
        var foreignMeasures = texts
            .SelectMany(t => MeasureIdPattern().Matches(t).Select(m => "M" + m.Groups[1].Value))
            .Where(id => !allowedMeasureIds.Contains(id))
            .Distinct()
            .Count();
        if (foreignMeasures > 0)
        {
            reason = $"text names {foreignMeasures} measure(s) that were not chosen";
            return false;
        }

        var allowed = AllowedNumbers(factsJson);
        var unknown = texts
            .SelectMany(ExtractNumbers)
            .Where(n => !allowed.Any(a => Math.Abs(a - n) < 0.0005))
            .Distinct()
            .ToList();
        if (unknown.Count > 0)
        {
            // Numbers alone are safe to log; the model text itself is never logged.
            reason = $"text contains {unknown.Count} number(s) not present in computed facts: " +
                     string.Join(", ", unknown.Take(5).Select(n => n.ToString(CultureInfo.InvariantCulture)));
            return false;
        }

        explanation = candidate;
        reason = string.Empty;
        return true;
    }

    private static List<double> AllowedNumbers(string factsJson)
    {
        var allowed = new List<double>(AlwaysAllowed);
        foreach (var value in ExtractNumbers(factsJson))
        {
            // Accept the exact value and its honest roundings/percent form; anything else is invented.
            allowed.Add(value);
            allowed.Add(ScoreCalculator.Round(Math.Round(value, 1, MidpointRounding.AwayFromZero)));
            allowed.Add(Math.Round(value, 0, MidpointRounding.AwayFromZero));
            if (value <= 1)
            {
                allowed.Add(ScoreCalculator.Round(value * 100));
            }
        }

        return allowed;
    }

    private static IEnumerable<double> ExtractNumbers(string text) =>
        NumberPattern().Matches(text)
            .Select(m => double.Parse(m.Value.Replace(',', '.'), CultureInfo.InvariantCulture));

    // Digits not glued to a letter, so ids like M10 or T1 are not treated as numbers.
    [GeneratedRegex(@"(?<![\p{L}\d.,])\d+(?:[.,]\d+)?")]
    private static partial Regex NumberPattern();

    // Latin or Cyrillic M followed by a measure number: M7, m7, М7.
    [GeneratedRegex(@"(?<![\p{L}\d])[MmМм](\d{1,2})(?!\d)")]
    private static partial Regex MeasureIdPattern();
}
