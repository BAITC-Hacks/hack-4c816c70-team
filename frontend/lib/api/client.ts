import { evaluationToVm, parseEvaluationDto, parseScenarioDto, scenarioToVm } from "@/lib/api/adapter";
import type { ApiEvaluateRequestDto, ApiExplanationLocale } from "@/lib/contracts/api.generated";
import type { EvaluationVM, ScenarioVM } from "@/lib/contracts/ui";
import { ApiClientError, normalizeApiError } from "./errors";
import type { ApiErrorKind } from "./errors";
import { buildEvaluateRequestInit } from "./request";

const DEFAULT_API_URL = "http://localhost:8080";
/** Live server explanation can take up to 60 seconds; leave transport headroom. */
const REQUEST_TIMEOUT_MS = 75_000;

export { ApiClientError } from "./errors";

export function normalizeApiUrl(value = process.env.NEXT_PUBLIC_API_URL): string {
  const baseUrl = value?.trim() || DEFAULT_API_URL;
  return baseUrl.replace(/\/+$/, "");
}

async function requestJson(path: string, init: RequestInit, signal?: AbortSignal): Promise<unknown> {
  const controller = new AbortController();
  const timeout = globalThis.setTimeout(() => controller.abort("timeout"), REQUEST_TIMEOUT_MS);
  const abortForwarder = () => controller.abort(signal?.reason);
  signal?.addEventListener("abort", abortForwarder, { once: true });
  try {
    const response = await fetch(`${normalizeApiUrl()}${path}`, { ...init, signal: controller.signal, headers: { Accept: "application/json", ...init.headers } });
    const text = await response.text();
    let body: unknown;
    try { body = text.length === 0 ? null : JSON.parse(text); } catch { throw new ApiClientError("invalid-json", "Сервер вернул ответ в неверном формате.", response.status); }
    if (!response.ok) throw normalizeApiError(body, response.status);
    return body;
  } catch (error) {
    if (error instanceof ApiClientError) throw error;
    if (controller.signal.aborted) {
      const kind: ApiErrorKind = controller.signal.reason === "timeout" ? "timeout" : "aborted";
      throw new ApiClientError(kind, kind === "timeout" ? "Время ожидания ответа сервера истекло." : "Запрос отменён.");
    }
    throw new ApiClientError("network", "Не удалось подключиться к серверу. Проверьте соединение и адрес API.");
  } finally {
    globalThis.clearTimeout(timeout);
    signal?.removeEventListener("abort", abortForwarder);
  }
}

export async function getScenario(signal?: AbortSignal): Promise<ScenarioVM> {
  try { return scenarioToVm(parseScenarioDto(await requestJson("/api/scenario", { method: "GET" }, signal))); }
  catch (error) { if (error instanceof ApiClientError) throw error; throw new ApiClientError("contract", error instanceof Error ? error.message : "Некорректный контракт сценария."); }
}

/** explanationLocale is sent as Accept-Language; the server answers with the actual explanationLocale. */
export async function evaluateChoices(payload: ApiEvaluateRequestDto, signal?: AbortSignal, explanationLocale?: ApiExplanationLocale): Promise<EvaluationVM> {
  try { return evaluationToVm(parseEvaluationDto(await requestJson("/api/simulations/evaluate", buildEvaluateRequestInit(payload, explanationLocale), signal))); }
  catch (error) { if (error instanceof ApiClientError) throw error; throw new ApiClientError("contract", error instanceof Error ? error.message : "Некорректный контракт результата."); }
}
