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
import { describeBlock, type PlannerText } from "./localize";
import type { DistrictOption, MeasureAvailability } from "./selection-rules";
import styles from "./planner.module.css";

interface MeasureCardProps {
  readonly measure: MeasureVM;
  readonly t: PlannerText;
  readonly budget: number;
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
  t,
  budget,
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
  const copy = t.copy;
  const effects = Object.entries(measure.effects) as [IndicatorId, number][];
  const isSelected = choice !== undefined;
  const reasons = availability.status === "blocked" ? availability.reasons.map((reason) => describeBlock(reason, t)) : [];
  const costShare = budget > 0 ? Math.min(1, measure.cost / budget) : 0;

  return (
    <article className={styles.card} data-state={availability.status} aria-labelledby={titleId}>
      <div className={styles.cardTop}>
        <span className={styles.measureId}>{measure.id}</span>
        <h3 id={titleId} className={styles.cardTitle}>
          {t.measure(measure.id)}
        </h3>
        <p className={styles.cardCost}>
          <strong>{t.units(measure.cost)}</strong> {copy.unit}
        </p>
      </div>

      <div className={styles.costTrack} aria-hidden="true">
        <span style={{ transform: `scaleX(${costShare})` }} />
      </div>

      <dl className={styles.facts}>
        <div>
          <dt>{copy.factCategory}</dt>
          <dd>{t.category(measure.category)}</dd>
        </div>
        <div>
          <dt>{copy.factScope}</dt>
          <dd>{measure.scope === "city" ? copy.scopeCity : copy.scopeDistrict}</dd>
        </div>
        <div>
          <dt>{copy.factLag}</dt>
          <dd>{copy.lag(t.units(measure.lagQuarters), measure.lagQuarters)}</dd>
        </div>
      </dl>

      <div className={styles.effectRow}>
        {effects.length > 0 ? (
          <ul className={styles.effectChips} aria-label={copy.effectsLabel}>
            {effects.map(([indicatorId, value]) => (
              <li key={indicatorId} data-sign={value < 0 ? "negative" : "positive"}>
                <span aria-hidden="true">{value < 0 ? "▼ " : "▲ "}</span>
                {/* Ухудшение не прячем: у отрицательного эффекта сразу видно название показателя. */}
                {value < 0 ? `${t.indicator(indicatorId)} ` : `${indicatorId} `}
                <strong>{t.signed(value)}</strong>
              </li>
            ))}
          </ul>
        ) : (
          <p className={styles.textMuted}>{copy.noEffects}</p>
        )}
        <button
          type="button"
          className={styles.moreToggle}
          aria-expanded={isOpen}
          aria-controls={detailsId}
          onClick={() => setOpen((open) => !open)}
        >
          {isOpen ? copy.hideDetails : copy.details}
          <span className={styles.chevron} aria-hidden="true" />
        </button>
      </div>

      <div id={detailsId} className={styles.details} data-open={isOpen} inert={!isOpen}>
        <div className={styles.detailsInner}>
          <p className={styles.textMuted}>{copy.fullEffectNote}</p>
          <ul className={styles.effectList}>
            {effects.map(([indicatorId, value]) => (
              <li key={indicatorId} data-sign={value < 0 ? "negative" : "positive"}>
                <span>
                  {indicatorId} {t.indicator(indicatorId)}
                </span>
                <strong>
                  <span aria-hidden="true">{value < 0 ? "▼ " : "▲ "}</span>
                  {t.signed(value)}
                </strong>
              </li>
            ))}
          </ul>
          {synergyPartners.length > 0 ? (
            <p className={styles.textMuted}>{copy.cardSynergy(synergyPartners.join(", "))}</p>
          ) : null}
        </div>
      </div>

      {measure.scope === "district" && showDistrictChoice ? (
        <DistrictChoice
          t={t}
          legend={isSelected ? copy.assignedDistrictLegend : copy.districtLegend}
          options={districtOptions}
          value={isSelected ? (choice.districtId ?? "") : pendingDistrictId}
          onChange={isSelected ? onDistrictChange : onPendingDistrictChange}
        >
          {isSelected && !choice.districtId ? (
            <p className={styles.textWarning}>
              <span aria-hidden="true">! </span>
              {copy.chooseDistrictWarning}
            </p>
          ) : null}
        </DistrictChoice>
      ) : null}

      <div className={styles.cardActions}>
        {isSelected ? (
          <p key="selected" className={styles.selectedMark}>
            <span className={styles.check} aria-hidden="true" />
            {copy.inPlan}
          </p>
        ) : null}
        {/* Keep the same DOM button when a keyboard user adds/removes this measure. */}
        <Button
          key="action"
          variant={isSelected || availability.status === "blocked" ? "secondary" : "primary"}
          disabled={!isSelected && availability.status === "blocked"}
          aria-describedby={!isSelected && reasons.length > 0 ? reasonsId : undefined}
          onClick={isSelected ? onRemove : onAdd}
        >
          {isSelected ? copy.remove : copy.addToPlan}
        </Button>
      </div>
      {reasons.length > 0 ? (
        <ul id={reasonsId} className={styles.reasons}>
          {reasons.map((reason, index) => (
            <li key={`${reason}-${index}`}>
              <span aria-hidden="true">✕ </span>
              {reason}
            </li>
          ))}
        </ul>
      ) : null}
    </article>
  );
}
