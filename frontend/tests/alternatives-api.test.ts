import { strict as assert } from "node:assert";
import test from "node:test";
import { alternativesToVm, parseAlternativesDto } from "../lib/api/alternatives";
import { buildAlternativesRequestInit } from "../lib/api/request";
import type { ApiAlternativesDto, ApiPlanChoiceDto, ApiPlanResultDto } from "../lib/contracts/api.generated";

const choices: ApiPlanChoiceDto[] = [
  { measureId: "M7", districtId: "nura" }, { measureId: "M8", districtId: "nura" },
  { measureId: "M10", districtId: "nura" }, { measureId: "M12", districtId: null },
  { measureId: "M5", districtId: "saryarka" },
];
const districts = ["yesil", "almaty", "saryarka", "baikonur", "nura"].map((id) => ({ id, name: id, score: 52.96 }));
function plan(choices: ApiPlanChoiceDto[], spent: number, score: number, minimum = 52.96): ApiPlanResultDto {
  return { choices, spent, remaining: 100 - spent, score, breakdown: { averageScore: 58.08, minDistrictScore: minimum, criticalCount: 0 }, districts };
}
function response(): ApiAlternativesDto {
  const first = { id: "best-score", strategies: ["score", "equity"] as const, title: "Best single swap", plan: plan([...choices.slice(0, 4), { measureId: "M3", districtId: "nura" }], 100, 57.21, 53.5), change: { kind: "replace" as const, removed: choices[4], added: { measureId: "M3", districtId: "nura" }, text: "Replace M5 with M3" }, delta: { score: 0.67, averageScore: 0.1, minDistrictScore: 0.54, criticalCount: 0, spent: 5, districts: { nura: 0.54 } }, arguments: [{ id: "score_up", text: "Score +0.67" }], tradeoffs: [{ id: "cost_up", text: "Spending +5" }] };
  const second = { id: "best-economy", strategies: ["economy"] as const, title: "Best single swap", plan: plan([...choices.slice(0, 4), { measureId: "M14", districtId: null }], 86, 56.99), change: { kind: "replace" as const, removed: choices[4], added: { measureId: "M14", districtId: null }, text: "Replace M5 with M14" }, delta: { score: 0.45, averageScore: 0.1, minDistrictScore: 0, criticalCount: 0, spent: -9, districts: { nura: 0 } }, arguments: [{ id: "score_up", text: "Score +0.45" }, { id: "cost_down", text: "Spending -9" }], tradeoffs: [] };
  return { goal: "score", searchScope: "single_swap", candidatesChecked: 265, validCandidates: 117, original: plan(choices, 95, 56.54), bestByGoal: { score: first.id, equity: first.id, economy: second.id }, variants: [{ ...first, strategies: [...first.strategies] }, { ...second, strategies: [...second.strategies] }], recommendation: { status: "improved", variantId: first.id, title: first.title, text: first.change.text, arguments: first.arguments, tradeoffs: first.tradeoffs, source: "mock" }, locale: "en-US" };
}

test("alternatives request uses the published body and language header", () => {
  const payload = choices.map((choice) => choice.districtId == null ? { measureId: choice.measureId } : { measureId: choice.measureId, districtId: choice.districtId });
  const init = buildAlternativesRequestInit(payload, "economy", "kk-KZ");
  assert.equal(init.method, "POST");
  assert.deepEqual(init.headers, { "Content-Type": "application/json", "Accept-Language": "kk-KZ" });
  assert.deepEqual(JSON.parse(init.body as string), { choices: payload, goal: "economy" });
});

test("real alternatives DTO maps server metrics and city nulls without arithmetic", () => {
  const vm = alternativesToVm(parseAlternativesDto(response()));
  assert.equal(vm.original.score, 56.54);
  assert.equal(vm.original.minDistrictScore, 52.96);
  assert.equal(vm.variants[0].plan.minDistrictScore, 53.5);
  assert.equal(vm.variants[0].delta.score, 0.67);
  assert.deepEqual(vm.original.choices[3], { measureId: "M12" });
  assert.deepEqual(vm.variants[1].plan.choices[4], { measureId: "M14" });
  assert.deepEqual(vm.advice.losses, [{ id: "cost_up", text: "Spending +5" }]);
});

test("AI recommendation keeps its chosen variant and facts independently of bestByGoal", () => {
  const dto = response();
  const selected = dto.variants[1];
  dto.recommendation = { ...dto.recommendation, variantId: selected.id, text: selected.change.text, arguments: [selected.arguments[1]], tradeoffs: selected.tradeoffs, source: "llm" };
  const vm = alternativesToVm(parseAlternativesDto(dto));
  assert.equal(vm.bestByGoal.score, "best-score");
  assert.equal(vm.advice.variantId, "best-economy");
  assert.equal(vm.advice.source, "llm");
  assert.deepEqual(vm.advice.gains, [{ id: "cost_down", text: "Spending -9" }]);
});

test("no improvement for a goal preserves other strategy variants", () => {
  const dto = response();
  dto.goal = "equity";
  dto.bestByGoal.equity = null;
  dto.variants[0].strategies = ["score"];
  dto.recommendation = { status: "no_improvement", variantId: null, title: "No improvement", text: "No improving single replacement", arguments: [], tradeoffs: [], source: "mock" };
  const vm = alternativesToVm(parseAlternativesDto(dto));
  assert.equal(vm.advice.status, "no_improvement");
  assert.equal(vm.variants.length, 2);
});

test("broken variant/fact references, non-finite metrics and unknown locale are rejected", () => {
  let dto = response(); dto.bestByGoal.score = "missing"; assert.throws(() => parseAlternativesDto(dto));
  dto = response(); dto.recommendation.variantId = "missing"; assert.throws(() => parseAlternativesDto(dto));
  dto = response(); dto.recommendation.arguments = [{ id: "invented", text: "Invented" }]; assert.throws(() => parseAlternativesDto(dto));
  dto = response(); dto.original.score = Number.NaN; assert.throws(() => parseAlternativesDto(dto));
  assert.throws(() => parseAlternativesDto({ ...response(), locale: "de-DE" }));
  dto = response(); dto.variants[1].strategies = ["score"]; assert.throws(() => parseAlternativesDto(dto));
});
