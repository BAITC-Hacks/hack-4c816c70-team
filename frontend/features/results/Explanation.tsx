import type { EvaluationVM } from "@/lib/contracts/ui";
import { useLocale } from "@/lib/i18n";
import { resultMessages } from "./messages";
import styles from "./results.module.css";

function explanationLocaleKey(value: unknown): "ru" | "kk" | "en" | null {
  if (typeof value !== "string") return null;
  const key = value.split("-", 1)[0]?.toLowerCase();
  return key === "ru" || key === "kk" || key === "en" ? key : null;
}

/** Keep a malformed/stale response from crashing the result screen. */
export function explanationListItem(value: unknown): string {
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (value !== null && typeof value === "object") {
    const record = value as Record<string, unknown>;
    for (const key of ["text", "message", "label", "title", "name"]) {
      if (typeof record[key] === "string") return record[key];
    }
    return JSON.stringify(value);
  }
  return "";
}

export function Explanation({ explanation, source, explanationLocale }: { readonly explanation: EvaluationVM["explanation"]; readonly source: EvaluationVM["explanationSource"]; readonly explanationLocale: EvaluationVM["explanationLocale"] }) {
  const { locale } = useLocale();
  const copy = resultMessages[locale];
  const languageNames = copy.languageNames;
  const actualLocale = explanationLocaleKey(explanationLocale);
  const sections = [[copy.strengths, "strengths"], [copy.risks, "risks"], [copy.recommendations, "recommendations"]] as const;
  return <section className={styles.explanation}><h2>{copy.explanation}</h2><p className={styles.explanationSource}>{copy.source[source]}</p><p>{actualLocale === null ? copy.unknownExplanationLanguage : copy.explanationLanguage(languageNames[actualLocale])}</p><p>{explanation.summary}</p>{sections.map(([title, key]) => <div key={key}><h3>{title}</h3>{explanation[key].length > 0 ? <ul>{explanation[key].map((item, index) => <li key={`${key}-${index}`}>{explanationListItem(item)}</li>)}</ul> : <p>{copy.none}</p>}</div>)}</section>;
}
