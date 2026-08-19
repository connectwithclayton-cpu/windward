import { dispatch } from "./dispatch.js";
import { assertFiniteNumber, clone, deepFreeze, stableFingerprint } from "./internal.js";
import type {
  BoardState,
  CandidateEvidence,
  Decision,
  EligibleCandidateEvidence,
  ImmediateDeltas,
  Job,
  PromisedTimeWindow,
  Technician,
  TechnicianId,
} from "./types.js";

export interface IntegerRange {
  readonly min: number;
  readonly max: number;
}

export interface JobBlueprint {
  readonly id: string;
  readonly arrivalMinute: IntegerRange;
  readonly requestedStartOffsetMinutes: IntegerRange;
  readonly promisedWindowStartOffsetMinutes: IntegerRange;
  readonly promisedWindowDurationMinutes: IntegerRange;
  readonly durationMinutes: IntegerRange;
  readonly requiredSkills: readonly string[];
  readonly requiredCertifications: readonly string[];
  readonly revenueCents: IntegerRange;
  readonly travelMinutesByTechnician: Readonly<Record<TechnicianId, IntegerRange>>;
  readonly routeDeltaMinutesByTechnician?: Readonly<Record<TechnicianId, IntegerRange>>;
  readonly expectedRevenueCentsByTechnician?: Readonly<Record<TechnicianId, IntegerRange>>;
}

export interface ScenarioDefinition {
  readonly seed: string | number;
  readonly initialBoard: BoardState;
  readonly jobs: readonly JobBlueprint[];
}

export interface ExogenousEvent {
  readonly sequence: number;
  readonly eventId: string;
  readonly job: Job;
}

export interface SimulationOverride {
  readonly eventId: string;
  readonly technicianId: TechnicianId;
}

export interface SimulationOutcome {
  readonly eventId: string;
  readonly decisionId: string;
  readonly assignedTechnicianId: TechnicianId;
  readonly overridden: boolean;
  readonly completionMinute: number;
  readonly promisedWindow: PromisedTimeWindow;
  readonly lateByMinutes: number;
  readonly immediateDeltas: ImmediateDeltas;
}

export interface SimulationResult {
  readonly seed: string | number;
  readonly exogenousEvents: readonly ExogenousEvent[];
  readonly decisions: readonly Decision[];
  readonly outcomes: readonly SimulationOutcome[];
  readonly finalBoard: BoardState;
}

export interface BranchComparison {
  readonly player: SimulationResult;
  readonly baseline: SimulationResult;
  readonly exogenousFingerprint: string;
}

export function generateExogenousEvents(
  scenario: ScenarioDefinition,
): readonly ExogenousEvent[] {
  const random = createRandom(scenario.seed);
  const seenIds = new Set<string>();
  const events = scenario.jobs.map((blueprint) => {
    validateBlueprint(blueprint);
    if (seenIds.has(blueprint.id)) {
      throw new RangeError(`duplicate job blueprint id: ${blueprint.id}`);
    }
    seenIds.add(blueprint.id);
    const arrivalMinute = randomInteger(random, blueprint.arrivalMinute);
    const requestedStartMinute =
      arrivalMinute + randomInteger(random, blueprint.requestedStartOffsetMinutes);
    const promisedWindowStartMinute =
      arrivalMinute + randomInteger(random, blueprint.promisedWindowStartOffsetMinutes);
    const promisedWindowEndMinute =
      promisedWindowStartMinute +
      randomInteger(random, blueprint.promisedWindowDurationMinutes);
    const technicianIds = Object.keys(blueprint.travelMinutesByTechnician).sort();
    const travelMinutesByTechnician = Object.fromEntries(
      technicianIds.map((technicianId) => [
        technicianId,
        randomInteger(random, blueprint.travelMinutesByTechnician[technicianId] as IntegerRange),
      ]),
    );
    const routeDeltaMinutesByTechnician = mapOptionalRanges(
      blueprint.routeDeltaMinutesByTechnician,
      technicianIds,
      random,
    );
    const expectedRevenueCentsByTechnician = mapOptionalRanges(
      blueprint.expectedRevenueCentsByTechnician,
      technicianIds,
      random,
    );
    const job: Job = {
      id: blueprint.id,
      arrivalMinute,
      requestedStartMinute,
      promisedWindow: {
        startMinute: promisedWindowStartMinute,
        endMinute: promisedWindowEndMinute,
      },
      durationMinutes: randomInteger(random, blueprint.durationMinutes),
      requiredSkills: [...blueprint.requiredSkills],
      requiredCertifications: [...blueprint.requiredCertifications],
      revenueCents: randomInteger(random, blueprint.revenueCents),
      travelMinutesByTechnician,
      ...(routeDeltaMinutesByTechnician === undefined
        ? {}
        : { routeDeltaMinutesByTechnician }),
      ...(expectedRevenueCentsByTechnician === undefined
        ? {}
        : { expectedRevenueCentsByTechnician }),
    };
    return { eventId: blueprint.id, job };
  });

  events.sort(
    (left, right) =>
      left.job.arrivalMinute - right.job.arrivalMinute ||
      left.eventId.localeCompare(right.eventId),
  );

  return deepFreeze(
    events.map((event, index) => ({
      sequence: index + 1,
      ...event,
    })),
  );
}

