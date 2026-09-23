import { useId, type ReactNode } from "react";
import type { DistrictId } from "@/lib/contracts/ui";
import type { DistrictOption } from "./selection-rules";
import styles from "./planner.module.css";

interface DistrictChoiceProps {
  readonly legend: string;
  readonly options: readonly DistrictOption[];
  readonly value: DistrictId | "";
  readonly onChange: (districtId: DistrictId) => void;
  /** Подсказка вызывающего компонента под выбором. */
  readonly children?: ReactNode;
}

/**
 * Выбор района в карточке: все районы видны сразу, как радиокнопки.
 * Район с конфликтом «в одном районе» недоступен, причина написана текстом.
 */
export function DistrictChoice({ legend, options, value, onChange, children }: DistrictChoiceProps) {
  const name = useId();
  const current = options.find((option) => option.id === value);
  const blocked = options.filter((option) => option.conflicts.length > 0 && option.id !== value);

  return (
    <fieldset className={styles.districts}>
      <legend className={styles.districtsLegend}>{legend}</legend>
      <div className={styles.pills}>
        {options.map((option) => {
          const hasConflict = option.conflicts.length > 0;
          return (
            <label key={option.id} className={styles.pill} data-conflict={hasConflict}>
              <input
                type="radio"
                className={styles.pillInput}
                name={name}
                value={option.id}
                checked={value === option.id}
                disabled={hasConflict && option.id !== value}
                onChange={() => onChange(option.id)}
              />
              <span className={styles.pillText}>
                {hasConflict ? <span aria-hidden="true">✕ </span> : null}
                {option.name}
              </span>
            </label>
          );
        })}
      </div>
      {current && current.conflicts.length > 0 ? (
        <p className={styles.textDanger}>
          <span aria-hidden="true">✕ </span>
          В районе {current.name} конфликт: {current.conflicts.join(" ")}
        </p>
      ) : null}
      {blocked.map((option) => (
        <p key={option.id} className={styles.textMuted}>
          В районе {option.name} нельзя: {option.conflicts.join(" ")}
        </p>
      ))}
      {children}
    </fieldset>
  );
}
