import { formatNumber, formatSigned } from "@/lib/format/numbers";
import type { DistrictResultVM, ScenarioVM } from "@/lib/contracts/ui";
import styles from "./results.module.css";

function DistrictRow({ district, scenario }: { readonly district: DistrictResultVM; readonly scenario: ScenarioVM }) {
  return <article className={styles.district}><header><h3>{district.name}</h3><span>{formatNumber(district.scoreBefore)} → {formatNumber(district.scoreAfter)}</span><b className={district.scoreDelta !== undefined && district.scoreDelta < 0 ? styles.negative : styles.positive}>{formatSigned(district.scoreDelta ?? 0)}</b></header><details><summary>10 показателей: до и после</summary><dl className={styles.indicators}>{scenario.indicators.map((indicator) => { const before = district.indicatorsBefore[indicator.id]; const after = district.indicatorsAfter[indicator.id]; const delta = district.indicatorDeltas?.[indicator.id] ?? after - before; return <div key={indicator.id}><dt>{indicator.name}</dt><dd>{formatNumber(before)} → {formatNumber(after)} <span className={delta < 0 ? styles.negative : styles.positive}>({formatSigned(delta)})</span>{before < scenario.criticalThreshold || after < scenario.criticalThreshold ? <em> Критический уровень: ниже {formatNumber(scenario.criticalThreshold)}</em> : null}</dd></div>; })}</dl></details></article>;
}

export function DistrictComparison({ scenario, districts }: { readonly scenario: ScenarioVM; readonly districts: readonly DistrictResultVM[] }) {
  return <section><h2>Районы: до и после</h2><div className={styles.districtGrid}>{districts.map((district) => <DistrictRow key={district.id} district={district} scenario={scenario} />)}</div></section>;
}
