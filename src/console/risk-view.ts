import {
  RISK_APPETITE_CASE,
  type RankedRiskPlan,
  type RiskBranchComparison,
  type RiskCohortResult,
  type RiskPlanId,
} from "../index.js";
import {
  DIRECT_RISK_COHORT,
  PROTECTED_RISK_COHORT,
  RISK_PLAN_DECISION,
  type RiskConsoleState,
} from "./risk-runtime.js";

export function renderCaseCards(current: "horizon" | "risk"): string {
  return `<nav class="case-cards" aria-label="Windward cases">
    <a class="case-card ${current === "horizon" ? "is-current" : ""}" href="./" ${current === "horizon" ? 'aria-current="page"' : ""}>
      <span>Case 1 · Horizon</span>
      <strong>Think beyond the assignment in front of the dispatcher.</strong>
    </a>
    <a class="case-card ${current === "risk" ? "is-current" : ""}" href="#risk-appetite" ${current === "risk" ? 'aria-current="page"' : ""}>
      <span>Case 2 · Risk appetite</span>
      <strong>Decide how much downside the business can carry.</strong>
    </a>
  </nav>`;
}

export function renderRiskConsole(state: RiskConsoleState): string {
  if (state.phase === "briefing") return renderRiskBriefing();
  if (state.phase === "decision" || state.phase === "receipt") {
    return renderRiskDecision(state);
  }
  if (state.phase === "world") return renderNarratedWorld(state);
  if (state.phase === "distribution") return renderDistribution(state);
  if (state.phase === "debrief") return renderRiskDebrief(state);
  return renderRiskTrace(state);
}

function renderRiskBriefing(): string {
  return `<main id="main-content" class="risk-shell risk-briefing phase-enter">
    ${renderRiskSignals()}
    <section class="risk-briefing-card" role="dialog" aria-modal="true" aria-labelledby="risk-briefing-title">
      <p class="eyebrow">Friday 3:25 PM · Central Florida</p>
      <h1 id="risk-briefing-title" tabindex="-1">You supervise a plan optimiser.</h1>
      ${renderCaseCards("risk")}
      <p class="briefing-copy">It chooses the highest average value. You decide whether the downside fits the business. Both plans cover the same cooling job.</p>
      <p class="safe-copy"><span aria-hidden="true">✓</span> You will see one Saturday after you decide, then the same decision replayed across 100 matched weekends. The single Saturday will not grade your choice.</p>
      <button class="primary-button wide" type="button" data-action="start-risk">Review the Friday decision</button>
      ${renderRiskProvenance()}
    </section>
  </main>`;
}

function renderRiskSignals(): string {
  return `<section class="signals risk-signals" aria-label="Persistent operational signals">
    <article class="signal context-signal">
      <span class="signal-mark" aria-hidden="true">5</span>
      <div><span class="signal-label">Weekend constraint</span><strong>Parts supplier closes at 5 PM · reopens Monday</strong></div>
    </article>
    <article class="signal coverage-signal">
      <span class="signal-mark" aria-hidden="true">$</span>
      <div><span class="signal-label">Risk limit</span><strong>Business can absorb at most a $15,000 loss from one job</strong></div>
    </article>
  </section>`;
}

function renderRiskDecision(state: RiskConsoleState): string {
  const recorded = state.phase === "receipt";
  const receipt = state.planChoice === "protect-weekend"
    ? `<strong>Override recorded — weekend protection added.</strong><span>The plan average moved +$5,900 → +$3,050; loss-limit breaches moved 15 → 0.</span>`
    : `<strong>Keep recorded — direct repair retained.</strong><span>The higher average remains; 15 of 100 outcomes still exceed the loss limit.</span>`;
  return `<main id="main-content" class="risk-shell phase-enter phase-risk-decision">
    ${renderRiskSignals()}
    <section class="risk-decision-shell" aria-labelledby="risk-decision-title">
      <header class="decision-header risk-decision-header">
        <p class="eyebrow">Case 2 · Risk appetite</p>
        <h1 id="risk-decision-title" tabindex="-1">How should the team cover the weekend?</h1>
        <span class="frozen-label"><span aria-hidden="true">❚❚</span> Frozen · no countdown</span>
      </header>
      <div class="risk-decision-content">
        <p class="risk-decision-lede">Both plans start the same repair. The AI chose the plan with the higher average. Your one-job loss limit is <strong>$15,000</strong>.</p>
        <div class="risk-plan-grid">
          ${renderRiskPlanCard("direct-repair", "Dispatcher chose", recorded)}
          ${renderRiskPlanCard("protect-weekend", "Override alternative", recorded)}
        </div>
        ${recorded ? `<div class="recorded risk-recorded" id="risk-confirmation" role="status" tabindex="-1">${receipt}</div>
          <aside class="event-log risk-event-log" aria-labelledby="risk-event-log-title"><h2 id="risk-event-log-title">Event log</h2><ol aria-live="polite"><li>${escapeHtml(state.eventLog[0] ?? "")}</li></ol></aside>
          <button class="primary-button wide continue-button" type="button" data-action="continue-risk-world">See one Saturday</button>` : ""}
        ${renderRiskWhyDrawer()}
      </div>
    </section>
    ${renderRiskProvenance()}
  </main>`;
}

