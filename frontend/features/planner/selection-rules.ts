/**
 * Проверки черновика пяти решений для формы.
 * Здесь только ограничения выбора и арифметика цен: Score, лаги, эффекты и
 * синергические бонусы рассчитывает C# API, он же — окончательный валидатор.
 */
import type {
  CategoryId,
  ChoiceDraft,
  DistrictId,
  DistrictVM,
  MeasureId,
  MeasureVM,
  ScenarioVM,
  SelectionIssue,
  ValidateDraft,
} from "@/lib/contracts/ui";
import { CATEGORY_LABELS, formatUnits } from "./labels";

type MeasureIndex = ReadonlyMap<MeasureId, MeasureVM>;

export function indexMeasures(scenario: ScenarioVM): MeasureIndex {
  return new Map(scenario.measures.map((measure) => [measure.id, measure]));
}

function indexDistricts(scenario: ScenarioVM): ReadonlyMap<DistrictId, DistrictVM> {
  return new Map(scenario.districts.map((district) => [district.id, district]));
}

/** Назначен ли район. Пустая строка и null считаются отсутствием района. */
export function hasDistrict(
  choice: ChoiceDraft,
): choice is ChoiceDraft & { readonly districtId: DistrictId } {
  const districtId: unknown = choice.districtId;
  return typeof districtId === "string" && districtId !== "";
}

function sumCosts(choices: readonly ChoiceDraft[], measures: MeasureIndex): number {
  let spent = 0;
  for (const choice of choices) {
    spent += measures.get(choice.measureId)?.cost ?? 0;
  }
  return spent;
}

function districtLabel(districts: ReadonlyMap<DistrictId, DistrictVM>, id: DistrictId): string {
  return `«${districts.get(id)?.name ?? id}»`;
}

function countMessage(count: number, required: number): string {
  if (count < required) {
    return `Выбрано ${count} из ${required} мер: добавьте ещё ${required - count}.`;
  }
  return `Выбрано ${count} мер, а нужно ровно ${required}: уберите ${count - required}.`;
}

/** Уникальные известные меры набора по направлениям. */
function measuresByCategory(
  choices: readonly ChoiceDraft[],
  measures: MeasureIndex,
): Map<CategoryId, MeasureId[]> {
  const byCategory = new Map<CategoryId, MeasureId[]>();
  const seen = new Set<MeasureId>();
  for (const choice of choices) {
    const measure = measures.get(choice.measureId);
    if (!measure || seen.has(measure.id)) continue;
    seen.add(measure.id);
    const ids = byCategory.get(measure.category) ?? [];
    ids.push(measure.id);
    byCategory.set(measure.category, ids);
  }
  return byCategory;
}

