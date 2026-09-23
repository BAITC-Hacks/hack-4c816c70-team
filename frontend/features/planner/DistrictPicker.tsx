import { useId, type ReactNode } from "react";
import { Select } from "@/components/ui/Select";
import type { DistrictId } from "@/lib/contracts/ui";
import { describeConflict, type PlannerText } from "./localize";
import type { DistrictOption } from "./selection-rules";
import styles from "./planner.module.css";

interface DistrictPickerProps {
  readonly t: PlannerText;
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
export function DistrictPicker({ t, options, value, label, children, onChange }: DistrictPickerProps) {
  const id = useId();
  const hintId = `${id}-hint`;
  const current = options.find((option) => option.id === value);
  const isUnknown = value !== "" && current === undefined;
  const conflicts = current?.conflicts ?? [];

  return (
    <div className={styles.picker}>
      <label id={`${id}-label`} htmlFor={id} className={styles.pickerLabel}>
        {label}
      </label>
      <Select
        id={id}
        value={value}
        labelledBy={`${id}-label`}
        describedBy={hintId}
        invalid={isUnknown || conflicts.length > 0}
        onChange={onChange}
        options={[
          { value: "", label: t.copy.notSelected },
          ...(isUnknown ? [{ value, label: t.copy.unknownDistrictOption(value) }] : []),
          ...options.map((option) => ({ value: option.id,
            label: option.conflicts.length > 0 ? t.copy.districtOptionConflict(t.district(option.id)) : t.district(option.id),
            disabled: option.conflicts.length > 0 && option.id !== value,
          })),
        ]}
      />
      <div id={hintId} className={styles.pickerHint}>
        {current && conflicts.length > 0 ? (
          <p className={styles.textDanger}>
            <span aria-hidden="true">✕ </span>
            {t.copy.conflictInDistrict(
              t.district(current.id),
              conflicts.map((conflict) => describeConflict(conflict, t)).join(" "),
            )}
          </p>
        ) : null}
        {children}
      </div>
    </div>
  );
}
