import type { BoardState, CertificationCode, SkillCode, TechnicianId } from "./types.js";
import { assertFiniteNumber, deepFreeze, normalizeCodes } from "./internal.js";

export interface CoverageRequirement {
  readonly atMinute: number;
  readonly requiredSkills?: readonly SkillCode[];
  readonly requiredCertifications: readonly CertificationCode[];
}

export interface CoverageCandidate {
  readonly technicianId: TechnicianId;
  readonly qualified: boolean;
  readonly available: boolean;
  readonly missingSkills: readonly SkillCode[];
  readonly missingCertifications: readonly CertificationCode[];
}

export interface CoverageEvidence {
  readonly atMinute: number;
  readonly availableQualifiedCount: number;
  readonly candidates: readonly CoverageCandidate[];
}

/** Describes board coverage. Dispatch does not import or consume this result. */
export function computeCoverage(
  boardState: BoardState,
  requirement: CoverageRequirement,
): CoverageEvidence {
  assertFiniteNumber(requirement.atMinute, "coverage.atMinute");
  const requiredSkills = normalizeCodes(requirement.requiredSkills ?? []);
  const requiredCertifications = normalizeCodes(requirement.requiredCertifications);
  const candidates = boardState.technicians
    .map((technician) => {
      const skills = new Set(normalizeCodes(technician.skills));
      const certifications = new Set(normalizeCodes(technician.certifications));
      const missingSkills = requiredSkills.filter((skill) => !skills.has(skill));
      const missingCertifications = requiredCertifications.filter(
        (certification) => !certifications.has(certification),
      );
      return {
        technicianId: technician.id,
        qualified: missingSkills.length === 0 && missingCertifications.length === 0,
        available: technician.availableAtMinute <= requirement.atMinute,
        missingSkills,
        missingCertifications,
      };
    })
    .sort((left, right) => left.technicianId.localeCompare(right.technicianId));

  return deepFreeze({
    atMinute: requirement.atMinute,
    availableQualifiedCount: candidates.filter(
      (candidate) => candidate.qualified && candidate.available,
    ).length,
    candidates,
  });
}
