import assert from "node:assert/strict";
import test from "node:test";

import {
  RISK_APPETITE_CASE,
  rankPlans,
  replayRiskWorld,
  runRiskCohort,
  runRiskCohortAndBaseline,
  validateRiskBranchComparison,
  validateRiskCaseDefinition,
} from "../dist/index.js";

test("expected-value-only plan evaluator correctly prefers direct repair", () => {
  const decision = rankPlans(RISK_APPETITE_CASE.decisionInput);

  assert.equal(decision.winner.planId, "direct-repair");
  assert.equal(decision.winner.averageNetValueCents, 590_000);
  assert.equal(decision.ranking[1]?.averageNetValueCents, 305_000);
  assert.equal(decision.reasonCode, "HIGHEST_WEIGHTED_NET_VALUE");
  assert.equal(decision.riskPolicyApplied, false);
  assert.equal("lossLimitCents" in decision.inputSnapshot, false);
  assert.deepEqual(
    decision.ranking.map(({ planId, averageNetValueCents }) => ({
      planId,
      averageNetValueCents,
    })),
    [
      { planId: "direct-repair", averageNetValueCents: 590_000 },
      { planId: "protect-weekend", averageNetValueCents: 305_000 },
    ],
  );
});

test("weighted-world replay is deterministic and keeps the narrative world fixed", () => {
  const first = replayRiskWorld(RISK_APPETITE_CASE, "world-042", "direct-repair");
  const repeated = replayRiskWorld(RISK_APPETITE_CASE, "world-042", "direct-repair");
  const protectedResult = replayRiskWorld(
    RISK_APPETITE_CASE,
    "world-042",
    "protect-weekend",
  );

  assert.deepEqual(first, repeated);
  assert.equal(first.condition, "ROUTINE_PART_AVAILABLE");
  assert.equal(first.netValueCents, 1_400_000);
  assert.equal(protectedResult.condition, first.condition);
  assert.equal(protectedResult.netValueCents, 500_000);
  assert.ok(RISK_APPETITE_CASE.worlds.some(({ id }) => id === "world-042"));
});

test("cohort arithmetic produces the exact authored loss-limit evidence", () => {
  const direct = runRiskCohort(RISK_APPETITE_CASE, "direct-repair");
  const protectedPlan = runRiskCohort(RISK_APPETITE_CASE, "protect-weekend");

  assert.equal(direct.worlds.length, 100);
  assert.equal(direct.averageNetValueCents, 590_000);
  assert.equal(direct.worstNetValueCents, -4_000_000);
  assert.equal(direct.lossLimitBreachCount, 15);
  assert.equal(direct.weekendCoolingFailureCount, 15);
  assert.equal(protectedPlan.averageNetValueCents, 305_000);
  assert.equal(protectedPlan.worstNetValueCents, -800_000);
  assert.equal(protectedPlan.lossLimitBreachCount, 0);
  assert.equal(protectedPlan.weekendCoolingFailureCount, 0);

  for (const cohort of [direct, protectedPlan]) {
    const sourceAverage = cohort.worlds.reduce(
      (total, world) => total + world.netValueCents * world.weightBasisPoints,
      0,
    ) / 10_000;
    assert.equal(cohort.averageNetValueCents, sourceAverage);
    assert.equal(
      cohort.lossLimitBreachCount,
      cohort.worlds.filter(({ netValueCents }) => netValueCents < -1_500_000).length,
    );
  }
});

test("player and AI-only branches receive matched worlds and independent results", () => {
  const comparison = runRiskCohortAndBaseline(
    RISK_APPETITE_CASE,
    "protect-weekend",
  );

  assert.notEqual(comparison.player.worlds, comparison.baseline.worlds);
  assert.deepEqual(
    comparison.player.worlds.map(({ worldId, weightBasisPoints, condition }) => ({
      worldId,
      weightBasisPoints,
      condition,
    })),
    comparison.baseline.worlds.map(({ worldId, weightBasisPoints, condition }) => ({
      worldId,
      weightBasisPoints,
      condition,
    })),
  );
  assert.equal(comparison.player.lossLimitBreachCount, 0);
  assert.equal(comparison.baseline.lossLimitBreachCount, 15);
  assert.match(comparison.aggregateFingerprint, /^[0-9a-f]{8}$/);
});

test("malformed case weights, duplicate IDs, unknown plans, and branch drift fail closed", () => {
  const duplicateWorldCase = {
    ...RISK_APPETITE_CASE,
    worlds: RISK_APPETITE_CASE.worlds.map((world, index) =>
      index === 1 ? { ...world, id: RISK_APPETITE_CASE.worlds[0].id } : world,
    ),
  };
  assert.throws(
    () => validateRiskCaseDefinition(duplicateWorldCase),
    /Duplicate risk world ID/,
  );

  const invalidWeightCase = {
    ...RISK_APPETITE_CASE,
    worlds: RISK_APPETITE_CASE.worlds.map((world, index) =>
      index === 0 ? { ...world, weightBasisPoints: 99 } : world,
    ),
  };
  assert.throws(
    () => validateRiskCaseDefinition(invalidWeightCase),
    /one percent weight/,
  );
  assert.throws(
    () => runRiskCohort(RISK_APPETITE_CASE, "unknown-plan"),
    /Unknown risk plan ID/,
  );

  const valid = runRiskCohortAndBaseline(RISK_APPETITE_CASE, "protect-weekend");
  const drifted = {
    ...valid,
    baseline: {
      ...valid.baseline,
      worlds: valid.baseline.worlds.map((world, index) =>
        index === 0
          ? {
              ...world,
              condition:
                world.condition === "ROUTINE_PART_AVAILABLE"
                  ? "PART_UNAVAILABLE_UNTIL_MONDAY"
                  : "ROUTINE_PART_AVAILABLE",
            }
          : world,
      ),
    },
  };
  assert.throws(
    () => validateRiskBranchComparison(drifted),
    /exogenous worlds drifted/,
  );
});
