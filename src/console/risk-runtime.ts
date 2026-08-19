import {
  RISK_APPETITE_CASE,
  rankPlans,
  replayRiskWorld,
  runRiskCohort,
  runRiskCohortAndBaseline,
  type PlanDecision,
  type RiskBranchComparison,
  type RiskCohortResult,
  type RiskPlanId,
  type RiskWorldResult,
} from "../index.js";

export type RiskConsolePhase =
  | "briefing"
  | "decision"
  | "receipt"
  | "world"
  | "distribution"
  | "debrief"
  | "trace";

export interface RiskConsoleState {
  readonly phase: RiskConsolePhase;
  readonly planChoice: RiskPlanId | null;
  readonly eventLog: readonly string[];
  readonly comparison: RiskBranchComparison | null;
}

export const RISK_PLAN_DECISION: PlanDecision = rankPlans(
  RISK_APPETITE_CASE.decisionInput,
);
export const DIRECT_RISK_COHORT: RiskCohortResult = runRiskCohort(
  RISK_APPETITE_CASE,
  "direct-repair",
);
export const PROTECTED_RISK_COHORT: RiskCohortResult = runRiskCohort(
  RISK_APPETITE_CASE,
  "protect-weekend",
);

export function createInitialRiskConsoleState(): RiskConsoleState {
  return Object.freeze({
    phase: "briefing",
    planChoice: null,
    eventLog: Object.freeze([]),
    comparison: null,
  });
}

export function startRiskCase(state: RiskConsoleState): RiskConsoleState {
  if (state.phase !== "briefing") return state;
  return update(state, { phase: "decision" });
}

export function recordRiskChoice(
  state: RiskConsoleState,
  planChoice: RiskPlanId,
): RiskConsoleState {
  if (state.phase !== "decision" || state.planChoice !== null) return state;
  const comparison = runRiskCohortAndBaseline(RISK_APPETITE_CASE, planChoice);
  const eventLog = planChoice === "protect-weekend"
    ? "3:25 PM · Override recorded: weekend protection added; loss-limit breaches moved 15 → 0."
    : "3:25 PM · Keep recorded: direct repair retained; 15 of 100 outcomes remain beyond the loss limit.";
  return update(state, {
    phase: "receipt",
    planChoice,
    comparison,
    eventLog: Object.freeze([eventLog]),
  });
}

export function continueToNarratedWorld(state: RiskConsoleState): RiskConsoleState {
  if (state.phase !== "receipt" || state.comparison === null) return state;
  return update(state, { phase: "world" });
}

export function openRiskDistribution(state: RiskConsoleState): RiskConsoleState {
  if (state.phase !== "world" || state.comparison === null) return state;
  return update(state, { phase: "distribution" });
}

export function openRiskDebrief(state: RiskConsoleState): RiskConsoleState {
  if (state.phase !== "distribution" || state.comparison === null) return state;
  return update(state, { phase: "debrief" });
}

export function openRiskTrace(state: RiskConsoleState): RiskConsoleState {
  if (state.phase !== "debrief" || state.comparison === null) return state;
  return update(state, { phase: "trace" });
}

export function closeRiskTrace(state: RiskConsoleState): RiskConsoleState {
  if (state.phase !== "trace") return state;
  return update(state, { phase: "debrief" });
}

export function getNarratedRiskWorld(
  planId: RiskPlanId,
): RiskWorldResult {
  return replayRiskWorld(
    RISK_APPETITE_CASE,
    RISK_APPETITE_CASE.narrativeWorldId,
    planId,
  );
}

function update(
  state: RiskConsoleState,
  changes: Partial<RiskConsoleState>,
): RiskConsoleState {
  return Object.freeze({ ...state, ...changes });
}
