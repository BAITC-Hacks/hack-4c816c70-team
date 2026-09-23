import { useId, useState } from "react";
import type {
  ChoiceDraft,
  DistrictId,
  IndicatorId,
  MeasureId,
  MeasureVM,
} from "@/lib/contracts/ui";
import { Button } from "@/components/ui";
import { DistrictChoice } from "./DistrictChoice";
import { CATEGORY_LABELS, formatSigned, formatUnits } from "./labels";
import type { DistrictOption, MeasureAvailability } from "./selection-rules";
import styles from "./planner.module.css";

interface MeasureCardProps {
  readonly measure: MeasureVM;
  readonly budget: number;
  readonly indicatorNames: ReadonlyMap<IndicatorId, string>;
  /** Текущий выбор этой меры в черновике или undefined, если мера не выбрана. */
  readonly choice: ChoiceDraft | undefined;
  readonly availability: MeasureAvailability;
  /** Выбор района скрыт, если карточку блокирует не район (например, 5 из 5). */
  readonly showDistrictChoice: boolean;
  readonly districtOptions: readonly DistrictOption[];
  /** Район, который будет назначен при добавлении (локальное значение формы). */
  readonly pendingDistrictId: DistrictId | "";
  readonly synergyPartners: readonly MeasureId[];
  readonly onPendingDistrictChange: (districtId: DistrictId) => void;
  readonly onAdd: () => void;
  readonly onRemove: () => void;
  readonly onDistrictChange: (districtId: DistrictId) => void;
}

export function MeasureCard({
  measure,
  budget,
  indicatorNames,
  choice,
  availability,
  showDistrictChoice,
  districtOptions,
  pendingDistrictId,
  synergyPartners,
  onPendingDistrictChange,
  onAdd,
  onRemove,
  onDistrictChange,
}: MeasureCardProps) {
  const titleId = useId();
  const reasonsId = useId();
  const detailsId = useId();
  const [isOpen, setOpen] = useState(false);
  const effects = Object.entries(measure.effects) as [IndicatorId, number][];
  const isSelected = choice !== undefined;
  const reasons = availability.status === "blocked" ? availability.reasons : [];
  const costShare = budget > 0 ? Math.min(1, measure.cost / budget) : 0;

  return (
    <article className={styles.card} data-state={availability.status} aria-labelledby={titleId}>
      <div className={styles.cardTop}>
        <span className={styles.measureId}>{measure.id}</span>
        <h3 id={titleId} className={styles.cardTitle}>
          {measure.name}
        </h3>
        <p className={styles.cardCost}>
          <strong>{formatUnits(measure.cost)}</strong> ед.
        </p>
      </div>

      <div className={styles.costTrack} aria-hidden="true">
        <span style={{ transform: `scaleX(${costShare})` }} />
      </div>

      <dl className={styles.facts}>
        <div>
          <dt>Направление</dt>
          <dd>{CATEGORY_LABELS[measure.category]}</dd>
        </div>
        <div>
          <dt>Охват</dt>
          <dd>{measure.scope === "city" ? "Весь город" : "Один район"}</dd>
        </div>
        <div>
          <dt>Лаг</dt>
          <dd>{formatUnits(measure.lagQuarters)} кв.</dd>
        </div>
      </dl>

      <div className={styles.effectRow}>
        {effects.length > 0 ? (
          <ul className={styles.effectChips} aria-label="Эффекты из каталога">
            {effects.map(([indicatorId, value]) => (
              <li key={indicatorId} data-sign={value < 0 ? "negative" : "positive"}>
                <span aria-hidden="true">{value < 0 ? "▼ " : "▲ "}</span>
                {/* Ухудшение не прячем: у отрицательного эффекта сразу видно название показателя. */}
                {value < 0 ? `${indicatorNames.get(indicatorId) ?? indicatorId} ` : `${indicatorId} `}
                <strong>{formatSigned(value)}</strong>
              </li>
            ))}
          </ul>
        ) : (
          <p className={styles.textMuted}>Эффекты в каталоге не указаны.</p>
        )}
        <button
          type="button"
          className={styles.moreToggle}
          aria-expanded={isOpen}
          aria-controls={detailsId}
          onClick={() => setOpen((open) => !open)}
        >
          {isOpen ? "Скрыть" : "Подробнее"}
          <span className={styles.chevron} aria-hidden="true" />
        </button>
      </div>

      <div id={detailsId} className={styles.details} data-open={isOpen} inert={!isOpen}>
        <div className={styles.detailsInner}>
          <p className={styles.textMuted}>Полный эффект из каталога, без учёта лага</p>
          <ul className={styles.effectList}>
            {effects.map(([indicatorId, value]) => (
              <li key={indicatorId} data-sign={value < 0 ? "negative" : "positive"}>
                <span>
                  {indicatorId} {indicatorNames.get(indicatorId) ?? ""}
                </span>
                <strong>
                  <span aria-hidden="true">{value < 0 ? "▼ " : "▲ "}</span>
                  {formatSigned(value)}
                </strong>
              </li>
            ))}
          </ul>
          {synergyPartners.length > 0 ? (
            <p className={styles.textMuted}>
              Возможная синергия с {synergyPartners.join(", ")}. Сработает ли она, покажет оценка сервера.
            </p>
          ) : null}
        </div>
      </div>

      {measure.scope === "district" && showDistrictChoice ? (
        <DistrictChoice
          legend={isSelected ? "Назначенный район" : "Район"}
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
        </DistrictChoice>
      ) : null}

      <div className={styles.cardActions}>
        {isSelected ? (
          <>
            <p className={styles.selectedMark}>
              <span className={styles.check} aria-hidden="true" />
              В плане
            </p>
            <Button variant="secondary" onClick={onRemove}>
              Убрать
            </Button>
          </>
        ) : (
          <Button
            variant={availability.status === "blocked" ? "secondary" : "primary"}
            disabled={availability.status === "blocked"}
            aria-describedby={reasons.length > 0 ? reasonsId : undefined}
            onClick={onAdd}
          >
            Добавить в план
          </Button>
        )}
      </div>
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
    </article>
  );
}
