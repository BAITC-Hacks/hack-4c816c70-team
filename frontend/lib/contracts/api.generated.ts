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

export interface ApiExplanationDto {
  summary: string;
  strengths: string[];
  risks: string[];
  recommendations: string[];
}

export interface ApiEvaluationDto {
  spent: number;
  remaining: number;
  baselineScore: number;
  score: number;
  districts: ApiDistrictResultDto[];
  appliedSynergies: ApiAppliedSynergyDto[];
  explanation: ApiExplanationDto;
  explanationSource: "llm" | "mock";
  /** BCP 47 tag for the language in explanation, e.g. ru-RU or kk-KZ. */
  explanationLocale: string | null;
}

export interface ApiErrorDto {
  error: {
    code: string;
    message: string;
  };
}
