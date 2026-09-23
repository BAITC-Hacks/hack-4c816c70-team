"use client";

import { useCallback, useEffect, useId, useReducer, useRef, useState } from "react";
import { Button } from "@/components/ui";
import { ApiClientError } from "@/lib/api/errors";
import type { ChoiceDraft, ScenarioVM } from "@/lib/contracts/ui";
import { formatInteger, formatNumber, formatSigned } from "@/lib/format/numbers";
import { intlLocales, useLocale, type IntlLocale } from "@/lib/i18n";
import { alternativesReducer, initialAlternativesState, type AlternativesFailure } from "./alternatives-state";
import { choiceLabel } from "./labels";
import { alternativesMessages } from "./messages";
import { diffPlans, samePlan } from "./plan-diff";
import { alternativeGoals, type AlternativeGoal, type AlternativeVariantVM, type AlternativesLoader, type AlternativesVM } from "./types";
import styles from "./alternatives.module.css";

/** Native names, so the notice names the language the server text is actually written in. */
const languageNames: Record<IntlLocale, string> = { "ru-RU": "Русский", "kk-KZ": "Қазақша", "en-US": "English" };

function failureOf(error: unknown): AlternativesFailure | null {
  if (!(error instanceof ApiClientError)) return "contract";
  if (error.kind === "aborted") return null;
  if (error.kind === "network" || error.kind === "timeout") return error.kind;
  return error.kind === "http" ? "server" : "contract";
}

export interface AlternativesPanelProps {
  readonly scenario: ScenarioVM;
  /** The evaluated plan; alternatives are requested for exactly these choices. */
  readonly submittedChoices: readonly ChoiceDraft[];
  /** Changes whenever the evaluated plan changes; old alternatives are dropped at that moment. */
  readonly basisKey: string;
  /** Explicit request function; null is supported for an unavailable deployment. */
  readonly loader: AlternativesLoader | null;
  readonly canApply: (choices: readonly ChoiceDraft[]) => boolean;
  readonly applyDisabled?: boolean;
  /** Moves full choices into the plan; evaluation stays a separate explicit action. */
  readonly onApply: (choices: readonly ChoiceDraft[]) => void;
}

export function AlternativesPanel({ scenario, submittedChoices, basisKey, loader, canApply, applyDisabled = false, onApply }: AlternativesPanelProps) {
  const { locale, intlLocale } = useLocale();
  const copy = alternativesMessages[locale];
  const id = useId();
  const [goal, setGoal] = useState<AlternativeGoal>("score");
  const [state, dispatch] = useReducer(alternativesReducer, initialAlternativesState);
  const requestId = useRef(0);
  const controller = useRef<AbortController | null>(null);
  const inFlight = useRef(false);

  // A new evaluated plan makes previous alternatives irrelevant: cancel and forget them.
  useEffect(() => {
    controller.current?.abort();
    inFlight.current = false;
    dispatch({ type: "invalidate" });
  }, [basisKey]);
  useEffect(() => () => controller.current?.abort(), []);

  const find = useCallback(async () => {
    if (!loader || state.status === "pending" || inFlight.current) return;
    inFlight.current = true;
    controller.current?.abort();
    const current = new AbortController();
    controller.current = current;
    const request = ++requestId.current;
    dispatch({ type: "start", requestId: request, goal, basisKey });
    try {
      const data = await loader({ goal, choices: submittedChoices.map((choice) => ({ ...choice })), locale: intlLocale }, current.signal);
      if (!current.signal.aborted) dispatch({ type: "success", requestId: request, basisKey, data });
    } catch (error) {
      const failure = failureOf(error);
      if (failure && !current.signal.aborted) dispatch({ type: "error", requestId: request, basisKey, failure });
    } finally {
      if (controller.current === current) inFlight.current = false;
    }
  }, [loader, state.status, goal, basisKey, submittedChoices, intlLocale]);

  const pending = state.status === "pending";
  const data = state.status === "success" && state.basisKey === basisKey ? state.data : null;

  return <section className={styles.panel} aria-labelledby={`${id}-title`} aria-busy={pending || undefined}>
    <h2 id={`${id}-title`}>{copy.title}</h2>
    <p className={styles.lead}>{copy.lead}</p>
    <div className={styles.controls}>
      <fieldset className={styles.goals} disabled={pending}>
        <legend>{copy.goalLegend}</legend>
        {alternativeGoals.map((item) => <label key={item} className={styles.goal}><input type="radio" name={`${id}-goal`} value={item} checked={goal === item} onChange={() => setGoal(item)} /><span>{copy.goals[item]}</span></label>)}
      </fieldset>
      <Button onClick={() => void find()} busy={pending} disabled={!loader}>{pending ? copy.finding : copy.find}</Button>
    </div>
    {!loader ? <p className={styles.notice}>{copy.unavailable}</p> : null}
    <div aria-live="polite">
      {state.status === "error" ? <div className={styles.error} role="alert"><p>{copy.failures[state.failure]}</p><Button variant="secondary" onClick={() => void find()}>{copy.retry}</Button></div> : null}
      {data ? <AlternativesResult data={data} scenario={scenario} submittedChoices={submittedChoices} selectedGoal={goal} pending={pending} canApply={canApply} applyDisabled={applyDisabled} onApply={onApply} onRequestAgain={() => void find()} /> : null}
    </div>
  </section>;
}

