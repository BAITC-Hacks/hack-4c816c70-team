/**
 * Тесты правил выбора Planner. Runner-agnostic по данным: используется только
 * встроенный node:test, без новых зависимостей. Подключение к npm scripts — GPT.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import type {
  ChoiceDraft,
  MeasureVM,
  ScenarioVM,
  SelectionIssueCode,
} from "@/lib/contracts/ui";
import {
  addChoice,
  getAddAvailability,
  getDistrictOptions,
  getPotentialSynergies,
  removeChoice,
  setChoiceDistrict,
  validateDraft,
} from "./selection-rules";
import { createPlannerText, describeBlock, describeIssue } from "./localize";
import { plannerMessages } from "./messages";

/*
 * ТЕСТОВЫЙ FIXTURE. Минимальный сценарий только для проверки правил формы:
 * цены и эффекты условные и НЕ являются данными датасета. Идентификаторы
 * и пары конфликтов повторяют структуру правил API (M1/M3 глобально,
 * M4/M7 и M5/M13 — в одном районе).
 */
function measure(
  id: string,
  category: MeasureVM["category"],
  scope: MeasureVM["scope"],
  cost = 10,
): MeasureVM {
  return { id, category, name: `Тестовая мера ${id}`, scope, cost, lagQuarters: 1, effects: {} };
}

const indicators = { T1: 50, T2: 50, E1: 50, E2: 50, S1: 50, S2: 50, B1: 50, B2: 50, C1: 50, C2: 50 };

const TEST_SCENARIO: ScenarioVM = {
  budget: 100,
  horizonQuarters: 8,
  criticalThreshold: 40,
  baselineScore: 50,
  indicators: [],
  districts: [
    { id: "nura", name: "Нура", populationShare: 0.25, indicators },
    { id: "yesil", name: "Есиль", populationShare: 0.25, indicators },
    { id: "saryarka", name: "Сарыарка", populationShare: 0.25, indicators },
    { id: "almaty", name: "Алматы", populationShare: 0.25, indicators },
  ],
  measures: [
    measure("M1", "transport", "district"),
    measure("M2", "transport", "city"),
    measure("M3", "transport", "district"),
    measure("M4", "ecology", "district"),
    measure("M5", "ecology", "district"),
    measure("M7", "social", "district"),
    measure("M8", "social", "district"),
    measure("M9", "social", "district"),
    measure("M10", "safety", "district"),
    measure("M12", "services", "city"),
    measure("M13", "services", "district"),
  ],
  rules: {
    requiredChoices: 5,
    maxPerCategory: 2,
    uniqueMeasures: true,
    incompatibilities: [
      { measureIds: ["M1", "M3"], scope: "global", reason: "тестовая причина BRT/ЛРТ" },
      { measureIds: ["M4", "M7"], scope: "same-district", reason: "тестовая причина участка" },
      { measureIds: ["M5", "M13"], scope: "same-district", reason: "тестовая причина программ" },
    ],
    synergies: [{ measureIds: ["M10", "M12"], targetMeasureId: "M10", effects: { B1: 2 } }],
  },
  source: "fixture",
};

function withCosts(costs: Readonly<Record<string, number>>): ScenarioVM {
  return {
    ...TEST_SCENARIO,
    measures: TEST_SCENARIO.measures.map((m) => (m.id in costs ? { ...m, cost: costs[m.id] } : m)),
  };
}

function codes(scenario: ScenarioVM, choices: readonly ChoiceDraft[]): SelectionIssueCode[] {
  return validateDraft(scenario, choices).issues.map((issue) => issue.code);
}

/** Пять допустимых мер из четырёх направлений. */
const VALID: readonly ChoiceDraft[] = [
  { measureId: "M7", districtId: "nura" },
  { measureId: "M8", districtId: "nura" },
  { measureId: "M10", districtId: "nura" },
  { measureId: "M12" },
  { measureId: "M5", districtId: "saryarka" },
];

