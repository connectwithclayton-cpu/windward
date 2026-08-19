import {
  DEFAULT_SCORING_WEIGHTS,
  type BoardState,
  type CandidateEvidence,
  type Decision,
  type DisqualifiedCandidateEvidence,
  type EligibleCandidateEvidence,
  type FactorBreakdown,
  type Job,
  type NormalizedJobRequirements,
  type Technician,
} from "./types.js";
import {
  assertFiniteNumber,
  clamp01,
  clone,
  compareCodeUnits,
  deepFreeze,
  normalizeCodes,
  roundScore,
  stableFingerprint,
} from "./internal.js";

const MAX_TRAVEL_MINUTES = 120;
const MAX_AVAILABILITY_WAIT_MINUTES = 120;

export class NoEligibleCandidateError extends Error {
  public constructor(public readonly candidates: readonly DisqualifiedCandidateEvidence[]) {
    super("No technician satisfies the job's hard constraints");
    this.name = "NoEligibleCandidateError";
  }
}

/**
 * Greedily ranks only the assignment in front of it. Future jobs, reserve
 * capacity, forecasts, and coverage are intentionally absent from this input
 * and ranking path.
 */
export function dispatch(boardState: BoardState, job: Job): Decision {
  const snapshot = normalizeInput(boardState, job);
  const decisionId = `decision-${stableFingerprint(snapshot)}`;
  const candidates = snapshot.boardState.technicians.map((technician) =>
    evaluateCandidate(technician, snapshot.job, decisionId),
  );

  const eligible = candidates
    .filter((candidate): candidate is EligibleCandidateEvidence => candidate.eligibility.eligible)
    .sort(compareEligible);
  const disqualified = candidates
    .filter(
      (candidate): candidate is DisqualifiedCandidateEvidence =>
        !candidate.eligibility.eligible,
    )
    .sort((left, right) => compareCodeUnits(left.technicianId, right.technicianId));

  if (eligible.length === 0) {
    throw new NoEligibleCandidateError(deepFreeze(rankDisqualified(disqualified)));
  }

  const rankedEligible = eligible.map((candidate, index) => ({
    ...candidate,
    rank: index + 1,
    reasonCode: index === 0 ? "BEST_IMMEDIATE_SCORE" : "LOWER_IMMEDIATE_SCORE",
  })) as unknown as [EligibleCandidateEvidence, ...EligibleCandidateEvidence[]];
  const rankedDisqualified = disqualified.map((candidate, index) => ({
    ...candidate,
    rank: rankedEligible.length + index + 1,
  }));
  const ranking = [
    ...rankedEligible,
    ...rankedDisqualified,
  ] as unknown as [EligibleCandidateEvidence, ...CandidateEvidence[]];
  const winner = ranking[0];

  const decision = {
    decisionId,
    inputSnapshot: snapshot,
    winner,
    rankedAlternatives: ranking.slice(1),
    ranking,
  } as unknown as Decision;

  return deepFreeze(decision);
}

