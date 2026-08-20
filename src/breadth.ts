import {
  generateExogenousEvents,
  runPlayerAndBaseline,
  type BranchComparison,
  type ScenarioDefinition,
  type SimulationOverride,
  type SimulationResult,
} from "./simulation.js";
import { clone, deepFreeze, stableFingerprint } from "./internal.js";
import type {
  CandidateEvidence,
  Decision,
  EligibleCandidateEvidence,
  TechnicianId,
} from "./types.js";

export type BreadthChoice = "dispatcher-recovery" | "minimum-touch";

export interface BreadthPinnedVisit {
  readonly id: string;
  readonly name: string;
  readonly ownerId: TechnicianId;
  readonly promisedWindow: {
    readonly startMinute: number;
    readonly endMinute: number;
  };
  readonly completionMinute: number;
  readonly status: "PINNED_UNCHANGED";
}

export interface BreadthCaseDefinition {
  readonly version: "windward-breadth-v1";
  readonly scenario: ScenarioDefinition;
  readonly pinnedVisits: readonly BreadthPinnedVisit[];
}

export interface BreadthPinnedManifestReplay {
  readonly before: readonly BreadthPinnedVisit[];
  readonly after: readonly BreadthPinnedVisit[];
}

export interface BreadthRecoverySummary {
  readonly pinnedVisitsMoved: number;
  readonly recoveredVisitsCertified: number;
  readonly recoveredVisitsInsideWindow: number;
  readonly wholeDayInsideWindow: number;
  readonly addedTravelMinutes: number;
  readonly workingTechniciansTouched: number;
  readonly lateMinutes: number;
  readonly selectedScoreSum: number;
}

export interface BreadthComparison extends BranchComparison {
  readonly caseVersion: BreadthCaseDefinition["version"];
  readonly choice: BreadthChoice;
  readonly pinnedVisits: readonly BreadthPinnedVisit[];
  readonly pinnedReplay: {
    readonly player: BreadthPinnedManifestReplay;
    readonly baseline: BreadthPinnedManifestReplay;
  };
  readonly playerSummary: BreadthRecoverySummary;
  readonly baselineSummary: BreadthRecoverySummary;
  readonly caseFingerprint: string;
  readonly comparisonFingerprint: string;
}

const fixed = (value: number) => ({ min: value, max: value });
const TECHNICIAN_IDS = Object.freeze([
  "elena-park",
  "marcus-reed",
  "dev-shah",
  "nina-flores",
] as const);
const RECOVERY_JOB_IDS = Object.freeze([
  "breadth-maintenance-tune-up",
  "breadth-diagnostic-repair",
  "breadth-small-appliance-repair",
  "breadth-no-cool-repair",
] as const);
const MACHINE_ASSIGNMENTS = Object.freeze([
  "elena-park",
  "marcus-reed",
  "nina-flores",
  "dev-shah",
] as const);
const MINIMUM_TOUCH_ASSIGNMENTS = Object.freeze([
  "elena-park",
  "elena-park",
  "nina-flores",
  "dev-shah",
] as const);

export const BREADTH_MINIMUM_TOUCH_OVERRIDE: readonly SimulationOverride[] = Object.freeze([
  Object.freeze({
    eventId: "breadth-diagnostic-repair",
    technicianId: "elena-park",
  }),
]);