function renderRiskPlanCard(
  planId: RiskPlanId,
  rankLabel: string,
  disabled: boolean,
): string {
  const plan = requireRankedPlan(planId);
  const cohort = cohortFor(planId);
  const routine = requireOutcome(plan, "ROUTINE_PART_AVAILABLE");
  const disruption = requireOutcome(plan, "PART_UNAVAILABLE_UNTIL_MONDAY");
  const action = planId === "direct-repair" ? "keep-risk" : "protect-risk";
  const button = planId === "direct-repair"
    ? "Keep · Direct repair"
    : "Override · Protect the weekend";
  return `<article class="risk-plan-card ${planId}" aria-label="${escapeHtml(plan.planName)} plan">
    <span class="choice-rank">${escapeHtml(rankLabel)}</span>
    <h2>${escapeHtml(plan.planName)}</h2>
    <dl class="risk-plan-facts">
      <div><dt>${routine.worldCount} of 100 weekends</dt><dd>${escapeHtml(routine.coolingStatus.toLowerCase())} · <strong>${formatRiskMoney(routine.netValueCents)}</strong></dd></div>
      <div class="disruption-fact"><dt>${disruption.worldCount} of 100 weekends</dt><dd>${escapeHtml(disruption.coolingStatus.toLowerCase())} · <strong>${formatRiskMoney(disruption.netValueCents)}</strong></dd></div>
      <div><dt>Average across 100</dt><dd><strong>${formatRiskMoney(cohort.averageNetValueCents)}</strong></dd></div>
      <div class="breach-fact"><dt>Loss-limit breaches</dt><dd><strong>${cohort.lossLimitBreachCount}</strong><span>${cohort.lossLimitBreachCount} of 100 beyond the $15,000 limit</span></dd></div>
    </dl>
    <button class="${planId === "direct-repair" ? "secondary-button" : "primary-button"} wide" type="button" data-action="${action}" ${disabled ? "disabled" : ""}>${button}</button>
  </article>`;
}

function renderRiskWhyDrawer(): string {
  const direct = requireRankedPlan("direct-repair");
  const protectedPlan = requireRankedPlan("protect-weekend");
  return `<details class="why-drawer risk-why">
    <summary>Why the optimiser chose direct repair</summary>
    <div class="why-content">
      <article class="why-block"><h3>Average across 100</h3><p><strong>+$5,900</strong> versus <strong>+$3,050</strong>. Direct repair is higher by $2,850, so the optimiser correctly preferred it.</p></article>
      <article class="why-block"><h3>Exact weighted-value calculation</h3><p><code>${escapeHtml(direct.weightedCalculation)}</code></p><p><code>${escapeHtml(protectedPlan.weightedCalculation)}</code></p><p class="policy-note">Decision ID: <code>${escapeHtml(RISK_PLAN_DECISION.decisionId)}</code> · reason: <code>${RISK_PLAN_DECISION.reasonCode}</code></p></article>
      <article class="why-block omitted"><h3>What it was not asked to decide</h3><p>Whether a −$40,000 outcome exceeds this business's −$15,000 one-job limit. The loss limit is not part of the optimiser's objective.</p></article>
    </div>
  </details>`;
}

