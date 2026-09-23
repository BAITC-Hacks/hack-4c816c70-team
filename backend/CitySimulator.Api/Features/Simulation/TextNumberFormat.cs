using System.Globalization;

namespace CitySimulator.Api.Features.Simulation;

/// <summary>
/// Russian number format for explanation text only (56,54). JSON numbers stay invariant (56.54).
/// Built explicitly because the Docker image runs with DOTNET_SYSTEM_GLOBALIZATION_INVARIANT, so ru-RU is unavailable.
/// </summary>
public static class TextNumberFormat
{
    private static readonly NumberFormatInfo Russian = new() { NumberDecimalSeparator = "," };

    /// <summary>Rounded to 2 decimals, trailing zeros dropped: 52,96 · 43,75 · 48.</summary>
    public static string F(double value) =>
        ScoreCalculator.Round(value).ToString("0.##", Russian);

    /// <summary>Explicit sign with a typographic minus: +3,98 · −1,75.</summary>
    public static string Signed(double value) => (value >= 0 ? "+" : "−") + F(Math.Abs(value));
}
