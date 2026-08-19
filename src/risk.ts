export type RiskPlanId = "direct-repair" | "protect-weekend";
export type RiskWorldCondition =
  | "ROUTINE_PART_AVAILABLE"
  | "PART_UNAVAILABLE_UNTIL_MONDAY";

export interface RiskPlanOutcomeInput {
  readonly condition: RiskWorldCondition;
  readonly worldCount: number;
  readonly weightBasisPoints: number;
  readonly netValueCents: number;
  readonly coolingStatus: string;
  readonly clientWithoutCoolingThroughWeekend: boolean;
}

export interface RiskPlanInput {
  readonly id: RiskPlanId;
  readonly name: string;
  readonly outcomes: readonly RiskPlanOutcomeInput[];
}

export interface PlanDecisionInput {
  readonly caseVersion: string;
  readonly plans: readonly RiskPlanInput[];
}

export interface RankedRiskPlan {
  readonly rank: number;
  readonly planId: RiskPlanId;
  readonly planName: string;
  readonly averageNetValueCents: number;
  readonly worstNetValueCents: number;
  readonly weightedCalculation: string;
  readonly outcomes: readonly RiskPlanOutcomeInput[];
}

export interface PlanDecision {
  readonly decisionId: string;
  readonly winner: RankedRiskPlan;
  readonly ranking: readonly RankedRiskPlan[];
  readonly reasonCode: "HIGHEST_WEIGHTED_NET_VALUE";
  readonly riskPolicyApplied: false;
  readonly inputSnapshot: PlanDecisionInput;
}

export interface RiskWorldDefinition {
  readonly id: string;
  readonly weightBasisPoints: number;
  readonly condition: RiskWorldCondition;
}

export interface RiskCaseDefinition {
  readonly caseVersion: string;
  readonly seed: string;
  readonly narrativeWorldId: string;
  readonly lossLimitCents: number;
  readonly decisionInput: PlanDecisionInput;
  readonly worlds: readonly RiskWorldDefinition[];
}

export interface RiskWorldResult {
  readonly caseVersion: string;
  readonly worldId: string;
  readonly weightBasisPoints: number;
  readonly condition: RiskWorldCondition;
  readonly planId: RiskPlanId;
  readonly planName: string;
  readonly netValueCents: number;
  readonly coolingStatus: string;
  readonly clientWithoutCoolingThroughWeekend: boolean;
  readonly lossLimitBreached: boolean;
}

export interface RiskCohortResult {
  readonly caseVersion: string;
  readonly planId: RiskPlanId;
  readonly planName: string;
  readonly lossLimitCents: number;
  readonly worlds: readonly RiskWorldResult[];
  readonly averageNetValueCents: number;
  readonly worstNetValueCents: number;
  readonly lossLimitBreachCount: number;
  readonly weekendCoolingFailureCount: number;
}

export interface RiskBranchComparison {
  readonly caseVersion: string;
  readonly narrativeWorldId: string;
  readonly decision: PlanDecision;
  readonly player: RiskCohortResult;
  readonly baseline: RiskCohortResult;
  readonly narrative: {
    readonly player: RiskWorldResult;
    readonly baseline: RiskWorldResult;
    readonly differenceCents: number;
  };
  readonly policyDelta: {
    readonly averageNetValueCents: number;
    readonly worstResultCents: number;
    readonly lossLimitBreachCount: number;
    readonly weekendCoolingFailureCount: number;
  };
  readonly aggregateFingerprint: string;
}

const ROUTINE_WEIGHT = 8_500;
const DISRUPTION_WEIGHT = 1_500;
const BASIS_POINT_TOTAL = 10_000;
const ONE_WORLD_WEIGHT = 100;
const NARRATIVE_WORLD_ID = "world-042";
const ADVERSE_WORLD_NUMBERS = new Set([
  3, 8, 14, 19, 26, 31, 37, 49, 55, 61, 68, 74, 82, 91, 97,
]);

