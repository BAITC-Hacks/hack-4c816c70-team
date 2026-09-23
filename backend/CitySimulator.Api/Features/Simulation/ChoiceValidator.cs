using CitySimulator.Api.Features.Scenario;

namespace CitySimulator.Api.Features.Simulation;

public sealed record ValidatedChoice(Measure Measure, District? District);

public sealed record ValidationFailure(int StatusCode, string Code, string Message);

public static class ChoiceValidator
{
    public static class Codes
    {
        public const string InvalidRequest = "INVALID_REQUEST";
        public const string WrongChoiceCount = "WRONG_CHOICE_COUNT";
        public const string UnknownMeasure = "UNKNOWN_MEASURE";
        public const string DuplicateMeasure = "DUPLICATE_MEASURE";
        public const string DistrictRequired = "DISTRICT_REQUIRED";
        public const string DistrictNotAllowed = "DISTRICT_NOT_ALLOWED";
        public const string UnknownDistrict = "UNKNOWN_DISTRICT";
        public const string BudgetExceeded = "BUDGET_EXCEEDED";
        public const string CategoryLimitExceeded = "CATEGORY_LIMIT_EXCEEDED";
        public const string IncompatibleMeasures = "INCOMPATIBLE_MEASURES";
        public const string InvalidGoal = "INVALID_GOAL";
    }

    public static (IReadOnlyList<ValidatedChoice>? Choices, ValidationFailure? Failure) Validate(EvaluateRequest? request)
    {
        if (request?.Choices is null)
        {
            return Fail(Codes.InvalidRequest, "Тело запроса должно содержать массив choices.");
        }

        if (request.Choices.Count != ScenarioData.ChoicesRequired)
        {
            return Fail(Codes.WrongChoiceCount,
                $"Нужно ровно {ScenarioData.ChoicesRequired} решений, получено {request.Choices.Count}.");
        }

        var validated = new List<ValidatedChoice>(request.Choices.Count);
        var seen = new HashSet<string>();

        foreach (var choice in request.Choices)
        {
            if (choice is null || string.IsNullOrWhiteSpace(choice.MeasureId))
            {
                return Fail(Codes.InvalidRequest, "Каждое решение должно содержать measureId.");
            }

            if (!ScenarioData.MeasuresById.TryGetValue(choice.MeasureId, out var measure))
            {
                return Fail(Codes.UnknownMeasure, $"Мера {choice.MeasureId} не найдена в каталоге.");
            }

            if (!seen.Add(measure.Id))
            {
                return Fail(Codes.DuplicateMeasure, $"Мера {measure.Id} выбрана больше одного раза.");
            }

            var districtId = string.IsNullOrWhiteSpace(choice.DistrictId) ? null : choice.DistrictId;
            District? district = null;

            if (measure.Scope == MeasureScope.District)
            {
                if (districtId is null)
                {
                    return Fail(Codes.DistrictRequired, $"Для районной меры {measure.Id} нужно указать districtId.");
                }

                if (!ScenarioData.DistrictsById.TryGetValue(districtId, out district))
                {
                    return Fail(Codes.UnknownDistrict, $"Район {districtId} не найден.");
                }
            }
            else if (districtId is not null)
            {
                return Fail(Codes.DistrictNotAllowed,
                    $"Мера {measure.Id} городская и действует на все районы; districtId указывать нельзя.");
            }

            validated.Add(new ValidatedChoice(measure, district));
        }

        var spent = validated.Sum(c => c.Measure.Cost);
        if (spent > ScenarioData.Budget)
        {
            return Fail(Codes.BudgetExceeded,
                $"Стоимость набора {spent} превышает бюджет {ScenarioData.Budget}.",
                StatusCodes.Status422UnprocessableEntity);
        }

        var overLimit = validated
            .GroupBy(c => c.Measure.Category)
            .FirstOrDefault(g => g.Count() > ScenarioData.MaxMeasuresPerCategory);
        if (overLimit is not null)
        {
            return Fail(Codes.CategoryLimitExceeded,
                $"Направление {overLimit.Key}: выбрано мер — {overLimit.Count()} ({string.Join(", ", overLimit.Select(c => c.Measure.Id))}), допускается не более {ScenarioData.MaxMeasuresPerCategory}.");
        }

        foreach (var rule in ScenarioData.Incompatibilities)
        {
            var first = validated.FirstOrDefault(c => c.Measure.Id == rule.FirstMeasureId);
            var second = validated.FirstOrDefault(c => c.Measure.Id == rule.SecondMeasureId);
            if (first is null || second is null)
            {
                continue;
            }

            if (!rule.SameDistrictOnly || first.District?.Id == second.District?.Id)
            {
                var where = rule.SameDistrictOnly ? $" в районе {first.District!.Name}" : string.Empty;
                return Fail(Codes.IncompatibleMeasures,
                    $"Меры {rule.FirstMeasureId} и {rule.SecondMeasureId} несовместимы{where}. {rule.Reason}");
            }
        }

        return (validated, null);
    }

    private static (IReadOnlyList<ValidatedChoice>?, ValidationFailure?) Fail(
        string code, string message, int statusCode = StatusCodes.Status400BadRequest) =>
        (null, new ValidationFailure(statusCode, code, message));
}