function normalizeInput(boardState: BoardState, job: Job) {
  validateJob(job);
  const seenIds = new Set<string>();
  const technicians = boardState.technicians
    .map((technician) => normalizeTechnician(technician, seenIds))
    .sort((left, right) => compareCodeUnits(left.id, right.id));

  if (technicians.length === 0) {
    throw new RangeError("boardState must contain at least one technician");
  }

  for (const technician of technicians) {
    const travel = job.travelMinutesByTechnician[technician.id];
    if (travel === undefined) {
      throw new RangeError(`job is missing travel minutes for technician ${technician.id}`);
    }
    assertFiniteNumber(travel, `travelMinutesByTechnician.${technician.id}`);
    const route = job.routeDeltaMinutesByTechnician?.[technician.id];
    if (route !== undefined && !Number.isFinite(route)) {
      throw new RangeError(`routeDeltaMinutesByTechnician.${technician.id} must be finite`);
    }
    const revenue = job.expectedRevenueCentsByTechnician?.[technician.id];
    if (revenue !== undefined) {
      assertFiniteNumber(revenue, `expectedRevenueCentsByTechnician.${technician.id}`);
    }
    const downstream = job.downstreamRouteConsequencesByTechnician?.[technician.id];
    if (downstream !== undefined) {
      if (downstream.kind !== "ROUTE_LOOKAHEAD") {
        throw new RangeError(
          `downstreamRouteConsequencesByTechnician.${technician.id}.kind must be ROUTE_LOOKAHEAD`,
        );
      }
      assertFiniteNumber(
        downstream.laterBookingMinute,
        `downstreamRouteConsequencesByTechnician.${technician.id}.laterBookingMinute`,
      );
      assertFiniteNumber(
        downstream.laterBookingDistanceMiles,
        `downstreamRouteConsequencesByTechnician.${technician.id}.laterBookingDistanceMiles`,
      );
      assertFiniteNumber(
        downstream.laterDriveMinutes,
        `downstreamRouteConsequencesByTechnician.${technician.id}.laterDriveMinutes`,
      );
      if (typeof downstream.crossesSameAreaTwice !== "boolean") {
        throw new TypeError(
          `downstreamRouteConsequencesByTechnician.${technician.id}.crossesSameAreaTwice must be boolean`,
        );
      }
    }
  }

  const normalizedJob: Job = {
    id: job.id.trim(),
    arrivalMinute: job.arrivalMinute,
    requestedStartMinute: job.requestedStartMinute,
    promisedWindow: clone(job.promisedWindow),
    durationMinutes: job.durationMinutes,
    requiredSkills: normalizeCodes(job.requiredSkills),
    requiredCertifications: normalizeCodes(job.requiredCertifications),
    revenueCents: job.revenueCents,
    travelMinutesByTechnician: Object.fromEntries(
      technicians.map((technician) => [
        technician.id,
        job.travelMinutesByTechnician[technician.id] as number,
      ]),
    ),
    ...(job.routeDeltaMinutesByTechnician === undefined
      ? {}
      : {
          routeDeltaMinutesByTechnician: Object.fromEntries(
            technicians.map((technician) => [
              technician.id,
              job.routeDeltaMinutesByTechnician?.[technician.id] ?? 0,
            ]),
          ),
        }),
    ...(job.expectedRevenueCentsByTechnician === undefined
      ? {}
      : {
          expectedRevenueCentsByTechnician: Object.fromEntries(
            technicians.map((technician) => [
              technician.id,
              job.expectedRevenueCentsByTechnician?.[technician.id] ?? job.revenueCents,
            ]),
          ),
        }),
    ...(job.downstreamRouteConsequencesByTechnician === undefined
      ? {}
      : {
          downstreamRouteConsequencesByTechnician: Object.fromEntries(
            technicians.flatMap((technician) => {
              const consequence =
                job.downstreamRouteConsequencesByTechnician?.[technician.id];
              return consequence === undefined
                ? []
                : [[technician.id, clone(consequence)] as const];
            }),
          ),
        }),
  };

  return deepFreeze({
    boardState: { technicians },
    job: normalizedJob,
  });
}

function validateJob(job: Job): void {
  if (job.id.trim().length === 0) {
    throw new RangeError("job.id must not be empty");
  }
  assertFiniteNumber(job.arrivalMinute, "job.arrivalMinute");
  assertFiniteNumber(job.requestedStartMinute, "job.requestedStartMinute");
  assertFiniteNumber(job.promisedWindow.startMinute, "job.promisedWindow.startMinute");
  assertFiniteNumber(job.promisedWindow.endMinute, "job.promisedWindow.endMinute");
  if (job.promisedWindow.endMinute < job.promisedWindow.startMinute) {
    throw new RangeError("job.promisedWindow must end at or after it starts");
  }
  assertFiniteNumber(job.durationMinutes, "job.durationMinutes", Number.EPSILON);
  assertFiniteNumber(job.revenueCents, "job.revenueCents");
}

function normalizeTechnician(technician: Technician, seenIds: Set<string>): Technician {
  const id = technician.id.trim();
  if (id.length === 0) {
    throw new RangeError("technician.id must not be empty");
  }
  if (seenIds.has(id)) {
    throw new RangeError(`duplicate technician id: ${id}`);
  }
  seenIds.add(id);
  assertFiniteNumber(technician.availableAtMinute, `${id}.availableAtMinute`);
  assertFiniteNumber(technician.assignedMinutes, `${id}.assignedMinutes`);
  assertFiniteNumber(technician.capacityMinutes, `${id}.capacityMinutes`, Number.EPSILON);

  return {
    id,
    skills: normalizeCodes(technician.skills),
    certifications: normalizeCodes(technician.certifications),
    availableAtMinute: technician.availableAtMinute,
    assignedMinutes: technician.assignedMinutes,
    capacityMinutes: technician.capacityMinutes,
  };
}

