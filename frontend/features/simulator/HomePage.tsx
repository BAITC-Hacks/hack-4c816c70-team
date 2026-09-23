"use client";

import { CityHome } from "@/features/city-overview";
import { useSimulationContext } from "./SimulationProvider";
import { formatSimulationError } from "./error-messages";
import { useLocale } from "@/lib/i18n";

export function HomePage() {
  const { state, dispatch, loadScenario } = useSimulationContext();
  const { locale } = useLocale();
  const scenario = state.scenario.status === "ready" ? state.scenario.scenario : null;
  return <main className="page-enter"><CityHome scenario={scenario} scenarioStatus={state.scenario.status} scenarioError={state.scenario.status === "error" ? formatSimulationError(state.scenario.error, locale) : null} onRetry={() => void loadScenario()} selectedDistrictId={state.selectedDistrictId} onSelectDistrict={(districtId) => dispatch({ type: "select-district", districtId })} decisionsHref="/decisions" /></main>;
}
