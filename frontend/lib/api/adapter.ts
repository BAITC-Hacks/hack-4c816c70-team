import type {
  ApiEvaluationDto,
  ApiScenarioDto,
} from "@/lib/contracts/api.generated";
import type {
  AppliedEffectVM,
  AppliedSynergyVM,
  CategoryId,
  DistrictResultVM,
  EvaluationVM,
  IndicatorEffects,
  IndicatorId,
  IndicatorValues,
  ScenarioVM,
} from "@/lib/contracts/ui";

const indicatorIds = ["T1", "T2", "E1", "E2", "S1", "S2", "B1", "B2", "C1", "C2"] as const;
const categories = ["transport", "ecology", "social", "safety", "services"] as const;

export class ApiContractError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ApiContractError";
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function expectRecord(value: unknown, path: string): Record<string, unknown> {
  if (!isRecord(value)) throw new ApiContractError(`Некорректный ответ API: ${path} должен быть объектом.`);
  return value;
}

function expectArray(value: unknown, path: string): unknown[] {
  if (!Array.isArray(value)) throw new ApiContractError(`Некорректный ответ API: ${path} должен быть массивом.`);
  return value;
}

function expectString(value: unknown, path: string): string {
  if (typeof value !== "string" || value.length === 0) throw new ApiContractError(`Некорректный ответ API: ${path} должен быть непустой строкой.`);
  return value;
}

function expectNumber(value: unknown, path: string): number {
  if (typeof value !== "number" || !Number.isFinite(value)) throw new ApiContractError(`Некорректный ответ API: ${path} должен быть числом.`);
  return value;
}

function expectBoolean(value: unknown, path: string): boolean {
  if (typeof value !== "boolean") throw new ApiContractError(`Некорректный ответ API: ${path} должен быть булевым значением.`);
  return value;
}

function expectIndicatorId(value: unknown, path: string): IndicatorId {
  const id = expectString(value, path);
  if (!indicatorIds.includes(id as IndicatorId)) throw new ApiContractError(`Некорректный ответ API: неизвестный показатель ${id}.`);
  return id as IndicatorId;
}

function expectCategory(value: unknown, path: string): CategoryId {
  const category = expectString(value, path);
  if (!categories.includes(category as CategoryId)) throw new ApiContractError(`Некорректный ответ API: неизвестное направление ${category}.`);
  return category as CategoryId;
}

function indicatorValues(value: unknown, path: string): IndicatorValues {
  const values = expectRecord(value, path);
  const output = {} as Record<IndicatorId, number>;
  for (const id of indicatorIds) output[id] = expectNumber(values[id], `${path}.${id}`);
  return output;
}

function indicatorEffects(value: unknown, path: string): IndicatorEffects {
  const values = expectRecord(value, path);
  const output: Partial<Record<IndicatorId, number>> = {};
  for (const [id, delta] of Object.entries(values)) output[expectIndicatorId(id, `${path} key`)] = expectNumber(delta, `${path}.${id}`);
  return output;
}

