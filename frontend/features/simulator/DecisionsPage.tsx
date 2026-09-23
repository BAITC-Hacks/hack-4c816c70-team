"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui";
import { Planner } from "@/features/planner";
import { useSimulationContext } from "./SimulationProvider";
import styles from "./routes.module.css";

export function DecisionsPage() {
  const router = useRouter();
  const { state, setChoices, evaluate, loadScenario } = useSimulationContext();
  if (state.scenario.status === "loading") return <main className={styles.state} aria-live="polite"><h1>Загружаем каталог решений…</h1></main>;
  if (state.scenario.status === "error") return <main className={styles.state} role="alert"><h1>Не удалось загрузить каталог</h1><p>{state.scenario.message}</p><Button onClick={() => void loadScenario()}>Повторить загрузку</Button><Link href="/">Вернуться к обзору</Link></main>;
  return <main className={styles.workspace}><Planner scenario={state.scenario.scenario} choices={state.choices} preferredDistrictId={state.selectedDistrictId} isEvaluating={state.evaluation.status === "pending"} serverError={state.evaluation.status === "error" ? state.evaluation.message : null} onChoicesChange={setChoices} onEvaluate={() => void evaluate()} onBack={() => router.push("/")} /></main>;
}
