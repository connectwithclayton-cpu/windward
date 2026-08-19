import {
  computeCoverage,
  runPlayerAndBaseline,
  simulateScenario,
  type BranchComparison,
  type CoverageEvidence,
  type Decision,
  type SimulationOverride,
  type SimulationResult,
  type TechnicianId,
} from "../index.js";
import { buildDecisionGrammar, type DecisionGrammarModel } from "./decision-model.js";
import {
  EMERGENCY_COVERAGE_REQUIREMENT,
  EVENT_ONE_SCENARIO,
  ROSTER,
} from "./scenario.js";

export type ConsolePhase =
  | "briefing"
  | "route-decision"
  | "route-receipt"
  | "observation"
  | "coverage-decision"
  | "coverage-receipt"
  | "emergency"
  | "debrief"
  | "trace";
export type RouteChoice = "keep" | "override";
export type CoverageChoice = "accept" | "hold";

export interface ConsoleState {
  readonly phase: ConsolePhase;
  readonly routeChoice: RouteChoice | null;
  readonly coverageChoice: CoverageChoice | null;
  readonly assignedTechnicianId: TechnicianId | null;
  readonly eventLog: readonly string[];
  readonly timerRemaining: number;
  readonly timerStarted: boolean;
  readonly paused: boolean;
  readonly coverage: number;
  readonly result: SimulationResult | null;
  readonly comparison: BranchComparison | null;
}

const names = Object.freeze(
  Object.fromEntries(ROSTER.map((profile) => [profile.id, profile.name])),
);
const previewResult = simulateScenario(EVENT_ONE_SCENARIO, []);

export const EVENT_ONE_DECISION = requireDecision(previewResult, 0);
export const EVENT_ONE_GRAMMAR: DecisionGrammarModel = buildDecisionGrammar(
  EVENT_ONE_DECISION,
  names,
);
export const INITIAL_COVERAGE: CoverageEvidence = computeCoverage(
  EVENT_ONE_SCENARIO.initialBoard,
  EMERGENCY_COVERAGE_REQUIREMENT,
);

export function createInitialConsoleState(): ConsoleState {
  return Object.freeze({
    phase: "briefing",
    routeChoice: null,
    coverageChoice: null,
    assignedTechnicianId: null,
    eventLog: Object.freeze([]),
    timerRemaining: 90,
    timerStarted: false,
    paused: false,
    coverage: INITIAL_COVERAGE.availableQualifiedCount,
    result: null,
    comparison: null,
  });
}

export function startShift(state: ConsoleState): ConsoleState {
  if (state.phase !== "briefing") return state;
  return update(state, { phase: "route-decision" });
}

export function recordRouteChoice(
  state: ConsoleState,
  routeChoice: RouteChoice,
): ConsoleState {
  if (state.phase !== "route-decision" || state.routeChoice !== null) return state;
  const assignedTechnicianId =
    routeChoice === "keep"
      ? EVENT_ONE_GRAMMAR.chosen.technicianId
      : EVENT_ONE_GRAMMAR.second.technicianId;
  const result = simulateScenario(EVENT_ONE_SCENARIO, routeOverrides(routeChoice));
  const logEntry =
    routeChoice === "override"
      ? `Route override recorded: ${EVENT_ONE_GRAMMAR.second.name} assigned; ${
          EVENT_ONE_GRAMMAR.laterMinutesSavedByOverride ?? 0
        } min saved later.`
      : `Route choice kept: ${EVENT_ONE_GRAMMAR.chosen.name} assigned; ${
          EVENT_ONE_GRAMMAR.omittedConsequence?.laterDriveMinutes ?? 0
        } min of later driving remains.`;

  return update(state, {
    phase: "route-receipt",
    routeChoice,
    assignedTechnicianId,
    eventLog: Object.freeze([...state.eventLog, logEntry]),
    result,
  });
}

export function continueToActiveShift(state: ConsoleState): ConsoleState {
  if (state.phase !== "route-receipt" || state.routeChoice === null) return state;
  return update(state, { phase: "observation", timerStarted: true, paused: false });
}

export function openCoverageDecision(state: ConsoleState): ConsoleState {
  if (state.phase !== "observation" || state.paused) return state;
  return update(state, { phase: "coverage-decision" });
}

export function getCoverageDecision(state: ConsoleState): Decision {
  const result = state.result ?? previewResult;
  return requireDecision(result, 1);
}

