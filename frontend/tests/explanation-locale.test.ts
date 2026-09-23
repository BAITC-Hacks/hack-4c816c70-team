import { strict as assert } from "node:assert";
import test from "node:test";
import { evaluationToVm, parseEvaluationDto } from "../lib/api/adapter";
import { buildEvaluatePayload } from "../lib/api/payload";
import { buildEvaluateRequestInit } from "../lib/api/request";
import type { ScenarioVM } from "../lib/contracts/ui";

const scenario = { measures: [{ id: "M7", category: "social", name: "M7", scope: "district", cost: 24, lagQuarters: 3, effects: {} }, { id: "M12", category: "services", name: "M12", scope: "city", cost: 14, lagQuarters: 1, effects: {} }] } as unknown as ScenarioVM;
const payload = buildEvaluatePayload(scenario, [{ measureId: "M7", districtId: "nura" }, { measureId: "M12" }]);
const indicators = { T1: 1, T2: 1, E1: 1, E2: 1, S1: 1, S2: 1, B1: 1, B2: 1, C1: 1, C2: 1 };
const response = (extra: Record<string, unknown>) => ({ spent: 95, remaining: 5, baselineScore: 52.56, score: 56.54, districts: [{ id: "nura", name: "Нура", scoreBefore: 49.18, scoreAfter: 52.96, indicatorsBefore: indicators, indicatorsAfter: indicators }], appliedSynergies: [], explanation: { summary: "s", strengths: [], risks: [], recommendations: [] }, explanationSource: "mock", ...extra });

test("POST body is unchanged by the UI language; language goes only to Accept-Language", () => {
  for (const locale of ["ru-RU", "kk-KZ", "en-US"] as const) {
    const init = buildEvaluateRequestInit(payload, locale);
    assert.equal(init.method, "POST");
    assert.equal(init.body, JSON.stringify({ choices: [{ measureId: "M7", districtId: "nura" }, { measureId: "M12" }] }));
    assert.deepEqual(init.headers, { "Content-Type": "application/json", "Accept-Language": locale });
  }
  assert.deepEqual(buildEvaluateRequestInit(payload).headers, { "Content-Type": "application/json" });
});

test("explanationLocale is parsed and kept in the view model", () => {
  const vm = evaluationToVm(parseEvaluationDto(response({ explanationLocale: "kk-KZ" })));
  assert.equal(vm.explanationLocale, "kk-KZ");
  assert.equal(vm.score, 56.54);
});

test("missing explanationLocale means the documented Russian fallback", () => {
  assert.equal(evaluationToVm(parseEvaluationDto(response({}))).explanationLocale, "ru-RU");
});

test("unknown explanationLocale is a contract error", () => {
  assert.throws(() => parseEvaluationDto(response({ explanationLocale: "de-DE" })), /язык объяснения/);
});
