import { formatNumber, formatSigned } from "@/lib/format/numbers";
import type { DistrictResultVM, ScenarioVM } from "@/lib/contracts/ui";
import { districtName, indicatorName, useLocale } from "@/lib/i18n";
import { resultMessages } from "./messages";
import styles from "./results.module.css";

function DistrictRow({ district, scenario }: { readonly district: DistrictResultVM; readonly scenario: ScenarioVM }) {
  const { locale, intlLocale } = useLocale();
  const copy = resultMessages[locale];
  const threshold = formatNumber(scenario.criticalThreshold, intlLocale);
  return <article className={styles.district}><header><h3>{districtName(district.id, locale, district.name)}</h3><span>{formatNumber(district.scoreBefore, intlLocale)} → {formatNumber(district.scoreAfter, intlLocale)}</span><b className={district.scoreDelta !== undefined && district.scoreDelta < 0 ? styles.negative : styles.positive}>{formatSigned(district.scoreDelta ?? 0, intlLocale)}</b></header><details><summary>{copy.indicators}</summary><dl className={styles.indicators}>{scenario.indicators.map((indicator) => { const before = district.indicatorsBefore[indicator.id]; const after = district.indicatorsAfter[indicator.id]; const delta = district.indicatorDeltas?.[indicator.id] ?? after - before; const criticalStatus = after < scenario.criticalThreshold ? copy.below(threshold) : before < scenario.criticalThreshold ? copy.recovered(threshold) : null; return <div key={indicator.id}><dt>{indicatorName(indicator.id, locale, indicator.name)}</dt><dd><span>{formatNumber(before, intlLocale)} → {formatNumber(after, intlLocale)} <span className={delta < 0 ? styles.negative : styles.positive}>({formatSigned(delta, intlLocale)})</span></span><span className={styles.indicatorBars} aria-hidden="true"><i><b style={{ width: `${Math.min(100, Math.max(0, before))}%` }} /></i><i><b style={{ width: `${Math.min(100, Math.max(0, after))}%` }} /></i></span>{criticalStatus ? <em>{criticalStatus}</em> : null}</dd></div>; })}</dl></details></article>;
}

export function DistrictComparison({ scenario, districts }: { readonly scenario: ScenarioVM; readonly districts: readonly DistrictResultVM[] }) {
  const { locale } = useLocale();
  return <section><h2>{resultMessages[locale].districts}</h2><div className={styles.districtGrid}>{districts.map((district) => <DistrictRow key={district.id} district={district} scenario={scenario} />)}</div></section>;
}