export const validateDraft: ValidateDraft = (scenario, choices) => {
  const measures = indexMeasures(scenario);
  const provisionalSpent = sumCosts(choices, measures);
  const provisionalRemaining = scenario.budget - provisionalSpent;
  const rules = scenario.rules;

  if (rules === null) {
    return {
      issues: [
        {
          code: "rules-unavailable",
          message: "Правила выбора ещё не получены от сервера: оценка недоступна.",
        },
      ],
      canSubmit: false,
      provisionalSpent,
      provisionalRemaining,
    };
  }

  const districts = indexDistricts(scenario);
  const issues: SelectionIssue[] = [];

  if (choices.length !== rules.requiredChoices) {
    issues.push({ code: "choice-count", message: countMessage(choices.length, rules.requiredChoices) });
  }

  const occurrences = new Map<MeasureId, number>();
  for (const choice of choices) {
    occurrences.set(choice.measureId, (occurrences.get(choice.measureId) ?? 0) + 1);
  }
  for (const [measureId, count] of occurrences) {
    if (count > 1) {
      issues.push({
        code: "duplicate-measure",
        message: `${measureId} выбрана ${count} раза: каждую меру можно выбрать только один раз, даже в разных районах.`,
        measureIds: [measureId],
      });
    }
  }

  for (const choice of choices) {
    const measure = measures.get(choice.measureId);
    if (!measure) {
      issues.push({
        code: "unknown-measure",
        message: `Меры «${choice.measureId}» нет в каталоге.`,
        measureIds: [choice.measureId],
      });
      continue;
    }
    if (measure.scope === "city") {
      if (choice.districtId !== undefined) {
        issues.push({
          code: "district-for-city",
          message: `${measure.id} действует на весь город: район ей не назначается.`,
          measureIds: [measure.id],
        });
      }
    } else if (!hasDistrict(choice)) {
      issues.push({
        code: "district-required",
        message: `Для ${measure.id} не выбран район.`,
        measureIds: [measure.id],
      });
    } else if (!districts.has(choice.districtId)) {
      issues.push({
        code: "invalid-district",
        message: `Для ${measure.id} указан неизвестный район «${choice.districtId}».`,
        measureIds: [measure.id],
        districtId: choice.districtId,
      });
    }
  }

  if (provisionalSpent > scenario.budget) {
    issues.push({
      code: "budget-exceeded",
      message: `Недостаточно бюджета: набор стоит ${formatUnits(provisionalSpent)} ед. при бюджете ${formatUnits(scenario.budget)}, не хватает ${formatUnits(provisionalSpent - scenario.budget)} ед.`,
    });
  }

  for (const [category, ids] of measuresByCategory(choices, measures)) {
    if (ids.length > rules.maxPerCategory) {
      issues.push({
        code: "category-limit",
        message: `По направлению «${CATEGORY_LABELS[category]}» выбрано ${ids.length} меры, допускается не больше ${rules.maxPerCategory}.`,
        measureIds: ids,
      });
    }
  }

  for (const rule of rules.incompatibilities) {
    const [first, second] = rule.measureIds;
    const firstChoices = choices.filter((choice) => choice.measureId === first);
    const secondChoices = choices.filter((choice) => choice.measureId === second);
    if (firstChoices.length === 0 || secondChoices.length === 0) continue;

    if (rule.scope === "global") {
      issues.push({
        code: "incompatible",
        message: `${first} и ${second} нельзя выбрать вместе ни в каком районе: ${rule.reason}`,
        measureIds: [first, second],
      });
      continue;
    }

    const conflictDistricts = new Set<DistrictId>();
    for (const a of firstChoices) {
      if (!hasDistrict(a)) continue;
      if (secondChoices.some((b) => b.districtId === a.districtId)) {
        conflictDistricts.add(a.districtId);
      }
    }
    for (const districtId of conflictDistricts) {
      issues.push({
        code: "incompatible",
        message: `${first} и ${second} в районе ${districtLabel(districts, districtId)}: ${rule.reason}`,
        measureIds: [first, second],
        districtId,
      });
    }
  }

  return {
    issues,
    canSubmit: issues.length === 0,
    provisionalSpent,
    provisionalRemaining,
  };
};

/* ---------- Доступность действий в форме ---------- */

/**
 * Причины без текста: только код и исходные данные. Перевод собирает словарь
 * planner (messages.ts) по locale, поэтому правила не зависят от языка.
 */
export type AddBlockReason =
  | { readonly kind: "rules-unavailable" }
  | { readonly kind: "unknown-measure"; readonly measureId: MeasureId }
  | { readonly kind: "plan-full"; readonly count: number; readonly required: number }
  | { readonly kind: "category-limit"; readonly category: CategoryId; readonly measureIds: readonly MeasureId[] }
  | { readonly kind: "incompatible"; readonly partner: MeasureId; readonly pair: readonly [MeasureId, MeasureId]; readonly reason: string }
  | { readonly kind: "budget"; readonly shortfall: number }
  | { readonly kind: "district-conflict"; readonly districtId: DistrictId; readonly conflict: DistrictConflict }
  | { readonly kind: "unknown-district"; readonly districtId: DistrictId }
  | { readonly kind: "all-districts-conflict" };

export type MeasureAvailability =
  | { readonly status: "selected" }
  | { readonly status: "available" }
  | { readonly status: "blocked"; readonly reasons: readonly AddBlockReason[] };

/** Конфликт «в одном районе»: уже выбранная мера-партнёр и исходная причина правила из API. */
export interface DistrictConflict {
  readonly partner: MeasureId;
  readonly pair: readonly [MeasureId, MeasureId];
  readonly reason: string;
}

export interface DistrictOption {
  readonly id: DistrictId;
  readonly name: string;
  /** Конфликты «в одном районе» с уже выбранными мерами. Пусто — назначение допустимо. */
  readonly conflicts: readonly DistrictConflict[];
}

/** Конфликты назначения measureId в districtId с остальными выбранными мерами. */
export function getDistrictConflicts(
  scenario: ScenarioVM,
  choices: readonly ChoiceDraft[],
  measureId: MeasureId,
  districtId: DistrictId,
): DistrictConflict[] {
  const rules = scenario.rules;
  if (rules === null) return [];
  const conflicts: DistrictConflict[] = [];
  for (const rule of rules.incompatibilities) {
    if (rule.scope !== "same-district") continue;
    const [first, second] = rule.measureIds;
    const partner = first === measureId ? second : second === measureId ? first : null;
    if (partner === null) continue;
    const clash = choices.some(
      (choice) => choice.measureId === partner && choice.districtId === districtId,
    );
    if (clash) conflicts.push({ partner, pair: rule.measureIds, reason: rule.reason });
  }
  return conflicts;
}

