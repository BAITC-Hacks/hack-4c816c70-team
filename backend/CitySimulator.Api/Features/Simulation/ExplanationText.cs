using System.Globalization;

namespace CitySimulator.Api.Features.Simulation;

/// <summary>Server-owned explanation templates. Unknown locales keep the Russian default.</summary>
internal static class ExplanationText
{
    private static readonly IReadOnlyDictionary<string, (string Russian, string Kazakh, string English)> Templates =
        new Dictionary<string, (string, string, string)>
        {
            ["summary"] = (
                "Итоговый Score {0} против базового {1} ({2}). Потрачено {3} из {4}. Средневзвешенная оценка районов {5}, самый слабый район — {6} ({7}), критических значений ниже {8}: {9}.",
                "Қорытынды Score {0}, бастапқы Score {1} ({2}). {4} бірліктің {3} бірлігі жұмсалды. Аудандардың халық саны бойынша өлшенген орташа ұпайы {5}, ұпайы ең төмен аудан — {6} ({7}), {8} шегінен төмен көрсеткіштер саны: {9}.",
                "Final Score {0} versus baseline {1} ({2}). Spent {3} out of {4}. Population-weighted average district score {5}, district with the lowest score — {6} ({7}), indicators below {8}: {9}."),
            ["leading_gain"] = (
                "Наибольший рост оценки района — {0}: {1}.",
                "Аудан ұпайының ең жоғары өсімі — {0}: {1}.",
                "Largest increase in district score — {0}: {1}."),
            ["tied_gain"] = (
                "Наибольший рост оценки района, одинаковый ({0}), — у районов {1}.",
                "Аудан ұпайының ең жоғары өсімі ({0}) мына аудандарда бірдей: {1}.",
                "The largest increase in district score ({0}) is shared by these districts: {1}."),
            ["district_gain"] = (
                "Рост оценки района {0}: {1}.",
                "{0} ауданы ұпайының өсімі: {1}.",
                "Increase in district score for {0}: {1}."),
            ["synergy"] = (
                "Сработала синергия {0}: {1} {2} в районе {3}.",
                "{0} синергиясы іске асты: {3} ауданындағы {1} көрсеткішіне {2} қосылды.",
                "Synergy {0} applied: {1} {2} in {3}."),
            ["critical_reduced"] = (
                "Критических значений стало меньше: {0} → {1} (каждое стоит −1 балл).",
                "Шектен төмен көрсеткіштер саны азайды: {0} → {1} (әрқайсысы Score-ды 1 ұпайға төмендетеді).",
                "Fewer indicators are below the critical threshold: {0} → {1} (each reduces Score by 1 point)."),
            ["critical_risk"] = (
                "В районе {0} показатель {1} ниже порога: {2}.",
                "{0} ауданындағы {1} көрсеткіші шектен төмен: {2}.",
                "In {0}, indicator {1} is below the threshold: {2}."),
            ["weakest_district"] = (
                "Самый слабый район {0} ({1}) имеет вес 30% в формуле Score.",
                "Ұпайы ең төмен {0} ауданының ({1}) Score формуласындағы салмағы — 30%.",
                "The district with the lowest score, {0} ({1}), has a 30% weight in the Score formula."),
            ["long_lag"] = (
                "Меры с долгим лагом ({0}) реализуют лишь часть эффекта за горизонт {1} кварталов.",
                "Іске асуы ұзаққа созылатын шаралар ({0}) {1} тоқсан ішінде әсерінің бір бөлігін ғана береді.",
                "Measures with long delays ({0}) deliver only part of their effect over {1} quarters."),
            ["impact"] = (
                "Вклад {0} ({1}) в итог: {2} к Score по сравнению с тем же набором без этой меры.",
                "{0} ({1}) шарасының үлесі: осы шара алып тасталған дәл сол жиынмен салыстырғанда Score {2}.",
                "Contribution of {0} ({1}): Score {2} compared with the same set with this measure removed."),
            ["low_impact"] = (
                "{0} ({1}) не повышает Score: {2} по сравнению с тем же набором без этой меры.",
                "{0} ({1}) Score көрсеткішін арттырмайды: осы шара алып тасталған дәл сол жиынмен салыстырғанда {2}.",
                "{0} ({1}) does not increase Score: {2} compared with the same set with this measure removed."),
            ["no_improvement"] = (
                "Ни одна допустимая замена одной меры не повышает Score — отдельной заменой набор не улучшить.",
                "Рұқсат етілген бірде-бір жеке алмастыру Score көрсеткішін арттырмайды — бір шараны алмастыру арқылы жиынды жақсарту мүмкін емес.",
                "No valid replacement of a single measure increases Score; the set cannot be improved by one replacement."),
            ["replacement_result"] = (
                "{0} При этой отдельной замене Score {1} ({2}), расходы {3} из {4}.",
                "{0} Осы бір ғана алмастырудан кейін Score {1} ({2}), шығындар — {4} бірліктің {3} бірлігі.",
                "{0} With this single replacement, Score is {1} ({2}), with spending of {3} out of {4}."),
            ["independent"] = (
                "Варианты замен независимы и применяются по отдельности: их эффекты не суммируются.",
                "Әр нұсқа бастапқы жиындағы бір ғана таңдауды өзгертеді. Олардың әсерлерін қосуға болмайды.",
                "Each option changes one choice in the original set. Their effects must not be added together."),
            ["move"] = (
                "Перенести {0}: {1} → {2}.",
                "{0} шарасын көшіру: {1} → {2}.",
                "Move {0}: {1} → {2}."),
            ["replace"] = (
                "Заменить {0} ({1}) на {2} ({3}).",
                "{0} ({1}) шарасын {2} ({3}) шарасымен алмастыру.",
                "Replace {0} ({1}) with {2} ({3})."),
        };

    public static string Format(string locale, string key, params object[] arguments)
    {
        var template = Templates[key];
        return string.Format(CultureInfo.InvariantCulture,
            Choose(locale, template.Russian, template.Kazakh, template.English), arguments);
    }

    public static string DistrictName(string? id, string locale) => id switch
    {
        null => Choose(locale, "все районы", "барлық аудандар", "all districts"),
        "yesil" => Choose(locale, "Есиль", "Есіл", "Esil"),
        "almaty" => Choose(locale, "Алматы", "Алматы", "Almaty"),
        "saryarka" => Choose(locale, "Сарыарка", "Сарыарқа", "Saryarka"),
        "baikonur" => Choose(locale, "Байконур", "Байқоңыр", "Baikonur"),
        "nura" => Choose(locale, "Нура", "Нұра", "Nura"),
        _ => id,
    };

    private static string Choose(string locale, string russian, string kazakh, string english) => locale switch
    {
        ExplanationLocales.Kazakh => kazakh,
        ExplanationLocales.English => english,
        _ => russian,
    };
}