const DIRECT_REPAIR: RiskPlanInput = freezePlan({
  id: "direct-repair",
  name: "Direct repair",
  outcomes: [
    {
      condition: "ROUTINE_PART_AVAILABLE",
      worldCount: 85,
      weightBasisPoints: ROUTINE_WEIGHT,
      netValueCents: 1_400_000,
      coolingStatus: "Cooling restored Friday",
      clientWithoutCoolingThroughWeekend: false,
    },
    {
      condition: "PART_UNAVAILABLE_UNTIL_MONDAY",
      worldCount: 15,
      weightBasisPoints: DISRUPTION_WEIGHT,
      netValueCents: -4_000_000,
      coolingStatus: "Client without cooling through weekend",
      clientWithoutCoolingThroughWeekend: true,
    },
  ],
});

const PROTECT_WEEKEND: RiskPlanInput = freezePlan({
  id: "protect-weekend",
  name: "Protect the weekend",
  outcomes: [
    {
      condition: "ROUTINE_PART_AVAILABLE",
      worldCount: 85,
      weightBasisPoints: ROUTINE_WEIGHT,
      netValueCents: 500_000,
      coolingStatus: "Cooling restored Friday",
      clientWithoutCoolingThroughWeekend: false,
    },
    {
      condition: "PART_UNAVAILABLE_UNTIL_MONDAY",
      worldCount: 15,
      weightBasisPoints: DISRUPTION_WEIGHT,
      netValueCents: -800_000,
      coolingStatus: "Temporary cooling stays on",
      clientWithoutCoolingThroughWeekend: false,
    },
  ],
});

const RISK_WORLDS = Object.freeze(
  Array.from({ length: 100 }, (_, index): RiskWorldDefinition => {
    const number = index + 1;
    return Object.freeze({
      id: `world-${String(number).padStart(3, "0")}`,
      weightBasisPoints: ONE_WORLD_WEIGHT,
      condition: ADVERSE_WORLD_NUMBERS.has(number)
        ? "PART_UNAVAILABLE_UNTIL_MONDAY"
        : "ROUTINE_PART_AVAILABLE",
    });
  }).sort((left, right) => {
    const leftKey = seededKey("windward-risk-appetite-v1", left.id);
    const rightKey = seededKey("windward-risk-appetite-v1", right.id);
    return leftKey - rightKey || left.id.localeCompare(right.id);
  }),
);

export const RISK_APPETITE_CASE: RiskCaseDefinition = Object.freeze({
  caseVersion: "windward-risk-appetite-v1",
  seed: "risk-appetite-authored-world-order-v1",
  narrativeWorldId: NARRATIVE_WORLD_ID,
  lossLimitCents: 1_500_000,
  decisionInput: Object.freeze({
    caseVersion: "windward-risk-appetite-v1",
    plans: Object.freeze([DIRECT_REPAIR, PROTECT_WEEKEND]),
  }),
  worlds: RISK_WORLDS,
});

export function rankPlans(input: PlanDecisionInput): PlanDecision {
  validateDecisionInput(input);
  const ranking = input.plans
    .map((plan) => evaluatePlan(plan))
    .sort((left, right) =>
      right.averageNetValueCents - left.averageNetValueCents ||
      left.planId.localeCompare(right.planId),
    )
    .map((plan, index) => Object.freeze({ ...plan, rank: index + 1 }));
  const winner = ranking[0];
  if (winner === undefined) throw new Error("Plan decision requires at least one plan");
  const inputSnapshot = cloneDecisionInput(input);
  return Object.freeze({
    decisionId: `plan-${fingerprint(inputSnapshot)}`,
    winner,
    ranking: Object.freeze(ranking),
    reasonCode: "HIGHEST_WEIGHTED_NET_VALUE",
    riskPolicyApplied: false,
    inputSnapshot,
  });
}

export function replayRiskWorld(
  definition: RiskCaseDefinition,
  worldId: string,
  planId: RiskPlanId,
): RiskWorldResult {
  validateRiskCaseDefinition(definition);
  const world = definition.worlds.find((candidate) => candidate.id === worldId);
  if (world === undefined) throw new Error(`Unknown risk world ID: ${worldId}`);
  const plan = definition.decisionInput.plans.find((candidate) => candidate.id === planId);
  if (plan === undefined) throw new Error(`Unknown risk plan ID: ${planId}`);
  const outcome = plan.outcomes.find((candidate) => candidate.condition === world.condition);
  if (outcome === undefined) {
    throw new Error(`Plan ${planId} has no outcome for ${world.condition}`);
  }
  return Object.freeze({
    caseVersion: definition.caseVersion,
    worldId: world.id,
    weightBasisPoints: world.weightBasisPoints,
    condition: world.condition,
    planId: plan.id,
    planName: plan.name,
    netValueCents: outcome.netValueCents,
    coolingStatus: outcome.coolingStatus,
    clientWithoutCoolingThroughWeekend: outcome.clientWithoutCoolingThroughWeekend,
    lossLimitBreached: outcome.netValueCents < -definition.lossLimitCents,
  });
}

