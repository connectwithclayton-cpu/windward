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
  const entry = choice === "dispatcher-recovery"
    ? "7:05 AM · Keep recorded: dispatcher recovery released; four certified owners and four in-window outcomes."
    : "7:05 AM · Override recorded: flexible visits kept with Elena; three mornings changed, seven drive minutes removed, diagnostic 13 minutes late.";
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

function update(
  state: BreadthConsoleState,
  changes: Partial<BreadthConsoleState>,
): BreadthConsoleState {
  return Object.freeze({ ...state, ...changes });
}
