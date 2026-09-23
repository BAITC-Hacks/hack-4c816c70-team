"use client";

import { useRouter } from "next/navigation";
import { Button } from "@/components/ui";
import { AlternativesPanel, alternativesLoader } from "@/features/alternatives";
import { validateDraft } from "@/features/planner";
import { Results } from "@/features/results";
import { useLocale, type Locale } from "@/lib/i18n";
import { useSimulationContext } from "./SimulationProvider";
import { choiceSetKey } from "./simulator-reducer";
import { formatSimulationError } from "./error-messages";
import styles from "./routes.module.css";

const messages: Record<Locale, { readonly kicker: string; readonly title: string; readonly text: string; readonly action: string; readonly retryError: string; readonly retry: string }> = {
  ru: { kicker: "Результат симуляции", title: "Здесь появится отчёт по вашему плану", text: "Оценка не хранится после перезагрузки: вернитесь к решениям и отправьте актуальный набор.", action: "Перейти к решениям", retryError: "Не удалось обновить объяснение. Предыдущий результат сохранён.", retry: "Повторить попытку" },
  kk: { kicker: "Симуляция нәтижесі", title: "Жоспарыңыздың есебі осы жерде пайда болады", text: "Бағалау бет жаңартылғаннан кейін сақталмайды: шешімдерге оралып, өзекті жиынтықты жіберіңіз.", action: "Шешімдерге өту", retryError: "Түсіндірмені жаңарту мүмкін болмады. Алдыңғы нәтиже сақталды.", retry: "Қайталап көру" },
  en: { kicker: "Simulation result", title: "Your plan report will appear here", text: "An evaluation is not kept after a page reload: return to decisions and submit the current set.", action: "Go to decisions", retryError: "Could not update the explanation. Your previous result has been kept.", retry: "Try again" },
};

export function ResultsPage() {
  const router = useRouter();
  const { state, reset, evaluate, applyAlternative } = useSimulationContext();
  const { locale } = useLocale();
  const scenario = state.scenario.status === "ready" ? state.scenario.scenario : null;
  // Keep the latest accepted result across navigation during a retry, only for the same plan.
  const latest = state.history.at(-1);
  const retained = latest?.key === choiceSetKey(state.choices) ? latest : null;
  const evaluation = state.evaluation.status === "success" ? state.evaluation
    : state.evaluation.status === "pending" || state.evaluation.status === "error" ? retained : null;
  const copy = messages[locale];
  // Re-evaluation reuses the submitted choices (state.choices equals them while a result is shown) and the current UI language.
  if (scenario && evaluation) {
    // Apply only moves choices into the plan and opens decisions; the user evaluates explicitly there.
    const basisKey = `${state.revision}|${choiceSetKey(evaluation.submittedChoices)}`;
    const alternatives = <AlternativesPanel scenario={scenario} submittedChoices={evaluation.submittedChoices} basisKey={basisKey} loader={alternativesLoader} canApply={(choices) => validateDraft(scenario, choices).canSubmit} applyDisabled={state.evaluation.status === "pending"} onApply={(choices) => { applyAlternative(choices, basisKey); router.push("/decisions"); }} />;
    return <main className={styles.workspace}>{state.evaluation.status === "error" ? <section role="alert"><p>{copy.retryError}</p><p>{formatSimulationError(state.evaluation.error, locale)}</p><Button onClick={() => void evaluate()}>{copy.retry}</Button></section> : null}<Results scenario={scenario} result={evaluation.result} submittedChoices={evaluation.submittedChoices} history={state.history} onEdit={() => router.push("/decisions")} onReset={() => { reset(); router.push("/decisions"); }} onReevaluate={() => void evaluate()} isReevaluating={state.evaluation.status === "pending"} afterSummary={alternatives} /></main>;
  }
  return <main className={styles.state}><p className={styles.kicker}>{copy.kicker}</p><h1>{copy.title}</h1><p>{copy.text}</p><Button size="lg" onClick={() => router.push("/decisions")}>{copy.action}</Button></main>;
}