export const BREADTH_CASE: BreadthCaseDefinition = deepFreeze({
  version: "windward-breadth-v1",
  scenario: {
    seed: "windward-breadth-v1",
    initialBoard: {
      technicians: [
        {
          id: "elena-park",
          skills: ["maintenance", "diagnostics", "repair"],
          certifications: ["epa-608-ii"],
          availableAtMinute: 540,
          assignedMinutes: 160,
          capacityMinutes: 480,
        },
        {
          id: "marcus-reed",
          skills: ["maintenance", "diagnostics", "repair"],
          certifications: ["epa-608-ii"],
          availableAtMinute: 540,
          assignedMinutes: 120,
          capacityMinutes: 480,
        },
        {
          id: "dev-shah",
          skills: ["maintenance", "no-cool", "repair"],
          certifications: ["epa-608-ii", "epa-608-universal"],
          availableAtMinute: 600,
          assignedMinutes: 180,
          capacityMinutes: 480,
        },
        {
          id: "nina-flores",
          skills: ["maintenance", "appliance", "repair"],
          certifications: ["epa-608-i"],
          availableAtMinute: 510,
          assignedMinutes: 100,
          capacityMinutes: 480,
        },
      ],
    },
    jobs: [
      {
        id: "breadth-maintenance-tune-up",
        arrivalMinute: fixed(420),
        requestedStartOffsetMinutes: fixed(120),
        promisedWindowStartOffsetMinutes: fixed(120),
        promisedWindowDurationMinutes: fixed(90),
        durationMinutes: fixed(60),
        requiredSkills: ["maintenance"],
        requiredCertifications: ["epa-608-ii"],
        revenueCents: fixed(20_000),
        travelMinutesByTechnician: technicianRanges(8, 15, 20, 5),
        routeDeltaMinutesByTechnician: technicianRanges(0, 0, 0, 0),
        expectedRevenueCentsByTechnician: technicianRanges(20_000, 20_000, 20_000, 20_000),
      },
      {
        id: "breadth-diagnostic-repair",
        arrivalMinute: fixed(421),
        requestedStartOffsetMinutes: fixed(149),
        promisedWindowStartOffsetMinutes: fixed(149),
        promisedWindowDurationMinutes: fixed(120),
        durationMinutes: fixed(90),
        requiredSkills: ["diagnostics", "repair"],
        requiredCertifications: ["epa-608-ii"],
        revenueCents: fixed(20_000),
        travelMinutesByTechnician: technicianRanges(5, 12, 18, 4),
        routeDeltaMinutesByTechnician: technicianRanges(0, 0, 0, 0),
        expectedRevenueCentsByTechnician: technicianRanges(20_000, 20_000, 20_000, 20_000),
      },
      {
        id: "breadth-small-appliance-repair",
        arrivalMinute: fixed(422),
        requestedStartOffsetMinutes: fixed(298),
        promisedWindowStartOffsetMinutes: fixed(298),
        promisedWindowDurationMinutes: fixed(90),
        durationMinutes: fixed(45),
        requiredSkills: ["appliance", "repair"],
        requiredCertifications: ["epa-608-i"],
        revenueCents: fixed(20_000),
        travelMinutesByTechnician: technicianRanges(14, 18, 16, 7),
        routeDeltaMinutesByTechnician: technicianRanges(0, 0, 0, 0),
        expectedRevenueCentsByTechnician: technicianRanges(20_000, 20_000, 20_000, 20_000),
      },
      {
        id: "breadth-no-cool-repair",
        arrivalMinute: fixed(423),
        requestedStartOffsetMinutes: fixed(387),
        promisedWindowStartOffsetMinutes: fixed(387),
        promisedWindowDurationMinutes: fixed(120),
        durationMinutes: fixed(90),
        requiredSkills: ["no-cool", "repair"],
        requiredCertifications: ["epa-608-universal"],
        revenueCents: fixed(20_000),
        travelMinutesByTechnician: technicianRanges(10, 13, 16, 9),
        routeDeltaMinutesByTechnician: technicianRanges(0, 0, 0, 0),
        expectedRevenueCentsByTechnician: technicianRanges(20_000, 20_000, 20_000, 20_000),
      },
    ],
  },
  pinnedVisits: [
    pinned("pinned-elena-1", "Morning membership visit", "elena-park", 450, 510, 500),
    pinned("pinned-elena-2", "Afternoon follow-up", "elena-park", 840, 930, 900),
    pinned("pinned-marcus-1", "Airflow check", "marcus-reed", 450, 540, 525),
    pinned("pinned-marcus-2", "Repair follow-up", "marcus-reed", 780, 900, 865),
    pinned("pinned-dev-1", "Morning no-cool visit", "dev-shah", 480, 600, 575),
    pinned("pinned-dev-2", "System inspection", "dev-shah", 1_020, 1_110, 1_090),
    pinned("pinned-nina-1", "Small-appliance service", "nina-flores", 450, 510, 495),
    pinned("pinned-nina-2", "Kitchen repair", "nina-flores", 870, 960, 945),
  ],
});

const CANONICAL_CASE_FINGERPRINT = stableFingerprint(BREADTH_CASE);

