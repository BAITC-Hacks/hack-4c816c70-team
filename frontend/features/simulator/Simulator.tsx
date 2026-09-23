"use client";

import { AppHeader } from "@/components/ui";
import { CityOverview } from "@/features/city-overview";
import { Planner, validateDraft } from "@/features/planner";
import { Results } from "@/features/results";
import { useSimulation } from "./use-simulation";
import styles from "./simulator.module.css";

const steps = [
  { id: "overview", label: "Обзор" },
  { id: "planner", label: "Решения" },
  { id: "results", label: "Результат" },
] as const;

export function Simulator() {
  const { state, dispatch, loadScenario, setChoices, evaluate, reset } = useSimulation(validateDraft);
  const scenario = state.scenario.status === "ready" ? state.scenario.scenario : null;
  const canOpenResults = state.evaluation.status === "success";

  return <div className={styles.shell}>
    <AppHeader title="Аким на 5 часов" activeStepId={state.step} steps={steps.map((step) => ({ ...step, disabled: step.id === "results" && !canOpenResults }))} onStepSelect={(step) => { if (step === "overview" || step === "planner" || (step === "results" && canOpenResults)) dispatch({ type: "set-step", step }); }} />
    {state.scenario.status === "loading" ? <main className={styles.message} aria-live="polite"><h1>Загружаем сценарий города…</h1><p>Получаем районы, показатели и каталог решений.</p></main> : null}
    {state.scenario.status === "error" ? <main className={styles.message} role="alert"><h1>Не удалось загрузить сценарий</h1><p>{state.scenario.message}</p><button type="button" onClick={() => void loadScenario()}>Повторить загрузку</button></main> : null}
    {scenario && state.step === "overview" ? <CityOverview scenario={scenario} selectedDistrictId={state.selectedDistrictId} onSelectDistrict={(districtId) => dispatch({ type: "select-district", districtId })} onStartPlanning={() => dispatch({ type: "set-step", step: "planner" })} /> : null}
    {scenario && state.step === "planner" ? <Planner scenario={scenario} choices={state.choices} preferredDistrictId={state.selectedDistrictId} isEvaluating={state.evaluation.status === "pending"} serverError={state.evaluation.status === "error" ? state.evaluation.message : null} onChoicesChange={setChoices} onEvaluate={() => void evaluate()} onBack={() => dispatch({ type: "set-step", step: "overview" })} /> : null}
    {scenario && state.step === "results" && state.evaluation.status === "success" ? <Results scenario={scenario} result={state.evaluation.result} submittedChoices={state.evaluation.submittedChoices} onEdit={() => dispatch({ type: "set-step", step: "planner" })} onReset={reset} /> : null}
  </div>;
}
