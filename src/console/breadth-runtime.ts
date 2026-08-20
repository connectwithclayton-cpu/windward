import {
  BREADTH_CASE,
  runBreadthComparison,
  type BreadthChoice,
  type BreadthComparison,
} from "../index.js";

export type BreadthPhase =
  | "briefing"
  | "decision"
  | "receipt"
  | "outcome"
  | "debrief"
  | "trace";

export interface BreadthConsoleState {
  readonly phase: BreadthPhase;
  readonly choice: BreadthChoice | null;
  readonly eventLog: readonly string[];
  readonly comparison: BreadthComparison | null;
}

export const BREADTH_MACHINE_PREVIEW = runBreadthComparison(
  BREADTH_CASE,
  "dispatcher-recovery",
);
export const BREADTH_MINIMUM_TOUCH_PREVIEW = runBreadthComparison(
  BREADTH_CASE,
  "minimum-touch",
);

export function createInitialBreadthConsoleState(): BreadthConsoleState {
  return Object.freeze({
    phase: "briefing",
    choice: null,
    eventLog: Object.freeze([]),
    comparison: null,
  });
}

export function startBreadthCase(state: BreadthConsoleState): BreadthConsoleState {
  if (state.phase !== "briefing") return state;
  return update(state, { phase: "decision" });
}

export function recordBreadthChoice(
  state: BreadthConsoleState,
  choice: BreadthChoice,
): BreadthConsoleState {
  if (state.phase !== "decision" || state.choice !== null) return state;
  const comparison = runBreadthComparison(BREADTH_CASE, choice);
  const recoveryCount = comparison.player.decisions.length;
  const flexibleOwner = repeatedAssignmentOwner(BREADTH_MINIMUM_TOUCH_PREVIEW.player);
  const flexibleName = flexibleOwner === "elena-park" ? "Elena Park" : flexibleOwner;
  const lateOutcome = BREADTH_MINIMUM_TOUCH_PREVIEW.player.outcomes.find((outcome, index) =>
    BREADTH_MINIMUM_TOUCH_PREVIEW.player.decisions[index]?.inputSnapshot.job.requiredSkills.includes("diagnostics"));
  const entry = choice === "dispatcher-recovery"
    ? "7:05 AM · Keep recorded: dispatcher recovery released; " + comparison.playerSummary.recoveredVisitsCertified + " certified owners and " + comparison.playerSummary.recoveredVisitsInsideWindow + " in-window outcomes."
    : "7:05 AM · Override recorded: " + recoveryCount + " recovered visits kept with " + flexibleName + "; " +
      comparison.playerSummary.workingTechniciansTouched + " mornings changed, " +
      (comparison.baselineSummary.addedTravelMinutes - comparison.playerSummary.addedTravelMinutes) +
      " drive minutes removed, diagnostic " + (lateOutcome?.lateByMinutes ?? 0) + " minutes late.";
  return update(state, {
    phase: "receipt",
    choice,
    comparison,
    eventLog: Object.freeze([entry]),
  });
}

export function continueBreadthOutcome(state: BreadthConsoleState): BreadthConsoleState {
  if (state.phase !== "receipt" || state.comparison === null) return state;
  return update(state, { phase: "outcome" });
}

export function openBreadthDebrief(state: BreadthConsoleState): BreadthConsoleState {
  if (state.phase !== "outcome" || state.comparison === null) return state;
  return update(state, { phase: "debrief" });
}

export function openBreadthTrace(state: BreadthConsoleState): BreadthConsoleState {
  if (state.phase !== "debrief" || state.comparison === null) return state;
  return update(state, { phase: "trace" });
}

export function closeBreadthTrace(state: BreadthConsoleState): BreadthConsoleState {
  if (state.phase !== "trace") return state;
  return update(state, { phase: "debrief" });
}

function repeatedAssignmentOwner(result: BreadthComparison["player"]): string {
  const counts = new Map<string, number>();
  for (const outcome of result.outcomes) {
    if (outcome.assignedTechnicianId !== null) {
      counts.set(outcome.assignedTechnicianId, (counts.get(outcome.assignedTechnicianId) ?? 0) + 1);
    }
  }
  const owner = [...counts.entries()].find(([, count]) => count > 1)?.[0];
  if (owner === undefined) throw new Error("Breadth replay has no flexible assignment owner");
  return owner;
}

function update(
  state: BreadthConsoleState,
  changes: Partial<BreadthConsoleState>,
): BreadthConsoleState {
  return Object.freeze({ ...state, ...changes });
}