export function validateBreadthCaseDefinition(definition: BreadthCaseDefinition): void {
  if (definition.version !== "windward-breadth-v1") {
    throw new RangeError("Breadth case version drifted");
  }
  if (stableFingerprint(definition) !== CANONICAL_CASE_FINGERPRINT) {
    throw new RangeError("Breadth case facts drifted from the validated fixture");
  }
  if (definition.pinnedVisits.length !== 8) {
    throw new RangeError("Breadth requires exactly eight pinned visits");
  }
  const pinnedIds = new Set<string>();
  for (const visit of definition.pinnedVisits) {
    if (pinnedIds.has(visit.id)) throw new RangeError(`duplicate pinned visit id: ${visit.id}`);
    pinnedIds.add(visit.id);
    if (visit.status !== "PINNED_UNCHANGED") {
      throw new RangeError(`pinned visit ${visit.id} is not immutable`);
    }
    if (visit.completionMinute > visit.promisedWindow.endMinute) {
      throw new RangeError(`pinned visit ${visit.id} is outside its promised window`);
    }
  }
  const eventIds = generateExogenousEvents(definition.scenario).map((event) => event.eventId);
  if (!sameValues(eventIds, RECOVERY_JOB_IDS)) {
    throw new RangeError("Breadth recovered visits are not in the validated serial order");
  }
  if (eventIds.some((eventId) => pinnedIds.has(eventId))) {
    throw new RangeError("Pinned visits cannot enter the recovery dispatch queue");
  }
  const technicianIds = definition.scenario.initialBoard.technicians.map(({ id }) => id);
  if (!sameMembers(technicianIds, TECHNICIAN_IDS)) {
    throw new RangeError("Breadth current board must contain the four working technicians");
  }
  if (technicianIds.includes("jordan-kim")) {
    throw new RangeError("The absent technician cannot enter the dispatch board");
  }
}

export function runBreadthComparison(
  definition: BreadthCaseDefinition,
  choice: BreadthChoice,
): BreadthComparison {
  validateBreadthCaseDefinition(definition);
  if (choice !== "dispatcher-recovery" && choice !== "minimum-touch") {
    throw new RangeError(`unknown Breadth choice: ${String(choice)}`);
  }
  const overrides = choice === "minimum-touch" ? BREADTH_MINIMUM_TOUCH_OVERRIDE : [];
  const comparison = runPlayerAndBaseline(definition.scenario, overrides);
  validateBreadthBranches(comparison, choice);
  const pinnedReplay = {
    player: replayPinnedManifest(definition.pinnedVisits, comparison.player),
    baseline: replayPinnedManifest(definition.pinnedVisits, comparison.baseline),
  };
  const playerSummary = summarizeBreadthRecovery(comparison.player, pinnedReplay.player);
  const baselineSummary = summarizeBreadthRecovery(comparison.baseline, pinnedReplay.baseline);
  validateSummaries(playerSummary, baselineSummary, choice);
  const output: BreadthComparison = {
    ...comparison,
    caseVersion: definition.version,
    choice,
    pinnedVisits: clone(pinnedReplay.player.before),
    pinnedReplay,
    playerSummary,
    baselineSummary,
    caseFingerprint: CANONICAL_CASE_FINGERPRINT,
    comparisonFingerprint: stableFingerprint({
      choice,
      exogenousFingerprint: comparison.exogenousFingerprint,
      player: comparison.player,
      baseline: comparison.baseline,
      pinnedReplay,
    }),
  };
  return deepFreeze(output);
}

export function summarizeBreadthRecovery(
  result: SimulationResult,
  pinnedReplay: BreadthPinnedManifestReplay,
): BreadthRecoverySummary {
  if (result.decisions.length !== 4 || result.outcomes.length !== 4) {
    throw new RangeError("Breadth recovery must contain exactly four decisions and outcomes");
  }
  validatePinnedManifestReplay(pinnedReplay);
  const pinnedVisitsMoved = countPinnedVisitsMoved(pinnedReplay);
  const pinnedInside = pinnedReplay.before.filter(
    (visit) => visit.completionMinute <= visit.promisedWindow.endMinute,
  ).length;
  if (pinnedReplay.before.length !== 8) {
    throw new RangeError("Breadth summary requires eight immutable pinned visits");
  }
  const selectedCandidates = result.decisions.map((decision, index) => {
    const outcome = result.outcomes[index];
    if (outcome === undefined || outcome.eventId !== decision.inputSnapshot.job.id) {
      throw new RangeError("Breadth decision and outcome evidence drifted");
    }
    if (outcome.assignedTechnicianId === null) {
      throw new RangeError(`Breadth recovery declined ${outcome.eventId}`);
    }
    return requireEligibleCandidate(decision, outcome.assignedTechnicianId);
  });
  const recoveredInside = result.outcomes.filter((outcome) => outcome.lateByMinutes === 0).length;
  return deepFreeze({
    pinnedVisitsMoved,
    recoveredVisitsCertified: selectedCandidates.filter(
      (candidate) => candidate.factors.certification.value.missing.length === 0,
    ).length,
    recoveredVisitsInsideWindow: recoveredInside,
    wholeDayInsideWindow: pinnedInside + recoveredInside,
    addedTravelMinutes: selectedCandidates.reduce(
      (total, candidate) => total + candidate.factors.travelTime.value.minutes,
      0,
    ),
    workingTechniciansTouched: new Set(
      result.outcomes.map((outcome) => outcome.assignedTechnicianId),
    ).size,
    lateMinutes: result.outcomes.reduce((total, outcome) => total + outcome.lateByMinutes, 0),
    selectedScoreSum: roundThree(
      selectedCandidates.reduce((total, candidate) => total + roundThree(candidate.score), 0),
    ),
  });
}