export function simulateScenario(
  scenario: ScenarioDefinition,
  overrides: readonly SimulationOverride[],
): SimulationResult {
  return simulateEvents(
    scenario.seed,
    clone(scenario.initialBoard),
    clone(generateExogenousEvents(scenario)),
    overrides,
  );
}

/**
 * Runs both branches from independent board clones and one frozen exogenous
 * trace. The baseline is always the same simulation with no overrides.
 */
export function runPlayerAndBaseline(
  scenario: ScenarioDefinition,
  playerOverrides: readonly SimulationOverride[],
): BranchComparison {
  const events = generateExogenousEvents(scenario);
  const player = simulateEvents(
    scenario.seed,
    clone(scenario.initialBoard),
    clone(events),
    playerOverrides,
  );
  const baseline = simulateEvents(
    scenario.seed,
    clone(scenario.initialBoard),
    clone(events),
    [],
  );
  return deepFreeze({
    player,
    baseline,
    exogenousFingerprint: stableFingerprint(events),
  });
}

function simulateEvents(
  seed: string | number,
  initialBoard: BoardState,
  exogenousEvents: readonly ExogenousEvent[],
  overrides: readonly SimulationOverride[],
): SimulationResult {
  const overrideByEvent = new Map<string, TechnicianId>();
  for (const override of overrides) {
    if (overrideByEvent.has(override.eventId)) {
      throw new RangeError(`duplicate override for event ${override.eventId}`);
    }
    overrideByEvent.set(override.eventId, override.technicianId);
  }
  const knownEvents = new Set(exogenousEvents.map((event) => event.eventId));
  for (const eventId of overrideByEvent.keys()) {
    if (!knownEvents.has(eventId)) {
      throw new RangeError(`override references unknown event ${eventId}`);
    }
  }

  let board = clone(initialBoard);
  const decisions: Decision[] = [];
  const outcomes: SimulationOutcome[] = [];

  for (const event of exogenousEvents) {
    const decision = dispatch(board, event.job);
    const selectedId = overrideByEvent.get(event.eventId) ?? decision.winner.technicianId;
    const selected = findEligibleCandidate(decision, selectedId, event.eventId);
    const completionMinute =
      event.job.requestedStartMinute + selected.immediateDeltas.timeMinutes;
    const assignedWorkMinutes =
      selected.factors.travelTime.value.minutes + event.job.durationMinutes;
    board = applyAssignment(board, selectedId, completionMinute, assignedWorkMinutes);
    decisions.push(decision);
    outcomes.push({
      eventId: event.eventId,
      decisionId: decision.decisionId,
      assignedTechnicianId: selectedId,
      overridden: selectedId !== decision.winner.technicianId,
      completionMinute,
      promisedWindow: clone(event.job.promisedWindow),
      lateByMinutes: Math.max(0, completionMinute - event.job.promisedWindow.endMinute),
      immediateDeltas: selected.immediateDeltas,
    });
  }

  return deepFreeze({
    seed,
    exogenousEvents: clone(exogenousEvents),
    decisions,
    outcomes,
    finalBoard: board,
  });
}

