import assert from "node:assert/strict";
import test from "node:test";

import {
  BREADTH_CASE,
  BREADTH_MINIMUM_TOUCH_OVERRIDE,
  dispatch,
  runBreadthComparison,
  simulateScenario,
  summarizeBreadthRecovery,
  validateBreadthCaseDefinition,
} from "../dist/index.js";

function clone(value) {
  return structuredClone(value);
}

test("Breadth dispatches four recovered visits serially against current board evidence", () => {
  const comparison = runBreadthComparison(BREADTH_CASE, "dispatcher-recovery");

  assert.deepEqual(
    comparison.baseline.outcomes.map((outcome) => outcome.assignedTechnicianId),
    ["elena-park", "marcus-reed", "nina-flores", "dev-shah"],
  );
  assert.equal(comparison.baseline.decisions.length, 4);
  assert.deepEqual(comparison.baseline.decisions.map((decision) => decision.ranking.length), [4, 4, 4, 4]);
  assert.equal(comparison.baseline.decisions.flatMap((decision) => decision.ranking).length, 16);
  assert.equal(comparison.baseline.outcomes.every((outcome) => !outcome.overridden), true);

  const firstHandoff = comparison.baseline.transitions[0].afterBoard.technicians.find(
    (technician) => technician.id === "elena-park",
  );
  assert.equal(firstHandoff.availableAtMinute, 608);
  assert.equal(firstHandoff.assignedMinutes, 228);

  const diagnostic = comparison.baseline.decisions[1];
  const marcus = diagnostic.ranking.find((candidate) => candidate.technicianId === "marcus-reed");
  const elena = diagnostic.ranking.find((candidate) => candidate.technicianId === "elena-park");
  assert.equal(diagnostic.winner.technicianId, "marcus-reed");
  assert.equal(marcus.factors.travelTime.value.minutes, 12);
  assert.equal(marcus.factors.availability.value.waitMinutes, 0);
  assert.equal(marcus.factors.utilisation.value.assignedMinutes, 120);
  assert.equal(Math.round(marcus.score * 1_000) / 1_000, 94.5);
  assert.equal(elena.factors.travelTime.value.minutes, 5);
  assert.equal(elena.factors.availability.value.waitMinutes, 38);
  assert.equal(elena.factors.utilisation.value.assignedMinutes, 228);
  assert.equal(Math.round(elena.score * 1_000) / 1_000, 89.25);
  assert.equal(diagnostic.ranking.every((candidate) => Object.keys(candidate.factors).length === 6), true);
});

test("both Breadth branches preserve certification and expose the exact two-sided tradeoff", () => {
  const released = runBreadthComparison(BREADTH_CASE, "dispatcher-recovery");
  const minimumTouch = runBreadthComparison(BREADTH_CASE, "minimum-touch");

  assert.deepEqual(released.playerSummary, {
    pinnedVisitsMoved: 0,
    recoveredVisitsCertified: 4,
    recoveredVisitsInsideWindow: 4,
    wholeDayInsideWindow: 12,
    addedTravelMinutes: 43,
    workingTechniciansTouched: 4,
    lateMinutes: 0,
    selectedScoreSum: 377.584,
  });
  assert.deepEqual(minimumTouch.playerSummary, {
    pinnedVisitsMoved: 0,
    recoveredVisitsCertified: 4,
    recoveredVisitsInsideWindow: 3,
    wholeDayInsideWindow: 11,
    addedTravelMinutes: 36,
    workingTechniciansTouched: 3,
    lateMinutes: 13,
    selectedScoreSum: 372.334,
  });
  assert.equal(minimumTouch.player.outcomes[1].completionMinute, 703);
  assert.equal(minimumTouch.player.outcomes[1].lateByMinutes, 13);
  assert.equal(minimumTouch.player.outcomes.filter((outcome) => outcome.overridden).length, 1);
  assert.deepEqual(BREADTH_MINIMUM_TOUCH_OVERRIDE, [
    { eventId: "breadth-diagnostic-repair", technicianId: "elena-park" },
  ]);
  assert.deepEqual(minimumTouch.player.exogenousEvents, minimumTouch.baseline.exogenousEvents);
  assert.notEqual(minimumTouch.player.exogenousEvents, minimumTouch.baseline.exogenousEvents);
  assert.notEqual(minimumTouch.player.finalBoard, minimumTouch.baseline.finalBoard);
});

