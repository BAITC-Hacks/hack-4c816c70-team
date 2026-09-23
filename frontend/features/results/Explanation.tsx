import type { EvaluationVM } from "@/lib/contracts/ui";
import styles from "./results.module.css";

const sections = [["Сильные стороны", "strengths"], ["Риски", "risks"], ["Рекомендации", "recommendations"]] as const;
export function Explanation({ explanation, source }: { readonly explanation: EvaluationVM["explanation"]; readonly source: EvaluationVM["explanationSource"] }) {
  const sourceLabel = source === "llm" ? "AI-анализ" : "Шаблонное объяснение";
  return <section className={styles.explanation}><h2>Объяснение от сервера</h2><p className={styles.explanationSource}>{sourceLabel}</p><p>{explanation.summary}</p>{sections.map(([title, key]) => <div key={key}><h3>{title}</h3>{explanation[key].length > 0 ? <ul>{explanation[key].map((item) => <li key={item}>{item}</li>)}</ul> : <p>Нет.</p>}</div>)}</section>;
}
