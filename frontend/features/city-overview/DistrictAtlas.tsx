"use client";

import { useId, useRef, type KeyboardEvent } from "react";
import type { DistrictId } from "@/lib/contracts/ui";
import { cx } from "@/components/ui";
import {
  ATLAS_VIEWBOX,
  BRIDGE_PATHS,
  RIVER_PATH,
  STREET_PATHS,
  assignSlots,
} from "./atlas-layout";
import type { DistrictSummary } from "./district-summary";
import { useCityCopy } from "./use-city-copy";
import styles from "./city-overview.module.css";

interface DistrictAtlasProps {
  readonly summaries: readonly DistrictSummary[];
  readonly criticalThreshold: number;
  readonly selectedDistrictId: DistrictId | null;
  readonly onSelectDistrict: (districtId: DistrictId) => void;
}

/** Мини-профиль показателей внутри области: столбики на шкале 0–100. */
const PROFILE = { top: 38, height: 40, bar: 11, gap: 3 } as const;

function clampScale(value: number): number {
  return Math.min(100, Math.max(0, value));
}

const NEXT_KEYS = new Set(["ArrowRight", "ArrowDown"]);
const PREV_KEYS = new Set(["ArrowLeft", "ArrowUp"]);

/**
 * Интерактивная схема районов: группа радиокнопок с «блуждающим» tabindex.
 * Карточки районов дублируют выбор обычными кнопками.
 */