test("Breadth aggregates reconcile from recovery evidence and the eight pinned manifest rows", () => {
  const comparison = runBreadthComparison(BREADTH_CASE, "minimum-touch");
  assert.equal(BREADTH_CASE.pinnedVisits.length, 8);
  assert.equal(BREADTH_CASE.pinnedVisits.every((visit) => visit.status === "PINNED_UNCHANGED"), true);
  assert.equal(
    BREADTH_CASE.pinnedVisits.every(
      (visit) => visit.completionMinute <= visit.promisedWindow.endMinute,
    ),
    true,
  );
  assert.deepEqual(
    summarizeBreadthRecovery(comparison.player),
    comparison.playerSummary,
  );
  assert.deepEqual(
    summarizeBreadthRecovery(comparison.baseline),
    comparison.baselineSummary,
  );
  assert.deepEqual(comparison.player.pinnedVisitsBefore, BREADTH_CASE.pinnedVisits);
  assert.deepEqual(comparison.player.pinnedVisitsAfter, BREADTH_CASE.pinnedVisits);
  assert.deepEqual(comparison.baseline.pinnedVisitsBefore, BREADTH_CASE.pinnedVisits);
  assert.deepEqual(comparison.baseline.pinnedVisitsAfter, BREADTH_CASE.pinnedVisits);
  assert.equal(comparison.playerSummary.pinnedVisitsMoved, 0);
  assert.equal(comparison.baselineSummary.pinnedVisitsMoved, 0);
  for (const choice of ["dispatcher-recovery", "minimum-touch"]) {
    const replay = runBreadthComparison(BREADTH_CASE, choice);
    for (const branch of [replay.player, replay.baseline]) {
      assert.deepEqual(branch.pinnedVisitsBefore, BREADTH_CASE.pinnedVisits);
      assert.deepEqual(branch.pinnedVisitsAfter, BREADTH_CASE.pinnedVisits);
      assert.equal(branch.transitions.length, 4);
      for (const [index, transition] of branch.transitions.entries()) {
        assert.deepEqual(transition.pinnedVisitsBefore, BREADTH_CASE.pinnedVisits);
        assert.deepEqual(transition.pinnedVisitsAfter, BREADTH_CASE.pinnedVisits);
        if (index > 0) {
          assert.deepEqual(
            transition.pinnedVisitsBefore,
            branch.transitions[index - 1].pinnedVisitsAfter,
          );
        }
      }
      assert.deepEqual(
        branch.pinnedVisitsAfter,
        branch.transitions.at(-1).pinnedVisitsAfter,
      );
    }
  }
  const changedTransition = {
    ...comparison.player.transitions[0],
    pinnedVisitsAfter: [
      {
        ...comparison.player.transitions[0].pinnedVisitsAfter[0],
        ownerId: "marcus-reed",
      },
      ...comparison.player.transitions[0].pinnedVisitsAfter.slice(1),
    ],
  };
  assert.throws(
    () => summarizeBreadthRecovery({
      ...comparison.player,
      transitions: [changedTransition, ...comparison.player.transitions.slice(1)],
    }),
    /Breadth pinned transition (before|after)-state drifted/,
  );
  const pinnedIds = new Set(BREADTH_CASE.pinnedVisits.map((visit) => visit.id));
  assert.equal(
    comparison.player.decisions.some((decision) => pinnedIds.has(decision.inputSnapshot.job.id)),
    false,
  );
  assert.equal(
    BREADTH_MINIMUM_TOUCH_OVERRIDE.some((override) => pinnedIds.has(override.eventId)),
    false,
  );
});