function AlternativesResult({ data, scenario, submittedChoices, selectedGoal, pending, canApply, applyDisabled, onApply, onRequestAgain }: {
  readonly data: AlternativesVM;
  readonly scenario: ScenarioVM;
  readonly submittedChoices: readonly ChoiceDraft[];
  readonly selectedGoal: AlternativeGoal;
  readonly pending: boolean;
  readonly canApply: (choices: readonly ChoiceDraft[]) => boolean;
  readonly applyDisabled: boolean;
  readonly onApply: (choices: readonly ChoiceDraft[]) => void;
  readonly onRequestAgain: () => void;
}) {
  const { locale, intlLocale } = useLocale();
  const copy = alternativesMessages[locale];
  // Never present alternatives computed for another plan as relevant to this one.
  if (!samePlan(data.original.choices, submittedChoices)) return <p className={styles.notice}>{copy.outdated}</p>;
  const textsStale = data.locale !== intlLocales[locale];
  const variants = new Map(data.variants.map((variant) => [variant.id, variant]));
  const recommended = data.advice.variantId ? variants.get(data.advice.variantId) : undefined;
  const shownFor = new Map<string, AlternativeGoal>();
  return <>
    {data.goal !== selectedGoal ? <p className={styles.notice}>{copy.goalMismatch(copy.goals[data.goal])}</p> : null}
    {textsStale ? <div role="status" className={styles.notice}><p>{copy.staleTexts(languageNames[data.locale])}</p><Button variant="secondary" onClick={onRequestAgain} busy={pending}>{copy.requestAgain}</Button></div> : null}
    <p className={styles.reference}>{copy.currentPlan(formatNumber(data.original.score, intlLocale), formatInteger(data.original.spent, intlLocale), formatNumber(data.original.minDistrictScore, intlLocale))}</p>
    <ol className={styles.strategies}>{alternativeGoals.map((goal) => {
      const variantId = data.bestByGoal[goal];
      const variant = variantId ? variants.get(variantId) ?? null : null;
      const firstGoal = variant ? shownFor.get(variant.id) : undefined;
      if (variant && firstGoal === undefined) shownFor.set(variant.id, goal);
      return <li key={goal} className={styles.strategy} data-goal={goal === data.goal || undefined}>
        <header><h3>{copy.goals[goal]}</h3>{goal === data.goal ? <span className={styles.badge}>{copy.yourGoal}</span> : null}</header>
        {variant === null ? <p className={styles.muted}>{copy.noVariant(copy.goals[goal])}</p>
          : firstGoal !== undefined ? <p className={styles.muted}>{copy.sameAs(copy.goals[firstGoal])}</p>
          : <VariantCard variant={variant} scenario={scenario} submittedChoices={submittedChoices} textLocale={data.locale} canApply={canApply} applyDisabled={applyDisabled} onApply={onApply} />}
      </li>;
    })}</ol>
    <p className={styles.caption}>{copy.versusCurrent}</p>
    <div className={styles.advice}>
      <h3>{copy.advice}: {copy.goals[data.goal]}</h3>
      <p className={styles.caption}>{copy.adviceSource[data.advice.source]}</p>
      <p lang={data.locale}>{data.advice.text}</p>
      {data.advice.gains.length > 0 ? <><h4>{copy.gains}</h4><ul lang={data.locale}>{data.advice.gains.map((fact) => <li key={fact.id}>{fact.text}</li>)}</ul></> : null}
      {data.advice.losses.length > 0 ? <><h4>{copy.losses}</h4><ul lang={data.locale}>{data.advice.losses.map((fact) => <li key={fact.id}>{fact.text}</li>)}</ul></> : null}
      {recommended ? <Button variant="secondary" disabled={applyDisabled || !canApply(recommended.plan.choices) || samePlan(recommended.plan.choices, submittedChoices)} onClick={() => onApply(recommended.plan.choices)}>{copy.apply}</Button> : null}
    </div>
  </>;
}

