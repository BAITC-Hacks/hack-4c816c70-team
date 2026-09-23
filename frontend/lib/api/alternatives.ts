import type { ApiAlternativeGoal, ApiAlternativesDto, ApiAlternativeVariantDto, ApiPlanChoiceDto, ApiPlanFactDto, ApiPlanResultDto } from "../contracts/api.generated";
import type { AlternativesVM } from "../../features/alternatives/types";
import { ApiContractError } from "./adapter";

const goals = ["score", "equity", "economy"] as const;
const locales = ["ru-RU", "kk-KZ", "en-US"] as const;

function invalid(path: string): never { throw new ApiContractError(`Invalid alternatives response: ${path}.`); }
function object(value: unknown, path: string): Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value) ? value as Record<string, unknown> : invalid(path);
}
function array(value: unknown, path: string): unknown[] { return Array.isArray(value) ? value : invalid(path); }
function text(value: unknown, path: string): string { return typeof value === "string" && value.length > 0 ? value : invalid(path); }
function number(value: unknown, path: string): number { return typeof value === "number" && Number.isFinite(value) ? value : invalid(path); }
function count(value: unknown, path: string): number {
  const result = number(value, path);
  return Number.isInteger(result) && result >= 0 ? result : invalid(path);
}
function member<T extends string>(value: unknown, values: readonly T[], path: string): T {
  return typeof value === "string" && values.includes(value as T) ? value as T : invalid(path);
}
function nullableId(value: unknown, path: string): string | null { return value === null ? null : text(value, path); }
function unique(values: readonly string[], path: string): void { if (new Set(values).size !== values.length) invalid(path); }
function choice(value: unknown, path: string): ApiPlanChoiceDto {
  const item = object(value, path);
  const measureId = text(item.measureId, `${path}.measureId`);
  // City measures are serialized as districtId:null; UI choices omit that optional field.
  return item.districtId === null || item.districtId === undefined
    ? { measureId }
    : { measureId, districtId: text(item.districtId, `${path}.districtId`) };
}
function facts(value: unknown, path: string): ApiPlanFactDto[] {
  const items = array(value, path).map((value, index) => {
    const item = object(value, `${path}[${index}]`);
    return { id: text(item.id, `${path}.id`), text: text(item.text, `${path}.text`) };
  });
  unique(items.map((item) => item.id), path);
  return items;
}
function plan(value: unknown, path: string): ApiPlanResultDto {
  const item = object(value, path);
  const choices = array(item.choices, `${path}.choices`).map((value, index) => choice(value, `${path}.choices[${index}]`));
  if (choices.length !== 5) invalid(`${path}.choices length`);
  unique(choices.map((item) => item.measureId), `${path}.choices`);
  const breakdown = object(item.breakdown, `${path}.breakdown`);
  const districts = array(item.districts, `${path}.districts`).map((value) => {
    const district = object(value, `${path}.districts[]`);
    return { id: text(district.id, `${path}.district.id`), name: text(district.name, `${path}.district.name`), score: number(district.score, `${path}.district.score`) };
  });
  if (districts.length !== 5) invalid(`${path}.districts length`);
  unique(districts.map((district) => district.id), `${path}.districts`);
  return { choices, districts, spent: count(item.spent, `${path}.spent`), remaining: count(item.remaining, `${path}.remaining`), score: number(item.score, `${path}.score`), breakdown: {
    averageScore: number(breakdown.averageScore, `${path}.breakdown.averageScore`),
    minDistrictScore: number(breakdown.minDistrictScore, `${path}.breakdown.minDistrictScore`),
    criticalCount: count(breakdown.criticalCount, `${path}.breakdown.criticalCount`),
  } };
}

