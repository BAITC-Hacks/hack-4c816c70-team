import type { EvaluationVM } from "@/lib/contracts/ui";
import { useLocale } from "@/lib/i18n";
import { resultMessages } from "./messages";
import styles from "./results.module.css";

export function Explanation({ explanation, source }: { readonly explanation: EvaluationVM["explanation"]; readonly source: EvaluationVM["explanationSource"] }) {
  const { locale } = useLocale();
  const copy = resultMessages[locale];
  const sections = [[copy.strengths, "strengths"], [copy.risks, "risks"], [copy.recommendations, "recommendations"]] as const;
  return <section className={styles.explanation}><h2>{copy.explanation}</h2><p className={styles.explanationSource}>{copy.source[source]}</p>{copy.explanationRussianOnly ? <p>{copy.explanationRussianOnly}</p> : null}<p>{explanation.summary}</p>{sections.map(([title, key]) => <div key={key}><h3>{title}</h3>{explanation[key].length > 0 ? <ul>{explanation[key].map((item) => <li key={item}>{item}</li>)}</ul> : <p>{copy.none}</p>}</div>)}</section>;
}
