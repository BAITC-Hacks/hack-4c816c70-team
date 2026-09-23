import { strict as assert } from "node:assert";
import test from "node:test";
import { formatSimulationError } from "../features/simulator/error-messages";

test("API errors are localized by stable kind and code", () => {
  assert.equal(formatSimulationError({ kind: "network" }, "en"), "Could not connect to the server. Check the connection and API address.");
  assert.equal(formatSimulationError({ kind: "timeout" }, "kk"), "Сервер жауабын күту уақыты аяқталды.");
  assert.equal(formatSimulationError({ kind: "http", code: "BUDGET_EXCEEDED", detail: "Стоимость набора 129 превышает бюджет 100." }, "en"), "This set exceeds the budget.");
  assert.match(formatSimulationError({ kind: "http", code: "NEW_CODE", detail: "серверная деталь" }, "kk"), /серверная деталь/);
});
