import type { ChoiceDraft, EvaluationAttemptVM, EvaluationVM, ScenarioVM } from "@/lib/contracts/ui";
import type { SimulationError } from "./error-messages";

export type ScenarioState =
  | { readonly status: "loading" }
  | { readonly status: "ready"; readonly scenario: ScenarioVM }
  | { readonly status: "error"; readonly error: SimulationError };
export type EvaluationState =
  | { readonly status: "idle" }
  | { readonly status: "pending"; readonly requestId: number; readonly revision: number; readonly submittedChoices: readonly ChoiceDraft[] }
  | { readonly status: "error"; readonly error: SimulationError }
  | { readonly status: "success"; readonly requestId: number; readonly result: EvaluationVM; readonly submittedChoices: readonly ChoiceDraft[]; readonly revision: number };

export interface SimulatorState {
  readonly scenario: ScenarioState;
  readonly choices: readonly ChoiceDraft[];
  readonly selectedDistrictId: string | null;
  readonly revision: number;
  readonly evaluation: EvaluationState;
  /** Last successful attempts with different choice sets, oldest first, at most {@link MAX_ATTEMPTS}. */
  readonly history: readonly EvaluationAttemptVM[];
  /** Choices came from an applied alternative and were neither edited nor evaluated yet. */
  readonly appliedAlternative: boolean;
}

export const MAX_ATTEMPTS = 2;

/** Order-independent identity of a choice set: sorted measureId/districtId pairs. */
export function choiceSetKey(choices: readonly ChoiceDraft[]): string {
  return choices.map((choice) => `${choice.measureId}@${choice.districtId ?? ""}`).sort().join("|");
}

/** The same set replaces its earlier entry and moves to the end, so A → B → A keeps B and A. */
export function pushAttempt(history: readonly EvaluationAttemptVM[], attempt: EvaluationAttemptVM): readonly EvaluationAttemptVM[] {
  return [...history.filter((item) => item.key !== attempt.key), attempt].slice(-MAX_ATTEMPTS);
}

export const initialSimulatorState: SimulatorState = {
  scenario: { status: "loading" }, choices: [], selectedDistrictId: null, revision: 0, evaluation: { status: "idle" }, history: [], appliedAlternative: false,
};

export type SimulatorAction =
  | { type: "scenario-loading" }
  | { type: "scenario-ready"; scenario: ScenarioVM }
  | { type: "scenario-error"; error: SimulationError }
  | { type: "select-district"; districtId: string }
  | { type: "set-choices"; choices: readonly ChoiceDraft[] }
  | { type: "apply-alternative"; choices: readonly ChoiceDraft[]; basisKey: string }
  | { type: "evaluate-start"; requestId: number; submittedChoices: readonly ChoiceDraft[] }
  | { type: "evaluate-success"; requestId: number; revision: number; result: EvaluationVM }
  | { type: "evaluate-error"; requestId: number; revision: number; error: SimulationError }
  | { type: "reset" };

export function simulatorReducer(state: SimulatorState, action: SimulatorAction): SimulatorState {
  switch (action.type) {
    case "scenario-loading": return { ...state, scenario: { status: "loading" } };
    case "scenario-ready": return { ...state, scenario: { status: "ready", scenario: action.scenario }, selectedDistrictId: action.scenario.districts[0]?.id ?? null };
    case "scenario-error": return { ...state, scenario: { status: "error", error: action.error } };
    case "select-district": return { ...state, selectedDistrictId: action.districtId };
    case "set-choices":
      if (state.evaluation.status === "pending") return state;
      return { ...state, choices: action.choices, revision: state.revision + 1, evaluation: { status: "idle" }, appliedAlternative: false };
    case "apply-alternative":
      // Only replaces the plan with full choices; evaluation stays an explicit user action.
      if (state.evaluation.status === "pending" || action.basisKey !== `${state.revision}|${choiceSetKey(state.choices)}`) return state;
      return { ...state, choices: action.choices.map((choice) => ({ ...choice })), revision: state.revision + 1, evaluation: { status: "idle" }, appliedAlternative: true };
    case "evaluate-start":
      if (state.evaluation.status === "pending") return state;
      return { ...state, evaluation: { status: "pending", requestId: action.requestId, revision: state.revision, submittedChoices: action.submittedChoices } };
    case "evaluate-success":
      if (state.evaluation.status !== "pending" || state.evaluation.requestId !== action.requestId || state.revision !== action.revision) return state;
      return { ...state, evaluation: { status: "success", requestId: action.requestId, result: action.result, submittedChoices: state.evaluation.submittedChoices, revision: action.revision }, history: pushAttempt(state.history, { key: choiceSetKey(state.evaluation.submittedChoices), requestId: action.requestId, submittedChoices: state.evaluation.submittedChoices, result: action.result }), appliedAlternative: false };
    case "evaluate-error":
      if (state.evaluation.status !== "pending" || state.evaluation.requestId !== action.requestId || state.revision !== action.revision) return state;
      return { ...state, evaluation: { status: "error", error: action.error } };
    case "reset": return { ...initialSimulatorState, scenario: state.scenario.status === "ready" ? state.scenario : initialSimulatorState.scenario, selectedDistrictId: state.scenario.status === "ready" ? state.scenario.scenario.districts[0]?.id ?? null : null, revision: state.revision + 1 };
    default: return state;
  }
}
