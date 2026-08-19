import type {
  CandidateEvidence,
  Decision,
  DisqualifiedCandidateEvidence,
  EligibleCandidateEvidence,
  TechnicianId,
} from "../index.js";

export interface DecisionChoiceModel {
  readonly technicianId: TechnicianId;
  readonly name: string;
  readonly rank: number;
  readonly travelMinutes: number;
  readonly totalImmediateMinutes: number;
  readonly revenueCents: number;
  readonly laterDriveMinutes: number | null;
}

export interface HardConstraintModel {
  readonly technicianId: TechnicianId;
  readonly name: string;
  readonly plainReason: string;
  readonly requiredDetail: string;
  readonly technicianDetail: string;
  readonly reasonCode: DisqualifiedCandidateEvidence["reasonCode"];
}

export interface DecisionGrammarModel {
  readonly decisionId: string;
  readonly chosen: DecisionChoiceModel;
  readonly second: DecisionChoiceModel;
  readonly keepLabel: string;
  readonly overrideLabel: string;
  readonly immediateReasons: readonly string[];
  readonly hardConstraints: readonly HardConstraintModel[];
  readonly immediateMinuteDifference: number;
  readonly immediateRevenueDifferenceCents: number;
  readonly laterMinutesSavedByOverride: number | null;
  readonly omittedConsequence: {
    readonly laterBookingMinute: number;
    readonly laterBookingDistanceMiles: number;
    readonly laterDriveMinutes: number;
    readonly crossesSameAreaTwice: boolean;
  } | null;
}

const SKILL_LABELS: Readonly<Record<string, string>> = Object.freeze({
  repair: "repair",
  diagnostics: "diagnostics",
  maintenance: "maintenance",
  "no-cool": "no-cool repair",
});

const CERTIFICATION_LABELS: Readonly<Record<string, string>> = Object.freeze({
  "epa-608-i": "EPA Section 608 Type I · small appliances",
  "epa-608-ii": "EPA Section 608 Type II · high-pressure residential systems",
  "epa-608-universal": "EPA Section 608 Universal · all covered equipment",
});

export function buildDecisionGrammar(
  decision: Decision,
  names: Readonly<Record<TechnicianId, string>>,
): DecisionGrammarModel {
  const second = decision.rankedAlternatives.find(isEligible);
  if (second === undefined) {
    throw new RangeError("The shared decision grammar requires a second eligible choice");
  }

  const chosen = toChoice(decision.winner, names);
  const secondChoice = toChoice(second, names);
  const laterMinutesSavedByOverride =
    chosen.laterDriveMinutes === null || secondChoice.laterDriveMinutes === null
      ? null
      : chosen.laterDriveMinutes - secondChoice.laterDriveMinutes;
  const requiredSkill = decision.winner.requirements.requiredSkills[0];
  const travelDifference = second.factors.travelTime.value.minutes -
    decision.winner.factors.travelTime.value.minutes;
  const skillEvidence = decision.winner.factors.skillMatch.value;
  const travelReason = travelDifference > 0
    ? `${travelDifference} min closer now`
    : travelDifference < 0
      ? `${Math.abs(travelDifference)} min farther now`
      : "Same immediate travel time";
  const skillReason = requiredSkill === undefined
    ? "No special skill required"
    : skillEvidence.missing.length === 0
      ? `Correct ${SKILL_LABELS[requiredSkill] ?? requiredSkill} skill`
      : `Missing ${skillEvidence.missing.map((skill) => SKILL_LABELS[skill] ?? skill).join(", ")}`;
  const immediateReasons = [
    travelReason,
    skillReason,
    decision.winner.factors.availability.value.waitMinutes === 0
      ? `Free at ${formatClockMinute(decision.winner.requirements.requestedStartMinute)}`
      : `${decision.winner.factors.availability.value.waitMinutes} min availability wait`,
  ];

  return Object.freeze({
    decisionId: decision.decisionId,
    chosen,
    second: secondChoice,
    keepLabel: `Keep · Assign ${chosen.name}`,
    overrideLabel: `Override · Assign ${secondChoice.name}${formatLaterImpact(
      laterMinutesSavedByOverride,
    )}`,
    immediateReasons: Object.freeze(immediateReasons),
    hardConstraints: Object.freeze(
      decision.ranking.filter(isDisqualified).map((candidate) =>
        toHardConstraint(candidate, decision, names),
      ),
    ),
    immediateMinuteDifference:
      second.immediateDeltas.timeMinutes - decision.winner.immediateDeltas.timeMinutes,
    immediateRevenueDifferenceCents:
      second.immediateDeltas.revenueCents - decision.winner.immediateDeltas.revenueCents,
    laterMinutesSavedByOverride,
    omittedConsequence: decision.winner.downstreamRouteConsequence,
  });
}

