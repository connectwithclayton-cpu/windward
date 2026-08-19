export { computeCoverage } from "./coverage.js";
export type {
  CoverageCandidate,
  CoverageEvidence,
  CoverageRequirement,
} from "./coverage.js";
export { dispatch, NoEligibleCandidateError } from "./dispatch.js";
export {
  generateExogenousEvents,
  runPlayerAndBaseline,
  simulateScenario,
} from "./simulation.js";
export {
  RISK_APPETITE_CASE,
  rankPlans,
  replayRiskWorld,
  runRiskCohort,
  runRiskCohortAndBaseline,
  validateRiskBranchComparison,
  validateRiskCaseDefinition,
} from "./risk.js";
export type {
  PlanDecision,
  PlanDecisionInput,
  RankedRiskPlan,
  RiskBranchComparison,
  RiskCaseDefinition,
  RiskCohortResult,
  RiskPlanId,
  RiskPlanInput,
  RiskPlanOutcomeInput,
  RiskWorldCondition,
  RiskWorldDefinition,
  RiskWorldResult,
} from "./risk.js";
export type {
  BranchComparison,
  ExogenousEvent,
  IntegerRange,
  JobBlueprint,
  ScenarioDefinition,
  ServiceOutcomeCode,
  SimulationOutcome,
  SimulationOverride,
  SimulationResult,
  SimulationTransition,
} from "./simulation.js";
export { DEFAULT_SCORING_WEIGHTS } from "./types.js";
export type {
  BoardState,
  CandidateEvidence,
  CertificationCode,
  Decision,
  DisqualifiedCandidateEvidence,
  Disqualifier,
  DispatchInputSnapshot,
  DownstreamRouteConsequence,
  EligibleCandidateEvidence,
  FactorBreakdown,
  FactorEvidence,
  ImmediateDeltas,
  Job,
  NormalizedJobRequirements,
  PromisedTimeWindow,
  ScoringFactor,
  SkillCode,
  Technician,
  TechnicianId,
} from "./types.js";