export function DistrictAtlas({
  summaries,
  criticalThreshold,
  selectedDistrictId,
  onSelectDistrict,
}: DistrictAtlasProps) {
  const plateRefs = useRef(new Map<DistrictId, SVGGElement>());
  const { copy, amount, share, district: districtLabel } = useCityCopy();
  const uid = useId().replace(/[^a-zA-Z0-9_-]/g, "");
  const gridId = `${uid}-grid`;
  const captionId = `${uid}-caption`;
  const clipId = (key: string) => `${uid}-clip-${key}`;
  const slots = assignSlots(summaries.map((summary) => summary.district.id));
  const placed = summaries.filter((summary) => slots.has(summary.district.id));
  const hiddenCount = summaries.length - placed.length;

  const hasSelectionOnMap = placed.some((summary) => summary.district.id === selectedDistrictId);
  const tabStopId = hasSelectionOnMap ? selectedDistrictId : (placed[0]?.district.id ?? null);

  const selectAndFocus = (districtId: DistrictId) => {
    onSelectDistrict(districtId);
    plateRefs.current.get(districtId)?.focus();
  };

  const handleKeyDown = (event: KeyboardEvent<SVGGElement>, index: number) => {
    const last = placed.length - 1;
    let target: number | null = null;
    if (NEXT_KEYS.has(event.key)) target = index === last ? 0 : index + 1;
    else if (PREV_KEYS.has(event.key)) target = index === 0 ? last : index - 1;
    else if (event.key === "Home") target = 0;
    else if (event.key === "End") target = last;
    else if (event.key === " " || event.key === "Enter") target = index;
    if (target === null) return;
    event.preventDefault();
    selectAndFocus(placed[target].district.id);
  };

  const thresholdLabel = amount(criticalThreshold);
  const indicatorCount = summaries[0]?.readings.length ?? 0;
  const thresholdY = (anchorY: number) =>
    anchorY + PROFILE.top + PROFILE.height - (clampScale(criticalThreshold) / 100) * PROFILE.height;

  return (
    <figure className={styles.atlas}>
      <svg
        className={styles.atlasSvg}
        viewBox={`0 0 ${ATLAS_VIEWBOX.width} ${ATLAS_VIEWBOX.height}`}
        role="radiogroup"
        aria-label={copy.atlasLabel}
        aria-describedby={captionId}
      >
        <defs>
          <pattern id={gridId} width="12" height="12" patternUnits="userSpaceOnUse">
            <circle cx="1" cy="1" r="1" className={styles.gridDot} />
          </pattern>
          {placed.map((summary) => {
            const slot = slots.get(summary.district.id);
            return slot ? (
              <clipPath key={summary.district.id} id={clipId(slot.key)}>
                <polygon points={slot.points} />
              </clipPath>
            ) : null;
          })}
        </defs>

        <g aria-hidden="true">
          <rect width={ATLAS_VIEWBOX.width} height={ATLAS_VIEWBOX.height} fill={`url(#${gridId})`} />
          {STREET_PATHS.map((d) => (
            <path key={d} d={d} className={styles.street} />
          ))}
          <path d={RIVER_PATH} className={styles.riverEdge} />
          <path d={RIVER_PATH} className={styles.river} />
          {BRIDGE_PATHS.map((d) => (
            <path key={d} d={d} className={styles.bridge} />
          ))}
        </g>

        {placed.map((summary, index) => {
          const { district, critical, readings } = summary;
          const slot = slots.get(district.id);
          if (!slot) return null;
          const isSelected = district.id === selectedDistrictId;
          const criticalCount = critical.length;
          const name = districtLabel(district);
          const shareValue = share(district.populationShare);
          const pillText = copy.platePill(criticalCount, thresholdLabel);
          const { x, y } = slot.anchor;

          return (
            <g
              key={district.id}
              ref={(node) => {
                if (node) plateRefs.current.set(district.id, node);
                else plateRefs.current.delete(district.id);
              }}
              role="radio"
              aria-checked={isSelected}
              aria-label={copy.plateLabel(name, shareValue, criticalCount, thresholdLabel)}
              tabIndex={district.id === tabStopId ? 0 : -1}
              className={cx(styles.plate, isSelected && styles.plateSelected)}
              onClick={() => selectAndFocus(district.id)}
              onKeyDown={(event) => handleKeyDown(event, index)}
            >
              <polygon points={slot.points} className={styles.plateShape} />
              <polygon points={slot.points} className={styles.plateFocus} />
              <g clipPath={`url(#${clipId(slot.key)})`} aria-hidden="true">
                <rect x={x} y={y - 13} width={11} height={11} rx={2} className={styles.plateNode} />
                <text x={x + 18} y={y} className={styles.plateName}>
                  {name}
                </text>
                <text x={x} y={y + 26} className={styles.plateMeta}>
                  {copy.plateShare(shareValue)}
                </text>
                <g className={styles.plateProfile}>
                  {readings.map((reading, barIndex) => {
                    const height = (clampScale(reading.value) / 100) * PROFILE.height;
                    return (
                      <rect
                        key={reading.indicator.id}
                        x={x + barIndex * (PROFILE.bar + PROFILE.gap)}
                        y={y + PROFILE.top + PROFILE.height - height}
                        width={PROFILE.bar}
                        height={Math.max(height, 2)}
                        className={reading.isCritical ? styles.plateBarCritical : styles.plateBar}
                      />
                    );
                  })}
                  <line
                    x1={x - 3}
                    x2={x + readings.length * (PROFILE.bar + PROFILE.gap)}
                    y1={thresholdY(y)}
                    y2={thresholdY(y)}
                    className={styles.plateThreshold}
                  />
                </g>
                {criticalCount > 0 ? (
                  <g className={styles.platePill}>
                    <rect
                      x={x}
                      y={y + PROFILE.top + PROFILE.height + 8}
                      width={pillText.length * 7.4 + 18}
                      height={24}
                      rx={12}
                      className={styles.platePillBox}
                    />
                    <text
                      x={x + 9}
                      y={y + PROFILE.top + PROFILE.height + 25}
                      className={styles.platePillText}
                    >
                      {pillText}
                    </text>
                  </g>
                ) : null}
              </g>
            </g>
          );
        })}
      </svg>
      <figcaption id={captionId} className={styles.atlasCaption}>
        <span className={styles.atlasCaptionTitle}>{copy.atlasLabel}</span>
        <span>
          {copy.atlasCaption(indicatorCount, thresholdLabel)}
          {hiddenCount > 0 ? ` ${copy.atlasHidden(hiddenCount)}` : null}
        </span>
      </figcaption>
    </figure>
  );
}
