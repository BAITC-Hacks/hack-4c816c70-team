import type { ApiEvaluateRequestDto } from "@/lib/contracts/api.generated";
import type { ChoiceDraft, ScenarioVM } from "@/lib/contracts/ui";

/** Makes the API payload only after UI validation; no UI-only fields enter JSON. */
export function buildEvaluatePayload(scenario: ScenarioVM, choices: readonly ChoiceDraft[]): ApiEvaluateRequestDto {
  const measureMap = new Map(scenario.measures.map((measure) => [measure.id, measure]));
  return { choices: choices.map((choice) => {
    const measure = measureMap.get(choice.measureId);
    if (!measure) throw new Error(`Меры «${choice.measureId}» нет в каталоге.`);
    if (measure.scope === "city") return { measureId: choice.measureId };
    if (!choice.districtId) throw new Error(`Для ${choice.measureId} не выбран район.`);
    return { measureId: choice.measureId, districtId: choice.districtId };
  }) };
}