function VariantCard({ variant, scenario, submittedChoices, textLocale, canApply, applyDisabled, onApply }: {
  readonly variant: AlternativeVariantVM;
  readonly scenario: ScenarioVM;
  readonly submittedChoices: readonly ChoiceDraft[];
  readonly textLocale: IntlLocale;
  readonly canApply: (choices: readonly ChoiceDraft[]) => boolean;
  readonly applyDisabled: boolean;
  readonly onApply: (choices: readonly ChoiceDraft[]) => void;
}) {
  const { locale, intlLocale } = useLocale();
  const copy = alternativesMessages[locale];
  const same = samePlan(variant.plan.choices, submittedChoices);
  const valid = canApply(variant.plan.choices);
  const diff = diffPlans(submittedChoices, variant.plan.choices);
  const tone = (delta: number, higherIsBetter: boolean) => delta === 0 ? undefined : (delta > 0) === higherIsBetter ? styles.positive : styles.negative;
  const metrics = [
    { key: "spent", label: copy.spent, value: formatInteger(variant.plan.spent, intlLocale), delta: variant.delta.spent, text: `${variant.delta.spent > 0 ? "+" : ""}${formatInteger(variant.delta.spent, intlLocale)}`, higherIsBetter: false },
    { key: "score", label: copy.score, value: formatNumber(variant.plan.score, intlLocale), delta: variant.delta.score, text: formatSigned(variant.delta.score, intlLocale), higherIsBetter: true },
    { key: "min", label: copy.minDistrict, value: formatNumber(variant.plan.minDistrictScore, intlLocale), delta: variant.delta.minDistrictScore, text: formatSigned(variant.delta.minDistrictScore, intlLocale), higherIsBetter: true },
  ];
  return <>
    <dl className={styles.metrics}>{metrics.map((metric) => <div key={metric.key}><dt>{metric.label}</dt><dd><b>{metric.value}</b> <span className={tone(metric.delta, metric.higherIsBetter)}>{metric.text}</span></dd></div>)}</dl>
    {same ? <p className={styles.muted}>{copy.samePlan}</p> : <>
      <div className={styles.changes}>{diff.added.length > 0 ? <p>{copy.adds(diff.added.map((choice) => choiceLabel(choice, scenario, locale)).join("; "))}</p> : null}{diff.removed.length > 0 ? <p>{copy.removes(diff.removed.map((choice) => choiceLabel(choice, scenario, locale)).join("; "))}</p> : null}</div>
      <div className={styles.tradeoffs}>
        <div><h4>{copy.gains}</h4>{variant.gains.length > 0 ? <ul lang={textLocale}>{variant.gains.map((fact) => <li key={fact.id}>{fact.text}</li>)}</ul> : <p>{copy.noGains}</p>}</div>
        <div><h4>{copy.losses}</h4>{variant.losses.length > 0 ? <ul lang={textLocale}>{variant.losses.map((fact) => <li key={fact.id}>{fact.text}</li>)}</ul> : <p>{copy.noLosses}</p>}</div>
      </div>
    </>}
    {!same && !valid ? <p className={styles.notice}>{copy.applyBlocked}</p> : null}
    <Button variant="secondary" fullWidth disabled={same || !valid || applyDisabled} onClick={() => onApply(variant.plan.choices)}>{copy.apply}</Button>
  </>;
}
