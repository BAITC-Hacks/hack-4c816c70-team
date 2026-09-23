import { Badge, Metric, cx } from "@/components/ui";
import type { DistrictSummary } from "./district-summary";
import { useCityCopy } from "./use-city-copy";
import styles from "./city-overview.module.css";

interface DistrictDetailsProps {
  readonly summary: DistrictSummary | null;
  readonly indicatorCount: number;
  readonly criticalThreshold: number;
  readonly headingId: string;
  readonly headingLevel?: 2 | 3;
}

/** Шкала показателей 0–100: только для ширины полосы, значения не изменяются. */
function toPercent(value: number): number {
  return Math.min(100, Math.max(0, value));
}

export function DistrictDetails({
  summary,
  indicatorCount,
  criticalThreshold,
  headingId,
  headingLevel = 2,
}: DistrictDetailsProps) {
  const Heading = headingLevel === 2 ? "h2" : "h3";
  const SubHeading = headingLevel === 2 ? "h3" : "h4";
  const { copy, amount, score, share, district: districtLabel, indicator: indicatorLabel } = useCityCopy();
  const thresholdLabel = amount(criticalThreshold);

  if (!summary) {
    return (
      <div className={styles.detailsEmpty}>
        <Heading id={headingId} className={styles.detailsTitle}>
          {copy.detailsEmptyTitle}
        </Heading>
        <p className={styles.muted}>{copy.detailsEmptyText(indicatorCount, thresholdLabel)}</p>
      </div>
    );
  }

  const { district, readings, critical } = summary;
  const criticalCount = critical.length;

  return (
    <div className={styles.details}>
      <div className={styles.detailsHead}>
        <Heading id={headingId} className={styles.detailsTitle}>
          {districtLabel(district)}
        </Heading>
        <div className={styles.detailsMetrics}>
          <Metric size="md" label={copy.populationShare} value={share(district.populationShare)} />
          {district.score !== undefined ? (
            <Metric size="md" label={copy.districtScore} value={score(district.score)} />
          ) : null}
        </div>
      </div>

      <p className={cx(styles.criticalNote, criticalCount > 0 && styles.criticalNoteAlert)}>
        {criticalCount > 0 ? (
          <>
            <span aria-hidden="true">▼ </span>
            {copy.criticalNote(
              criticalCount,
              thresholdLabel,
              critical.map((reading) => indicatorLabel(reading.indicator)).join(", "),
            )}
          </>
        ) : (
          <>{copy.noneCritical(thresholdLabel)}</>
        )}
      </p>

      <SubHeading className={styles.readingsTitle}>{copy.readingsTitle}</SubHeading>
      <ul className={styles.readings} role="list">
        {readings.map(({ indicator, value, isCritical }) => (
          <li key={indicator.id} className={cx(styles.reading, isCritical && styles.readingCritical)}>
            <span className={styles.readingName}>
              <span className={styles.readingId}>{indicator.id}</span>
              {indicatorLabel(indicator)}
            </span>
            <span className={styles.readingValue}>
              {isCritical ? (
                <Badge tone="danger" className={styles.readingFlag}>
                  <span aria-hidden="true">▼</span> {copy.belowFlag(thresholdLabel)}
                </Badge>
              ) : null}
              <data value={value}>{score(value)}</data>
            </span>
            <span className={styles.readingTrack} aria-hidden="true">
              <span className={styles.readingFill} style={{ width: `${toPercent(value)}%` }} />
              <span
                className={styles.readingThreshold}
                style={{ left: `${toPercent(criticalThreshold)}%` }}
              />
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