/** Validate the actual server DTO before mapping it to the component contract. No model arithmetic. */
export function parseAlternativesDto(value: unknown): ApiAlternativesDto {
  const root = object(value, "response");
  const goal = member(root.goal, goals, "goal");
  const searchScope = member(root.searchScope, ["single_swap"] as const, "searchScope");
  const original = plan(root.original, "original");
  const variants: ApiAlternativeVariantDto[] = array(root.variants, "variants").map((value, index) => {
    const path = `variants[${index}]`;
    const item = object(value, path);
    const change = object(item.change, `${path}.change`);
    const delta = object(item.delta, `${path}.delta`);
    const districtDeltas = object(delta.districts, `${path}.delta.districts`);
    const strategies = array(item.strategies, `${path}.strategies`).map((value) => member(value, goals, `${path}.strategies[]`));
    if (strategies.length === 0) invalid(`${path}.strategies`);
    unique(strategies, `${path}.strategies`);
    return {
      id: text(item.id, `${path}.id`), strategies, title: text(item.title, `${path}.title`), plan: plan(item.plan, `${path}.plan`),
      change: { kind: member(change.kind, ["move", "replace"] as const, `${path}.change.kind`), removed: choice(change.removed, `${path}.change.removed`), added: choice(change.added, `${path}.change.added`), text: text(change.text, `${path}.change.text`) },
      delta: { score: number(delta.score, `${path}.delta.score`), averageScore: number(delta.averageScore, `${path}.delta.averageScore`), minDistrictScore: number(delta.minDistrictScore, `${path}.delta.minDistrictScore`), criticalCount: number(delta.criticalCount, `${path}.delta.criticalCount`), spent: number(delta.spent, `${path}.delta.spent`), districts: Object.fromEntries(Object.entries(districtDeltas).map(([id, value]) => [id, number(value, `${path}.delta.districts.${id}`)])) },
      arguments: facts(item.arguments, `${path}.arguments`), tradeoffs: facts(item.tradeoffs, `${path}.tradeoffs`),
    };
  });
  unique(variants.map((variant) => variant.id), "variants.id");
  const byId = new Map(variants.map((variant) => [variant.id, variant]));
  const best = object(root.bestByGoal, "bestByGoal");
  const bestByGoal: Record<ApiAlternativeGoal, string | null> = { score: nullableId(best.score, "bestByGoal.score"), equity: nullableId(best.equity, "bestByGoal.equity"), economy: nullableId(best.economy, "bestByGoal.economy") };
  for (const strategy of goals) {
    const id = bestByGoal[strategy];
    if (id !== null && !byId.get(id)?.strategies.includes(strategy)) invalid(`bestByGoal.${strategy} reference`);
  }
  for (const variant of variants) {
    if (variant.strategies.some((strategy) => bestByGoal[strategy] !== variant.id)) invalid(`variants.${variant.id}.strategies reference`);
  }
  const recommendation = object(root.recommendation, "recommendation");
  const status = member(recommendation.status, ["improved", "no_improvement"] as const, "recommendation.status");
  const variantId = nullableId(recommendation.variantId, "recommendation.variantId");
  const arguments_ = facts(recommendation.arguments, "recommendation.arguments");
  const tradeoffs = facts(recommendation.tradeoffs, "recommendation.tradeoffs");
  const selected = variantId === null ? null : byId.get(variantId);
  if (status === "improved") {
    // AI may choose another eligible variant, independently of the deterministic bestByGoal winner.
    if (!selected || bestByGoal[goal] === null) invalid("recommendation.variantId reference");
    const improvement = goal === "score" ? selected.delta.score > 0 : goal === "equity" ? selected.delta.minDistrictScore > 0 : selected.delta.spent < 0;
    if (!improvement) invalid("recommendation goal improvement");
    if (arguments_.some((fact) => !selected.arguments.some((source) => source.id === fact.id && source.text === fact.text))
      || tradeoffs.some((fact) => !selected.tradeoffs.some((source) => source.id === fact.id && source.text === fact.text))) invalid("recommendation fact reference");
  } else if (variantId !== null || bestByGoal[goal] !== null || arguments_.length > 0 || tradeoffs.length > 0) invalid("no_improvement recommendation");
  const candidatesChecked = count(root.candidatesChecked, "candidatesChecked");
  const validCandidates = count(root.validCandidates, "validCandidates");
  if (validCandidates > candidatesChecked) invalid("validCandidates");
  return { goal, searchScope, candidatesChecked, validCandidates, original, bestByGoal, variants, recommendation: {
    status, variantId, title: text(recommendation.title, "recommendation.title"), text: text(recommendation.text, "recommendation.text"), arguments: arguments_, tradeoffs,
    source: member(recommendation.source, ["mock", "llm"] as const, "recommendation.source"),
  }, locale: member(root.locale, locales, "locale") };
}

export function alternativesToVm(dto: ApiAlternativesDto): AlternativesVM {
  const summary = (plan: ApiPlanResultDto) => ({ choices: plan.choices.map((choice) => choice.districtId == null ? { measureId: choice.measureId } : { measureId: choice.measureId, districtId: choice.districtId }), spent: plan.spent, score: plan.score, minDistrictScore: plan.breakdown.minDistrictScore });
  return {
    goal: dto.goal, original: summary(dto.original), bestByGoal: dto.bestByGoal, locale: dto.locale,
    variants: dto.variants.map((variant) => ({ id: variant.id, goals: variant.strategies, plan: summary(variant.plan), delta: { score: variant.delta.score, minDistrictScore: variant.delta.minDistrictScore, spent: variant.delta.spent }, gains: variant.arguments, losses: variant.tradeoffs })),
    advice: { status: dto.recommendation.status, variantId: dto.recommendation.variantId, text: dto.recommendation.text, source: dto.recommendation.source, gains: dto.recommendation.arguments, losses: dto.recommendation.tradeoffs },
  };
}
