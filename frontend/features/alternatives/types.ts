import type { ChoiceDraft, EvaluationVM } from "@/lib/contracts/ui";
import type { IntlLocale } from "@/lib/i18n";

/**
 * Internal component contract for plan alternatives. This is NOT a backend DTO.
 * The API adapter maps the published alternatives response into these types.
 * Every number and text comes from the C# API as is; the browser only displays them.
 */
export type AlternativeGoal = "score" | "equity" | "economy";
export const alternativeGoals: readonly AlternativeGoal[] = ["score", "equity", "economy"];

export interface PlanSummaryVM {
  /** Full plan in evaluate format; applied to the planner as is. */
  readonly choices: readonly ChoiceDraft[];
  readonly spent: number;
  readonly score: number;
  /** Server value of the weakest district score. */
  readonly minDistrictScore: number;
}

/** Server fact with a stable ID; text is in {@link AlternativesVM.locale}. */
export interface AlternativeFactVM {
  readonly id: string;
  readonly text: string;
}

export interface AlternativeVariantVM {
  readonly id: string;
  /** Goals for which the server picked this very plan. */
  readonly goals: readonly AlternativeGoal[];
  readonly plan: PlanSummaryVM;
  /** Variant minus current plan, as returned by the server. */
  readonly delta: { readonly score: number; readonly minDistrictScore: number; readonly spent: number };
  readonly gains: readonly AlternativeFactVM[];
  readonly losses: readonly AlternativeFactVM[];
}

export interface AlternativeAdviceVM {
  readonly status: "improved" | "no_improvement";
  readonly variantId: string | null;
  readonly text: string;
  readonly source: EvaluationVM["explanationSource"];
  readonly gains: readonly AlternativeFactVM[];
  readonly losses: readonly AlternativeFactVM[];
}

export interface AlternativesVM {
  readonly goal: AlternativeGoal;
  /** The plan the server compared against. */
  readonly original: PlanSummaryVM;
  /** null: no strictly better plan was found for that goal. */
  readonly bestByGoal: Readonly<Record<AlternativeGoal, string | null>>;
  readonly variants: readonly AlternativeVariantVM[];
  readonly advice: AlternativeAdviceVM;
  /** Actual language of every server text in this response. */
  readonly locale: IntlLocale;
}

export interface AlternativesRequest {
  readonly goal: AlternativeGoal;
  readonly choices: readonly ChoiceDraft[];
  readonly locale: IntlLocale;
}

/** Explicit user requests only; locale selects server text without changing choices. */
export type AlternativesLoader = (request: AlternativesRequest, signal: AbortSignal) => Promise<AlternativesVM>;
