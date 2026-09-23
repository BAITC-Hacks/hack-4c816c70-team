import { useId } from "react";
import type {
  ChoiceDraft,
  DistrictId,
  IndicatorId,
  MeasureVM,
} from "@/lib/contracts/ui";
import { Button } from "@/components/ui";
import { DistrictPicker } from "./DistrictPicker";
import { CATEGORY_LABELS, formatSigned, formatUnits } from "./labels";
import type { DistrictOption, MeasureAvailability } from "./selection-rules";
import styles from "./planner.module.css";

interface MeasureCardProps {
  readonly measure: MeasureVM;
  readonly indicatorNames: ReadonlyMap<IndicatorId, string>;
  /** Текущий выбор этой меры в черновике или undefined, если мера не выбрана. */
  readonly choice: ChoiceDraft | undefined;
  readonly availability: MeasureAvailability;
  readonly districtOptions: readonly DistrictOption[];
  /** Район, который будет назначен при добавлении (локальное значение формы). */
  readonly pendingDistrictId: DistrictId | "";
  readonly onPendingDistrictChange: (districtId: DistrictId | "") => void;
  readonly onAdd: () => void;
  readonly onRemove: () => void;
  readonly onDistrictChange: (districtId: DistrictId | "") => void;
}

export function MeasureCard({
  measure,
  indicatorNames,
  choice,
  availability,
  districtOptions,
  pendingDistrictId,
  onPendingDistrictChange,
  onAdd,
  onRemove,
  onDistrictChange,
}: MeasureCardProps) {
  const titleId = useId();
  const reasonsId = useId();
  const effects = Object.entries(measure.effects) as [IndicatorId, number][];
  const isSelected = choice !== undefined;
  const reasons = availability.status === "blocked" ? availability.reasons : [];

  return (
    <article
      className={styles.card}
      data-state={availability.status}
      aria-labelledby={titleId}
    >
      <header className={styles.cardHeader}>
        <p className={styles.cardMeta}>
          <span>{CATEGORY_LABELS[measure.category]}</span>
          <span aria-hidden="true"> · </span>
          <span className={styles.measureId}>{measure.id}</span>
        </p>
        {isSelected ? (
          <p className={styles.selectedMark}>
            <span aria-hidden="true">✓ </span>Выбрано
          </p>
        ) : null}
      </header>

      <h3 id={titleId} className={styles.cardTitle}>
        {measure.name}
      </h3>

      <dl className={styles.facts}>
        <div>
          <dt>Охват</dt>
          <dd>{measure.scope === "city" ? "Весь город" : "Район"}</dd>
        </div>
        <div>
          <dt>Стоимость</dt>
          <dd>{formatUnits(measure.cost)} ед.</dd>
        </div>
        <div>
          <dt>Лаг</dt>
          <dd>{formatUnits(measure.lagQuarters)} кв.</dd>
        </div>
      </dl>

      <div className={styles.effects}>
        <p className={styles.effectsCaption}>Полный эффект из каталога, без учёта лага</p>
        {effects.length > 0 ? (
          <ul className={styles.effectList}>
            {effects.map(([indicatorId, value]) => (
              <li key={indicatorId} data-sign={value < 0 ? "negative" : "positive"}>
                <span className={styles.effectValue}>
                  <span aria-hidden="true">{value < 0 ? "▼ " : "▲ "}</span>
                  {formatSigned(value)}
                </span>{" "}
                <span>
                  {indicatorId} {indicatorNames.get(indicatorId) ?? ""}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className={styles.textMuted}>Эффекты в каталоге не указаны.</p>
        )}
      </div>

      {measure.scope === "district" ? (
        <DistrictPicker
          label={isSelected ? "Назначенный район" : "Район для меры"}
          options={districtOptions}
          value={isSelected ? (choice.districtId ?? "") : pendingDistrictId}
          onChange={isSelected ? onDistrictChange : onPendingDistrictChange}
        >
          {isSelected && !choice.districtId ? (
            <p className={styles.textWarning}>
              <span aria-hidden="true">! </span>
              Выберите район: без него оценка недоступна.
            </p>
          ) : null}
        </DistrictPicker>
      ) : (
        <p className={styles.cityNote}>Действует во всех районах, район не назначается.</p>
      )}

      <div className={styles.cardActions}>
        {isSelected ? (
          <Button variant="secondary" fullWidth onClick={onRemove}>
            Убрать из решений
          </Button>
        ) : (
          <Button
            fullWidth
            disabled={availability.status === "blocked"}
            aria-describedby={reasons.length > 0 ? reasonsId : undefined}
            onClick={onAdd}
          >
            Добавить в решения
          </Button>
        )}
        {reasons.length > 0 ? (
          <ul id={reasonsId} className={styles.reasons}>
            {reasons.map((reason) => (
              <li key={reason}>
                <span aria-hidden="true">✕ </span>
                {reason}
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    </article>
  );
}