describe("validateDraft: количество и уникальность", () => {
  it("5 допустимых мер из 4 направлений можно отправить", () => {
    const result = validateDraft(TEST_SCENARIO, VALID);
    assert.deepEqual(result.issues, []);
    assert.equal(result.canSubmit, true);
    assert.equal(result.provisionalSpent, 50);
    assert.equal(result.provisionalRemaining, 50);
  });

  it("0, 4 и 6 мер блокируют отправку", () => {
    assert.deepEqual(codes(TEST_SCENARIO, []), ["choice-count"]);
    assert.deepEqual(codes(TEST_SCENARIO, VALID.slice(0, 4)), ["choice-count"]);
    const six = [...VALID, { measureId: "M1", districtId: "yesil" }];
    assert.deepEqual(codes(TEST_SCENARIO, six), ["choice-count"]);
    assert.equal(validateDraft(TEST_SCENARIO, six).canSubmit, false);
  });

  it("повтор меры отклоняется даже в разных районах", () => {
    const choices = [
      ...VALID.slice(0, 4),
      { measureId: "M7", districtId: "yesil" },
    ];
    const result = validateDraft(TEST_SCENARIO, choices);
    assert.ok(result.issues.some((i) => i.code === "duplicate-measure" && i.measureIds?.[0] === "M7"));
    assert.equal(result.canSubmit, false);
  });
});

describe("validateDraft: бюджет", () => {
  const exact = withCosts({ M7: 20, M8: 20, M10: 20, M12: 20, M5: 20 });

  it("ровно бюджет (100) допустим", () => {
    const result = validateDraft(exact, VALID);
    assert.equal(result.provisionalSpent, 100);
    assert.equal(result.provisionalRemaining, 0);
    assert.equal(result.canSubmit, true);
  });

  it("101 превышает бюджет и называет недостачу", () => {
    const over = withCosts({ M7: 21, M8: 20, M10: 20, M12: 20, M5: 20 });
    const result = validateDraft(over, VALID);
    const issue = result.issues.find((i) => i.code === "budget-exceeded");
    assert.ok(issue);
    assert.match(issue.message, /не хватает 1 ед\./);
    assert.equal(result.provisionalRemaining, -1);
    assert.equal(result.canSubmit, false);
  });

  it("не округляет цены ради валидации", () => {
    const fractional = withCosts({ M7: 20.004, M8: 20, M10: 20, M12: 20, M5: 20 });
    assert.ok(codes(fractional, VALID).includes("budget-exceeded"));
  });
});

describe("validateDraft: направления", () => {
  it("третья мера соцсферы (M7 + M8 + M9) превышает лимит", () => {
    const choices = [
      { measureId: "M7", districtId: "nura" },
      { measureId: "M8", districtId: "nura" },
      { measureId: "M9", districtId: "yesil" },
      { measureId: "M12" },
      { measureId: "M10", districtId: "nura" },
    ];
    const issue = validateDraft(TEST_SCENARIO, choices).issues.find((i) => i.code === "category-limit");
    assert.ok(issue);
    assert.deepEqual(issue.measureIds, ["M7", "M8", "M9"]);
  });

  it("две меры одного направления допустимы", () => {
    assert.ok(!codes(TEST_SCENARIO, VALID).includes("category-limit"));
  });
});

describe("validateDraft: назначение района", () => {
  it("районная мера без района блокирует отправку", () => {
    const choices = VALID.map((c) => (c.measureId === "M8" ? { measureId: "M8" } : c));
    assert.deepEqual(codes(TEST_SCENARIO, choices), ["district-required"]);
  });

  it("пустая строка района считается отсутствием района", () => {
    const choices = VALID.map((c) => (c.measureId === "M8" ? { measureId: "M8", districtId: "" } : c));
    assert.deepEqual(codes(TEST_SCENARIO, choices), ["district-required"]);
  });

  it("неизвестный район — ошибка без угадывания", () => {
    const choices = VALID.map((c) => (c.measureId === "M8" ? { measureId: "M8", districtId: "atlantis" } : c));
    const issue = validateDraft(TEST_SCENARIO, choices).issues.find((i) => i.code === "invalid-district");
    assert.ok(issue);
    assert.equal(issue.districtId, "atlantis");
  });

  it("неизвестная мера — ошибка", () => {
    const choices = [...VALID.slice(0, 4), { measureId: "M99", districtId: "nura" }];
    assert.deepEqual(codes(TEST_SCENARIO, choices), ["unknown-measure"]);
  });

  it("городской мере район не назначается", () => {
    const choices = VALID.map((c) => (c.measureId === "M12" ? { measureId: "M12", districtId: "nura" } : c));
    assert.deepEqual(codes(TEST_SCENARIO, choices), ["district-for-city"]);
  });

  it("addChoice/setChoiceDistrict для городской меры не создают ключ districtId", () => {
    const m12 = TEST_SCENARIO.measures.find((m) => m.id === "M12")!;
    const added = addChoice([], m12, "nura");
    assert.equal("districtId" in added[0], false);
    const changed = setChoiceDistrict(added, m12, "yesil");
    assert.equal("districtId" in changed[0], false);
    assert.equal(JSON.stringify(changed), '[{"measureId":"M12"}]');
  });

  it("сброс района у районной меры убирает ключ и делает выбор незавершённым", () => {
    const m7 = TEST_SCENARIO.measures.find((m) => m.id === "M7")!;
    const cleared = setChoiceDistrict(VALID, m7, "");
    assert.equal("districtId" in cleared[0], false);
    assert.deepEqual(codes(TEST_SCENARIO, cleared), ["district-required"]);
  });
});

