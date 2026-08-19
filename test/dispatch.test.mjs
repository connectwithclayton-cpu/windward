import assert from "node:assert/strict";
import test from "node:test";

import {
  DEFAULT_SCORING_WEIGHTS,
  NoEligibleCandidateError,
  computeCoverage,
  dispatch,
} from "../dist/index.js";

function technician(overrides = {}) {
  return {
    id: "target",
    skills: ["diagnostics", "repair"],
    certifications: ["epa-608-ii"],
    availableAtMinute: 600,
    assignedMinutes: 0,
    capacityMinutes: 480,
    ...overrides,
  };
}

function job(overrides = {}) {
  return {
    id: "repair-1",
    arrivalMinute: 570,
    requestedStartMinute: 600,
    promisedWindow: { startMinute: 600, endMinute: 720 },
    durationMinutes: 60,
    requiredSkills: ["Repair", "diagnostics", "repair"],
    requiredCertifications: ["EPA-608-II"],
    revenueCents: 20_000,
    travelMinutesByTechnician: { target: 0, anchor: 60 },
    routeDeltaMinutesByTechnician: { target: -5, anchor: 12 },
    expectedRevenueCentsByTechnician: { target: 20_000, anchor: 10_000 },
    ...overrides,
  };
}

function board(targetOverrides = {}) {
  return {
    technicians: [
      technician(targetOverrides),
      technician({
        id: "anchor",
        availableAtMinute: 660,
        assignedMinutes: 240,
      }),
    ],
  };
}

function evidenceFor(decision, technicianId = "target") {
  const evidence = decision.ranking.find(
    (candidate) => candidate.technicianId === technicianId,
  );
  assert.ok(evidence, `missing evidence for ${technicianId}`);
  return evidence;
}

test("dispatch structurally returns a winner, ranked alternatives, and replay evidence", () => {
  const decision = dispatch(board(), job());

  assert.equal(decision.winner, decision.ranking[0]);
  assert.deepEqual(decision.rankedAlternatives, decision.ranking.slice(1));
  assert.equal(decision.ranking.length, 2);
  assert.equal(decision.winner.reasonCode, "BEST_IMMEDIATE_SCORE");
  assert.match(decision.decisionId, /^decision-[0-9a-f]{8}$/);
  assert.equal(decision.inputSnapshot.job.promisedWindow.endMinute, 720);
  assert.deepEqual(decision.winner.requirements, {
    jobId: "repair-1",
    arrivalMinute: 570,
    requestedStartMinute: 600,
    promisedWindow: { startMinute: 600, endMinute: 720 },
    durationMinutes: 60,
    requiredSkills: ["diagnostics", "repair"],
    requiredCertifications: ["epa-608-ii"],
    revenueCents: 20_000,
  });
  assert.deepEqual(decision.winner.immediateDeltas, {
    timeMinutes: 60,
    routeMinutes: -5,
    revenueCents: 20_000,
  });
  assert.equal(Object.isFrozen(decision), true);
  assert.equal(Object.isFrozen(decision.inputSnapshot), true);
});

test("an uncertified technician is visible as disqualified and can never win", () => {
  const state = {
    technicians: [
      technician({
        id: "uncertified",
        certifications: [],
        availableAtMinute: 0,
        assignedMinutes: 0,
      }),
      technician({
        id: "qualified",
        availableAtMinute: 720,
        assignedMinutes: 400,
      }),
    ],
  };
  const work = job({
    travelMinutesByTechnician: { uncertified: 0, qualified: 120 },
    routeDeltaMinutesByTechnician: { uncertified: 0, qualified: 50 },
    expectedRevenueCentsByTechnician: { uncertified: 20_000, qualified: 1_000 },
  });

  const decision = dispatch(state, work);
  const excluded = evidenceFor(decision, "uncertified");

  assert.equal(decision.winner.technicianId, "qualified");
  assert.equal(excluded.eligibility.eligible, false);
  assert.equal(excluded.reasonCode, "HARD_CONSTRAINT_FAILED");
  assert.deepEqual(excluded.eligibility.disqualifiers, [
    {
      code: "MISSING_CERTIFICATION",
      constraint: "certification",
      missing: ["epa-608-ii"],
    },
  ]);
  assert.equal(
    decision.rankedAlternatives.some(
      (candidate) =>
        candidate.technicianId === "uncertified" && candidate.eligibility.eligible,
    ),
    false,
  );
});

