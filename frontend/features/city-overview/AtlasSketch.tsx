import { ATLAS_SLOTS, ATLAS_VIEWBOX, BRIDGE_PATHS, RIVER_PATH, STREET_PATHS } from "./atlas-layout";
import styles from "./home.module.css";

/**
 * Декоративный линейный эскиз схемы районов для первого экрана.
 * Без данных сценария и без интерактива: рабочая схема — ниже на странице.
 */
export function AtlasSketch() {
  return (
    <svg
      className={styles.sketch}
      viewBox={`0 0 ${ATLAS_VIEWBOX.width} ${ATLAS_VIEWBOX.height}`}
      aria-hidden="true"
      focusable="false"
    >
      {STREET_PATHS.map((d) => (
        <path key={d} d={d} className={styles.sketchStreet} />
      ))}
      <path d={RIVER_PATH} className={styles.sketchRiver} />
      {BRIDGE_PATHS.map((d) => (
        <path key={d} d={d} className={styles.sketchBridge} />
      ))}
      {ATLAS_SLOTS.map((slot, index) => (
        <polygon
          key={slot.key}
          points={slot.points}
          pathLength={1}
          className={styles.sketchPlate}
          style={{ animationDelay: `${160 + index * 90}ms` }}
        />
      ))}
      {ATLAS_SLOTS.map((slot, index) => (
        <rect
          key={slot.key}
          x={slot.anchor.x}
          y={slot.anchor.y - 13}
          width={11}
          height={11}
          rx={2}
          className={styles.sketchNode}
          style={{ animationDelay: `${520 + index * 90}ms` }}
        />
      ))}
    </svg>
  );
}