function evaluateCandidate(
  technician: Technician,
  job: Job,
  decisionId: string,
): CandidateEvidence {
  const requirements = toRequirements(job);
  const technicianSkills = new Set(technician.skills);
  const technicianCertifications = new Set(technician.certifications);
  const matchedSkills = job.requiredSkills.filter((skill) => technicianSkills.has(skill));
  const missingSkills = job.requiredSkills.filter((skill) => !technicianSkills.has(skill));
  const satisfiedCertifications = job.requiredCertifications.filter((certification) =>
    technicianCertifications.has(certification),
  );
  const missingCertifications = job.requiredCertifications.filter(
    (certification) => !technicianCertifications.has(certification),
  );
  const travelMinutes = job.travelMinutesByTechnician[technician.id] as number;
  const waitMinutes = Math.max(0, technician.availableAtMinute - job.requestedStartMinute);
  const expectedRevenueCents =
    job.expectedRevenueCentsByTechnician?.[technician.id] ?? job.revenueCents;
  const utilisationRatio = clamp01(technician.assignedMinutes / technician.capacityMinutes);

  const travelNormalized = 1 - clamp01(travelMinutes / MAX_TRAVEL_MINUTES);
  const skillNormalized =
    job.requiredSkills.length === 0 ? 1 : matchedSkills.length / job.requiredSkills.length;
  const certificationNormalized = missingCertifications.length === 0 ? 1 : 0;
  const availabilityNormalized = 1 - clamp01(waitMinutes / MAX_AVAILABILITY_WAIT_MINUTES);
  const revenueNormalized =
    job.revenueCents === 0
      ? expectedRevenueCents === 0
        ? 1
        : 0
      : clamp01(expectedRevenueCents / job.revenueCents);
  const utilisationNormalized = 1 - utilisationRatio;

  const factors: FactorBreakdown = {
    travelTime: factor({ minutes: travelMinutes }, travelNormalized, "travelTime"),
    skillMatch: factor(
      { matched: matchedSkills, missing: missingSkills },
      skillNormalized,
      "skillMatch",
    ),
    certification: factor(
      { satisfied: satisfiedCertifications, missing: missingCertifications },
      certificationNormalized,
      "certification",
    ),
    availability: factor({ waitMinutes }, availabilityNormalized, "availability"),
    revenueFit: factor(
      { expectedRevenueCents, jobRevenueCents: job.revenueCents },
      revenueNormalized,
      "revenueFit",
    ),
    utilisation: factor(
      {
        assignedMinutes: technician.assignedMinutes,
        capacityMinutes: technician.capacityMinutes,
        ratio: roundScore(utilisationRatio),
      },
      utilisationNormalized,
      "utilisation",
    ),
  };
  const score = roundScore(
    Object.values(factors).reduce((total, evidence) => total + evidence.contribution, 0),
  );
  const base = {
    technicianId: technician.id,
    rank: 0,
    score,
    requirements,
    factors,
    immediateDeltas: {
      timeMinutes: waitMinutes + travelMinutes + job.durationMinutes,
      routeMinutes: job.routeDeltaMinutesByTechnician?.[technician.id] ?? 0,
      revenueCents: expectedRevenueCents,
    },
    downstreamRouteConsequence:
      job.downstreamRouteConsequencesByTechnician?.[technician.id] ?? null,
    decisionId,
  };

  if (missingCertifications.length > 0) {
    return {
      ...base,
      eligibility: {
        eligible: false,
        disqualifiers: [
          {
            code: "MISSING_CERTIFICATION",
            constraint: "certification",
            missing: missingCertifications,
          },
        ],
      },
      reasonCode: "HARD_CONSTRAINT_FAILED",
    };
  }

  return {
    ...base,
    eligibility: { eligible: true, disqualifiers: [] },
    reasonCode: "LOWER_IMMEDIATE_SCORE",
  };
}

function factor<TValue>(
  value: TValue,
  normalizedValue: number,
  name: keyof typeof DEFAULT_SCORING_WEIGHTS,
) {
  const normalized = roundScore(clamp01(normalizedValue));
  const weight = DEFAULT_SCORING_WEIGHTS[name];
  return {
    value,
    normalizedValue: normalized,
    weight,
    contribution: roundScore(normalized * weight),
  };
}

function toRequirements(job: Job): NormalizedJobRequirements {
  return {
    jobId: job.id,
    arrivalMinute: job.arrivalMinute,
    requestedStartMinute: job.requestedStartMinute,
    promisedWindow: clone(job.promisedWindow),
    durationMinutes: job.durationMinutes,
    requiredSkills: job.requiredSkills,
    requiredCertifications: job.requiredCertifications,
    revenueCents: job.revenueCents,
  };
}

function compareEligible(
  left: EligibleCandidateEvidence,
  right: EligibleCandidateEvidence,
): number {
  return (
    right.score - left.score ||
    left.factors.travelTime.value.minutes - right.factors.travelTime.value.minutes ||
    compareCodeUnits(left.technicianId, right.technicianId)
  );
}

function rankDisqualified(
  candidates: readonly DisqualifiedCandidateEvidence[],
): DisqualifiedCandidateEvidence[] {
  return candidates.map((candidate, index) => ({ ...candidate, rank: index + 1 }));
}
