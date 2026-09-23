import { strict as assert } from "node:assert";
import test from "node:test";
import type { ChoiceDraft, EvaluationVM, ScenarioVM } from "../lib/contracts/ui";
import { choiceSetKey, initialSimulatorState, simulatorReducer, type SimulatorState } from "../features/simulator/simulator-reducer";

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

const setA: readonly ChoiceDraft[] = [{ measureId: "M7", districtId: "nura" }, { measureId: "M12" }, { measureId: "M5", districtId: "saryarka" }];
const setB: readonly ChoiceDraft[] = [{ measureId: "M7", districtId: "nura" }, { measureId: "M12" }, { measureId: "M3", districtId: "nura" }];
const resultFor = (score: number, locale: EvaluationVM["explanationLocale"] = "ru-RU") => ({ ...result, score, explanationLocale: locale }) as EvaluationVM;
let nextRequest = 100;

function succeed(state: SimulatorState, choices: readonly ChoiceDraft[], evaluation: EvaluationVM): SimulatorState {
  let next = simulatorReducer(state, { type: "set-choices", choices });
  const requestId = ++nextRequest;
  next = simulatorReducer(next, { type: "evaluate-start", requestId, submittedChoices: next.choices });
  return simulatorReducer(next, { type: "evaluate-success", requestId, revision: next.revision, result: evaluation });
}
const ready = () => simulatorReducer(initialSimulatorState, { type: "scenario-ready", scenario });
const scores = (state: SimulatorState) => state.history.map((attempt) => attempt.result.score);

test("ключ набора не зависит от порядка choices", () => {
  assert.equal(choiceSetKey([...setA].reverse()), choiceSetKey(setA));
  assert.notEqual(choiceSetKey(setA), choiceSetKey(setB));
  assert.notEqual(choiceSetKey([{ measureId: "M7", districtId: "nura" }]), choiceSetKey([{ measureId: "M7", districtId: "yesil" }]));
});

test("первая попытка попадает в историю, вторая с другим набором добавляет сравнение", () => {
  let state = succeed(ready(), setA, resultFor(56.54));
  assert.deepEqual(scores(state), [56.54]);
  state = succeed(state, setB, resultFor(57.21));
  assert.deepEqual(scores(state), [56.54, 57.21]);
  assert.deepEqual(state.history[1]?.submittedChoices, setB);
});

test("перестановка и повтор на другом языке не создают новую попытку", () => {
  let state = succeed(ready(), setA, resultFor(56.54));
  state = succeed(state, setB, resultFor(57.21));
  state = succeed(state, [...setB].reverse(), resultFor(57.21, "kk-KZ"));
  assert.equal(state.history.length, 2);
  assert.deepEqual(scores(state), [56.54, 57.21]);
  assert.equal(state.history[1]?.result.explanationLocale, "kk-KZ");
});

test("A → B → A показывает B/A, хранится не больше двух попыток", () => {
  let state = succeed(ready(), setA, resultFor(56.54));
  state = succeed(state, setB, resultFor(57.21));
  state = succeed(state, setA, resultFor(56.54, "en-US"));
  assert.equal(state.history.length, 2);
  assert.equal(state.history[0]?.key, choiceSetKey(setB));
  assert.equal(state.history[1]?.key, choiceSetKey(setA));
  const setC: readonly ChoiceDraft[] = [{ measureId: "M14" }];
  state = succeed(state, setC, resultFor(55));
  assert.deepEqual(state.history.map((attempt) => attempt.key), [choiceSetKey(setA), choiceSetKey(setC)]);
});

test("ошибка, поздний ответ и навигация не меняют историю; reset очищает", () => {
  let state = succeed(ready(), setA, resultFor(56.54));
  const history = state.history;
  state = simulatorReducer(state, { type: "evaluate-start", requestId: 900, submittedChoices: state.choices });
  state = simulatorReducer(state, { type: "evaluate-error", requestId: 900, revision: state.revision, error: { kind: "network" } });
  assert.equal(state.history, history);
  state = simulatorReducer(state, { type: "evaluate-start", requestId: 901, submittedChoices: state.choices });
  const late = simulatorReducer(state, { type: "evaluate-success", requestId: 899, revision: state.revision, result: resultFor(10) });
  assert.equal(late.history, history);
  const stale = simulatorReducer(state, { type: "evaluate-success", requestId: 901, revision: state.revision + 1, result: resultFor(10) });
  assert.equal(stale.history, history);
  state = simulatorReducer(state, { type: "evaluate-error", requestId: 901, revision: state.revision, error: { kind: "timeout" } });
  state = simulatorReducer(state, { type: "select-district", districtId: "nura" });
  state = simulatorReducer(state, { type: "set-choices", choices: setB });
  assert.equal(state.history, history);
  const cleared = simulatorReducer(state, { type: "reset" });
  assert.deepEqual(cleared.history, []);
  assert.equal(simulatorReducer(cleared, { type: "evaluate-success", requestId: 901, revision: 1, result: resultFor(10) }).history.length, 0);
});
