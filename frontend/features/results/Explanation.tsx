import { Button } from "@/components/ui";
import type { EvaluationVM } from "@/lib/contracts/ui";
import { intlLocales, useLocale } from "@/lib/i18n";
import { resultMessages } from "./messages";
import styles from "./results.module.css";

/** Native names, so the notice names the language the text is actually written in. */
const languageNames: Record<EvaluationVM["explanationLocale"], string> = { "ru-RU": "Русский", "kk-KZ": "Қазақша", "en-US": "English" };

/** Keep malformed or stale list items from becoming React children. */
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

export function Explanation({ explanation, source, explanationLocale, onReevaluate, isReevaluating = false }: {
  readonly explanation: EvaluationVM["explanation"];
  readonly source: EvaluationVM["explanationSource"];
  readonly explanationLocale: EvaluationVM["explanationLocale"];
  readonly onReevaluate?: () => void;
  readonly isReevaluating?: boolean;
}) {
  const { locale } = useLocale();
  const copy = resultMessages[locale];
  // The server text stays in the language it was produced in; switching UI language never relabels it.
  const isStale = explanationLocale !== intlLocales[locale];
  const sections = [[copy.strengths, "strengths"], [copy.risks, "risks"], [copy.recommendations, "recommendations"]] as const;
  return <section className={styles.explanation}><h2>{copy.explanation}</h2><p className={styles.explanationSource}>{copy.source[source]}</p>{isStale ? <div role="status"><p>{copy.staleExplanation(languageNames[explanationLocale])}</p>{onReevaluate ? <Button onClick={onReevaluate} busy={isReevaluating}>{isReevaluating ? copy.reevaluating : copy.reevaluate}</Button> : null}</div> : null}<p lang={explanationLocale}>{explanation.summary}</p>{sections.map(([title, key]) => <div key={key}><h3>{title}</h3>{explanation[key].length > 0 ? <ul lang={explanationLocale}>{explanation[key].map((item, index) => <li key={`${key}-${index}`}>{explanationListItem(item)}</li>)}</ul> : <p>{copy.none}</p>}</div>)}</section>;
}
