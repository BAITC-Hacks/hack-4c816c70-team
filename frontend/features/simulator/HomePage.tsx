"use client";

import { CityHome } from "@/features/city-overview";
import { useSimulationContext } from "./SimulationProvider";

export function HomePage() {
  const { state, dispatch, loadScenario } = useSimulationContext();
  const scenario = state.scenario.status === "ready" ? state.scenario.scenario : null;
  return <main className="page-enter"><CityHome scenario={scenario} scenarioStatus={state.scenario.status} scenarioError={state.scenario.status === "error" ? state.scenario.message : null} onRetry={() => void loadScenario()} selectedDistrictId={state.selectedDistrictId} onSelectDistrict={(districtId) => dispatch({ type: "select-district", districtId })} decisionsHref="/decisions" /></main>;
}
