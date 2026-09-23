import type { ChoiceDraft } from "@/lib/contracts/ui";
import { choiceSetKey } from "../simulator/simulator-reducer";

const choiceKey = (choice: ChoiceDraft) => `${choice.measureId}@${choice.districtId ?? ""}`;

export const samePlan = (left: readonly ChoiceDraft[], right: readonly ChoiceDraft[]) => choiceSetKey(left) === choiceSetKey(right);

export interface PlanDiff {
  readonly added: readonly ChoiceDraft[];
  readonly removed: readonly ChoiceDraft[];
}

/** Which decisions differ; a measure moved to another district counts as removed + added. */
export function diffPlans(current: readonly ChoiceDraft[], next: readonly ChoiceDraft[]): PlanDiff {
  const currentKeys = new Set(current.map(choiceKey));
  const nextKeys = new Set(next.map(choiceKey));
  return { added: next.filter((choice) => !currentKeys.has(choiceKey(choice))), removed: current.filter((choice) => !nextKeys.has(choiceKey(choice))) };
}
