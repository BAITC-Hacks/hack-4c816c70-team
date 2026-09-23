import { strict as assert } from "node:assert";
import test from "node:test";
import { evaluationToVm, parseEvaluationDto } from "../lib/api/adapter";

// Minimal boundary fixture; full five-district responses are covered by API integration tests.
const response = { spent: 95, remaining: 5, baselineScore: 52.56, score: 56.54, districts: [], appliedSynergies: [], explanation: { summary: "Test", strengths: [], risks: [], recommendations: [] }, explanationSource: "mock" };
const effect = { measureId: "M11", districtId: "nura", indicatorId: "T1", delta: -1.75 };

test("lag-adjusted effects are passed through, including negative values", () => {
  for (const explanationLocale of ["ru-RU", "kk-KZ", "en-US"] as const) {
    const result = evaluationToVm(parseEvaluationDto({ ...response, appliedEffects: [effect], explanationLocale }));
    assert.deepEqual(result.appliedEffects, [effect]);
    assert.equal(result.explanationLocale, explanationLocale);
  }
});
test("an old server's absent effects remain unknown, not zero", () => {
  assert.equal(evaluationToVm(parseEvaluationDto(response)).appliedEffects, null);
});
test("an explicitly empty effect list remains empty", () => {
  assert.deepEqual(evaluationToVm(parseEvaluationDto({ ...response, appliedEffects: [] })).appliedEffects, []);
});
test("malformed effects are rejected at the API boundary", () => {
  for (const appliedEffects of [null, {}, [{ ...effect, delta: "-1.75" }], [{ ...effect, indicatorId: "unknown" }]]) {
    assert.throws(() => parseEvaluationDto({ ...response, appliedEffects }), /Некорректный ответ API/);
  }
});
