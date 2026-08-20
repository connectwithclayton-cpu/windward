import assert from "node:assert/strict";
import test from "node:test";

import {
  closeBreadthTrace,
  continueBreadthOutcome,
  createInitialBreadthConsoleState,
  openBreadthDebrief,
  openBreadthTrace,
  recordBreadthChoice,
  startBreadthCase,
} from "../dist/console/breadth-runtime.js";
import { renderBreadthConsole } from "../dist/console/breadth-view.js";
import { renderCaseCards } from "../dist/console/risk-view.js";

function reachDebrief(choice) {
  return openBreadthDebrief(
    continueBreadthOutcome(
      recordBreadthChoice(startBreadthCase(createInitialBreadthConsoleState()), choice),
    ),
  );
}

test("Breadth is a third sibling entry with a frozen release-authority briefing", () => {
  const state = createInitialBreadthConsoleState();
  const html = renderBreadthConsole(state);
  const cards = renderCaseCards("breadth");

  assert.equal(state.phase, "briefing");
  assert.match(cards, /Case 1 · Horizon/);
  assert.match(cards, /Case 2 · Risk appetite/);
  assert.match(cards, /Case 3 · Breadth/);
  assert.match(cards, /href="#breadth" aria-current="page"/);
  assert.match(html, /You supervise a dispatch recovery/);
  assert.match(html, /You decide whether to release that recovery/);
  assert.match(html, /Eight other visits stay pinned in both paths/);
  assert.match(html, /Review the recovery/);
});

test("the Breadth decision exposes two respectable choices and serial engine evidence", () => {
  const state = startBreadthCase(createInitialBreadthConsoleState());
  const html = renderBreadthConsole(state);

  assert.equal(state.phase, "decision");
  assert.equal((html.match(/<article class="signal /g) ?? []).length, 2);
  assert.match(html, /Release the broader recovery\?/);
  assert.match(html, /4 technicians touched/);
  assert.match(html, /43 added drive min/);
  assert.match(html, /3 technicians touched/);
  assert.match(html, /36 added drive min/);
  assert.match(html, /Keep · Release dispatcher recovery/);
  assert.match(html, /Override · Keep flexible visits with Elena/);
  assert.match(html, /Four serial assignments/);
  assert.equal((html.match(/class="recovery-row /g) ?? []).length, 4);
  assert.equal((html.match(/class="candidate-evidence /g) ?? []).length, 16);
  assert.match(html, /Elena[\s\S]*first assignment recorded[\s\S]*All 4 rechecked[\s\S]*Marcus/);
  assert.match(html, /Elena remains closer\. Marcus becomes the best current choice/);
  assert.match(html, /Marcus Reed[\s\S]*12 min[\s\S]*Elena Park[\s\S]*5 min/);
  assert.match(html, /38 min wait/);
  assert.match(html, /228\/480 min/);
  assert.match(html, /Promised-window outcomes were calculated after assignment\. They did not change the dispatcher score/);
  assert.match(html, /Future impact/);
  assert.match(html, /Absent by design/);
  assert.match(html, /Not in model/);
  assert.match(html, /8 pinned visits · unchanged/);
});

test("both Breadth choices focus a legible receipt and reach respectful outcomes", () => {
  const kept = recordBreadthChoice(
    startBreadthCase(createInitialBreadthConsoleState()),
    "dispatcher-recovery",
  );
  const keptReceipt = renderBreadthConsole(kept);
  assert.equal(kept.phase, "receipt");
  assert.match(keptReceipt, /id="breadth-confirmation" role="status" tabindex="-1"/);
  assert.match(keptReceipt, /Keep recorded — dispatcher recovery released/);
  assert.match(keptReceipt, /four technician-days changed/);
  assert.equal((keptReceipt.match(/Assigned ·/g) ?? []).length, 4);

  const keptOutcome = continueBreadthOutcome(kept);
  const keptOutcomeHtml = renderBreadthConsole(keptOutcome);
  assert.match(keptOutcomeHtml, /Recovery complete — 12 of 12 commitments stayed inside their windows/);
  assert.match(keptOutcomeHtml, /All four recovered visits stayed inside their windows/);
  assert.match(keptOutcomeHtml, /No pinned visit moved/);

  const minimum = recordBreadthChoice(
    startBreadthCase(createInitialBreadthConsoleState()),
    "minimum-touch",
  );
  const minimumReceipt = renderBreadthConsole(minimum);
  assert.match(minimumReceipt, /Override recorded — flexible visits kept with Elena/);
  assert.match(minimumReceipt, /seven drive minutes were removed/);
  assert.match(minimumReceipt, /13 minutes outside its promised window/);

  const minimumOutcome = continueBreadthOutcome(minimum);
  const minimumOutcomeHtml = renderBreadthConsole(minimumOutcome);
  assert.match(minimumOutcomeHtml, /Recovery complete — 11 of 12 commitments stayed inside their windows/);
  assert.match(minimumOutcomeHtml, /One fewer technician's morning changed and seven drive minutes were saved/);
  assert.match(minimumOutcomeHtml, /Diagnostic repair[\s\S]*11:43 AM[\s\S]*13 min late/);

  const alteredOutcomeHtml = renderBreadthConsole({
    ...minimum,
    phase: "outcome",
    comparison: {
      ...minimum.comparison,
      playerSummary: {
        ...minimum.comparison.playerSummary,
        pinnedVisitsMoved: 1,
      },
    },
  });
  assert.match(alteredOutcomeHtml, /1 pinned visits moved/);
  assert.doesNotMatch(alteredOutcomeHtml, /No pinned visit moved/);
});

test("both Breadth debriefs use the shared branch ledger and deny machine foresight", () => {
  const released = reachDebrief("dispatcher-recovery");
  const releasedHtml = renderBreadthConsole(released);
  assert.equal(released.phase, "debrief");
  assert.match(releasedHtml, /Causal debrief · branch ledger/);
  assert.match(releasedHtml, /No overall score/);
  assert.match(releasedHtml, /Your released recovery/);
  assert.match(releasedHtml, /Untouched AI-only recovery/);
  assert.match(releasedHtml, /If flexible visits stayed with Elena/);
  assert.match(releasedHtml, /Approving sound machine work is supervision, not spectatorship/);
  assert.match(releasedHtml, /The dispatcher did not foresee the day/);
  assert.match(releasedHtml, /re-evaluated every technician after each assignment/);

  const minimum = reachDebrief("minimum-touch");
  const minimumHtml = renderBreadthConsole(minimum);
  assert.match(minimumHtml, /Your minimum-touch recovery/);
  assert.match(minimumHtml, /Your alternative achieved its stated goal/);
  assert.match(minimumHtml, /No certification rule was broken and no pinned visit moved/);
  assert.match(minimumHtml, /The cost was one late commitment/);

  const allCopy = `${releasedHtml}\n${minimumHtml}`;
  assert.doesNotMatch(allCopy, /schedule combinations|reshuffles? .*day|globally optim|human instinct|humans? usually choose|machine protects promised windows/i);

  const trace = openBreadthTrace(minimum);
  const traceHtml = renderBreadthConsole(trace);
  assert.match(traceHtml, /Breadth recovery trace/);
  assert.match(traceHtml, /16 rows · 4 current decisions/);
  assert.match(traceHtml, /Validated eight-visit pinned manifest/);
  assert.match(traceHtml, /Player decision evidence — 16 candidate rows/);
  assert.match(traceHtml, /src\/breadth\.ts/);
  assert.match(traceHtml, /test\/breadth\.test\.mjs/);
  assert.equal(closeBreadthTrace(trace).phase, "debrief");
});