test("dispatch fails closed with explicit evidence when every candidate is uncertified", () => {
  const state = { technicians: [technician({ certifications: [] })] };
  const work = job({
    travelMinutesByTechnician: { target: 0 },
    routeDeltaMinutesByTechnician: { target: 0 },
    expectedRevenueCentsByTechnician: { target: 20_000 },
  });

  assert.throws(
    () => dispatch(state, work),
    (error) => {
      assert.ok(error instanceof NoEligibleCandidateError);
      assert.equal(error.candidates.length, 1);
      assert.equal(error.candidates[0].reasonCode, "HARD_CONSTRAINT_FAILED");
      assert.equal(error.candidates[0].eligibility.disqualifiers[0].code, "MISSING_CERTIFICATION");
      return true;
    },
  );
});

test("each declared ranking factor contributes independently to the score", () => {
  const baseline = evidenceFor(dispatch(board(), job()));
  assert.deepEqual(
    Object.fromEntries(
      Object.entries(baseline.factors).map(([name, factor]) => [name, factor.contribution]),
    ),
    DEFAULT_SCORING_WEIGHTS,
  );
  assert.equal(
    baseline.score,
    Object.values(baseline.factors).reduce(
      (sum, factor) => sum + factor.contribution,
      0,
    ),
  );

  const cases = [
    {
      factor: "travelTime",
      state: board(),
      work: job({ travelMinutesByTechnician: { target: 120, anchor: 60 } }),
    },
    {
      factor: "skillMatch",
      state: board({ skills: [] }),
      work: job(),
    },
    {
      factor: "certification",
      state: board({ certifications: [] }),
      work: job(),
    },
    {
      factor: "availability",
      state: board({ availableAtMinute: 720 }),
      work: job(),
    },
    {
      factor: "revenueFit",
      state: board(),
      work: job({
        expectedRevenueCentsByTechnician: { target: 0, anchor: 10_000 },
      }),
    },
    {
      factor: "utilisation",
      state: board({ assignedMinutes: 480 }),
      work: job(),
    },
  ];

  for (const { factor, state, work } of cases) {
    const changed = evidenceFor(dispatch(state, work));
    assert.equal(changed.factors[factor].contribution, 0, factor);
    assert.equal(
      baseline.score - changed.score,
      DEFAULT_SCORING_WEIGHTS[factor],
      `${factor} score delta`,
    );
    for (const otherFactor of Object.keys(DEFAULT_SCORING_WEIGHTS)) {
      if (otherFactor !== factor) {
        assert.equal(
          changed.factors[otherFactor].contribution,
          baseline.factors[otherFactor].contribution,
          `${factor} must not alter ${otherFactor}`,
        );
      }
    }
  }
});

test("promised windows are replayable job data but never a ranking factor", () => {
  const first = dispatch(board(), job());
  const second = dispatch(
    board(),
    job({ promisedWindow: { startMinute: 660, endMinute: 780 } }),
  );

  assert.deepEqual(
    first.ranking.map(({ technicianId, score }) => ({ technicianId, score })),
    second.ranking.map(({ technicianId, score }) => ({ technicianId, score })),
  );
  assert.deepEqual(first.winner.factors, second.winner.factors);
  assert.notEqual(first.decisionId, second.decisionId);
  assert.deepEqual(second.winner.requirements.promisedWindow, {
    startMinute: 660,
    endMinute: 780,
  });
});

test("non-ASCII technician IDs use deterministic code-unit tie-breaking", () => {
  const state = {
    technicians: [
      technician({ id: "é" }),
      technician({ id: "z" }),
    ],
  };
  const work = job({
    travelMinutesByTechnician: { é: 0, z: 0 },
    routeDeltaMinutesByTechnician: { é: 0, z: 0 },
    expectedRevenueCentsByTechnician: { é: 20_000, z: 20_000 },
  });

  const decision = dispatch(state, work);
  const reversedDecision = dispatch(
    { technicians: [...state.technicians].reverse() },
    work,
  );

  assert.deepEqual(
    decision.ranking.map(({ technicianId }) => technicianId),
    ["z", "é"],
  );
  assert.equal(decision.winner.technicianId, "z");
  assert.equal(decision.decisionId, reversedDecision.decisionId);
});

test("coverage is descriptive evidence computed separately from dispatch", () => {
  const state = board({ availableAtMinute: 900 });
  const coverage = computeCoverage(state, {
    atMinute: 840,
    requiredSkills: ["repair"],
    requiredCertifications: ["epa-608-ii"],
  });

  assert.equal(coverage.availableQualifiedCount, 1);
  assert.deepEqual(
    coverage.candidates.map(({ technicianId, qualified, available }) => ({
      technicianId,
      qualified,
      available,
    })),
    [
      { technicianId: "anchor", qualified: true, available: true },
      { technicianId: "target", qualified: true, available: false },
    ],
  );
});
