import { strict as assert } from "node:assert";
import test from "node:test";
import { formatSimulationError } from "../features/simulator/error-messages";

test("API errors are localized by stable kind and code", () => {
  assert.equal(formatSimulationError({ kind: "network" }, "en"), "Could not connect to the server. Check the connection and API address.");
  assert.equal(formatSimulationError({ kind: "timeout" }, "kk"), "Сервер жауабын күту уақыты аяқталды.");
  assert.equal(formatSimulationError({ kind: "http", code: "BUDGET_EXCEEDED", detail: "Стоимость набора 129 превышает бюджет 100." }, "en"), "This set exceeds the budget.");
  const unknownHttp = { kind: "http" as const, code: "NEW_CODE", status: 500, detail: "Сервер вернул ошибку 500." };
  const contract = { kind: "contract" as const, detail: "Некорректный ответ API: districts должен быть массивом." };
  assert.equal(formatSimulationError(unknownHttp, "en"), "The server returned error 500.");
  assert.equal(formatSimulationError(unknownHttp, "kk"), "Сервер 500 қатесін қайтарды.");
  assert.equal(formatSimulationError(contract, "en"), "The server returned data in an unsupported format.");
  assert.equal(formatSimulationError(contract, "kk"), "Сервер қолдау көрсетілмейтін пішімдегі деректерді жіберді.");
});