function renderNarratedWorld(state: RiskConsoleState): string {
  const comparison = requireComparison(state);
  const protectedChoice = state.planChoice === "protect-weekend";
  return `<main id="main-content" class="risk-shell phase-enter phase-risk-world">
    ${renderRiskSignals()}
    <section class="risk-outcome-panel" aria-labelledby="risk-world-title">
      <div class="event-heading"><div><p class="eyebrow">Observed Saturday · world 042</p><h1 id="risk-world-title" tabindex="-1">Cooling restored Friday.</h1></div><span class="time-stamp">One world</span></div>
      <div class="one-world-comparison">
        ${protectedChoice
          ? `<p>Your protected plan returned <strong>+$5,000</strong>. The AI-only direct plan returned <strong>+$14,000</strong> in this same world.</p><p class="observed-difference"><strong>Observed difference today: −$9,000.</strong></p>`
          : `<p>Direct repair returned <strong>+$14,000</strong> in this world.</p><p class="observed-difference"><strong>Observed difference today: $0 from AI-only.</strong></p>`}
      </div>
      <div class="not-verdict"><strong>One Saturday is not the verdict.</strong><span>This fixed world is one of 100. Restart will not reroll it.</span></div>
      <p class="world-evidence">Both plans received <code>${escapeHtml(comparison.narrative.player.condition)}</code> in <code>${escapeHtml(comparison.narrative.player.worldId)}</code>.</p>
      <button class="primary-button wide" type="button" data-action="open-risk-distribution">Replay 100 matched weekends</button>
    </section>
    ${renderRiskProvenance()}
  </main>`;
}

function renderDistribution(state: RiskConsoleState): string {
  requireComparison(state);
  return `<main id="main-content" class="risk-shell phase-enter phase-risk-distribution">
    ${renderRiskSignals()}
    <section class="distribution-panel" aria-labelledby="distribution-title">
      <div class="ledger-heading"><div><p class="eyebrow">Policy replay · 100 matched worlds</p><h1 id="distribution-title" tabindex="-1">One story inside the whole distribution</h1></div><span class="not-score">No overall score</span></div>
      <p class="trace-intro">Under this authored 15-in-100 assumption, both plans face the same 85 routine worlds and the same 15 part-delay worlds. The strips show all weighted worlds at once; they are not sampled runs.</p>
      <div class="outcome-strips" aria-label="Matched 100-world outcomes for both plans">
        ${renderOutcomeStrip(DIRECT_RISK_COHORT)}
        ${renderOutcomeStrip(PROTECTED_RISK_COHORT)}
        <div class="loss-ruler" aria-label="One-job loss limit at negative $15,000">
          <span class="ruler-min">−$40k</span><span class="ruler-line" aria-hidden="true"></span><strong>Loss limit · −$15k</strong><span class="ruler-max">+$14k</span>
        </div>
      </div>
      <div class="distribution-callout"><strong>15 vs 0 limit breaches</strong><span>Direct repair crosses the stated boundary in 15 worlds. Weekend protection keeps all 100 inside it.</span></div>
      <button class="primary-button wide" type="button" data-action="open-risk-debrief">Open policy debrief</button>
    </section>
    ${renderRiskProvenance()}
  </main>`;
}

function renderOutcomeStrip(cohort: RiskCohortResult): string {
  const plan = requireRankedPlan(cohort.planId);
  const routine = requireOutcome(plan, "ROUTINE_PART_AVAILABLE");
  const disruption = requireOutcome(plan, "PART_UNAVAILABLE_UNTIL_MONDAY");
  return `<article class="outcome-strip-row ${cohort.planId}" aria-label="${escapeHtml(cohort.planName)}: ${routine.worldCount} routine worlds at ${formatRiskMoney(routine.netValueCents)}, ${disruption.worldCount} part-delay worlds at ${formatRiskMoney(disruption.netValueCents)}, average ${formatRiskMoney(cohort.averageNetValueCents)}, worst ${formatRiskMoney(cohort.worstNetValueCents)}, ${cohort.lossLimitBreachCount} loss-limit breaches, ${cohort.weekendCoolingFailureCount} clients without cooling through the weekend">
    <header><h2>${escapeHtml(cohort.planName)}</h2><span>${cohort.planId === "direct-repair" ? "AI plan · higher average" : "Protected plan · bounded downside"}</span></header>
    <div class="outcome-strip">
      <div class="outcome-segment routine"><strong>${routine.worldCount} routine</strong><span>${formatRiskMoney(routine.netValueCents)}</span><i aria-hidden="true">Observed Saturday · world 042</i></div>
      <div class="outcome-segment disruption"><strong>${disruption.worldCount} part delays</strong><span>${formatRiskMoney(disruption.netValueCents)}</span></div>
    </div>
    <dl class="strip-summary">
      <div><dt>Average</dt><dd>${formatRiskMoney(cohort.averageNetValueCents)}</dd></div>
      <div><dt>Worst</dt><dd>${formatRiskMoney(cohort.worstNetValueCents)}</dd></div>
      <div class="strip-breaches"><dt>Beyond limit</dt><dd>${cohort.lossLimitBreachCount} of 100</dd></div>
      <div><dt>Weekend cooling failures</dt><dd>${cohort.weekendCoolingFailureCount}</dd></div>
    </dl>
  </article>`;
}

