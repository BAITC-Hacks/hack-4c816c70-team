import { strict as assert } from "node:assert";
import test from "node:test";
import { normalizeApiError } from "../lib/api/errors";
import { parseApiLocale } from "../lib/api/adapter";
import { buildEvaluatePayload } from "../lib/api/payload";
import type { ScenarioVM } from "../lib/contracts/ui";

const scenario = { measures: [{ id: "M7", category: "social", name: "Районная", scope: "district", cost: 24, lagQuarters: 3, effects: {} }, { id: "M12", category: "services", name: "Городская", scope: "city", cost: 14, lagQuarters: 1, effects: {} }] } as unknown as ScenarioVM;

test("payload omits districtId for a city measure", () => {
  assert.deepEqual(buildEvaluatePayload(scenario, [{ measureId: "M7", districtId: "nura" }, { measureId: "M12", districtId: "should-not-leak" }]), { choices: [{ measureId: "M7", districtId: "nura" }, { measureId: "M12" }] });
});

test("documented API errors retain the server message and code", () => {
  const error = normalizeApiError({ error: { code: "BUDGET_EXCEEDED", message: "Стоимость набора 121 превышает бюджет 100." } }, 422);
  assert.equal(error.status, 422);
  assert.equal(error.code, "BUDGET_EXCEEDED");
  assert.equal(error.message, "Стоимость набора 121 превышает бюджет 100.");
});

test("published explanation locale and Content-Language tags map to supported UI locales", () => {
  assert.equal(parseApiLocale("ru-RU", "explanationLocale"), "ru");
  assert.equal(parseApiLocale("kk-KZ", "explanationLocale"), "kk");
  assert.equal(parseApiLocale("en-US", "Content-Language"), "en");
  assert.equal(parseApiLocale(null, "Content-Language"), null);
  assert.throws(() => parseApiLocale("kz-KZ", "explanationLocale"), /неподдерживаемый язык/);
});
