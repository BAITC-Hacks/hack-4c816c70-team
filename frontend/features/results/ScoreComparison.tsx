import { formatNumber, formatSigned } from "@/lib/format/numbers";
import type { EvaluationVM } from "@/lib/contracts/ui";
import { useLocale } from "@/lib/i18n";
import { resultMessages } from "./messages";
import styles from "./results.module.css";

export function ScoreComparison({ result }: { readonly result: EvaluationVM }) {
  const { locale, intlLocale } = useLocale();
  const copy = resultMessages[locale];
  const before = Math.min(100, Math.max(0, result.baselineScore));
  const after = Math.min(100, Math.max(0, result.score));
  const beforeText = formatNumber(result.baselineScore, intlLocale);
  const afterText = formatNumber(result.score, intlLocale);
  return <section className={styles.score} aria-label={copy.scoreAria}><p className={styles.eyebrow}>{copy.finalScore}</p><div className={styles.scoreValues}><strong>{beforeText}</strong><span aria-hidden="true">→</span><strong>{afterText}</strong></div><div className={styles.scoreBars} aria-label={copy.scoreBarAria(beforeText, afterText)}><div><span>{copy.before}</span><i><b style={{ width: `${before}%` }} /></i></div><div><span>{copy.after}</span><i><b style={{ width: `${after}%` }} /></i></div></div><p className={result.scoreDelta !== undefined && result.scoreDelta < 0 ? styles.negative : styles.positive}>{copy.change}: {formatSigned(result.scoreDelta ?? 0, intlLocale)}</p></section>;
}