describe("validateDraft: несовместимости", () => {
  const base: readonly ChoiceDraft[] = [
    { measureId: "M10", districtId: "nura" },
    { measureId: "M12" },
    { measureId: "M8", districtId: "almaty" },
  ];

  it("M1 в Нуре + M3 в Есиле — глобальный конфликт", () => {
    const choices = [...base, { measureId: "M1", districtId: "nura" }, { measureId: "M3", districtId: "yesil" }];
    const issue = validateDraft(TEST_SCENARIO, choices).issues.find((i) => i.code === "incompatible");
    assert.ok(issue);
    assert.deepEqual(issue.measureIds, ["M1", "M3"]);
    assert.equal(issue.districtId, undefined);
  });

  it("M4 и M7 в Нуре — конфликт за участок", () => {
    const choices = [...base, { measureId: "M4", districtId: "nura" }, { measureId: "M7", districtId: "nura" }];
    const issue = validateDraft(TEST_SCENARIO, choices).issues.find((i) => i.code === "incompatible");
    assert.ok(issue);
    assert.equal(issue.districtId, "nura");
    assert.match(issue.message, /«Нура»/);
  });

  it("M4 в Есиле и M7 в Нуре допустимы", () => {
    const choices = [...base, { measureId: "M4", districtId: "yesil" }, { measureId: "M7", districtId: "nura" }];
    assert.deepEqual(codes(TEST_SCENARIO, choices), []);
  });

  it("M5 и M13 в Сарыарке — конфликт; в разных районах — допустимо", () => {
    const same = [...base, { measureId: "M5", districtId: "saryarka" }, { measureId: "M13", districtId: "saryarka" }];
    assert.deepEqual(codes(TEST_SCENARIO, same), ["incompatible"]);
    const apart = [...base, { measureId: "M5", districtId: "saryarka" }, { measureId: "M13", districtId: "almaty" }];
    assert.deepEqual(codes(TEST_SCENARIO, apart), []);
  });

  it("смена района пересчитывает районный конфликт", () => {
    const m7 = TEST_SCENARIO.measures.find((m) => m.id === "M7")!;
    const start = [...base, { measureId: "M4", districtId: "nura" }, { measureId: "M7", districtId: "yesil" }];
    assert.deepEqual(codes(TEST_SCENARIO, start), []);
    const moved = setChoiceDistrict(start, m7, "nura");
    assert.deepEqual(codes(TEST_SCENARIO, moved), ["incompatible"]);
    const back = setChoiceDistrict(moved, m7, "almaty");
    assert.deepEqual(codes(TEST_SCENARIO, back), []);
  });

  it("незавершённая районная мера не создаёт ложного районного конфликта", () => {
    const choices = [...base, { measureId: "M4" }, { measureId: "M7" }];
    assert.deepEqual(codes(TEST_SCENARIO, choices), ["district-required", "district-required"]);
  });
});

describe("validateDraft: отсутствие правил", () => {
  it("rules === null → rules-unavailable, набор не допустим", () => {
    const scenario: ScenarioVM = { ...TEST_SCENARIO, rules: null };
    const result = validateDraft(scenario, VALID);
    assert.deepEqual(result.issues.map((i) => i.code), ["rules-unavailable"]);
    assert.equal(result.canSubmit, false);
    assert.equal(result.provisionalSpent, 50);
  });
});