test("promised-window changes affect outcome evidence and fingerprints but never ranking", () => {
  const original = simulateScenario(BREADTH_CASE.scenario, []);
  const changedScenario = clone(BREADTH_CASE.scenario);
  changedScenario.jobs[1].promisedWindowDurationMinutes = { min: 90, max: 90 };
  const changed = simulateScenario(changedScenario, []);

  assert.deepEqual(
    changed.decisions[1].ranking.map((candidate) => [candidate.technicianId, candidate.score]),
    original.decisions[1].ranking.map((candidate) => [candidate.technicianId, candidate.score]),
  );
  assert.notEqual(changed.decisions[1].decisionId, original.decisions[1].decisionId);
  assert.equal(original.outcomes[1].lateByMinutes, 0);
  assert.equal(changed.outcomes[1].lateByMinutes, 12);
});

test("later work cannot change earlier decisions, while changed current state can", () => {
  const original = simulateScenario(BREADTH_CASE.scenario, []);
  const withLaterJob = clone(BREADTH_CASE.scenario);
  withLaterJob.jobs.push({
    ...clone(withLaterJob.jobs[0]),
    id: "breadth-later-fifth-job",
    arrivalMinute: { min: 1_000, max: 1_000 },
    requestedStartOffsetMinutes: { min: 20, max: 20 },
    promisedWindowStartOffsetMinutes: { min: 20, max: 20 },
  });
  const expanded = simulateScenario(withLaterJob, []);
  assert.deepEqual(expanded.decisions.slice(0, 4), original.decisions);

  const currentBoard = clone(original.decisions[1].inputSnapshot.boardState);
  const marcus = currentBoard.technicians.find((technician) => technician.id === "marcus-reed");
  marcus.assignedMinutes = 480;
  const changedCurrentRanking = dispatch(currentBoard, original.decisions[1].inputSnapshot.job);
  assert.equal(changedCurrentRanking.winner.technicianId, "elena-park");
});

test("Breadth remains deterministic under technician ordering and restart", () => {
  const first = runBreadthComparison(BREADTH_CASE, "minimum-touch");
  const second = runBreadthComparison(BREADTH_CASE, "minimum-touch");
  assert.deepEqual(first, second);

  const reordered = clone(BREADTH_CASE.scenario);
  reordered.initialBoard.technicians.reverse();
  const reorderedResult = simulateScenario(reordered, []);
  assert.deepEqual(
    reorderedResult.decisions.map((decision) => decision.ranking.map((candidate) => candidate.technicianId)),
    first.baseline.decisions.map((decision) => decision.ranking.map((candidate) => candidate.technicianId)),
  );
});

test("Breadth fails closed on ineligible overrides and fixture or manifest drift", () => {
  assert.throws(
    () => simulateScenario(BREADTH_CASE.scenario, [
      { eventId: "breadth-no-cool-repair", technicianId: "nina-flores" },
    ]),
    /selects ineligible technician nina-flores/,
  );

  const changedOrder = clone(BREADTH_CASE);
  changedOrder.scenario.jobs.reverse();
  assert.throws(() => validateBreadthCaseDefinition(changedOrder), /facts drifted/);

  const changedBoard = clone(BREADTH_CASE);
  changedBoard.scenario.initialBoard.technicians[0].assignedMinutes += 1;
  assert.throws(() => runBreadthComparison(changedBoard, "dispatcher-recovery"), /facts drifted/);

  const changedPinned = clone(BREADTH_CASE);
  changedPinned.pinnedVisits[0].status = "MOVED";
  assert.throws(() => runBreadthComparison(changedPinned, "minimum-touch"), /facts drifted/);
});
