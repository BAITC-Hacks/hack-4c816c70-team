using System.Globalization;

namespace CitySimulator.Api.Features.Simulation;

/// <summary>
/// Localized explanation text only: ru/kk use a comma, en a dot. JSON numbers stay invariant.
/// Explicit number formats work with DOTNET_SYSTEM_GLOBALIZATION_INVARIANT, without named cultures or ICU.
/// </summary>
public static class TextNumberFormat
{
    private static readonly NumberFormatInfo Comma = NumberFormatInfo.ReadOnly(new NumberFormatInfo { NumberDecimalSeparator = "," });
    private static readonly NumberFormatInfo Dot = NumberFormatInfo.ReadOnly(new NumberFormatInfo { NumberDecimalSeparator = "." });

    /// <summary>Rounded to 2 decimals, trailing zeros dropped; unknown locales keep the Russian default.</summary>
    public static string F(double value, string locale = ExplanationLocales.Russian) =>
        ScoreCalculator.Round(value).ToString("0.##", locale == ExplanationLocales.English ? Dot : Comma);

    /// <summary>Explicit sign with a typographic minus, using the requested decimal separator.</summary>
    public static string Signed(double value, string locale = ExplanationLocales.Russian) =>
        (value >= 0 ? "+" : "−") + F(Math.Abs(value), locale);
}
