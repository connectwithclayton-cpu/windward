import {
  computeCoverage,
  simulateScenario,
  type CoverageEvidence,
  type SimulationResult,
  type TechnicianId,
} from "../index.js";
import { buildDecisionGrammar, type DecisionGrammarModel } from "./decision-model.js";
import {
  EMERGENCY_COVERAGE_REQUIREMENT,
  EVENT_ONE_SCENARIO,
  ROSTER,
} from "./scenario.js";

export type ConsolePhase = "briefing" | "decision" | "receipt" | "shift" | "trace";
export type RouteChoice = "keep" | "override";

export interface ConsoleState {
  readonly phase: ConsolePhase;
  readonly routeChoice: RouteChoice | null;
  readonly assignedTechnicianId: TechnicianId | null;
  readonly eventLog: readonly string[];
  readonly timerRemaining: number;
  readonly timerStarted: boolean;
  readonly paused: boolean;
  readonly result: SimulationResult | null;
}

const names = Object.freeze(
  Object.fromEntries(ROSTER.map((profile) => [profile.id, profile.name])),
);
const previewResult = simulateScenario(EVENT_ONE_SCENARIO, []);
const eventOneDecision = previewResult.decisions[0];
if (eventOneDecision === undefined) {
  throw new Error("Event 1 scenario did not produce a decision");
}
export const EVENT_ONE_DECISION = eventOneDecision;

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
    assignedTechnicianId: null,
    eventLog: Object.freeze([]),
    timerRemaining: 90,
    timerStarted: false,
    paused: false,
    result: null,
  });
}

export function startShift(state: ConsoleState): ConsoleState {
  if (state.phase !== "briefing") return state;
  return update(state, { phase: "decision" });
}

export function recordRouteChoice(
  state: ConsoleState,
  routeChoice: RouteChoice,
): ConsoleState {
  if (state.phase !== "decision" || state.routeChoice !== null) return state;
  const assignedTechnicianId =
    routeChoice === "keep"
      ? EVENT_ONE_GRAMMAR.chosen.technicianId
      : EVENT_ONE_GRAMMAR.second.technicianId;
  const overrides =
    routeChoice === "override"
      ? [{ eventId: EVENT_ONE_DECISION.inputSnapshot.job.id, technicianId: assignedTechnicianId }]
      : [];
  const result = simulateScenario(EVENT_ONE_SCENARIO, overrides);
  const logEntry =
    routeChoice === "override"
      ? `Route override recorded: ${EVENT_ONE_GRAMMAR.second.name} assigned; ${
          EVENT_ONE_GRAMMAR.laterMinutesSavedByOverride ?? 0
        } min saved later.`
      : `Route choice kept: ${EVENT_ONE_GRAMMAR.chosen.name} assigned; ${
          EVENT_ONE_GRAMMAR.omittedConsequence?.laterDriveMinutes ?? 0
        } min of later driving remains.`;

  return update(state, {
    phase: "receipt",
    routeChoice,
    assignedTechnicianId,
    eventLog: Object.freeze([...state.eventLog, logEntry]),
    result,
  });
}

export function continueToActiveShift(state: ConsoleState): ConsoleState {
  if (state.phase !== "receipt" || state.routeChoice === null) return state;
  return update(state, { phase: "shift", timerStarted: true, paused: false });
}

export function togglePause(state: ConsoleState): ConsoleState {
  if (state.phase !== "shift" || !state.timerStarted) return state;
  return update(state, { paused: !state.paused });
}

export function tick(state: ConsoleState): ConsoleState {
  if (
    state.phase !== "shift" ||
    !state.timerStarted ||
    state.paused ||
    state.timerRemaining === 0
  ) {
    return state;
  }
  return update(state, { timerRemaining: state.timerRemaining - 1 });
}

export function openTrace(state: ConsoleState): ConsoleState {
  if (state.phase !== "shift" || state.result === null) return state;
  return update(state, { phase: "trace" });
}

export function closeTrace(state: ConsoleState): ConsoleState {
  if (state.phase !== "trace") return state;
  return update(state, { phase: "shift" });
}

function update(
  state: ConsoleState,
  changes: Partial<ConsoleState>,
): ConsoleState {
  return Object.freeze({ ...state, ...changes });
}
