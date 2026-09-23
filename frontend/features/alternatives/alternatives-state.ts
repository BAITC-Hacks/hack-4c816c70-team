import type { AlternativeGoal, AlternativesVM } from "./types";

/** Localized in the UI; raw server messages are Russian-only and are not shown here. */
export type AlternativesFailure = "network" | "timeout" | "server" | "contract";

export type AlternativesState =
  | { readonly status: "idle" }
  | { readonly status: "pending"; readonly requestId: number; readonly goal: AlternativeGoal; readonly basisKey: string }
  | { readonly status: "success"; readonly requestId: number; readonly goal: AlternativeGoal; readonly basisKey: string; readonly data: AlternativesVM }
  | { readonly status: "error"; readonly requestId: number; readonly goal: AlternativeGoal; readonly basisKey: string; readonly failure: AlternativesFailure };

export type AlternativesAction =
  | { type: "start"; requestId: number; goal: AlternativeGoal; basisKey: string }
  | { type: "success"; requestId: number; basisKey: string; data: AlternativesVM }
  | { type: "error"; requestId: number; basisKey: string; failure: AlternativesFailure }
  /** The evaluated plan changed: old alternatives are no longer relative to it. */
  | { type: "invalidate" };

export const initialAlternativesState: AlternativesState = { status: "idle" };

export function alternativesReducer(state: AlternativesState, action: AlternativesAction): AlternativesState {
  switch (action.type) {
    case "start":
      if (state.status === "pending") return state;
      return { status: "pending", requestId: action.requestId, goal: action.goal, basisKey: action.basisKey };
    case "success":
    case "error":
      // Late answers for another request or another plan are dropped.
      if (state.status !== "pending" || state.requestId !== action.requestId || state.basisKey !== action.basisKey) return state;
      return action.type === "success"
        ? { status: "success", requestId: action.requestId, goal: state.goal, basisKey: action.basisKey, data: action.data }
        : { status: "error", requestId: action.requestId, goal: state.goal, basisKey: action.basisKey, failure: action.failure };
    case "invalidate":
      return state.status === "idle" ? state : initialAlternativesState;
    default:
      return state;
  }
}