/** Runtime validation of raw JSON before it enters the UI layer. */
export function parseScenarioDto(value: unknown): ApiScenarioDto {
  const root = expectRecord(value, "ответ");
  const indicators = expectArray(root.indicators, "indicators").map((item, index) => {
    const dto = expectRecord(item, `indicators[${index}]`);
    return { id: expectIndicatorId(dto.id, `indicators[${index}].id`), name: expectString(dto.name, `indicators[${index}].name`), category: expectCategory(dto.category, `indicators[${index}].category`), weight: expectNumber(dto.weight, `indicators[${index}].weight`) };
  });
  const districts = expectArray(root.districts, "districts").map((item, index) => {
    const dto = expectRecord(item, `districts[${index}]`);
    return { id: expectString(dto.id, `districts[${index}].id`), name: expectString(dto.name, `districts[${index}].name`), populationShare: expectNumber(dto.populationShare, `districts[${index}].populationShare`), indicators: indicatorValues(dto.indicators, `districts[${index}].indicators`) };
  });
  const measures = expectArray(root.measures, "measures").map((item, index) => {
    const dto = expectRecord(item, `measures[${index}]`);
    const scope = expectString(dto.scope, `measures[${index}].scope`);
    if (scope !== "district" && scope !== "city") throw new ApiContractError(`Некорректный ответ API: неизвестный охват ${scope}.`);
    return { id: expectString(dto.id, `measures[${index}].id`), category: expectCategory(dto.category, `measures[${index}].category`), name: expectString(dto.name, `measures[${index}].name`), scope, cost: expectNumber(dto.cost, `measures[${index}].cost`), lagQuarters: expectNumber(dto.lagQuarters, `measures[${index}].lagQuarters`), effects: indicatorEffects(dto.effects, `measures[${index}].effects`) };
  });
  const synergies = expectArray(root.synergies, "synergies").map((item, index) => {
    const dto = expectRecord(item, `synergies[${index}]`);
    return { firstMeasureId: expectString(dto.firstMeasureId, `synergies[${index}].firstMeasureId`), secondMeasureId: expectString(dto.secondMeasureId, `synergies[${index}].secondMeasureId`), indicatorId: expectIndicatorId(dto.indicatorId, `synergies[${index}].indicatorId`), bonus: expectNumber(dto.bonus, `synergies[${index}].bonus`) };
  });
  const incompatibilities = expectArray(root.incompatibilities, "incompatibilities").map((item, index) => {
    const dto = expectRecord(item, `incompatibilities[${index}]`);
    return { firstMeasureId: expectString(dto.firstMeasureId, `incompatibilities[${index}].firstMeasureId`), secondMeasureId: expectString(dto.secondMeasureId, `incompatibilities[${index}].secondMeasureId`), sameDistrictOnly: expectBoolean(dto.sameDistrictOnly, `incompatibilities[${index}].sameDistrictOnly`), reason: expectString(dto.reason, `incompatibilities[${index}].reason`) };
  });
  return { budget: expectNumber(root.budget, "budget"), horizonQuarters: expectNumber(root.horizonQuarters, "horizonQuarters"), choicesRequired: expectNumber(root.choicesRequired, "choicesRequired"), maxMeasuresPerCategory: expectNumber(root.maxMeasuresPerCategory, "maxMeasuresPerCategory"), criticalThreshold: expectNumber(root.criticalThreshold, "criticalThreshold"), baselineScore: expectNumber(root.baselineScore, "baselineScore"), indicators, districts, measures, synergies, incompatibilities };
}

export function scenarioToVm(dto: ApiScenarioDto): ScenarioVM {
  return {
    budget: dto.budget, horizonQuarters: dto.horizonQuarters, criticalThreshold: dto.criticalThreshold, baselineScore: dto.baselineScore,
    indicators: dto.indicators.map((item) => ({ id: item.id as IndicatorId, name: item.name, weight: item.weight })),
    districts: dto.districts.map((item) => ({ id: item.id, name: item.name, populationShare: item.populationShare, indicators: item.indicators as IndicatorValues })),
    measures: dto.measures.map((item) => ({ id: item.id, category: item.category as CategoryId, name: item.name, scope: item.scope as "district" | "city", cost: item.cost, lagQuarters: item.lagQuarters, effects: item.effects as IndicatorEffects })),
    rules: { requiredChoices: dto.choicesRequired, maxPerCategory: dto.maxMeasuresPerCategory, uniqueMeasures: true, incompatibilities: dto.incompatibilities.map((item) => ({ measureIds: [item.firstMeasureId, item.secondMeasureId], scope: item.sameDistrictOnly ? "same-district" : "global", reason: item.reason })), synergies: dto.synergies.map((item) => ({ measureIds: [item.firstMeasureId, item.secondMeasureId], targetMeasureId: item.firstMeasureId, effects: { [item.indicatorId]: item.bonus } })) },
    source: "api",
  };
}

