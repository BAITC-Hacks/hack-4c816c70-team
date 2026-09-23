import type { ApiAlternativeGoal, ApiChoiceDto, ApiEvaluateRequestDto, ApiExplanationLocale } from "../contracts/api.generated";

/**
 * POST /api/simulations/evaluate init. The UI language goes only into Accept-Language;
 * the JSON body stays exactly `{ choices }` as before localization.
 */
export function buildEvaluateRequestInit(payload: ApiEvaluateRequestDto, explanationLocale?: ApiExplanationLocale): RequestInit {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (explanationLocale) headers["Accept-Language"] = explanationLocale;
  return { method: "POST", headers, body: JSON.stringify(payload) };
}


export function buildAlternativesRequestInit(choices: readonly ApiChoiceDto[], goal: ApiAlternativeGoal, locale: ApiExplanationLocale): RequestInit {
  return {
    method: "POST",
    headers: { "Content-Type": "application/json", "Accept-Language": locale },
    body: JSON.stringify({ choices, goal }),
  };
}
