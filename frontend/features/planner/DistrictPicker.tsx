import { useId, type ReactNode } from "react";
import type { DistrictId } from "@/lib/contracts/ui";
import type { DistrictOption } from "./selection-rules";
import styles from "./planner.module.css";

interface DistrictPickerProps {
  readonly options: readonly DistrictOption[];
  readonly value: DistrictId | "";
  readonly label: string;
  readonly onChange: (districtId: DistrictId | "") => void;
  /** Подсказка вызывающего компонента, связана с select через aria-describedby. */
  readonly children?: ReactNode;
}

/**
 * Компактное назначение района в строке плана. Районы с конфликтом недоступны,
 * конфликт текущего назначения написан текстом под select.
 */
export function DistrictPicker({ options, value, label, children, onChange }: DistrictPickerProps) {
  const id = useId();
  const hintId = `${id}-hint`;
  const current = options.find((option) => option.id === value);
  const isUnknown = value !== "" && current === undefined;
  const conflicts = current?.conflicts ?? [];

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
        aria-invalid={isUnknown || conflicts.length > 0}
        onChange={(event) => onChange(event.target.value)}
      >
        <option value="">Не выбран</option>
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
        {current && conflicts.length > 0 ? (
          <p className={styles.textDanger}>
            <span aria-hidden="true">✕ </span>
            В районе {current.name} конфликт: {conflicts.join(" ")}
          </p>
        ) : null}
        {children}
      </div>
    </div>
  );
}
