import type { ReactNode } from "react";

/**
 * Internal component contract. This is NOT the backend DTO or an OpenAPI schema.
 * The API adapter maps the published backend contract into these view models.
 * No simulation calculations belong here.
 */
export type IndicatorId =
  | "T1" | "T2" | "E1" | "E2" | "S1"
  | "S2" | "B1" | "B2" | "C1" | "C2";

export type CategoryId = "transport" | "ecology" | "social" | "safety" | "services";
export type DistrictId = string;
export type MeasureId = string;
export type IndicatorValues = Readonly<Record<IndicatorId, number>>;
export type IndicatorEffects = Readonly<Partial<Record<IndicatorId, number>>>;

export interface IndicatorVM {
  readonly id: IndicatorId;
  readonly name: string;
  readonly weight: number;
}

export interface DistrictVM {
  readonly id: DistrictId;
  readonly name: string;
  readonly populationShare: number;
  readonly indicators: IndicatorValues;
  /** Only populate when supplied by the backend. */
  readonly score?: number;
}

export interface MeasureVM {
  readonly id: MeasureId;
  readonly category: CategoryId;
  readonly name: string;
  readonly scope: "district" | "city";
  readonly cost: number;
  readonly lagQuarters: number;
  /** Full catalog effects, not the effects realized after lag. */
  readonly effects: IndicatorEffects;
}

export interface IncompatibilityVM {
  readonly measureIds: readonly [MeasureId, MeasureId];
  readonly scope: "global" | "same-district";
  readonly reason: string;
}

export interface SynergyRuleVM {
  readonly measureIds: readonly [MeasureId, MeasureId];
  /** The bonus belongs to the district selected for this measure. */
  readonly targetMeasureId: MeasureId;
  readonly effects: IndicatorEffects;
}

export interface SelectionRulesVM {
  readonly requiredChoices: number;
  readonly maxPerCategory: number;
  readonly uniqueMeasures: true;
  readonly incompatibilities: readonly IncompatibilityVM[];
  readonly synergies: readonly SynergyRuleVM[];
}

export interface ScenarioVM {
  readonly budget: number;
  readonly horizonQuarters: number;
  readonly criticalThreshold: number;
  readonly baselineScore: number;
  readonly indicators: readonly IndicatorVM[];
  readonly districts: readonly DistrictVM[];
  readonly measures: readonly MeasureVM[];
  /** Pending rules must be shown as unavailable; never assume empty rules. */
  readonly rules: SelectionRulesVM | null;
  readonly source: "api" | "fixture";
}

/** Incomplete district selection is allowed only while editing the draft. */
export interface ChoiceDraft {
  readonly measureId: MeasureId;
  readonly districtId?: DistrictId;
}

/** Frontend form codes. These do not claim to be the backend error codes. */
export type SelectionIssueCode =
  | "rules-unavailable"
  | "choice-count"
  | "duplicate-measure"
  | "unknown-measure"
  | "category-limit"
  | "budget-exceeded"
  | "district-required"
  | "invalid-district"
  | "district-for-city"
  | "incompatible";

export interface SelectionIssue {
  readonly code: SelectionIssueCode;
  readonly message: string;
  readonly measureIds?: readonly MeasureId[];
  readonly districtId?: DistrictId;
}

export interface DraftValidation {
  readonly issues: readonly SelectionIssue[];
  readonly canSubmit: boolean;
  readonly provisionalSpent: number;
  readonly provisionalRemaining: number;
}

/** Claude 2 exports a function with this signature as validateDraft. */
export type ValidateDraft = (
  scenario: ScenarioVM,
  choices: readonly ChoiceDraft[],
) => DraftValidation;

export interface CityOverviewProps {
  readonly scenario: ScenarioVM;
  readonly selectedDistrictId: DistrictId | null;
  readonly onSelectDistrict: (districtId: DistrictId) => void;
  readonly onStartPlanning: () => void;
}

export interface PlannerProps {
  readonly scenario: ScenarioVM;
  readonly choices: readonly ChoiceDraft[];
  readonly preferredDistrictId: DistrictId | null;
  readonly isEvaluating: boolean;
  readonly serverError: string | null;
  readonly onChoicesChange: (choices: readonly ChoiceDraft[]) => void;
  readonly onEvaluate: () => void;
  readonly onBack: () => void;
}

export interface DistrictResultVM {
  readonly id: DistrictId;
  readonly name: string;
  readonly scoreBefore: number;
  readonly scoreAfter: number;
  readonly indicatorsBefore: IndicatorValues;
  readonly indicatorsAfter: IndicatorValues;
  /** Display-only after - before, derived from API values with backend-owner approval. */
  readonly scoreDelta?: number;
  readonly indicatorDeltas?: IndicatorEffects;
}

export interface AppliedEffectVM {
  readonly measureId: MeasureId;
  readonly districtId: DistrictId;
  readonly indicatorId: IndicatorId;
  readonly delta: number;
}

export interface AppliedSynergyVM {
  readonly measureIds: readonly [MeasureId, MeasureId];
  readonly districtId: DistrictId;
  readonly indicatorId: IndicatorId;
  readonly delta: number;
}

export interface ExplanationVM {
  readonly summary: string;
  readonly strengths: readonly string[];
  readonly risks: readonly string[];
  readonly recommendations: readonly string[];
}

export interface EvaluationVM {
  readonly spent: number;
  readonly remaining: number;
  readonly baselineScore: number;
  readonly score: number;
  /** Display-only score - baselineScore; never recalculate the simulation. */
  readonly scoreDelta?: number;
  readonly districts: readonly DistrictResultVM[];
  /** null means missing in the response; [] means supplied and empty. */
  readonly appliedEffects: readonly AppliedEffectVM[] | null;
  readonly appliedSynergies: readonly AppliedSynergyVM[];
  readonly explanation: ExplanationVM;
  /** Origin of explanation text as reported by the backend; it never affects numbers. */
  readonly explanationSource: "llm" | "mock";
  /** Actual language of explanation text from the server; compare with the UI language before showing it as current. */
  readonly explanationLocale: "ru-RU" | "kk-KZ" | "en-US";
  readonly source: "api" | "fixture";
}

/** One successful evaluation kept for comparison; numbers come from the API response as is. */
export interface EvaluationAttemptVM {
  /** Sorted measureId/districtId pairs: the same set in another order or language is the same attempt. */
  readonly key: string;
  readonly requestId: number;
  readonly submittedChoices: readonly ChoiceDraft[];
  readonly result: EvaluationVM;
}

export interface ResultsProps {
  readonly scenario: ScenarioVM;
  readonly result: EvaluationVM;
  readonly submittedChoices: readonly ChoiceDraft[];
  /** Up to two last successful attempts with different choice sets, oldest first; the last one is the current result. */
  readonly history?: readonly EvaluationAttemptVM[];
  /** Optional block rendered right after the attempt comparison (plan alternatives). */
  readonly afterSummary?: ReactNode;
  readonly onEdit: () => void;
  readonly onReset: () => void;
  /** Re-runs evaluate with the same submitted choices to get the explanation in the current UI language. */
  readonly onReevaluate?: () => void;
  readonly isReevaluating?: boolean;
}