describe("доступность действий в форме", () => {
  it("глобальный конфликт блокирует всю карточку M3", () => {
    const availability = getAddAvailability(TEST_SCENARIO, [{ measureId: "M1", districtId: "nura" }], "M3");
    assert.equal(availability.status, "blocked");
    assert.ok(
      availability.status === "blocked" &&
        availability.reasons.some((r) => r.kind === "incompatible" && r.partner === "M1"),
    );
  });

  it("районный конфликт блокирует только конкретный район", () => {
    const choices = [{ measureId: "M4", districtId: "nura" }];
    assert.equal(getAddAvailability(TEST_SCENARIO, choices, "M7").status, "available");
    const options = getDistrictOptions(TEST_SCENARIO, choices, "M7");
    assert.ok(options.find((o) => o.id === "nura")!.conflicts.length > 0);
    assert.deepEqual(options.find((o) => o.id === "yesil")!.conflicts, []);
  });

  it("район, выбранный в карточке до добавления, учитывается при добавлении", () => {
    // Сценарий: Нура выбрана для M7 заранее → в Нуру добавлена M4 → добавление M7.
    const m4 = TEST_SCENARIO.measures.find((m) => m.id === "M4")!;
    const choices = addChoice([], m4, "nura");

    const conflicting = getAddAvailability(TEST_SCENARIO, choices, "M7", "nura");
    assert.equal(conflicting.status, "blocked");
    assert.ok(
      conflicting.status === "blocked" &&
        conflicting.reasons.some(
          (r) => r.kind === "district-conflict" && r.districtId === "nura" && r.conflict.partner === "M4",
        ),
    );

    assert.equal(getAddAvailability(TEST_SCENARIO, choices, "M7", "yesil").status, "available");
    assert.equal(getAddAvailability(TEST_SCENARIO, choices, "M7", "").status, "available");
    assert.equal(getAddAvailability(TEST_SCENARIO, choices, "M7").status, "available");
  });

  it("неизвестный район для добавления блокирует кнопку", () => {
    const availability = getAddAvailability(TEST_SCENARIO, [], "M7", "atlantis");
    assert.ok(
      availability.status === "blocked" &&
        availability.reasons.some((r) => r.kind === "unknown-district" && r.districtId === "atlantis"),
    );
  });

  it("район-кандидат городской меры игнорируется", () => {
    assert.equal(getAddAvailability(TEST_SCENARIO, [], "M12", "nura").status, "available");
  });

  it("третья мера направления, бюджет и заполненные слоты объясняют блокировку", () => {
    const social = [{ measureId: "M7", districtId: "nura" }, { measureId: "M8", districtId: "nura" }];
    const byCategory = getAddAvailability(TEST_SCENARIO, social, "M9");
    assert.ok(
      byCategory.status === "blocked" &&
        byCategory.reasons.some((r) => r.kind === "category-limit" && r.category === "social"),
    );

    const pricey = withCosts({ M7: 60, M13: 45 });
    const budget = getAddAvailability(pricey, [{ measureId: "M7", districtId: "nura" }], "M13");
    assert.ok(budget.status === "blocked" && budget.reasons.some((r) => r.kind === "budget" && r.shortfall === 5));

    const full = getAddAvailability(TEST_SCENARIO, VALID, "M1");
    assert.ok(
      full.status === "blocked" &&
        full.reasons.some((r) => r.kind === "plan-full" && r.count === 5 && r.required === 5),
    );
  });

  it("удаление меры сразу освобождает карточку и бюджет", () => {
    const pricey = withCosts({ M7: 60, M13: 45 });
    const after = removeChoice([{ measureId: "M7", districtId: "nura" }], "M7");
    assert.equal(getAddAvailability(pricey, after, "M13").status, "available");
    assert.equal(getAddAvailability(pricey, after, "M7").status, "available");
  });

  it("выбранная мера помечается как выбранная, повторно не добавляется", () => {
    assert.equal(getAddAvailability(TEST_SCENARIO, VALID, "M7").status, "selected");
    const m7 = TEST_SCENARIO.measures.find((m) => m.id === "M7")!;
    assert.equal(addChoice(VALID, m7, "yesil"), VALID);
  });

  it("возможная синергия — только наличие пары", () => {
    assert.deepEqual(getPotentialSynergies(TEST_SCENARIO, VALID), [["M10", "M12"]]);
    assert.deepEqual(getPotentialSynergies({ ...TEST_SCENARIO, rules: null }, VALID), []);
  });
});

