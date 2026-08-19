import type { Decision, EligibleCandidateEvidence } from "../src/index.js";

declare const winner: EligibleCandidateEvidence;

// A Decision cannot be constructed from a bare winner. The module-private brand
// and the required ranking/replay fields force consumers through dispatch().
// @ts-expect-error winner-only decisions violate the public evidence contract
const invalidDecision: Decision = { winner };

void invalidDecision;