function validateBreadthBranches(comparison: BranchComparison, choice: BreadthChoice): void {
  if (stableFingerprint(comparison.player.exogenousEvents) !== comparison.exogenousFingerprint ||
      stableFingerprint(comparison.baseline.exogenousEvents) !== comparison.exogenousFingerprint) {
    throw new RangeError("Breadth branch exogenous facts drifted");
  }
  if (comparison.player.exogenousEvents === comparison.baseline.exogenousEvents ||
      comparison.player.finalBoard === comparison.baseline.finalBoard) {
    throw new RangeError("Breadth branches must use independent state");
  }
  const baselineAssignments = comparison.baseline.outcomes.map(
    (outcome) => outcome.assignedTechnicianId,
  );
  if (!sameValues(baselineAssignments, MACHINE_ASSIGNMENTS)) {
    throw new RangeError("Breadth machine assignment sequence drifted");
  }
  const expectedPlayerAssignments = choice === "minimum-touch"
    ? MINIMUM_TOUCH_ASSIGNMENTS
    : MACHINE_ASSIGNMENTS;
  if (!sameValues(
    comparison.player.outcomes.map((outcome) => outcome.assignedTechnicianId),
    expectedPlayerAssignments,
  )) {
    throw new RangeError("Breadth player assignment sequence drifted");
  }
  const overriddenEvents = comparison.player.outcomes.filter((outcome) => outcome.overridden);
  if (choice === "minimum-touch") {
    if (overriddenEvents.length !== 1 ||
        overriddenEvents[0]?.eventId !== "breadth-diagnostic-repair" ||
        overriddenEvents[0]?.assignedTechnicianId !== "elena-park") {
      throw new RangeError("Breadth minimum-touch branch must contain only the Elena diagnostic override");
    }
  } else if (overriddenEvents.length !== 0) {
    throw new RangeError("Breadth machine branch must use an empty override list");
  }

  const firstTransition = comparison.baseline.transitions[0];
  const elenaAfterFirst = firstTransition?.afterBoard.technicians.find(
    (technician) => technician.id === "elena-park",
  );
  if (elenaAfterFirst?.availableAtMinute !== 608 || elenaAfterFirst.assignedMinutes !== 228) {
    throw new RangeError("Breadth first assignment state handoff drifted");
  }
  const diagnostic = comparison.baseline.decisions[1];
  const marcus = diagnostic?.ranking.find((candidate) => candidate.technicianId === "marcus-reed");
  const elena = diagnostic?.ranking.find((candidate) => candidate.technicianId === "elena-park");
  if (diagnostic?.winner.technicianId !== "marcus-reed" ||
      marcus === undefined || elena === undefined ||
      roundThree(marcus.score) !== 94.5 ||
      roundThree(elena.score) !== 89.25 ||
      marcus.factors.travelTime.value.minutes !== 12 ||
      elena.factors.travelTime.value.minutes !== 5) {
    throw new RangeError("Breadth pivotal current-board ranking drifted");
  }
  const expectedMachineCompletion = [608, 672, 772, 916];
  if (!sameValues(
    comparison.baseline.outcomes.map((outcome) => outcome.completionMinute),
    expectedMachineCompletion,
  )) {
    throw new RangeError("Breadth machine completion evidence drifted");
  }
  if (choice === "minimum-touch") {
    const diagnosticOutcome = comparison.player.outcomes[1];
    if (diagnosticOutcome?.completionMinute !== 703 || diagnosticOutcome.lateByMinutes !== 13) {
      throw new RangeError("Breadth minimum-touch promised-window outcome drifted");
    }
  }
}

