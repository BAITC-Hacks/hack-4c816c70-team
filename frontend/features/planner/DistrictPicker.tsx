import { useId, type ReactNode } from "react";
import type { DistrictId } from "@/lib/contracts/ui";
import type { DistrictOption } from "./selection-rules";
import styles from "./planner.module.css";

interface DistrictPickerProps {
  readonly options: readonly DistrictOption[];
  readonly value: DistrictId | "";
  readonly label: string;
  /** Дополнительная подсказка вызывающего компонента, связана с select через aria-describedby. */
  readonly children?: ReactNode;
  readonly onChange: (districtId: DistrictId | "") => void;
}

/**
 * Назначение района для районной меры. Районы с конфликтом «в одном районе»
 * недоступны для выбора, причина видна текстом под select, без hover.
 */
export function DistrictPicker({ options, value, label, children, onChange }: DistrictPickerProps) {
  const id = useId();
  const hintId = `${id}-hint`;
  const current = options.find((option) => option.id === value);
  const blocked = options.filter((option) => option.conflicts.length > 0 && option.id !== value);
  const isUnknown = value !== "" && current === undefined;

  return (
    <div className={styles.picker}>
      <label htmlFor={id} className={styles.pickerLabel}>
        {label}
      </label>
      <select
        id={id}
        className={styles.select}
        value={value}
        aria-describedby={hintId}
        aria-invalid={isUnknown || (current?.conflicts.length ?? 0) > 0}
        onChange={(event) => onChange(event.target.value)}
      >
        <option value="">— район не выбран —</option>
        {isUnknown ? <option value={value}>Неизвестный район «{value}»</option> : null}
        {options.map((option) => (
          <option
            key={option.id}
            value={option.id}
            disabled={option.conflicts.length > 0 && option.id !== value}
          >
            {option.conflicts.length > 0 ? `${option.name} — конфликт` : option.name}
          </option>
        ))}
      </select>
      <div id={hintId} className={styles.pickerHint}>
        {current && current.conflicts.length > 0 ? (
          <p className={styles.textDanger}>
            <span aria-hidden="true">✕ </span>
            {current.name}: {current.conflicts.join("; ")}
          </p>
        ) : null}
        {children}
        {blocked.map((option) => (
          <p key={option.id} className={styles.textMuted}>
            Недоступно — {option.name}: {option.conflicts.join("; ")}
          </p>
        ))}
      </div>
    </div>
  );
}
