using System.Globalization;

namespace CitySimulator.Api.Features.Simulation;

/// <summary>Languages of explanation text; numeric API fields and scenario data are unchanged.</summary>
public static class ExplanationLocales
{
    public const string Russian = "ru-RU";
    public const string Kazakh = "kk-KZ";
    public const string English = "en-US";

    /// <summary>
    /// Select the supported language with the highest positive q value, retaining header order on ties.
    /// Unsupported or malformed ranges are ignored. Missing or unmatched headers use Russian.
    /// </summary>
    public static string Resolve(string? acceptLanguage)
    {
        var selected = Russian;
        var bestQuality = 0d;
        foreach (var range in (acceptLanguage ?? string.Empty).Split(',', StringSplitOptions.RemoveEmptyEntries))
        {
            var parts = range.Split(';', StringSplitOptions.TrimEntries);
            var tags = parts[0].Split('-');
            if (tags.Any(tag => tag.Length is 0 or > 8
                || !tag.All(c => c is >= 'a' and <= 'z' or >= 'A' and <= 'Z' or >= '0' and <= '9')))
            {
                continue;
            }

            var language = tags[0].ToLowerInvariant();
            var locale = language switch
            {
                "ru" => Russian,
                "kk" => Kazakh,
                "en" => English,
                _ => null,
            };
            if (locale is null)
            {
                continue;
            }

            var quality = 1d;
            var valid = true;
            var hasQuality = false;
            foreach (var parameter in parts.Skip(1))
            {
                if (hasQuality || !parameter.StartsWith("q=", StringComparison.OrdinalIgnoreCase)
                    || !IsValidQuality(parameter.AsSpan(2))
                    || !double.TryParse(parameter.AsSpan(2), NumberStyles.AllowDecimalPoint,
                        CultureInfo.InvariantCulture, out quality)
                    || quality < 0 || quality > 1)
                {
                    valid = false;
                    break;
                }

                hasQuality = true;
            }

            if (valid && quality > bestQuality)
            {
                selected = locale;
                bestQuality = quality;
            }
        }

        return selected;
    }

    private static bool IsValidQuality(ReadOnlySpan<char> value)
    {
        // HTTP quality values are 0 or 1 with at most three decimal digits.
        if (value.IsEmpty || value[0] is not ('0' or '1'))
            return false;
        if (value.Length == 1)
            return true;
        if (value.Length > 5 || value[1] != '.')
            return false;
        foreach (var digit in value[2..])
        {
            if (digit is < '0' or > '9' || (value[0] == '1' && digit != '0'))
                return false;
        }
        return true;
    }
}