export function getDistrictOptions(
  scenario: ScenarioVM,
  choices: readonly ChoiceDraft[],
  measureId: MeasureId,
): DistrictOption[] {
  return scenario.districts.map((district) => ({
    id: district.id,
    name: district.name,
    conflicts: getDistrictConflicts(scenario, choices, measureId, district.id),
  }));
}

/**
 * Можно ли добавить меру к текущему набору и почему нет.
 * districtId — район, который будет назначен при добавлении («» — без района);
 * конфликт этого назначения блокирует добавление, другие районы остаются доступны.
 */
export function getAddAvailability(
  scenario: ScenarioVM,
  choices: readonly ChoiceDraft[],
  measureId: MeasureId,
  districtId: DistrictId | "" = "",
): MeasureAvailability {
  if (choices.some((choice) => choice.measureId === measureId)) {
    return { status: "selected" };
  }

  const rules = scenario.rules;
  if (rules === null) {
    return { status: "blocked", reasons: [{ kind: "rules-unavailable" }] };
  }

  const measures = indexMeasures(scenario);
  const measure = measures.get(measureId);
  if (!measure) {
    return { status: "blocked", reasons: [{ kind: "unknown-measure", measureId }] };
  }

  const reasons: AddBlockReason[] = [];

  if (choices.length >= rules.requiredChoices) {
    reasons.push({ kind: "plan-full", count: choices.length, required: rules.requiredChoices });
  }

  const sameCategory = measuresByCategory(choices, measures).get(measure.category) ?? [];
  if (sameCategory.length >= rules.maxPerCategory) {
    reasons.push({ kind: "category-limit", category: measure.category, measureIds: sameCategory });
  }

  for (const rule of rules.incompatibilities) {
    if (rule.scope !== "global") continue;
    const [first, second] = rule.measureIds;
    const partner = first === measureId ? second : second === measureId ? first : null;
    if (partner !== null && choices.some((choice) => choice.measureId === partner)) {
      reasons.push({ kind: "incompatible", partner, pair: rule.measureIds, reason: rule.reason });
    }
  }

  const spent = sumCosts(choices, measures);
  if (spent + measure.cost > scenario.budget) {
    reasons.push({ kind: "budget", shortfall: spent + measure.cost - scenario.budget });
  }

  if (measure.scope === "district" && districtId !== "") {
    if (!scenario.districts.some((candidate) => candidate.id === districtId)) {
      reasons.push({ kind: "unknown-district", districtId });
    } else {
      for (const conflict of getDistrictConflicts(scenario, choices, measureId, districtId)) {
        reasons.push({ kind: "district-conflict", districtId, conflict });
      }
    }
  }

  if (
    measure.scope === "district" &&
    scenario.districts.length > 0 &&
    scenario.districts.every(
      (district) => getDistrictConflicts(scenario, choices, measureId, district.id).length > 0,
    )
  ) {
    reasons.push({ kind: "all-districts-conflict" });
  }

  return reasons.length === 0 ? { status: "available" } : { status: "blocked", reasons };
}

/** Пары возможной синергии в текущем наборе — только справка, без чисел. */
export function getPotentialSynergies(
  scenario: ScenarioVM,
  choices: readonly ChoiceDraft[],
): (readonly [MeasureId, MeasureId])[] {
  if (scenario.rules === null) return [];
  const selected = new Set(choices.map((choice) => choice.measureId));
  return scenario.rules.synergies
    .filter(({ measureIds: [a, b] }) => selected.has(a) && selected.has(b))
    .map(({ measureIds }) => measureIds);
}

/* ---------- Иммутабельные изменения черновика ---------- */

function makeChoice(measure: MeasureVM, districtId: DistrictId | ""): ChoiceDraft {
  if (measure.scope === "city" || districtId === "") return { measureId: measure.id };
  return { measureId: measure.id, districtId };
}

export function addChoice(
  choices: readonly ChoiceDraft[],
  measure: MeasureVM,
  districtId: DistrictId | "",
): readonly ChoiceDraft[] {
  if (choices.some((choice) => choice.measureId === measure.id)) return choices;
  return [...choices, makeChoice(measure, districtId)];
}

export function removeChoice(
  choices: readonly ChoiceDraft[],
  measureId: MeasureId,
): readonly ChoiceDraft[] {
  return choices.filter((choice) => choice.measureId !== measureId);
}

export function setChoiceDistrict(
  choices: readonly ChoiceDraft[],
  measure: MeasureVM,
  districtId: DistrictId | "",
): readonly ChoiceDraft[] {
  return choices.map((choice) =>
    choice.measureId === measure.id ? makeChoice(measure, districtId) : choice,
  );
}