export function runRiskCohort(
  definition: RiskCaseDefinition,
  planId: RiskPlanId,
): RiskCohortResult {
  validateRiskCaseDefinition(definition);
  const plan = definition.decisionInput.plans.find((candidate) => candidate.id === planId);
  if (plan === undefined) throw new Error(`Unknown risk plan ID: ${planId}`);
  const worlds = Object.freeze(
    definition.worlds.map((world) => replayRiskWorld(definition, world.id, planId)),
  );
  const weightedValue = worlds.reduce(
    (total, world) => total + world.netValueCents * world.weightBasisPoints,
    0,
  );
  if (weightedValue % BASIS_POINT_TOTAL !== 0) {
    throw new Error("Weighted risk aggregate does not resolve to integer cents");
  }
  return Object.freeze({
    caseVersion: definition.caseVersion,
    planId: plan.id,
    planName: plan.name,
    lossLimitCents: definition.lossLimitCents,
    worlds,
    averageNetValueCents: weightedValue / BASIS_POINT_TOTAL,
    worstNetValueCents: Math.min(...worlds.map((world) => world.netValueCents)),
    lossLimitBreachCount: worlds.filter((world) => world.lossLimitBreached).length,
    weekendCoolingFailureCount: worlds.filter(
      (world) => world.clientWithoutCoolingThroughWeekend,
    ).length,
  });
}

export function runRiskCohortAndBaseline(
  definition: RiskCaseDefinition,
  playerPlanId: RiskPlanId,
): RiskBranchComparison {
  validateRiskCaseDefinition(definition);
  const comparison = buildRiskBranchComparison(definition, playerPlanId);
  validateRiskBranchComparison(comparison);
  return Object.freeze(comparison);
}

function buildRiskBranchComparison(
  definition: RiskCaseDefinition,
  playerPlanId: RiskPlanId,
): RiskBranchComparison {
  const decision = rankPlans(definition.decisionInput);
  const player = runRiskCohort(definition, playerPlanId);
  const baseline = runRiskCohort(definition, decision.winner.planId);
  const narrativePlayer = requireCohortWorld(player, definition.narrativeWorldId);
  const narrativeBaseline = requireCohortWorld(baseline, definition.narrativeWorldId);
  const comparison = {
    caseVersion: definition.caseVersion,
    narrativeWorldId: definition.narrativeWorldId,
    decision,
    player,
    baseline,
    narrative: Object.freeze({
      player: narrativePlayer,
      baseline: narrativeBaseline,
      differenceCents: narrativePlayer.netValueCents - narrativeBaseline.netValueCents,
    }),
    policyDelta: Object.freeze({
      averageNetValueCents:
        player.averageNetValueCents - baseline.averageNetValueCents,
      worstResultCents: player.worstNetValueCents - baseline.worstNetValueCents,
      lossLimitBreachCount:
        player.lossLimitBreachCount - baseline.lossLimitBreachCount,
      weekendCoolingFailureCount:
        player.weekendCoolingFailureCount - baseline.weekendCoolingFailureCount,
    }),
    aggregateFingerprint: fingerprint({
      caseVersion: definition.caseVersion,
      seed: definition.seed,
      worlds: definition.worlds,
      plans: definition.decisionInput.plans,
      player: player.worlds,
      baseline: baseline.worlds,
    }),
  } satisfies RiskBranchComparison;
  return comparison;
}