export function formatClockMinute(minute: number): string {
  const normalizedMinute = Math.floor(minute) % 1_440;
  const hour24 = Math.floor(normalizedMinute / 60);
  const minutes = normalizedMinute % 60;
  const suffix = hour24 >= 12 ? "PM" : "AM";
  const hour = hour24 % 12 || 12;
  return `${hour}:${String(minutes).padStart(2, "0")} ${suffix}`;
}

export function formatMoney(cents: number): string {
  const sign = cents < 0 ? "−" : "";
  const absoluteCents = Math.abs(cents);
  const amount = absoluteCents % 100 === 0
    ? String(absoluteCents / 100)
    : (absoluteCents / 100).toFixed(2);
  return `${sign}$${amount}`;
}

function toChoice(
  candidate: EligibleCandidateEvidence,
  names: Readonly<Record<TechnicianId, string>>,
): DecisionChoiceModel {
  return Object.freeze({
    technicianId: candidate.technicianId,
    name: names[candidate.technicianId] ?? candidate.technicianId,
    rank: candidate.rank,
    travelMinutes: candidate.factors.travelTime.value.minutes,
    totalImmediateMinutes: candidate.immediateDeltas.timeMinutes,
    revenueCents: candidate.immediateDeltas.revenueCents,
    laterDriveMinutes:
      candidate.downstreamRouteConsequence?.laterDriveMinutes ?? null,
  });
}

function toHardConstraint(
  candidate: DisqualifiedCandidateEvidence,
  decision: Decision,
  names: Readonly<Record<TechnicianId, string>>,
): HardConstraintModel {
  const missing = candidate.eligibility.disqualifiers.flatMap(
    (disqualifier) => disqualifier.missing,
  );
  const technician = decision.inputSnapshot.boardState.technicians.find(
    (entry) => entry.id === candidate.technicianId,
  );
  const requiredDetail = missing.map(labelCertification).join(", ");
  const technicianDetail =
    technician?.certifications.map(labelCertification).join(", ") ?? "No certification listed";

  return Object.freeze({
    technicianId: candidate.technicianId,
    name: names[candidate.technicianId] ?? candidate.technicianId,
    plainReason: "Missing the residential-system certification this repair requires",
    requiredDetail,
    technicianDetail,
    reasonCode: candidate.reasonCode,
  });
}

function labelCertification(code: string): string {
  return CERTIFICATION_LABELS[code] ?? code;
}

function formatLaterImpact(minutesSaved: number | null): string {
  if (minutesSaved === null) return "";
  if (minutesSaved > 0) return ` · saves ${minutesSaved} min`;
  if (minutesSaved < 0) return ` · adds ${Math.abs(minutesSaved)} min later`;
  return " · same later drive time";
}

function isEligible(candidate: CandidateEvidence): candidate is EligibleCandidateEvidence {
  return candidate.eligibility.eligible;
}

function isDisqualified(
  candidate: CandidateEvidence,
): candidate is DisqualifiedCandidateEvidence {
  return !candidate.eligibility.eligible;
}
