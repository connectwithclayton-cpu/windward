import assert from "node:assert/strict";
import test from "node:test";

import {
  closeRiskTrace,
  continueToNarratedWorld,
  createInitialRiskConsoleState,
  openRiskDebrief,
  openRiskDistribution,
  openRiskTrace,
  recordRiskChoice,
  startRiskCase,
} from "../dist/console/risk-runtime.js";
import { renderRiskConsole } from "../dist/console/risk-view.js";

function reachDistribution(planId) {
  return openRiskDistribution(
    continueToNarratedWorld(
      recordRiskChoice(startRiskCase(createInitialRiskConsoleState()), planId),
    ),
  );
}

test("risk decision states both natural-frequency plans and the pre-stated limit", () => {
  const decision = startRiskCase(createInitialRiskConsoleState());
  const html = renderRiskConsole(decision);

  assert.equal(decision.phase, "decision");
  assert.match(html, /How should the team cover the weekend\?/);
  assert.match(html, /one-job loss limit is <strong>\$15,000/);
  assert.match(html, /85 of 100 weekends/);
  assert.match(html, /15 of 100 weekends/);
  assert.match(html, /Average across 100/);
  assert.match(html, /Loss-limit breaches/);
  assert.match(html, /Keep · Direct repair/);
  assert.match(html, /Override · Protect the weekend/);
});

test("protected choice resolves one favourable world before the matched distribution", () => {
  const recorded = recordRiskChoice(
    startRiskCase(createInitialRiskConsoleState()),
    "protect-weekend",
  );
  const receiptHtml = renderRiskConsole(recorded);
  assert.equal(recorded.phase, "receipt");
  assert.match(recorded.eventLog[0] ?? "", /loss-limit breaches moved 15 → 0/);
  assert.match(receiptHtml, /Override recorded — weekend protection added/);
  assert.match(receiptHtml, /loss-limit breaches moved 15 → 0/);

  const world = continueToNarratedWorld(recorded);
  const worldHtml = renderRiskConsole(world);
  assert.match(worldHtml, /Observed Saturday · world 042/);
  assert.match(worldHtml, /<h1 id="risk-world-title" tabindex="-1">Cooling restored Friday<\/h1>/);
  assert.match(worldHtml, /Observed difference today: −\$9,000/);
  assert.match(worldHtml, /One Saturday is not the verdict/);
  assert.match(worldHtml, /Restart will not reroll it/);

  const distribution = openRiskDistribution(world);
  const distributionHtml = renderRiskConsole(distribution);
  assert.match(distributionHtml, /Under this authored 15-in-100 assumption/);
  assert.match(distributionHtml, /15 vs 0 limit breaches/);
  assert.match(distributionHtml, /Weekend protection keeps all 100 replayed worlds inside the stated boundary\./);
  assert.match(distributionHtml, /Worst<\/dt><dd>−\$40,000/);
  assert.match(distributionHtml, /Worst<\/dt><dd>−\$8,000/);
  assert.match(distributionHtml, /Loss limit · −\$15k/);
  assert.match(distributionHtml, /--risk-routine-weight: 8500fr; --risk-disruption-weight: 1500fr/);
  assert.match(distributionHtml, /--risk-loss-limit-position: 46\.3%/);
});

test("both choice branches reach policy debriefs that separate luck from quality", () => {
  const protectedDebrief = openRiskDebrief(reachDistribution("protect-weekend"));
  const protectedHtml = renderRiskConsole(protectedDebrief);
  assert.equal(protectedDebrief.phase, "debrief");
  assert.match(protectedHtml, /Policy ledger · 100 matched worlds/);
  assert.match(protectedHtml, /gave up \$2,850 of average value/);
  assert.match(protectedHtml, /This Saturday cost \$9,000 more than the AI-only plan/);
  assert.match(protectedHtml, /Your decision was still sound/);
  assert.match(protectedHtml, /it keeps all 100 replayed worlds inside the stated boundary/);
  assert.match(protectedHtml, /One outcome does not grade a risk decision/);

  const directDebrief = openRiskDebrief(reachDistribution("direct-repair"));
  const directHtml = renderRiskConsole(directDebrief);
  const directReceipt = recordRiskChoice(
    startRiskCase(createInitialRiskConsoleState()),
    "direct-repair",
  );
  assert.match(directReceipt.eventLog[0] ?? "", /15 of 100 outcomes remain beyond the loss limit/);
  assert.match(directHtml, /The optimiser did its job/);
  assert.match(directHtml, /This Saturday happened to work/);
  assert.match(directHtml, /lucky result did not make the exposure compliant/);

  const trace = openRiskTrace(protectedDebrief);
  const traceHtml = renderRiskConsole(trace);
  assert.match(traceHtml, /100 worlds · 10,000 basis points/);
  assert.match(traceHtml, /https:\/\/github\.com\/connectwithclayton-cpu\/windward\/blob\/main\/src\/risk\.ts/);
  assert.match(traceHtml, /https:\/\/github\.com\/connectwithclayton-cpu\/windward\/blob\/main\/test\/risk\.test\.mjs/);
  assert.equal(closeRiskTrace(trace).phase, "debrief");
});
