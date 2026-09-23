import { strict as assert } from "node:assert";
import test from "node:test";
import type { EvaluationVM, ScenarioVM } from "../lib/contracts/ui";
import { initialSimulatorState, simulatorReducer } from "../features/simulator/simulator-reducer";

const scenario = {
  budget: 100, horizonQuarters: 8, criticalThreshold: 40, baselineScore: 52.56,
  indicators: [], districts: [{ id: "nura", name: "Нура", populationShare: 0.16, indicators: {} }], measures: [], rules: null, source: "api",
} as unknown as ScenarioVM;
const result = { spent: 95, remaining: 5, baselineScore: 52.56, score: 56.54, districts: [], appliedEffects: null, appliedSynergies: [], explanation: { summary: "ok", strengths: [], risks: [], recommendations: [] }, explanationSource: "mock", explanationLocale: "ru-RU", source: "api" } as EvaluationVM;

test("late evaluation response after reset is ignored", () => {
  let state = simulatorReducer(initialSimulatorState, { type: "scenario-ready", scenario });
  state = simulatorReducer(state, { type: "set-choices", choices: [{ measureId: "M7", districtId: "nura" }] });
  state = simulatorReducer(state, { type: "evaluate-start", requestId: 1, submittedChoices: state.choices });
  const reset = simulatorReducer(state, { type: "reset" });
  const late = simulatorReducer(reset, { type: "evaluate-success", requestId: 1, revision: 1, result });
  assert.equal(late.evaluation.status, "idle");
  assert.deepEqual(late.choices, []);
});

test("pending evaluation locks choice changes and only matching response is accepted", () => {
  let state = simulatorReducer(initialSimulatorState, { type: "scenario-ready", scenario });
  state = simulatorReducer(state, { type: "evaluate-start", requestId: 4, submittedChoices: [] });
  assert.equal(simulatorReducer(state, { type: "set-choices", choices: [{ measureId: "M7" }] }), state);
  const complete = simulatorReducer(state, { type: "evaluate-success", requestId: 4, revision: 0, result });
  assert.equal(complete.evaluation.status, "success");
});

test("изменение выбора сбрасывает устаревший результат", () => {
  let state = simulatorReducer(initialSimulatorState, { type: "scenario-ready", scenario });
  state = simulatorReducer(state, { type: "set-choices", choices: [{ measureId: "M7", districtId: "nura" }] });
  state = simulatorReducer(state, { type: "evaluate-start", requestId: 7, submittedChoices: state.choices });
  state = simulatorReducer(state, { type: "evaluate-success", requestId: 7, revision: state.revision, result });
  const changed = simulatorReducer(state, { type: "set-choices", choices: [{ measureId: "M8", districtId: "nura" }] });
  assert.equal(changed.evaluation.status, "idle");
  assert.equal(changed.choices[0]?.measureId, "M8");
});

test("ошибка оценки сохраняет выбор и разрешает повторную отправку", () => {
  let state = simulatorReducer(initialSimulatorState, { type: "scenario-ready", scenario });
  state = simulatorReducer(state, { type: "set-choices", choices: [{ measureId: "M7", districtId: "nura" }] });
  state = simulatorReducer(state, { type: "evaluate-start", requestId: 8, submittedChoices: state.choices });
  state = simulatorReducer(state, { type: "evaluate-error", requestId: 8, revision: state.revision, error: { kind: "network" } });
  assert.equal(state.evaluation.status, "error");
  assert.deepEqual(state.choices, [{ measureId: "M7", districtId: "nura" }]);
  const retry = simulatorReducer(state, { type: "evaluate-start", requestId: 9, submittedChoices: state.choices });
  assert.equal(retry.evaluation.status, "pending");
});

test("повторный evaluate-start не заменяет активный запрос", () => {
  let state = simulatorReducer(initialSimulatorState, { type: "scenario-ready", scenario });
  state = simulatorReducer(state, { type: "evaluate-start", requestId: 10, submittedChoices: [] });
  const duplicate = simulatorReducer(state, { type: "evaluate-start", requestId: 11, submittedChoices: [] });
  assert.equal(duplicate, state);
});