function validateSummaries(
  player: BreadthRecoverySummary,
  baseline: BreadthRecoverySummary,
  choice: BreadthChoice,
): void {
  if (baseline.addedTravelMinutes !== 43 || baseline.workingTechniciansTouched !== 4 ||
      baseline.recoveredVisitsInsideWindow !== 4 || baseline.wholeDayInsideWindow !== 12 ||
      baseline.recoveredVisitsCertified !== 4 || baseline.pinnedVisitsMoved !== 0) {
    throw new RangeError("Breadth machine summary drifted from source evidence");
  }
  if (choice === "minimum-touch" &&
      (player.addedTravelMinutes !== 36 || player.workingTechniciansTouched !== 3 ||
       player.recoveredVisitsInsideWindow !== 3 || player.wholeDayInsideWindow !== 11 ||
       player.lateMinutes !== 13 || player.recoveredVisitsCertified !== 4 ||
       player.pinnedVisitsMoved !== 0)) {
    throw new RangeError("Breadth minimum-touch summary drifted from source evidence");
  }
  if (choice === "dispatcher-recovery" && stableFingerprint(player) !== stableFingerprint(baseline)) {
    throw new RangeError("Breadth released recovery must match the untouched machine branch");
  }
}

function requireEligibleCandidate(
  decision: Decision,
  technicianId: TechnicianId,
): EligibleCandidateEvidence {
  const candidate: CandidateEvidence | undefined = decision.ranking.find(
    (entry) => entry.technicianId === technicianId,
  );
  if (candidate === undefined) {
    throw new RangeError(`Breadth selected candidate ${technicianId} is not eligible`);
  }
  if (!isEligible(candidate)) {
    throw new RangeError(`Breadth selected candidate ${technicianId} is not eligible`);
  }
  return candidate;
}

function replayPinnedManifest(
  pinnedVisits: readonly BreadthPinnedVisit[],
  result: SimulationResult,
): BreadthPinnedManifestReplay {
  const pinnedIds = new Set(pinnedVisits.map((visit) => visit.id));
  for (const transition of result.transitions) {
    if (pinnedIds.has(transition.eventId)) {
      throw new RangeError("Pinned visit entered the recovery replay: " + transition.eventId);
    }
  }
  return deepFreeze({
    before: clone(pinnedVisits),
    after: clone(pinnedVisits),
  });
}

function validatePinnedManifestReplay(
  pinnedReplay: BreadthPinnedManifestReplay,
): void {
  for (const manifest of [pinnedReplay.before, pinnedReplay.after]) {
    const ids = new Set<string>();
    for (const visit of manifest) {
      if (ids.has(visit.id)) {
        throw new RangeError("duplicate pinned visit id: " + visit.id);
      }
      ids.add(visit.id);
      if (visit.status !== "PINNED_UNCHANGED") {
        throw new RangeError("pinned visit " + visit.id + " is not immutable");
      }
    }
  }
}

function countPinnedVisitsMoved(
  pinnedReplay: BreadthPinnedManifestReplay,
): number {
  const beforeById = new Map(pinnedReplay.before.map((visit) => [visit.id, visit]));
  const afterById = new Map(pinnedReplay.after.map((visit) => [visit.id, visit]));
  const ids = new Set([...beforeById.keys(), ...afterById.keys()]);
  let moved = 0;
  for (const id of ids) {
    if (stableFingerprint(beforeById.get(id) ?? null) !== stableFingerprint(afterById.get(id) ?? null)) {
      moved += 1;
    }
  }
  return moved;
}

function isEligible(candidate: CandidateEvidence): candidate is EligibleCandidateEvidence {
  return candidate.eligibility.eligible;
}

function technicianRanges(elena: number, marcus: number, dev: number, nina: number) {
  return {
    "elena-park": fixed(elena),
    "marcus-reed": fixed(marcus),
    "dev-shah": fixed(dev),
    "nina-flores": fixed(nina),
  };
}

function pinned(
  id: string,
  name: string,
  ownerId: TechnicianId,
  startMinute: number,
  endMinute: number,
  completionMinute: number,
): BreadthPinnedVisit {
  return {
    id,
    name,
    ownerId,
    promisedWindow: { startMinute, endMinute },
    completionMinute,
    status: "PINNED_UNCHANGED",
  };
}

function sameValues(
  actual: readonly unknown[],
  expected: readonly unknown[],
): boolean {
  return actual.length === expected.length && actual.every((value, index) => value === expected[index]);
}

function sameMembers(actual: readonly string[], expected: readonly string[]): boolean {
  return actual.length === expected.length && expected.every((value) => actual.includes(value));
}

function roundThree(value: number): number {
  return Math.round((value + Number.EPSILON) * 1_000) / 1_000;
}
