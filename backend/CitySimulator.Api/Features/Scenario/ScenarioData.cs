namespace CitySimulator.Api.Features.Scenario;

/// <summary>
/// Synthetic dataset from docs/reference/district-dataset.docx. The single source of numbers for scoring.
/// </summary>
public static class ScenarioData
{
    public const int Budget = 100;
    public const int HorizonQuarters = 8;
    public const int ChoicesRequired = 5;
    public const int MaxMeasuresPerCategory = 2;
    public const double CriticalThreshold = 40;
    public const double CriticalPenalty = 1.0;
    public const double AverageWeight = 0.7;
    public const double MinDistrictWeight = 0.3;

    public static readonly IReadOnlyList<Indicator> Indicators =
    [
        new("T1", "Разгрузка дорог", "transport", 0.10),
        new("T2", "Доступность общественного транспорта", "transport", 0.10),
        new("E1", "Озеленение", "ecology", 0.09),
        new("E2", "Качество воздуха", "ecology", 0.11),
        new("S1", "Школы и детсады", "social", 0.11),
        new("S2", "Поликлиники и первичная медпомощь", "social", 0.11),
        new("B1", "Безопасность улиц", "safety", 0.09),
        new("B2", "Безопасность дорожного движения", "safety", 0.09),
        new("C1", "Надёжность ЖКХ", "services", 0.10),
        new("C2", "Скорость решения обращений жителей", "services", 0.10),
    ];

    public static readonly IReadOnlyList<District> Districts =
    [
        District("yesil", "Есиль", 0.27, 45, 62, 68, 72, 48, 55, 78, 60, 75, 70),
        District("almaty", "Алматы", 0.24, 40, 75, 50, 55, 60, 65, 62, 52, 50, 60),
        District("saryarka", "Сарыарка", 0.20, 50, 70, 42, 40, 62, 68, 58, 55, 45, 55),
        District("baikonur", "Байконур", 0.13, 52, 68, 55, 50, 58, 60, 52, 58, 55, 58),
        District("nura", "Нура", 0.16, 55, 40, 45, 65, 38, 35, 55, 50, 60, 50),
    ];

    public static readonly IReadOnlyList<Measure> Measures =
    [
        new("M1", "transport", "Выделенные полосы для автобусов", MeasureScope.District, 18, 2, Effects(("T1", 6), ("T2", 9))),
        new("M2", "transport", "Умные светофоры (адаптивное управление)", MeasureScope.City, 22, 2, Effects(("T1", 4), ("B2", 3))),
        new("M3", "transport", "Линия ЛРТ / расширение", MeasureScope.District, 30, 4, Effects(("T1", 16), ("T2", 20), ("E2", 4))),
        new("M4", "ecology", "Парк / сквер", MeasureScope.District, 15, 2, Effects(("E1", 12), ("E2", 3), ("B1", 2))),
        new("M5", "ecology", "Перевод частного сектора на чистое топливо", MeasureScope.District, 25, 3, Effects(("E2", 14), ("C1", 4))),
        new("M6", "ecology", "Городская программа озеленения и ветрозащитных полос", MeasureScope.City, 20, 4, Effects(("E1", 5), ("E2", 3))),
        new("M7", "social", "Школа + детсад (модульное строительство)", MeasureScope.District, 24, 3, Effects(("S1", 16))),
        new("M8", "social", "Центр семейного здоровья / поликлиника", MeasureScope.District, 20, 3, Effects(("S2", 14))),
        new("M9", "social", "Дворовые спорт-хабы", MeasureScope.District, 10, 1, Effects(("S1", 3), ("S2", 3), ("B1", 3))),
        new("M10", "safety", "Освещение и камеры (расширение Safe City)", MeasureScope.District, 12, 1, Effects(("B1", 12), ("B2", 2))),
        new("M11", "safety", "Безопасные переходы и школьные зоны", MeasureScope.District, 10, 1, Effects(("B2", 12), ("T1", -2))),
        new("M12", "services", "Единая цифровая платформа обращений", MeasureScope.City, 14, 1, Effects(("C2", 5))),
        new("M13", "services", "Модернизация тепло- и водосетей", MeasureScope.District, 28, 4, Effects(("C1", 18), ("E2", 2))),
        new("M14", "services", "Аварийные бригады ЖКХ + раннее оповещение", MeasureScope.City, 16, 1, Effects(("C1", 5), ("C2", 2))),
    ];

    /// <summary>Fixed bonus, not scaled by lag, applied in the district of the first measure of the pair.</summary>
    public static readonly IReadOnlyList<Synergy> Synergies =
    [
        new("M1", "M2", "T1", 2),
        new("M10", "M12", "B1", 2),
        new("M5", "M6", "E2", 2),
    ];

    public static readonly IReadOnlyList<Incompatibility> Incompatibilities =
    [
        new("M1", "M3", false, "Либо выделенные полосы (BRT), либо ЛРТ — в любом районе."),
        new("M4", "M7", true, "Парк и школа не могут быть в одном районе: конфликт за участок."),
        new("M5", "M13", true, "Чистое топливо и модернизация сетей не могут быть в одном районе: дублирование программы."),
    ];

    public static readonly IReadOnlyDictionary<string, Measure> MeasuresById = Measures.ToDictionary(m => m.Id);
    public static readonly IReadOnlyDictionary<string, District> DistrictsById = Districts.ToDictionary(d => d.Id);

    private static District District(string id, string name, double populationShare, params double[] values)
    {
        var indicators = new Dictionary<string, double>();
        for (var i = 0; i < Indicators.Count; i++)
        {
            indicators[Indicators[i].Id] = values[i];
        }

        return new District(id, name, populationShare, indicators);
    }

    private static IReadOnlyDictionary<string, double> Effects(params (string IndicatorId, double Delta)[] effects) =>
        effects.ToDictionary(e => e.IndicatorId, e => e.Delta);
}