describe("локализация Planner: ru / kk / en", () => {
  const LOCALES = ["ru", "kk", "en"] as const;
  const CYRILLIC = /[А-Яа-яЁёӘәҒғҚқҢңӨөҰұҮүҺһІі]/;
  // Реальные ID пар и районов — чтобы названия и причины пришли из каталога GPT.
  const CONFLICT: readonly ChoiceDraft[] = [
    { measureId: "M1", districtId: "nura" },
    { measureId: "M3", districtId: "yesil" },
    { measureId: "M4", districtId: "nura" },
    { measureId: "M7", districtId: "nura" },
    { measureId: "M12", districtId: "nura" },
    { measureId: "M8" },
  ];

  it("в словарях одинаковые ключи во всех языках", () => {
    const keys = (value: object): string[] =>
      Object.entries(value).flatMap(([key, item]) =>
        typeof item === "object" && item !== null ? keys(item).map((nested) => `${key}.${nested}`) : [key],
      ).sort();
    assert.deepEqual(keys(plannerMessages.kk), keys(plannerMessages.ru));
    assert.deepEqual(keys(plannerMessages.en), keys(plannerMessages.ru));
  });

  it("причины validateDraft переводятся по code, английский текст без кириллицы", () => {
    const validation = validateDraft(TEST_SCENARIO, CONFLICT);
    const kinds = new Set(validation.issues.map((issue) => issue.code));
    for (const code of ["choice-count", "district-for-city", "district-required", "incompatible"] as const) {
      assert.ok(kinds.has(code), code);
    }
    for (const locale of LOCALES) {
      const t = createPlannerText(locale, TEST_SCENARIO);
      for (const issue of validation.issues) {
        const text = describeIssue(issue, TEST_SCENARIO, CONFLICT, validation, t);
        assert.ok(text.length > 0);
        if (locale === "en") assert.doesNotMatch(text, CYRILLIC, text);
      }
    }
    const en = createPlannerText("en", TEST_SCENARIO);
    const district = validation.issues.find((issue) => issue.code === "incompatible" && issue.districtId === "nura")!;
    assert.match(describeIssue(district, TEST_SCENARIO, CONFLICT, validation, en), /Nura/);
  });

  it("причины блокировки переводятся из данных, числа по intlLocale", () => {
    const pricey = withCosts({ M7: 60, M13: 45.5 });
    const blocked = getAddAvailability(pricey, [{ measureId: "M7", districtId: "nura" }], "M13");
    assert.equal(blocked.status, "blocked");
    const reasons = blocked.status === "blocked" ? blocked.reasons : [];
    assert.match(describeBlock(reasons[0], createPlannerText("ru", pricey)), /5,5 ед\./);
    assert.match(describeBlock(reasons[0], createPlannerText("en", pricey)), /5\.5 units/);
    assert.match(describeBlock(reasons[0], createPlannerText("kk", pricey)), /5,5 бірлік/);

    const conflict = getAddAvailability(TEST_SCENARIO, [{ measureId: "M4", districtId: "nura" }], "M7", "nura");
    const kk = createPlannerText("kk", TEST_SCENARIO);
    const text = conflict.status === "blocked" ? describeBlock(conflict.reasons[0], kk) : "";
    assert.match(text, /Нұра/);
    assert.doesNotMatch(text, /уже выбрана/);
  });

  it("смена языка не меняет доступность, расходы и выбор", () => {
    const base = validateDraft(TEST_SCENARIO, VALID);
    for (const locale of LOCALES) {
      createPlannerText(locale, TEST_SCENARIO);
      assert.deepEqual(validateDraft(TEST_SCENARIO, VALID), base);
      assert.equal(getAddAvailability(TEST_SCENARIO, VALID, "M1").status, "blocked");
    }
  });

  it("неизвестный ID сохраняет название из API", () => {
    const scenario: ScenarioVM = { ...TEST_SCENARIO, measures: [...TEST_SCENARIO.measures, measure("M99", "safety", "city")] };
    assert.equal(createPlannerText("en", scenario).measure("M99"), "Тестовая мера M99");
    const english = createPlannerText("en", scenario).measure("M7");
    assert.notEqual(english, "Тестовая мера M7");
    assert.doesNotMatch(english, CYRILLIC);
  });
});
