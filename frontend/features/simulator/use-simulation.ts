"use client";

import { useCallback, useEffect, useReducer, useRef } from "react";
import { ApiClientError, evaluateChoices, getScenario } from "@/lib/api/client";
import { buildEvaluatePayload } from "@/lib/api/payload";
import type { ChoiceDraft, ScenarioVM, ValidateDraft } from "@/lib/contracts/ui";
import type { Locale } from "@/lib/i18n";
import { initialSimulatorState, simulatorReducer } from "./simulator-reducer";

function apiMessage(error: unknown): string {
  if (error instanceof ApiClientError && error.kind === "aborted") return "";
  if (error instanceof Error) return error.message;
  return "Не удалось выполнить запрос к серверу.";
}

const DRAFT_STORAGE_KEY = "akim-draft-v1";
const DRAFT_STORAGE_VERSION = 1;

function restoreDraft(scenario: ScenarioVM, validateDraft: ValidateDraft): readonly ChoiceDraft[] {
  try {
    const parsed: unknown = JSON.parse(sessionStorage.getItem(DRAFT_STORAGE_KEY) ?? "null");
    if (!parsed || typeof parsed !== "object" || (parsed as { version?: unknown }).version !== DRAFT_STORAGE_VERSION || !Array.isArray((parsed as { choices?: unknown }).choices)) return [];
    const measureMap = new Map(scenario.measures.map((measure) => [measure.id, measure]));
    const districtIds = new Set(scenario.districts.map((district) => district.id));
    const seen = new Set<string>();
    const choices = (parsed as { choices: unknown[] }).choices.flatMap((value): ChoiceDraft[] => {
      if (!value || typeof value !== "object") return [];
      const candidate = value as { measureId?: unknown; districtId?: unknown };
      if (typeof candidate.measureId !== "string" || seen.has(candidate.measureId)) return [];
      const measure = measureMap.get(candidate.measureId);
      if (!measure) return [];
      seen.add(candidate.measureId);
      if (measure.scope === "city") return [{ measureId: measure.id }];
      if (typeof candidate.districtId === "string" && districtIds.has(candidate.districtId)) return [{ measureId: measure.id, districtId: candidate.districtId }];
      return [{ measureId: measure.id }];
    });
    const hardIssues = validateDraft(scenario, choices).issues.filter((issue) => issue.code !== "choice-count" && issue.code !== "district-required");
    return hardIssues.length === 0 ? choices : [];
  } catch {
    return [];
  }
}

export function useSimulation(validateDraft: ValidateDraft, locale: Locale) {
  const [state, dispatch] = useReducer(simulatorReducer, initialSimulatorState);
  const requestId = useRef(0);
  const scenarioController = useRef<AbortController | null>(null);
  const evaluationController = useRef<AbortController | null>(null);
  // Reducer защищает состояние после ререндера, а ref закрывает окно между
  // двумя синхронными кликами до того, как React успеет обновить state.
  const evaluationInFlight = useRef(false);
  const draftHydrated = useRef(false);
  const skipFirstPersist = useRef(false);
  const localeRef = useRef(locale);

  useEffect(() => {
    localeRef.current = locale;
  }, [locale]);

  const loadScenario = useCallback(async () => {
    scenarioController.current?.abort();
    const controller = new AbortController();
    scenarioController.current = controller;
    dispatch({ type: "scenario-loading" });
    try { dispatch({ type: "scenario-ready", scenario: await getScenario(localeRef.current, controller.signal) }); }
    catch (error) { if (!controller.signal.aborted) dispatch({ type: "scenario-error", message: apiMessage(error) }); }
  }, []);

  useEffect(() => { void loadScenario(); return () => { scenarioController.current?.abort(); evaluationController.current?.abort(); }; }, [loadScenario]);

  useEffect(() => {
    if (state.scenario.status !== "ready" || draftHydrated.current) return;
    const restored = restoreDraft(state.scenario.scenario, validateDraft);
    draftHydrated.current = true;
    if (restored.length > 0) {
      skipFirstPersist.current = true;
      dispatch({ type: "set-choices", choices: restored });
    }
  }, [state.scenario, validateDraft]);

  useEffect(() => {
    if (state.scenario.status !== "ready" || !draftHydrated.current) return;
    if (skipFirstPersist.current) {
      skipFirstPersist.current = false;
      return;
    }
    try { sessionStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify({ version: DRAFT_STORAGE_VERSION, choices: state.choices })); } catch { /* Storage is optional. */ }
  }, [state.choices, state.scenario]);

  const setChoices = useCallback((choices: readonly ChoiceDraft[]) => dispatch({ type: "set-choices", choices }), []);
  const evaluate = useCallback(async () => {
    if (state.scenario.status !== "ready" || state.evaluation.status === "pending" || evaluationInFlight.current) return;
    const validation = validateDraft(state.scenario.scenario, state.choices);
    if (!validation.canSubmit) return;
    evaluationInFlight.current = true;
    const submittedChoices = state.choices.map((choice) => ({ ...choice }));
    const id = ++requestId.current;
    const revision = state.revision;
    evaluationController.current?.abort();
    const controller = new AbortController();
    evaluationController.current = controller;
    dispatch({ type: "evaluate-start", requestId: id, submittedChoices });
    try { dispatch({ type: "evaluate-success", requestId: id, revision, result: await evaluateChoices(buildEvaluatePayload(state.scenario.scenario, submittedChoices), localeRef.current, controller.signal) }); }
    catch (error) { if (!controller.signal.aborted) dispatch({ type: "evaluate-error", requestId: id, revision, message: apiMessage(error) }); }
    finally { evaluationInFlight.current = false; }
  }, [state, validateDraft]);

  const reset = useCallback(() => { evaluationController.current?.abort(); evaluationInFlight.current = false; requestId.current += 1; try { sessionStorage.removeItem(DRAFT_STORAGE_KEY); } catch { /* Storage is optional. */ } dispatch({ type: "reset" }); }, []);
  return { state, dispatch, loadScenario, setChoices, evaluate, reset };
}