function renderRiskDebrief(state: RiskConsoleState): string {
  const comparison = requireComparison(state);
  const protectedChoice = state.planChoice === "protect-weekend";
  const playerLabel = protectedChoice ? "Your protected plan" : "Your direct plan";
  const summary = protectedChoice
    ? `At 3:25 PM you gave up $2,850 of average value to reduce the worst result by $32,000. That decision kept every replayed world inside the business's $15,000 one-job loss limit. It was sound under the stated policy even though it cost $9,000 in the Saturday you saw.`
    : `At 3:25 PM you kept direct repair. The optimiser did its job: +$5,900 is the higher average. The business's loss limit was not applied, leaving 15 of 100 worlds at −$40,000. This Saturday happened to work. The lucky result did not make the exposure compliant with the stated policy.`;
  const verdict = protectedChoice
    ? `This Saturday cost $9,000 more than the AI-only plan. Your decision was still sound under the stated $15,000 loss limit: it kept all 100 replayed worlds inside the limit. One outcome does not grade a risk decision.`
    : `The optimiser chose the higher average correctly. The plan still crossed the business's stated loss limit in 15 worlds. One lucky outcome does not grade a risk decision.`;
  return `<main id="main-content" class="risk-shell phase-enter phase-risk-debrief">
    <section class="debrief-panel risk-debrief-panel" aria-labelledby="risk-debrief-title">
      <div class="ledger-heading"><div><p class="eyebrow">Causal debrief · branch ledger</p><h1 id="risk-debrief-title" tabindex="-1">Friday 3:25 PM · Weekend plan</h1></div><span class="not-score">No overall score</span></div>
      <p class="debrief-position">${protectedChoice ? "You traded average value for a bounded downside." : "You kept the plan with the higher average."}</p>
      ${renderComparisonLedger("Observed world · world 042", [
        ["Cooling", comparison.narrative.player.coolingStatus, comparison.narrative.baseline.coolingStatus],
        ["Net value in world 042", formatRiskMoney(comparison.narrative.player.netValueCents), formatRiskMoney(comparison.narrative.baseline.netValueCents)],
        ["Difference today", formatRiskDifference(comparison.narrative.differenceCents), "Baseline"],
      ], playerLabel)}
      ${renderComparisonLedger("Policy ledger · 100 matched worlds", [
        ["Average across 100", formatRiskMoney(comparison.player.averageNetValueCents), formatRiskMoney(comparison.baseline.averageNetValueCents)],
        ["Worst result", formatRiskMoney(comparison.player.worstNetValueCents), formatRiskMoney(comparison.baseline.worstNetValueCents)],
        ["Outcomes beyond the −$15,000 limit", String(comparison.player.lossLimitBreachCount), String(comparison.baseline.lossLimitBreachCount)],
        ["Client without cooling through weekend", String(comparison.player.weekendCoolingFailureCount), String(comparison.baseline.weekendCoolingFailureCount)],
      ], playerLabel)}
      <div class="causal-summary"><strong>The only branch difference</strong><span>${escapeHtml(summary)}</span></div>
      <blockquote class="risk-verdict">${escapeHtml(verdict)}</blockquote>
      <div class="debrief-actions"><button class="secondary-button" type="button" data-action="open-risk-trace">Open engineering trace</button><button class="primary-button" type="button" data-action="restart-risk">Restart fixed case</button></div>
    </section>
    ${renderRiskProvenance()}
  </main>`;
}

function renderComparisonLedger(
  title: string,
  rows: readonly (readonly [string, string, string])[],
  playerLabel: string,
): string {
  return `<section class="comparison-ledger" aria-label="${escapeHtml(title)}">
    <h2>${escapeHtml(title)}</h2>
    <div class="comparison-row comparison-head"><span>Measure</span><strong>${escapeHtml(playerLabel)}</strong><strong>Untouched AI-only plan</strong></div>
    ${rows.map(([measure, player, baseline]) => `<div class="comparison-row"><span>${escapeHtml(measure)}</span><strong>${escapeHtml(player)}</strong><strong>${escapeHtml(baseline)}</strong></div>`).join("")}
  </section>`;
}

