export type TechnicianId = string;
export type SkillCode = string;
export type CertificationCode = string;

export interface Technician {
  readonly id: TechnicianId;
  readonly skills: readonly SkillCode[];
  readonly certifications: readonly CertificationCode[];
  readonly availableAtMinute: number;
  readonly assignedMinutes: number;
  readonly capacityMinutes: number;
}

export interface BoardState {
  readonly technicians: readonly Technician[];
}

export interface PromisedTimeWindow {
  readonly startMinute: number;
  readonly endMinute: number;
}

/**
 * Descriptive evidence about work after the assignment in front of the
 * dispatcher. Dispatch returns this evidence but deliberately never scores it.
 */
export interface DownstreamRouteConsequence {
  readonly kind: "ROUTE_LOOKAHEAD";
  readonly laterBookingMinute: number;
  readonly laterBookingDistanceMiles: number;
  readonly laterDriveMinutes: number;
  readonly crossesSameAreaTwice: boolean;
}

export interface Job {
  readonly id: string;
  readonly arrivalMinute: number;
  readonly requestedStartMinute: number;
  readonly promisedWindow: PromisedTimeWindow;
  readonly durationMinutes: number;
  readonly requiredSkills: readonly SkillCode[];
  readonly requiredCertifications: readonly CertificationCode[];
  readonly revenueCents: number;
  readonly travelMinutesByTechnician: Readonly<Record<TechnicianId, number>>;
  readonly routeDeltaMinutesByTechnician?: Readonly<Record<TechnicianId, number>>;
  readonly expectedRevenueCentsByTechnician?: Readonly<Record<TechnicianId, number>>;
  readonly downstreamRouteConsequencesByTechnician?: Readonly<
    Record<TechnicianId, DownstreamRouteConsequence>
  >;
}

export interface NormalizedJobRequirements {
  readonly jobId: string;
  readonly arrivalMinute: number;
  readonly requestedStartMinute: number;
  readonly promisedWindow: PromisedTimeWindow;
  readonly durationMinutes: number;
  readonly requiredSkills: readonly SkillCode[];
  readonly requiredCertifications: readonly CertificationCode[];
  readonly revenueCents: number;
}

export interface FactorEvidence<TValue> {
  readonly value: TValue;
  readonly normalizedValue: number;
  readonly weight: number;
  readonly contribution: number;
}

export interface FactorBreakdown {
  readonly travelTime: FactorEvidence<{ readonly minutes: number }>;
  readonly skillMatch: FactorEvidence<{
    readonly matched: readonly SkillCode[];
    readonly missing: readonly SkillCode[];
  }>;
  readonly certification: FactorEvidence<{
    readonly satisfied: readonly CertificationCode[];
    readonly missing: readonly CertificationCode[];
  }>;
  readonly availability: FactorEvidence<{ readonly waitMinutes: number }>;
  readonly revenueFit: FactorEvidence<{
    readonly expectedRevenueCents: number;
    readonly jobRevenueCents: number;
  }>;
  readonly utilisation: FactorEvidence<{
    readonly assignedMinutes: number;
    readonly capacityMinutes: number;
    readonly ratio: number;
  }>;
}

export type Disqualifier = {
  readonly code: "MISSING_CERTIFICATION";
  readonly constraint: "certification";
  readonly missing: readonly CertificationCode[];
};

export interface ImmediateDeltas {
  readonly timeMinutes: number;
  readonly routeMinutes: number;
  readonly revenueCents: number;
}

interface CandidateEvidenceBase {
  readonly technicianId: TechnicianId;
  readonly rank: number;
  readonly score: number;
  readonly requirements: NormalizedJobRequirements;
  readonly factors: FactorBreakdown;
  readonly immediateDeltas: ImmediateDeltas;
  readonly downstreamRouteConsequence: DownstreamRouteConsequence | null;
  readonly decisionId: string;
}

export interface EligibleCandidateEvidence extends CandidateEvidenceBase {
  readonly eligibility: {
    readonly eligible: true;
    readonly disqualifiers: readonly [];
  };
  readonly reasonCode: "BEST_IMMEDIATE_SCORE" | "LOWER_IMMEDIATE_SCORE";
}

export interface DisqualifiedCandidateEvidence extends CandidateEvidenceBase {
  readonly eligibility: {
    readonly eligible: false;
    readonly disqualifiers: readonly [Disqualifier, ...Disqualifier[]];
  };
  readonly reasonCode: "HARD_CONSTRAINT_FAILED";
}

export type CandidateEvidence =
  | EligibleCandidateEvidence
  | DisqualifiedCandidateEvidence;

export interface DispatchInputSnapshot {
  readonly boardState: BoardState;
  readonly job: Job;
}

declare const decisionEvidenceBrand: unique symbol;

/**
 * Only dispatch can create this branded contract. A winner cannot be represented
 * without its complete ranking and replayable input evidence.
 */
export interface Decision {
  readonly [decisionEvidenceBrand]: true;
  readonly decisionId: string;
  readonly inputSnapshot: DispatchInputSnapshot;
  readonly winner: EligibleCandidateEvidence;
  readonly rankedAlternatives: readonly CandidateEvidence[];
  readonly ranking: readonly [EligibleCandidateEvidence, ...CandidateEvidence[]];
}

export const DEFAULT_SCORING_WEIGHTS = Object.freeze({
  travelTime: 30,
  skillMatch: 20,
  certification: 15,
  availability: 15,
  revenueFit: 10,
  utilisation: 10,
} as const);

export type ScoringFactor = keyof typeof DEFAULT_SCORING_WEIGHTS;