export function parseEvaluationDto(value: unknown): ApiEvaluationDto {
  const root = expectRecord(value, "ответ");
  const districts = expectArray(root.districts, "districts").map((item, index) => {
    const dto = expectRecord(item, `districts[${index}]`);
    return { id: expectString(dto.id, `districts[${index}].id`), name: expectString(dto.name, `districts[${index}].name`), scoreBefore: expectNumber(dto.scoreBefore, `districts[${index}].scoreBefore`), scoreAfter: expectNumber(dto.scoreAfter, `districts[${index}].scoreAfter`), indicatorsBefore: indicatorValues(dto.indicatorsBefore, `districts[${index}].indicatorsBefore`), indicatorsAfter: indicatorValues(dto.indicatorsAfter, `districts[${index}].indicatorsAfter`) };
  });
  const appliedSynergies = expectArray(root.appliedSynergies, "appliedSynergies").map((item, index) => {
    const dto = expectRecord(item, `appliedSynergies[${index}]`);
    const ids = expectArray(dto.measureIds, `appliedSynergies[${index}].measureIds`);
    if (ids.length !== 2) throw new ApiContractError("Некорректный ответ API: синергия должна содержать две меры.");
    return { measureIds: [expectString(ids[0], `appliedSynergies[${index}].measureIds[0]`), expectString(ids[1], `appliedSynergies[${index}].measureIds[1]`)] as [string, string], districtId: expectString(dto.districtId, `appliedSynergies[${index}].districtId`), indicatorId: expectIndicatorId(dto.indicatorId, `appliedSynergies[${index}].indicatorId`), delta: expectNumber(dto.delta, `appliedSynergies[${index}].delta`) };
  });
  const explanation = expectRecord(root.explanation, "explanation");
  const appliedEffects = root.appliedEffects === undefined ? undefined : expectArray(root.appliedEffects, "appliedEffects").map((item, index) => {
    const path = `appliedEffects[${index}]`;
    const dto = expectRecord(item, path);
    return { measureId: expectString(dto.measureId, `${path}.measureId`), districtId: expectString(dto.districtId, `${path}.districtId`), indicatorId: expectIndicatorId(dto.indicatorId, `${path}.indicatorId`), delta: expectNumber(dto.delta, `${path}.delta`) };
  });
  const stringList = (value: unknown, path: string) => expectArray(value, path).map((entry, index) => expectString(entry, `${path}[${index}]`));
  const explanationSource = expectString(root.explanationSource, "explanationSource");
  if (explanationSource !== "llm" && explanationSource !== "mock") throw new ApiContractError("Некорректный ответ API: неизвестный источник объяснения.");
  // Older API builds without the field always answered in Russian (documented fallback).
  const explanationLocale = root.explanationLocale === undefined ? "ru-RU" : expectString(root.explanationLocale, "explanationLocale");
  if (explanationLocale !== "ru-RU" && explanationLocale !== "kk-KZ" && explanationLocale !== "en-US") throw new ApiContractError("Некорректный ответ API: неизвестный язык объяснения.");
  return { spent: expectNumber(root.spent, "spent"), remaining: expectNumber(root.remaining, "remaining"), baselineScore: expectNumber(root.baselineScore, "baselineScore"), score: expectNumber(root.score, "score"), districts, appliedSynergies, appliedEffects, explanation: { summary: expectString(explanation.summary, "explanation.summary"), strengths: stringList(explanation.strengths, "explanation.strengths"), risks: stringList(explanation.risks, "explanation.risks"), recommendations: stringList(explanation.recommendations, "explanation.recommendations") }, explanationSource, explanationLocale };
}

export function evaluationToVm(dto: ApiEvaluationDto): EvaluationVM {
  const districts: DistrictResultVM[] = dto.districts.map((district) => {
    const indicatorDeltas: Partial<Record<IndicatorId, number>> = {};
    for (const id of indicatorIds) indicatorDeltas[id] = district.indicatorsAfter[id] - district.indicatorsBefore[id];
    return { ...district, indicatorsBefore: district.indicatorsBefore as IndicatorValues, indicatorsAfter: district.indicatorsAfter as IndicatorValues, scoreDelta: district.scoreAfter - district.scoreBefore, indicatorDeltas };
  });
  const appliedSynergies: AppliedSynergyVM[] = dto.appliedSynergies.map((item) => ({ ...item, measureIds: item.measureIds, indicatorId: item.indicatorId as IndicatorId }));
  const appliedEffects: AppliedEffectVM[] | null = dto.appliedEffects?.map((item) => ({ ...item, indicatorId: item.indicatorId as IndicatorId })) ?? null;
  return { spent: dto.spent, remaining: dto.remaining, baselineScore: dto.baselineScore, score: dto.score, scoreDelta: dto.score - dto.baselineScore, districts, appliedEffects, appliedSynergies, explanation: dto.explanation, explanationSource: dto.explanationSource, explanationLocale: dto.explanationLocale, source: "api" };
}