function renderRiskTrace(state: RiskConsoleState): string {
  const comparison = requireComparison(state);
  return `<main id="main-content" class="trace-shell phase-enter phase-risk-trace">
    <header class="trace-heading"><div><p class="eyebrow">Reading depth four · reproducible trace</p><h1 tabindex="-1">Risk replay trace</h1></div><button class="secondary-button" type="button" data-action="close-risk-trace">Back to debrief</button></header>
    <p class="trace-intro">This trace exposes the fixed narrative world, explicit 100-world manifest, exact plan inputs, paired outcomes, and aggregate fingerprint. The authored likelihood is an assumption, not a measured or predicted failure rate.</p>
    <dl class="trace-facts">
      <div><dt>Case version</dt><dd><code>${escapeHtml(comparison.caseVersion)}</code></dd></div>
      <div><dt>Narrative world</dt><dd><code>${escapeHtml(comparison.narrativeWorldId)}</code></dd></div>
      <div><dt>World manifest</dt><dd>100 worlds · 10,000 basis points · 85 routine / 15 part delay</dd></div>
      <div><dt>Aggregate fingerprint</dt><dd><code>${escapeHtml(comparison.aggregateFingerprint)}</code></dd></div>
      <div><dt>Decision ID</dt><dd><code>${escapeHtml(comparison.decision.decisionId)}</code></dd></div>
      <div><dt>Replay path</dt><dd><code>runRiskCohortAndBaseline(RISK_APPETITE_CASE, "${escapeHtml(state.planChoice)}")</code></dd></div>
    </dl>
    <div class="trace-grid">
      ${renderJsonPanel("Plan decision input — no loss limit", comparison.decision.inputSnapshot)}
      ${renderJsonPanel("Plan decision evidence", comparison.decision)}
      ${renderJsonPanel("Versioned weighted-world manifest", RISK_APPETITE_CASE.worlds)}
      ${renderJsonPanel("Player cohort", comparison.player)}
      ${renderJsonPanel("Untouched AI-only cohort", comparison.baseline)}
    </div>
    <nav class="source-links" aria-label="Risk engine source and tests"><a href="./src/risk.ts">Open risk engine source</a><a href="./test/risk.test.mjs">Open risk replay tests</a></nav>
    ${renderRiskProvenance()}
  </main>`;
}

function renderJsonPanel(title: string, value: unknown): string {
  return `<details class="json-panel"><summary>${escapeHtml(title)}</summary><pre><code>${escapeHtml(JSON.stringify(value, null, 2))}</code></pre></details>`;
}

function renderRiskProvenance(): string {
  return `<footer class="provenance"><strong>Focused simulation, fictional data.</strong> The 15-in-100 likelihood, $15,000 loss limit, plans, outcomes, and money are authored assumptions—not real HVAC pricing, actuarial evidence, or advice. Windward does not show how any real vendor model behaves. This independent portfolio project is not affiliated with, endorsed by, or built for any company.</footer>`;
}

function requireComparison(state: RiskConsoleState): RiskBranchComparison {
  if (state.comparison === null) throw new Error("Risk phase requires a paired comparison");
  return state.comparison;
}

function requireRankedPlan(planId: RiskPlanId): RankedRiskPlan {
  const plan = RISK_PLAN_DECISION.ranking.find((candidate) => candidate.planId === planId);
  if (plan === undefined) throw new Error(`Missing ranked risk plan: ${planId}`);
  return plan;
}

function requireOutcome(
  plan: RankedRiskPlan,
  condition: "ROUTINE_PART_AVAILABLE" | "PART_UNAVAILABLE_UNTIL_MONDAY",
) {
  const outcome = plan.outcomes.find((candidate) => candidate.condition === condition);
  if (outcome === undefined) throw new Error(`Missing ${condition} outcome for ${plan.planId}`);
  return outcome;
}

function cohortFor(planId: RiskPlanId): RiskCohortResult {
  return planId === "direct-repair" ? DIRECT_RISK_COHORT : PROTECTED_RISK_COHORT;
}

function formatRiskMoney(cents: number): string {
  const sign = cents < 0 ? "−" : cents > 0 ? "+" : "";
  return `${sign}$${Math.abs(cents / 100).toLocaleString("en-US")}`;
}

function formatRiskDifference(cents: number): string {
  return cents === 0 ? "$0" : formatRiskMoney(cents);
}

function escapeHtml(value: unknown): string {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
