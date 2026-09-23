/**
 * DTOs for the published Swagger schema. These are deliberately separate from
 * the component view models in ui.ts: all conversion happens in lib/api/adapter.
 */
export interface ApiIndicatorDto {
  id: string;
  name: string;
  category: string;
  weight: number;
}

export interface ApiDistrictDto {
  id: string;
  name: string;
  populationShare: number;
  indicators: Record<string, number>;
}

export interface ApiMeasureDto {
  id: string;
  category: string;
  name: string;
  scope: string;
  cost: number;
  lagQuarters: number;
  effects: Record<string, number>;
}

export interface ApiSynergyDto {
  firstMeasureId: string;
  secondMeasureId: string;
  indicatorId: string;
  bonus: number;
}

export interface ApiIncompatibilityDto {
  firstMeasureId: string;
  secondMeasureId: string;
  sameDistrictOnly: boolean;
  reason: string;
}

export interface ApiScenarioDto {
  budget: number;
  horizonQuarters: number;
  choicesRequired: number;
  maxMeasuresPerCategory: number;
  criticalThreshold: number;
  baselineScore: number;
  indicators: ApiIndicatorDto[];
  districts: ApiDistrictDto[];
  measures: ApiMeasureDto[];
  synergies: ApiSynergyDto[];
  incompatibilities: ApiIncompatibilityDto[];
}

export interface ApiChoiceDto {
  measureId: string;
  districtId?: string;
}

export interface ApiEvaluateRequestDto {
  choices: ApiChoiceDto[];
}

export interface ApiDistrictResultDto {
  id: string;
  name: string;
  scoreBefore: number;
  scoreAfter: number;
  indicatorsBefore: Record<string, number>;
  indicatorsAfter: Record<string, number>;
}

export interface ApiAppliedSynergyDto {
  measureIds: [string, string];
  districtId: string;
  indicatorId: string;
  delta: number;
}

export interface ApiAppliedEffectDto {
  measureId: string;
  districtId: string;
  indicatorId: string;
  /** Lag-adjusted contribution before synergies and final clipping. */
  delta: number;
}

export interface ApiExplanationDto {
  summary: string;
  strengths: string[];
  risks: string[];
  recommendations: string[];
}

/** Canonical language of the explanation text; also sent back as Content-Language. */
export type ApiExplanationLocale = "ru-RU" | "kk-KZ" | "en-US";

export interface ApiEvaluationDto {
  spent: number;
  remaining: number;
  baselineScore: number;
  score: number;
  districts: ApiDistrictResultDto[];
  appliedSynergies: ApiAppliedSynergyDto[];
  /** Optional while older API deployments are still in use. */
  appliedEffects?: ApiAppliedEffectDto[];
  explanation: ApiExplanationDto;
  explanationSource: "llm" | "mock";
  explanationLocale: ApiExplanationLocale;
}

export interface ApiErrorDto {
  error: {
    code: string;
    message: string;
  };
}


/** POST /api/simulations/alternatives, from AlternativeModels.cs and published Swagger. */
export type ApiAlternativeGoal = "score" | "equity" | "economy";
export interface ApiPlanChoiceDto { measureId: string; districtId?: string | null }
export interface ApiScoreBreakdownDto { averageScore: number; minDistrictScore: number; criticalCount: number }
export interface ApiPlanResultDto {
  choices: ApiPlanChoiceDto[];
  spent: number;
  remaining: number;
  score: number;
  breakdown: ApiScoreBreakdownDto;
  districts: { id: string; name: string; score: number }[];
}
export interface ApiPlanFactDto { id: string; text: string }
export interface ApiAlternativeVariantDto {
  id: string;
  strategies: ApiAlternativeGoal[];
  title: string;
  plan: ApiPlanResultDto;
  change: { kind: "move" | "replace"; removed: ApiPlanChoiceDto; added: ApiPlanChoiceDto; text: string };
  delta: { score: number; averageScore: number; minDistrictScore: number; criticalCount: number; spent: number; districts: Record<string, number> };
  arguments: ApiPlanFactDto[];
  tradeoffs: ApiPlanFactDto[];
}
export interface ApiAlternativesDto {
  goal: ApiAlternativeGoal;
  searchScope: "single_swap";
  candidatesChecked: number;
  validCandidates: number;
  original: ApiPlanResultDto;
  bestByGoal: Record<ApiAlternativeGoal, string | null>;
  variants: ApiAlternativeVariantDto[];
  recommendation: {
    status: "improved" | "no_improvement";
    variantId: string | null;
    title: string;
    text: string;
    arguments: ApiPlanFactDto[];
    tradeoffs: ApiPlanFactDto[];
    source: "mock" | "llm";
  };
  locale: ApiExplanationLocale;
}