function findEligibleCandidate(
  decision: Decision,
  technicianId: TechnicianId,
  eventId: string,
): EligibleCandidateEvidence {
  const candidate = decision.ranking.find((entry) => entry.technicianId === technicianId);
  if (candidate === undefined) {
    throw new RangeError(`override for ${eventId} references unknown technician ${technicianId}`);
  }
  if (!isEligible(candidate)) {
    throw new RangeError(
      `override for ${eventId} selects ineligible technician ${technicianId}`,
    );
  }
  return candidate;
}

function isEligible(candidate: CandidateEvidence): candidate is EligibleCandidateEvidence {
  return candidate.eligibility.eligible;
}

function applyAssignment(
  board: BoardState,
  technicianId: TechnicianId,
  completionMinute: number,
  assignedWorkMinutes: number,
): BoardState {
  const technicians = board.technicians.map((technician): Technician => {
    if (technician.id !== technicianId) {
      return clone(technician);
    }
    return {
      ...clone(technician),
      availableAtMinute: completionMinute,
      assignedMinutes: technician.assignedMinutes + assignedWorkMinutes,
    };
  });
  return { technicians };
}

function validateBlueprint(blueprint: JobBlueprint): void {
  if (blueprint.id.trim().length === 0) {
    throw new RangeError("job blueprint id must not be empty");
  }
  validateRange(blueprint.arrivalMinute, `${blueprint.id}.arrivalMinute`);
  validateRange(
    blueprint.requestedStartOffsetMinutes,
    `${blueprint.id}.requestedStartOffsetMinutes`,
  );
  validateRange(
    blueprint.promisedWindowStartOffsetMinutes,
    `${blueprint.id}.promisedWindowStartOffsetMinutes`,
  );
  validateRange(
    blueprint.promisedWindowDurationMinutes,
    `${blueprint.id}.promisedWindowDurationMinutes`,
    1,
  );
  validateRange(blueprint.durationMinutes, `${blueprint.id}.durationMinutes`, 1);
  validateRange(blueprint.revenueCents, `${blueprint.id}.revenueCents`);
  for (const [technicianId, range] of Object.entries(
    blueprint.travelMinutesByTechnician,
  )) {
    validateRange(range, `${blueprint.id}.travel.${technicianId}`);
  }
  for (const [technicianId, range] of Object.entries(
    blueprint.routeDeltaMinutesByTechnician ?? {},
  )) {
    validateRange(range, `${blueprint.id}.route.${technicianId}`, Number.NEGATIVE_INFINITY);
  }
  for (const [technicianId, range] of Object.entries(
    blueprint.expectedRevenueCentsByTechnician ?? {},
  )) {
    validateRange(range, `${blueprint.id}.revenue.${technicianId}`);
  }
}

function validateRange(range: IntegerRange, name: string, minimum = 0): void {
  assertFiniteNumber(range.min, `${name}.min`, minimum);
  assertFiniteNumber(range.max, `${name}.max`, minimum);
  if (!Number.isInteger(range.min) || !Number.isInteger(range.max) || range.max < range.min) {
    throw new RangeError(`${name} must be an ordered integer range`);
  }
}

function mapOptionalRanges(
  ranges: Readonly<Record<TechnicianId, IntegerRange>> | undefined,
  technicianIds: readonly TechnicianId[],
  random: () => number,
): Readonly<Record<TechnicianId, number>> | undefined {
  if (ranges === undefined) {
    return undefined;
  }
  return Object.fromEntries(
    technicianIds.map((technicianId) => {
      const range = ranges[technicianId];
      if (range === undefined) {
        throw new RangeError(`missing seeded range for technician ${technicianId}`);
      }
      return [technicianId, randomInteger(random, range)];
    }),
  );
}

function randomInteger(random: () => number, range: IntegerRange): number {
  return range.min + Math.floor(random() * (range.max - range.min + 1));
}

function createRandom(seed: string | number): () => number {
  let state = seedToUint32(seed);
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4_294_967_296;
  };
}

function seedToUint32(seed: string | number): number {
  if (typeof seed === "number") {
    if (!Number.isFinite(seed)) {
      throw new RangeError("scenario seed must be finite");
    }
    return seed >>> 0;
  }
  let value = 0x811c9dc5;
  for (let index = 0; index < seed.length; index += 1) {
    value ^= seed.charCodeAt(index);
    value = Math.imul(value, 0x01000193);
  }
  return value >>> 0;
}