export function validateRiskCaseDefinition(definition: RiskCaseDefinition): void {
  if (definition.caseVersion !== RISK_APPETITE_CASE.caseVersion) {
    throw new Error("Risk case version is not the canonical authored version");
  }
  if (definition.seed !== RISK_APPETITE_CASE.seed) {
    throw new Error("Risk case seed is not the canonical authored seed");
  }
  if (definition.caseVersion !== definition.decisionInput.caseVersion) {
    throw new Error("Risk case and decision input versions do not match");
  }
  if (definition.lossLimitCents !== RISK_APPETITE_CASE.lossLimitCents) {
    throw new Error("Risk loss limit drifted from the canonical authored case");
  }
  if (definition.worlds.length !== 100) {
    throw new Error("Risk cohort must contain exactly 100 weighted worlds");
  }
  if (definition.narrativeWorldId !== NARRATIVE_WORLD_ID) {
    throw new Error("Narrative world must be the fixed authored world-042");
  }
  const ids = new Set<string>();
  let totalWeight = 0;
  const conditionWeights = new Map<RiskWorldCondition, number>();
  for (const [index, world] of definition.worlds.entries()) {
    if (ids.has(world.id)) throw new Error(`Duplicate risk world ID: ${world.id}`);
    ids.add(world.id);
    const expectedWorld = RISK_WORLDS[index];
    if (
      expectedWorld === undefined ||
      world.id !== expectedWorld.id ||
      world.condition !== expectedWorld.condition
    ) {
      throw new Error("Risk world manifest drifted from the canonical authored worlds");
    }
    if (world.weightBasisPoints !== ONE_WORLD_WEIGHT) {
      throw new Error("Every authored risk world must carry one percent weight");
    }
    totalWeight += world.weightBasisPoints;
    conditionWeights.set(
      world.condition,
      (conditionWeights.get(world.condition) ?? 0) + world.weightBasisPoints,
    );
  }
  if (totalWeight !== BASIS_POINT_TOTAL) {
    throw new Error(`Risk world weights must sum to ${BASIS_POINT_TOTAL} basis points`);
  }
  validateDecisionInput(definition.decisionInput);
  for (const plan of definition.decisionInput.plans) {
    const expectedPlan = RISK_APPETITE_CASE.decisionInput.plans.find(
      (candidate) => candidate.id === plan.id,
    );
    if (expectedPlan === undefined || !sameJson(plan, expectedPlan)) {
      throw new Error(`Risk plan ${plan.id} drifted from the canonical authored input`);
    }
    for (const outcome of plan.outcomes) {
      if ((conditionWeights.get(outcome.condition) ?? 0) !== outcome.weightBasisPoints) {
        throw new Error(`Plan ${plan.id} weights drift from the authored world manifest`);
      }
    }
  }
}

export function validateRiskBranchComparison(comparison: RiskBranchComparison): void {
  const playerWorlds = comparison.player.worlds;
  const baselineWorlds = comparison.baseline.worlds;
  if (playerWorlds === baselineWorlds) {
    throw new Error("Risk player and baseline branches must use independent results");
  }
  if (playerWorlds.length !== baselineWorlds.length) {
    throw new Error("Risk player and baseline world manifests drifted");
  }
  for (let index = 0; index < playerWorlds.length; index += 1) {
    const player = playerWorlds[index];
    const baseline = baselineWorlds[index];
    if (
      player === undefined ||
      baseline === undefined ||
      player.worldId !== baseline.worldId ||
      player.weightBasisPoints !== baseline.weightBasisPoints ||
      player.condition !== baseline.condition
    ) {
      throw new Error("Risk player and baseline exogenous worlds drifted");
    }
  }
  if (!isRiskPlanId(comparison.player.planId)) {
    throw new Error("Risk player branch has an unknown plan ID");
  }
  if (!isRiskPlanId(comparison.baseline.planId)) {
    throw new Error("Risk baseline branch has an unknown plan ID");
  }
  const expected = buildRiskBranchComparison(
    RISK_APPETITE_CASE,
    comparison.player.planId,
  );
  if (!sameJson(comparison, expected)) {
    throw new Error("Risk branch evidence drifted from the deterministic replay");
  }
}

function evaluatePlan(plan: RiskPlanInput): Omit<RankedRiskPlan, "rank"> {
  const numerator = plan.outcomes.reduce(
    (total, outcome) => total + outcome.netValueCents * outcome.weightBasisPoints,
    0,
  );
  if (numerator % BASIS_POINT_TOTAL !== 0) {
    throw new Error(`Plan ${plan.id} weighted value does not resolve to integer cents`);
  }
  return {
    planId: plan.id,
    planName: plan.name,
    averageNetValueCents: numerator / BASIS_POINT_TOTAL,
    worstNetValueCents: Math.min(...plan.outcomes.map((outcome) => outcome.netValueCents)),
    weightedCalculation: `(${plan.outcomes
      .map((outcome) => `${outcome.worldCount} × ${formatRiskMoney(outcome.netValueCents)}`)
      .join(" + ")}) ÷ 100 = ${formatRiskMoney(numerator / BASIS_POINT_TOTAL)}`,
    outcomes: plan.outcomes,
  };
}

