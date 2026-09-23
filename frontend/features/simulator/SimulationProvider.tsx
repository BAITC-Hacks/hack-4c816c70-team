"use client";

import { createContext, useContext, useEffect, useMemo, useRef, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { validateDraft } from "@/features/planner";
import type { ChoiceDraft } from "@/lib/contracts/ui";
import { useSimulation } from "./use-simulation";

type Simulation = ReturnType<typeof useSimulation>;
interface SimulationContextValue extends Simulation {
  readonly replaceChoices: (choices: readonly ChoiceDraft[]) => void;
}

const SimulationContext = createContext<SimulationContextValue | null>(null);

export function SimulationProvider({ children }: { readonly children: ReactNode }) {
  const simulation = useSimulation(validateDraft);
  const router = useRouter();
  const pathname = usePathname();
  const navigatedRequestId = useRef<number | null>(null);

  useEffect(() => {
    if (simulation.state.evaluation.status !== "success") return;
    if (navigatedRequestId.current === simulation.state.evaluation.requestId) return;
    navigatedRequestId.current = simulation.state.evaluation.requestId;
    if (pathname !== "/results") router.push("/results");
  }, [pathname, router, simulation.state.evaluation]);

  const value = useMemo<SimulationContextValue>(() => ({ ...simulation, replaceChoices: simulation.setChoices }), [simulation]);
  return <SimulationContext.Provider value={value}>{children}</SimulationContext.Provider>;
}

export function useSimulationContext(): SimulationContextValue {
  const value = useContext(SimulationContext);
  if (value === null) throw new Error("SimulationProvider не смонтирован.");
  return value;
}
