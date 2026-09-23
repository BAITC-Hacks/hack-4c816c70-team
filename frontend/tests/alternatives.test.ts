import { strict as assert } from "node:assert";
import test from "node:test";
import type { ChoiceDraft, EvaluationVM, ScenarioVM } from "../lib/contracts/ui";
import { alternativesReducer, initialAlternativesState, type AlternativesState } from "../features/alternatives/alternatives-state";
import { diffPlans, samePlan } from "../features/alternatives/plan-diff";
import type { AlternativesVM } from "../features/alternatives/types";
import { choiceSetKey, initialSimulatorState, simulatorReducer } from "../features/simulator/simulator-reducer";

const plan: readonly ChoiceDraft[] = [{ measureId: "M7", districtId: "nura" }, { measureId: "M12" }, { measureId: "M5", districtId: "saryarka" }];
const better: readonly ChoiceDraft[] = [{ measureId: "M7", districtId: "nura" }, { measureId: "M12" }, { measureId: "M3", districtId: "nura" }];
const data = { goal: "score", original: { choices: plan, spent: 95, score: 56.54, minDistrictScore: 52.96 }, bestByGoal: { score: "a", equity: null, economy: null }, variants: [], advice: { status: "improved", variantId: "a", text: "…", source: "mock" }, locale: "ru-RU" } as unknown as AlternativesVM;
const scenario = { budget: 100, horizonQuarters: 8, criticalThreshold: 40, baselineScore: 52.56, indicators: [], districts: [], measures: [], rules: null, source: "api" } as unknown as ScenarioVM;
const result = { spent: 95, remaining: 5, baselineScore: 52.56, score: 56.54, districts: [], appliedEffects: null, appliedSynergies: [], explanation: { summary: "ok", strengths: [], risks: [], recommendations: [] }, explanationSource: "mock", explanationLocale: "ru-RU", source: "api" } as EvaluationVM;

const start = (state: AlternativesState, requestId: number, basisKey = "1|plan") => alternativesReducer(state, { type: "start", requestId, goal: "score", basisKey });

test("альтернативы: ответ принимается только для текущего запроса и плана", () => {
  const pending = start(initialAlternativesState, 1);
  assert.equal(alternativesReducer(pending, { type: "success", requestId: 0, basisKey: "1|plan", data }), pending);
  assert.equal(alternativesReducer(pending, { type: "success", requestId: 1, basisKey: "2|other", data }), pending);
  const done = alternativesReducer(pending, { type: "success", requestId: 1, basisKey: "1|plan", data });
  assert.equal(done.status, "success");
  assert.equal(done.status === "success" && done.goal, "score");
});

test("альтернативы: смена плана делает старый результат и поздний ответ неактуальными", () => {
  const done = alternativesReducer(start(initialAlternativesState, 1), { type: "success", requestId: 1, basisKey: "1|plan", data });
  assert.equal(alternativesReducer(done, { type: "invalidate" }).status, "idle");
  const pending = start(initialAlternativesState, 2);
  const invalidated = alternativesReducer(pending, { type: "invalidate" });
  assert.equal(alternativesReducer(invalidated, { type: "success", requestId: 2, basisKey: "1|plan", data }).status, "idle");
  assert.equal(alternativesReducer(invalidated, { type: "error", requestId: 2, basisKey: "1|plan", failure: "timeout" }).status, "idle");
});

test("альтернативы: повторный start во время запроса игнорируется, ошибку можно повторить", () => {
  const pending = start(initialAlternativesState, 3);
  assert.equal(start(pending, 4), pending);
  const failed = alternativesReducer(pending, { type: "error", requestId: 3, basisKey: "1|plan", failure: "network" });
  assert.equal(failed.status === "error" && failed.failure, "network");
  assert.equal(start(failed, 5).status, "pending");
});

test("сравнение планов не зависит от порядка и показывает замену", () => {
  assert.ok(samePlan([...plan].reverse(), plan));
  assert.ok(!samePlan(plan, better));
  assert.deepEqual(diffPlans(plan, better), { added: [{ measureId: "M3", districtId: "nura" }], removed: [{ measureId: "M5", districtId: "saryarka" }] });
  const moved = diffPlans([{ measureId: "M7", districtId: "nura" }], [{ measureId: "M7", districtId: "yesil" }]);
  assert.equal(moved.added.length, 1);
  assert.equal(moved.removed.length, 1);
});

test("«Применить» переносит полные choices без автоматической оценки", () => {
  let state = simulatorReducer(initialSimulatorState, { type: "scenario-ready", scenario });
  state = simulatorReducer(state, { type: "set-choices", choices: plan });
  state = simulatorReducer(state, { type: "evaluate-start", requestId: 1, submittedChoices: state.choices });
  state = simulatorReducer(state, { type: "evaluate-success", requestId: 1, revision: state.revision, result });
  const revision = state.revision;
  const applied = simulatorReducer(state, { type: "apply-alternative", choices: better, basisKey: `${state.revision}|${choiceSetKey(state.choices)}` });
  assert.deepEqual(applied.choices, better);
  assert.notEqual(applied.choices[0], better[0]);
  assert.equal(applied.evaluation.status, "idle");
  assert.equal(applied.revision, revision + 1);
  assert.equal(applied.appliedAlternative, true);
  assert.equal(applied.history.length, 1);
  assert.equal(simulatorReducer(applied, { type: "set-choices", choices: plan }).appliedAlternative, false);
  const evaluated = simulatorReducer(simulatorReducer(applied, { type: "evaluate-start", requestId: 2, submittedChoices: applied.choices }), { type: "evaluate-success", requestId: 2, revision: applied.revision, result: { ...result, score: 57.21 } });
  assert.equal(evaluated.appliedAlternative, false);
  assert.deepEqual(evaluated.history.map((attempt) => attempt.result.score), [56.54, 57.21]);
});

test("«Применить» не меняет план во время оценки", () => {
  let state = simulatorReducer(initialSimulatorState, { type: "scenario-ready", scenario });
  state = simulatorReducer(state, { type: "evaluate-start", requestId: 1, submittedChoices: [] });
  assert.equal(simulatorReducer(state, { type: "apply-alternative", choices: better, basisKey: `${state.revision}|${choiceSetKey(state.choices)}` }), state);
});


test("stale alternative cannot overwrite an edited plan", () => {
  let state = simulatorReducer(initialSimulatorState, { type: "scenario-ready", scenario });
  state = simulatorReducer(state, { type: "set-choices", choices: plan });
  const basisKey = `${state.revision}|${choiceSetKey(state.choices)}`;
  const edited = simulatorReducer(state, { type: "set-choices", choices: better });
  assert.equal(simulatorReducer(edited, { type: "apply-alternative", choices: plan, basisKey }), edited);
});