export function recordCoverageChoice(
  state: ConsoleState,
  coverageChoice: CoverageChoice,
): ConsoleState {
  if (state.phase !== "coverage-decision" || state.coverageChoice !== null || state.paused) {
    return state;
  }
  const overrides = allOverrides(state.routeChoice, coverageChoice);
  const result = simulateScenario(EVENT_ONE_SCENARIO, overrides);
  const transition = result.transitions[1];
  if (transition === undefined) throw new Error("Coverage event did not produce a transition");
  const coverageEvidence = computeCoverage(
    transition.afterBoard,
    EMERGENCY_COVERAGE_REQUIREMENT,
  );
  const coverage = coverageEvidence.availableQualifiedCount;
  const eventLog = coverageChoice === "hold"
    ? `11:40 AM · Override recorded: window held; emergency coverage remains ${coverage}.`
    : `11:40 AM · Keep recorded: maintenance accepted; emergency coverage moved ${state.coverage} → ${coverage}.`;
  return update(state, {
    phase: "coverage-receipt",
    coverageChoice,
    coverage,
    result,
    eventLog: Object.freeze([...state.eventLog, eventLog]),
  });
}

export function continueToEmergency(state: ConsoleState): ConsoleState {
  if (state.phase !== "coverage-receipt" || state.coverageChoice === null || state.paused) {
    return state;
  }
  const emergency = state.result?.outcomes[2];
  if (emergency === undefined) throw new Error("Emergency event did not produce an outcome");
  const eventLog = emergency.serviceOutcomeCode === "COMPLETED_IN_WINDOW"
    ? "2:03 PM · No-cool emergency received same-day service."
    : "2:03 PM · No-cool emergency moved to tomorrow; coverage was zero.";
  return update(state, {
    phase: "emergency",
    paused: false,
    eventLog: Object.freeze([...state.eventLog, eventLog]),
  });
}

export function openDebrief(state: ConsoleState): ConsoleState {
  if (state.phase !== "emergency" || state.routeChoice === null || state.coverageChoice === null) {
    return state;
  }
  const comparison = runPlayerAndBaseline(
    EVENT_ONE_SCENARIO,
    allOverrides(state.routeChoice, state.coverageChoice),
  );
  return update(state, { phase: "debrief", comparison });
}

export function togglePause(state: ConsoleState): ConsoleState {
  if (!isActiveShiftPhase(state.phase) || !state.timerStarted) return state;
  return update(state, { paused: !state.paused });
}

export function tick(state: ConsoleState): ConsoleState {
  if (
    !isActiveShiftPhase(state.phase) ||
    !state.timerStarted ||
    state.paused ||
    state.timerRemaining === 0
  ) {
    return state;
  }
  return update(state, { timerRemaining: state.timerRemaining - 1 });
}

export function openTrace(state: ConsoleState): ConsoleState {
  if (state.phase !== "debrief" || state.comparison === null) return state;
  return update(state, { phase: "trace" });
}

export function closeTrace(state: ConsoleState): ConsoleState {
  if (state.phase !== "trace") return state;
  return update(state, { phase: "debrief" });
}

function routeOverrides(routeChoice: RouteChoice): readonly SimulationOverride[] {
  return routeChoice === "override"
    ? [{ eventId: EVENT_ONE_DECISION.inputSnapshot.job.id, technicianId: EVENT_ONE_GRAMMAR.second.technicianId }]
    : [];
}

function allOverrides(
  routeChoice: RouteChoice | null,
  coverageChoice: CoverageChoice,
): readonly SimulationOverride[] {
  return [
    ...(routeChoice === "override" ? routeOverrides(routeChoice) : []),
    ...(coverageChoice === "hold"
      ? [{ eventId: "event-2-coverage-tradeoff", type: "DECLINE" as const }]
      : []),
  ];
}

function isActiveShiftPhase(phase: ConsolePhase): boolean {
  return ["observation", "coverage-decision", "coverage-receipt"].includes(phase);
}

function requireDecision(result: SimulationResult, index: number): Decision {
  const decision = result.decisions[index];
  if (decision === undefined) throw new Error(`Scenario did not produce decision ${index + 1}`);
  return decision;
}

function update(
  state: ConsoleState,
  changes: Partial<ConsoleState>,
): ConsoleState {
  return Object.freeze({ ...state, ...changes });
}