function validateDecisionInput(input: PlanDecisionInput): void {
  if (input.plans.length < 2) throw new Error("Plan decision requires at least two plans");
  const ids = new Set<string>();
  for (const plan of input.plans) {
    if (!isRiskPlanId(plan.id)) {
      throw new Error(`Unknown risk plan ID: ${String(plan.id)}`);
    }
    if (ids.has(plan.id)) throw new Error(`Duplicate risk plan ID: ${plan.id}`);
    ids.add(plan.id);
    if (plan.outcomes.length === 0) throw new Error(`Plan ${plan.id} has no outcomes`);
    const conditions = new Set<RiskWorldCondition>();
    const totalWeight = plan.outcomes.reduce((total, outcome) => {
      if (!isRiskWorldCondition(outcome.condition)) {
        throw new Error(`Plan ${plan.id} contains an unknown outcome condition`);
      }
      if (conditions.has(outcome.condition)) {
        throw new Error(`Plan ${plan.id} repeats condition ${outcome.condition}`);
      }
      conditions.add(outcome.condition);
      if (!Number.isInteger(outcome.netValueCents)) {
        throw new Error(`Plan ${plan.id} contains non-integer cents`);
      }
      if (!Number.isInteger(outcome.weightBasisPoints) || outcome.weightBasisPoints <= 0) {
        throw new Error(`Plan ${plan.id} contains an invalid outcome weight`);
      }
      if (
        !Number.isInteger(outcome.worldCount) ||
        outcome.worldCount <= 0 ||
        outcome.worldCount * ONE_WORLD_WEIGHT !== outcome.weightBasisPoints
      ) {
        throw new Error(`Plan ${plan.id} world count does not match its outcome weight`);
      }
      return total + outcome.weightBasisPoints;
    }, 0);
    if (totalWeight !== BASIS_POINT_TOTAL) {
      throw new Error(`Plan ${plan.id} weights must sum to ${BASIS_POINT_TOTAL} basis points`);
    }
  }
}

function isRiskPlanId(value: unknown): value is RiskPlanId {
  return value === "direct-repair" || value === "protect-weekend";
}

function isRiskWorldCondition(value: unknown): value is RiskWorldCondition {
  return value === "ROUTINE_PART_AVAILABLE" || value === "PART_UNAVAILABLE_UNTIL_MONDAY";
}

function sameJson(left: unknown, right: unknown): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

function freezePlan(plan: RiskPlanInput): RiskPlanInput {
  return Object.freeze({
    ...plan,
    outcomes: Object.freeze(plan.outcomes.map((outcome) => Object.freeze({ ...outcome }))),
  });
}

function cloneDecisionInput(input: PlanDecisionInput): PlanDecisionInput {
  return Object.freeze({
    caseVersion: input.caseVersion,
    plans: Object.freeze(input.plans.map((plan) => freezePlan(plan))),
  });
}

function seededKey(seed: string, value: string): number {
  let hash = 2_166_136_261;
  for (const character of `${seed}:${value}`) {
    hash ^= character.charCodeAt(0);
    hash = Math.imul(hash, 16_777_619);
  }
  return hash >>> 0;
}

function fingerprint(value: unknown): string {
  return seededKey("windward-fingerprint", JSON.stringify(value)).toString(16).padStart(8, "0");
}

function formatRiskMoney(cents: number): string {
  const sign = cents < 0 ? "−" : "+";
  return `${sign}$${Math.abs(cents / 100).toLocaleString("en-US")}`;
}

function requireCohortWorld(cohort: RiskCohortResult, worldId: string): RiskWorldResult {
  const world = cohort.worlds.find((candidate) => candidate.worldId === worldId);
  if (world === undefined) throw new Error(`Narrative world ${worldId} is absent from cohort`);
  return world;
}
