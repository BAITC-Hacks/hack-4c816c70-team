import { strict as assert } from "node:assert";
import test from "node:test";
import type { EvaluationVM, ScenarioVM } from "../lib/contracts/ui";
import { initialSimulatorState, simulatorReducer } from "../features/simulator/simulator-reducer";

const scenario = {
  budget: 100, horizonQuarters: 8, criticalThreshold: 40, baselineScore: 52.56,
  indicators: [], districts: [{ id: "nura", name: "Нура", populationShare: 0.16, indicators: {} }], measures: [], rules: null, source: "api",
} as unknown as ScenarioVM;
const result = { spent: 95, remaining: 5, baselineScore: 52.56, score: 56.54, districts: [], appliedEffects: null, appliedSynergies: [], explanation: { summary: "ok", strengths: [], risks: [], recommendations: [] }, explanationSource: "mock", source: "api" } as EvaluationVM;

test("late evaluation response after reset is ignored", () => {
  let state = simulatorReducer(initialSimulatorState, { type: "scenario-ready", scenario });
  state = simulatorReducer(state, { type: "set-choices", choices: [{ measureId: "M7", districtId: "nura" }] });
  state = simulatorReducer(state, { type: "evaluate-start", requestId: 1, submittedChoices: state.choices });
  const reset = simulatorReducer(state, { type: "reset" });
  const late = simulatorReducer(reset, { type: "evaluate-success", requestId: 1, revision: 1, result });
  assert.equal(late.evaluation.status, "idle");
  assert.deepEqual(late.choices, []);
});

test("pending evaluation locks choice changes and only matching response advances to results", () => {
  let state = simulatorReducer(initialSimulatorState, { type: "scenario-ready", scenario });
  state = simulatorReducer(state, { type: "evaluate-start", requestId: 4, submittedChoices: [] });
  assert.equal(simulatorReducer(state, { type: "set-choices", choices: [{ measureId: "M7" }] }), state);
  const complete = simulatorReducer(state, { type: "evaluate-success", requestId: 4, revision: 0, result });
  assert.equal(complete.step, "results");
  assert.equal(complete.evaluation.status, "success");
});
