import type { ChoiceDraft, ScenarioVM } from "@/lib/contracts/ui";
import { districtName, measureName, type Locale } from "@/lib/i18n";

/** "M3 Measure — District" for display; city-wide measures have no district. */
export function choiceLabel(choice: ChoiceDraft, scenario: ScenarioVM, locale: Locale): string {
  const measure = scenario.measures.find((item) => item.id === choice.measureId);
  const name = `${choice.measureId} ${measureName(choice.measureId, locale, measure?.name ?? choice.measureId)}`;
  if (!choice.districtId) return name;
  const district = scenario.districts.find((item) => item.id === choice.districtId);
  return `${name} — ${districtName(choice.districtId, locale, district?.name ?? choice.districtId)}`;
}
