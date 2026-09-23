"use client";

import { useCallback, useEffect, useReducer, useRef } from "react";
import { ApiClientError, evaluateChoices, getScenario } from "@/lib/api/client";
import { buildEvaluatePayload } from "@/lib/api/payload";
import type { ChoiceDraft, ValidateDraft } from "@/lib/contracts/ui";
import { initialSimulatorState, simulatorReducer } from "./simulator-reducer";

function apiMessage(error: unknown): string {
  if (error instanceof ApiClientError && error.kind === "aborted") return "";
  if (error instanceof Error) return error.message;
  return "Не удалось выполнить запрос к серверу.";
}

export function useSimulation(validateDraft: ValidateDraft) {
  const [state, dispatch] = useReducer(simulatorReducer, initialSimulatorState);
  const requestId = useRef(0);
  const scenarioController = useRef<AbortController | null>(null);
  const evaluationController = useRef<AbortController | null>(null);

  const loadScenario = useCallback(async () => {
    scenarioController.current?.abort();
    const controller = new AbortController();
    scenarioController.current = controller;
    dispatch({ type: "scenario-loading" });
    try { dispatch({ type: "scenario-ready", scenario: await getScenario(controller.signal) }); }
    catch (error) { if (!controller.signal.aborted) dispatch({ type: "scenario-error", message: apiMessage(error) }); }
  }, []);

  useEffect(() => { void loadScenario(); return () => { scenarioController.current?.abort(); evaluationController.current?.abort(); }; }, [loadScenario]);

  const setChoices = useCallback((choices: readonly ChoiceDraft[]) => dispatch({ type: "set-choices", choices }), []);
  const evaluate = useCallback(async () => {
    if (state.scenario.status !== "ready" || state.evaluation.status === "pending") return;
    const validation = validateDraft(state.scenario.scenario, state.choices);
    if (!validation.canSubmit) return;
    const submittedChoices = state.choices.map((choice) => ({ ...choice }));
    const id = ++requestId.current;
    const revision = state.revision;
    evaluationController.current?.abort();
    const controller = new AbortController();
    evaluationController.current = controller;
    dispatch({ type: "evaluate-start", requestId: id, submittedChoices });
    try { dispatch({ type: "evaluate-success", requestId: id, revision, result: await evaluateChoices(buildEvaluatePayload(state.scenario.scenario, submittedChoices), controller.signal) }); }
    catch (error) { if (!controller.signal.aborted) dispatch({ type: "evaluate-error", requestId: id, revision, message: apiMessage(error) }); }
  }, [state, validateDraft]);

  const reset = useCallback(() => { evaluationController.current?.abort(); requestId.current += 1; dispatch({ type: "reset" }); }, []);
  return { state, dispatch, loadScenario, setChoices, evaluate, reset };
}
