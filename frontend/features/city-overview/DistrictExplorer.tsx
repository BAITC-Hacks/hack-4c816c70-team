"use client";

import { useId, useMemo } from "react";
import type { DistrictId, ScenarioVM } from "@/lib/contracts/ui";
import { Badge, Panel, cx } from "@/components/ui";
import { DistrictAtlas } from "./DistrictAtlas";
import { DistrictDetails } from "./DistrictDetails";
import { summarizeDistrict } from "./district-summary";
import { useCityCopy } from "./use-city-copy";
import styles from "./city-overview.module.css";

export interface DistrictExplorerProps {
  readonly scenario: ScenarioVM;
  readonly selectedDistrictId: DistrictId | null;
  readonly onSelectDistrict: (districtId: DistrictId) => void;
  /** Уровень заголовка списка районов и подробностей. */
  readonly headingLevel?: 2 | 3;
}

/** Схема, подробности выбранного района и карточки — единый синхронный выбор. */
export function DistrictExplorer({
  scenario,
  selectedDistrictId,
  onSelectDistrict,
  headingLevel = 2,
}: DistrictExplorerProps) {
  const uid = useId();
  const detailsHeadingId = `${uid}-details`;
  const listHeadingId = `${uid}-list`;
  const { criticalThreshold, indicators, districts } = scenario;
  const ListHeading = headingLevel === 2 ? "h2" : "h3";
  const { copy, amount, score, share, district: districtLabel, indicator: indicatorLabel } = useCityCopy();

  const summaries = useMemo(
    () => districts.map((district) => summarizeDistrict(district, indicators, criticalThreshold)),
    [districts, indicators, criticalThreshold],
  );

  const selectedSummary = summaries.find((summary) => summary.district.id === selectedDistrictId) ?? null;
  const thresholdLabel = amount(criticalThreshold);

  return (
    <div className={styles.explorer}>
      <div className={styles.stage}>
        <Panel as="div" padding="md" className={styles.atlasPanel}>
          <DistrictAtlas
            summaries={summaries}
            criticalThreshold={criticalThreshold}
            selectedDistrictId={selectedDistrictId}
            onSelectDistrict={onSelectDistrict}
          />
        </Panel>
        <Panel as="section" aria-labelledby={detailsHeadingId} className={styles.detailsPanel}>
          <DistrictDetails
            summary={selectedSummary}
            indicatorCount={indicators.length}
            criticalThreshold={criticalThreshold}
            headingId={detailsHeadingId}
            headingLevel={headingLevel}
          />
        </Panel>
      </div>

      <section aria-labelledby={listHeadingId} className={styles.listSection}>
        <ListHeading id={listHeadingId} className={styles.sectionTitle}>
          {copy.allDistricts}
        </ListHeading>
        <ul className={styles.cards} role="list">
          {summaries.map(({ district, readings, critical, weakest }) => {
            const isSelected = district.id === selectedDistrictId;
            const criticalCount = critical.length;
            return (
              <li key={district.id} className={styles.cardItem}>
                <button
                  type="button"
                  className={cx(styles.card, isSelected && styles.cardSelected)}
                  aria-pressed={isSelected}
                  onClick={() => onSelectDistrict(district.id)}
                >
                  <span className={styles.cardHead}>
                    <span className={styles.cardName}>{districtLabel(district)}</span>
                    {isSelected ? (
                      <span className={styles.cardSelectedMark}>
                        <span aria-hidden="true">●</span> {copy.selected}
                      </span>
                    ) : null}
                  </span>
                  <span className={styles.cardShare}>{copy.cardShare(share(district.populationShare))}</span>
                  <span className={styles.cardStrip} aria-hidden="true">
                    {readings.map((reading) => (
                      <span
                        key={reading.indicator.id}
                        className={cx(styles.stripBar, reading.isCritical && styles.stripBarCritical)}
                        style={{ height: `${Math.min(100, Math.max(4, reading.value))}%` }}
                      />
                    ))}
                    <span
                      className={styles.stripThreshold}
                      style={{ bottom: `${Math.min(100, Math.max(0, criticalThreshold))}%` }}
                    />
                  </span>
                  {criticalCount > 0 ? (
                    <Badge tone="danger">
                      <span aria-hidden="true">▼</span> {copy.criticalBadge(criticalCount, thresholdLabel)}
                    </Badge>
                  ) : (
                    <Badge tone="neutral">{copy.noCritical(thresholdLabel)}</Badge>
                  )}
                  {weakest ? (
                    <span className={styles.cardWeakest}>
                      {copy.weakest(indicatorLabel(weakest.indicator), score(weakest.value))}
                    </span>
                  ) : null}
                </button>
              </li>
            );
          })}
        </ul>
      </section>

      <p className="visually-hidden" aria-live="polite">
        {selectedSummary
          ? copy.liveSelected(districtLabel(selectedSummary.district), selectedSummary.critical.length, thresholdLabel)
          : ""}
      </p>
    </div>
  );
}
