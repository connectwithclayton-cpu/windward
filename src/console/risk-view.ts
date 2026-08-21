import {
  RISK_APPETITE_CASE,
  type RankedRiskPlan,
  type RiskBranchComparison,
  type RiskCohortResult,
  type RiskPlanId,
  type RiskWorldCondition,
} from "../index.js";
import {
  DIRECT_RISK_COHORT,
  PROTECTED_RISK_COHORT,
  RISK_PLAN_DECISION,
  type RiskConsoleState,
} from "./risk-runtime.js";
import {
  escapeHtml,
  renderDecisionPanel,
  renderEventLog,
  renderHonestLimits,
} from "./components.js";

export function renderCaseCards(current: "horizon" | "risk" | "breadth"): string {
  return `<nav class="case-cards" aria-label="Windward cases">
    <a class="case-card ${current === "horizon" ? "is-current" : ""}" href="./" ${current === "horizon" ? 'aria-current="page"' : ""}>
      <span>Case 1 · Horizon</span>
      <strong>Think beyond the assignment in front of the dispatcher.</strong>
    </a>
    <a class="case-card ${current === "risk" ? "is-current" : ""}" href="#risk-appetite" ${current === "risk" ? 'aria-current="page"' : ""}>
      <span>Case 2 · Risk appetite</span>
      <strong>Decide how much downside the business can carry.</strong>
    </a>
    <a class="case-card ${current === "breadth" ? "is-current" : ""}" href="#breadth" ${current === "breadth" ? 'aria-current="page"' : ""}>
      <span>Case 3 · Breadth</span>
      <strong>Decide whether a routine recovery is safe to release.</strong>
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
  const worldCount = DIRECT_RISK_COHORT.worlds.length;
  return `<main id="main-content" class="risk-shell risk-briefing phase-enter">
    ${renderRiskSignals()}
    <section class="risk-briefing-card" role="dialog" aria-modal="true" aria-labelledby="risk-briefing-title">
      <p class="eyebrow">Friday 3:25 PM · Central Florida</p>
      <h1 id="risk-briefing-title" tabindex="-1">You supervise a plan optimiser.</h1>
      ${renderCaseCards("risk")}
      <p class="briefing-copy">It chooses the highest average value. You decide whether the downside fits the business. Both plans cover the same cooling job.</p>
      <p class="safe-copy"><span aria-hidden="true">✓</span> You will see one Saturday after you decide, then the same decision replayed across ${worldCount} matched weekends. The single Saturday will not grade your choice.</p>
      <button class="primary-button wide" type="button" data-action="start-risk">Review the Friday decision</button>
      ${renderRiskProvenance()}
    </section>
  </main>`;
}

function renderRiskSignals(): string {
  const lossLimit = formatUnsignedRiskMoney(RISK_APPETITE_CASE.lossLimitCents);
  return `<section class="signals risk-signals" aria-label="Persistent operational signals">
    <article class="signal context-signal">
      <span class="signal-mark" aria-hidden="true">5</span>
      <div><span class="signal-label">Weekend constraint</span><strong>Parts supplier closes at 5 PM · reopens Monday</strong></div>
    </article>
    <article class="signal coverage-signal">
      <span class="signal-mark" aria-hidden="true">$</span>
      <div><span class="signal-label">Risk limit</span><strong>Business can absorb at most a ${lossLimit} loss from one job</strong></div>
    </article>
  </section>`;
}

function renderRiskDecision(state: RiskConsoleState): string {
  const recorded = state.phase === "receipt";
  const comparison = recorded ? requireComparison(state) : null;
  const receipt = comparison === null
    ? ""
    : state.planChoice === "protect-weekend"
    ? `<strong>Override recorded — weekend protection added.</strong><span>The plan average moved ${formatRiskMoney(comparison.baseline.averageNetValueCents)} → ${formatRiskMoney(comparison.player.averageNetValueCents)}; loss-limit breaches moved ${comparison.baseline.lossLimitBreachCount} → ${comparison.player.lossLimitBreachCount}.</span>`
    : `<strong>Keep recorded — direct repair retained.</strong><span>The higher average remains at ${formatRiskMoney(comparison.player.averageNetValueCents)}; ${comparison.player.lossLimitBreachCount} of ${comparison.player.worlds.length} outcomes still exceed the loss limit.</span>`;
  return `<main id="main-content" class="risk-shell phase-enter phase-risk-decision">
    ${renderRiskSignals()}
    ${renderDecisionPanel({
      titleId: "risk-decision-title",
      eyebrow: "Case 2 · Risk appetite",
      title: "How should the team cover the weekend?",
      className: "risk-decision-shell",
      contentClassName: "risk-decision-content",
      badge: {
        label: "Frozen · no countdown",
        icon: "❚❚",
        tone: "quiet",
        className: "frozen-label",
      },
      content: `
        <div class="risk-world-heading" aria-hidden="true"><strong>${DIRECT_RISK_COHORT.worlds.length}</strong><span>matched weekends</span></div>
        <div class="risk-plan-grid">
          ${renderRiskPlanCard("direct-repair", "Dispatcher chose", recorded)}
          ${renderRiskPlanCard("protect-weekend", "Override alternative", recorded)}
        </div>
        ${recorded ? `<div class="recorded risk-recorded" id="risk-confirmation" role="status" tabindex="-1">${receipt}</div>
          ${renderEventLog({ titleId: "risk-event-log-title", entries: state.eventLog, className: "risk-event-log" })}
          <button class="primary-button wide continue-button" type="button" data-action="continue-risk-world">See one Saturday</button>` : ""}
        ${renderRiskWhyDrawer()}`,
    })}
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
  const directAverage = DIRECT_RISK_COHORT.averageNetValueCents;
  const averageCost = directAverage - cohort.averageNetValueCents;
  const averageShare = Math.round((cohort.averageNetValueCents / directAverage) * 10_000) / 100;
  const action = planId === "direct-repair" ? "keep-risk" : "protect-risk";
  const button = planId === "direct-repair"
    ? "Keep · Direct repair"
    : "Override · Protect the weekend";
  return `<article class="risk-plan-card ${planId}" aria-label="${escapeHtml(plan.planName)} plan">
    <span class="choice-rank">${escapeHtml(rankLabel)}</span>
    <h2>${escapeHtml(plan.planName)}</h2>
    <div class="risk-plan-facts">
      ${renderRiskWorldGrid(cohort, routine, disruption)}
      <div class="risk-average" style="--risk-average-share: ${averageShare}%;">
        <div><span>Average</span><strong>${formatRiskMoney(cohort.averageNetValueCents)}</strong>${averageCost > 0 ? `<em>−${formatUnsignedRiskMoney(averageCost)} avg</em>` : ""}</div>
        <span class="risk-average-track" aria-hidden="true"><i></i></span>
      </div>
    </div>
    <button class="${planId === "direct-repair" ? "secondary-button" : "primary-button"} wide" type="button" data-action="${action}" ${disabled ? "disabled" : ""}>${button}</button>
  </article>`;
}

function renderRiskWorldGrid(
  cohort: RiskCohortResult,
  routine: RankedRiskPlan["outcomes"][number],
  disruption: RankedRiskPlan["outcomes"][number],
): string {
  const worldLabel = `${cohort.worlds.length} matched weekends: ${routine.worldCount} routine at ${formatRiskMoney(routine.netValueCents)}, ${disruption.worldCount} part delays at ${formatRiskMoney(disruption.netValueCents)}; ${cohort.lossLimitBreachCount} cross the ${formatUnsignedRiskMoney(cohort.lossLimitCents)} loss limit.`;
  const worlds = cohort.worlds.map((world) => {
    const outcome = world.condition === "ROUTINE_PART_AVAILABLE"
      ? "routine"
      : world.lossLimitBreached
      ? "breach"
      : "contained";
    return `<span class="risk-world-unit is-${outcome}" data-risk-world="${escapeHtml(world.worldId)}" data-risk-outcome="${outcome}" aria-hidden="true"></span>`;
  }).join("");
  const adverseOutcome = cohort.lossLimitBreachCount > 0 ? "breach" : "contained";
  const adverseLabel = cohort.weekendCoolingFailureCount > 0 ? "No cooling" : "Cooling on";
  return `<figure class="risk-world-figure">
    <div class="risk-world-units" role="img" aria-label="${escapeHtml(worldLabel)}">${worlds}</div>
    <figcaption class="risk-world-key">
      <span><i class="risk-key-unit is-routine" aria-hidden="true"></i><strong>${routine.worldCount}</strong><small>Friday cooling</small><b>${formatCompactRiskMoney(routine.netValueCents)}</b></span>
      <span><i class="risk-key-unit is-${adverseOutcome}" aria-hidden="true"></i><strong>${disruption.worldCount}</strong><small>${adverseLabel}</small><b>${formatCompactRiskMoney(disruption.netValueCents)}</b></span>
    </figcaption>
  </figure>`;
}

function renderRiskWhyDrawer(): string {
  const direct = requireRankedPlan("direct-repair");
  const protectedPlan = requireRankedPlan("protect-weekend");
  const directCohort = cohortFor("direct-repair");
  const protectedCohort = cohortFor("protect-weekend");
  const averageDifference = directCohort.averageNetValueCents - protectedCohort.averageNetValueCents;
  const directWorst = directCohort.worstNetValueCents;
  const lossLimit = formatUnsignedRiskMoney(directCohort.lossLimitCents);
  return `<details class="why-drawer risk-why">
    <summary>Why the optimiser chose direct repair</summary>
    <div class="why-content">
      <article class="why-block"><h3>Average across ${directCohort.worlds.length}</h3><p><strong>${formatRiskMoney(directCohort.averageNetValueCents)}</strong> versus <strong>${formatRiskMoney(protectedCohort.averageNetValueCents)}</strong>. Direct repair is higher by ${formatUnsignedRiskMoney(averageDifference)}, so the optimiser correctly preferred it.</p></article>
      <article class="why-block"><h3>Exact weighted-value calculation</h3><p><code>${escapeHtml(direct.weightedCalculation)}</code></p><p><code>${escapeHtml(protectedPlan.weightedCalculation)}</code></p><p class="policy-note">Decision ID: <code>${escapeHtml(RISK_PLAN_DECISION.decisionId)}</code> · reason: <code>${RISK_PLAN_DECISION.reasonCode}</code></p></article>
      <article class="why-block omitted"><h3>What it was not asked to decide</h3><p>Whether a ${formatRiskMoney(directWorst)} outcome exceeds this business's −${lossLimit} one-job limit. The loss limit is not part of the optimiser's objective.</p></article>
    </div>
  </details>`;
}

function renderNarratedWorld(state: RiskConsoleState): string {
  const comparison = requireComparison(state);
  const protectedChoice = state.planChoice === "protect-weekend";
  const player = comparison.narrative.player;
  const baseline = comparison.narrative.baseline;
  const worldCount = comparison.player.worlds.length;
  return `<main id="main-content" class="risk-shell phase-enter phase-risk-world">
    ${renderRiskSignals()}
    <section class="risk-outcome-panel" aria-labelledby="risk-world-title">
      <div class="event-heading"><div><p class="eyebrow">Observed Saturday · ${escapeHtml(formatRiskWorldLabel(player.worldId))}</p><h1 id="risk-world-title" tabindex="-1">${escapeHtml(player.coolingStatus)}</h1></div><span class="time-stamp">One world</span></div>
      <div class="one-world-comparison">
        ${protectedChoice
          ? `<p>Your protected plan returned <strong>${formatRiskMoney(player.netValueCents)}</strong>. The AI-only direct plan returned <strong>${formatRiskMoney(baseline.netValueCents)}</strong> in this same world.</p><p class="observed-difference"><strong>Observed difference today: ${formatRiskDifference(comparison.narrative.differenceCents)}.</strong></p>`
          : `<p>Direct repair returned <strong>${formatRiskMoney(player.netValueCents)}</strong> in this world.</p><p class="observed-difference"><strong>Observed difference today: ${formatRiskDifference(comparison.narrative.differenceCents)} from AI-only.</strong></p>`}
      </div>
      <div class="not-verdict"><strong>One Saturday is not the verdict.</strong><span>This fixed world is one of ${worldCount}. Restart will not reroll it.</span></div>
      <p class="world-evidence">Both plans received <code>${escapeHtml(player.condition)}</code> in <code>${escapeHtml(player.worldId)}</code>.</p>
      <button class="primary-button wide" type="button" data-action="open-risk-distribution">Replay ${worldCount} matched weekends</button>
    </section>
    ${renderRiskProvenance()}
  </main>`;
}

function renderDistribution(state: RiskConsoleState): string {
  const comparison = requireComparison(state);
  const direct = cohortFor("direct-repair");
  const protectedPlan = cohortFor("protect-weekend");
  const totalWorlds = comparison.player.worlds.length;
  const routineWorlds = countWorlds(direct, "ROUTINE_PART_AVAILABLE");
  const disruptionWorlds = countWorlds(direct, "PART_UNAVAILABLE_UNTIL_MONDAY");
  const allValues = [...direct.worlds, ...protectedPlan.worlds].map((world) => world.netValueCents);
  const minimumValue = Math.min(...allValues);
  const maximumValue = Math.max(...allValues);
  const lossLimitPosition = valuePosition(minimumValue, maximumValue, -direct.lossLimitCents);
  return `<main id="main-content" class="risk-shell phase-enter phase-risk-distribution">
    ${renderRiskSignals()}
    <section class="distribution-panel" aria-labelledby="distribution-title">
      <div class="ledger-heading"><div><p class="eyebrow">Policy replay · ${totalWorlds} matched worlds</p><h1 id="distribution-title" tabindex="-1">One story inside the whole distribution</h1></div><span class="not-score">No overall score</span></div>
      <p class="trace-intro">Under this authored ${disruptionWorlds}-in-${totalWorlds} assumption, both plans face the same ${routineWorlds} routine worlds and the same ${disruptionWorlds} part-delay worlds. The strips show all weighted worlds at once; they are not sampled runs.</p>
      <div class="outcome-strips" aria-label="Matched ${totalWorlds}-world outcomes for both plans">
        ${renderOutcomeStrip(direct)}
        ${renderOutcomeStrip(protectedPlan)}
        <div class="loss-ruler" style="--risk-loss-limit-position: ${lossLimitPosition}%;" aria-label="One-job loss limit at ${formatRiskMoney(direct.lossLimitCents * -1)}">
          <span class="ruler-min">${formatCompactRiskMoney(minimumValue)}</span><span class="ruler-line" aria-hidden="true"></span><strong>Loss limit · ${formatCompactRiskMoney(-direct.lossLimitCents)}</strong><span class="ruler-max">${formatCompactRiskMoney(maximumValue)}</span>
        </div>
      </div>
      <div class="distribution-callout"><strong>${direct.lossLimitBreachCount} vs ${protectedPlan.lossLimitBreachCount} limit breaches</strong><span>${describeLossLimitCoverage(direct, "Direct repair")} ${describeLossLimitCoverage(protectedPlan, "Weekend protection")}</span></div>
      <button class="primary-button wide" type="button" data-action="open-risk-debrief">Open policy debrief</button>
    </section>
    ${renderRiskProvenance()}
  </main>`;
}

function renderOutcomeStrip(cohort: RiskCohortResult): string {
  const plan = requireRankedPlan(cohort.planId);
  const routine = requireOutcome(plan, "ROUTINE_PART_AVAILABLE");
  const disruption = requireOutcome(plan, "PART_UNAVAILABLE_UNTIL_MONDAY");
  const routineWeight = weightForCondition(cohort, "ROUTINE_PART_AVAILABLE");
  const disruptionWeight = weightForCondition(cohort, "PART_UNAVAILABLE_UNTIL_MONDAY");
  return `<article class="outcome-strip-row ${cohort.planId}">
    <header><h2>${escapeHtml(cohort.planName)}</h2><span>${cohort.planId === "direct-repair" ? "AI plan · higher average" : "Protected plan · bounded downside"}</span></header>
    <p class="sr-only">${routine.worldCount} of ${cohort.worlds.length} routine worlds: ${escapeHtml(routine.coolingStatus)}, ${formatRiskMoney(routine.netValueCents)}. ${disruption.worldCount} of ${cohort.worlds.length} part-delay worlds: ${escapeHtml(disruption.coolingStatus)}, ${formatRiskMoney(disruption.netValueCents)}.</p>
    <div class="outcome-strip" style="--risk-routine-weight: ${routineWeight}fr; --risk-disruption-weight: ${disruptionWeight}fr;" aria-hidden="true">
      <div class="outcome-segment routine"><strong>${routine.worldCount} routine</strong><span>${formatRiskMoney(routine.netValueCents)}</span><i>Observed Saturday · ${escapeHtml(RISK_APPETITE_CASE.narrativeWorldId)}</i></div>
      <div class="outcome-segment disruption"><strong>${disruption.worldCount} part delays</strong><span>${formatRiskMoney(disruption.netValueCents)}</span></div>
    </div>
    <dl class="strip-summary">
      <div><dt>Average across ${cohort.worlds.length}</dt><dd>${formatRiskMoney(cohort.averageNetValueCents)}</dd></div>
      <div><dt>Worst</dt><dd>${formatRiskMoney(cohort.worstNetValueCents)}</dd></div>
      <div class="strip-breaches"><dt>Beyond limit</dt><dd>${cohort.lossLimitBreachCount} of ${cohort.worlds.length}</dd></div>
      <div><dt>Weekend cooling failures</dt><dd>${cohort.weekendCoolingFailureCount}</dd></div>
    </dl>
  </article>`;
}

function renderRiskDebrief(state: RiskConsoleState): string {
  const comparison = requireComparison(state);
  const protectedChoice = state.planChoice === "protect-weekend";
  const playerLabel = protectedChoice ? "Your protected plan" : "Your direct plan";
  const averageTrade = Math.abs(comparison.policyDelta.averageNetValueCents);
  const worstImprovement = comparison.baseline.worstNetValueCents - comparison.player.worstNetValueCents;
  const worldCount = comparison.player.worlds.length;
  const lossLimit = formatUnsignedRiskMoney(comparison.player.lossLimitCents);
  const playerAverage = formatRiskMoney(comparison.player.averageNetValueCents);
  const playerWorst = formatRiskMoney(comparison.player.worstNetValueCents);
  const narrativeDifference = formatUnsignedRiskMoney(Math.abs(comparison.narrative.differenceCents));
  const summary = protectedChoice
    ? `At 3:25 PM you gave up ${formatUnsignedRiskMoney(averageTrade)} of average value to reduce the worst result by ${formatUnsignedRiskMoney(worstImprovement)}. ${describeProtectedPolicy(comparison.player, lossLimit)} It cost ${narrativeDifference} in the Saturday you saw.`
    : `At 3:25 PM you kept direct repair. The optimiser did its job: ${playerAverage} is the higher average. The business's loss limit was not applied, leaving ${comparison.player.lossLimitBreachCount} of ${worldCount} worlds at ${playerWorst}. This Saturday happened to work. The lucky result did not make the exposure compliant with the stated policy.`;
  const verdict = protectedChoice
    ? `This Saturday cost ${narrativeDifference} more than the AI-only plan. ${describeProtectedPolicy(comparison.player, lossLimit)} One outcome does not grade a risk decision.`
    : `The optimiser chose the higher average correctly. The plan still crossed the business's stated loss limit in ${comparison.player.lossLimitBreachCount} worlds. One lucky outcome does not grade a risk decision.`;
  return `<main id="main-content" class="risk-shell phase-enter phase-risk-debrief">
    <section class="debrief-panel risk-debrief-panel" aria-labelledby="risk-debrief-title">
      <div class="ledger-heading"><div><p class="eyebrow">Causal debrief · branch ledger</p><h1 id="risk-debrief-title" tabindex="-1">Friday 3:25 PM · Weekend plan</h1></div><span class="not-score">No overall score</span></div>
      <p class="debrief-position">${protectedChoice ? "You traded average value for a bounded downside." : "You kept the plan with the higher average."}</p>
      ${renderComparisonLedger(`Observed world · ${formatRiskWorldLabel(comparison.narrativeWorldId)}`, [
        ["Cooling", comparison.narrative.player.coolingStatus, comparison.narrative.baseline.coolingStatus],
        [`Net value in ${formatRiskWorldLabel(comparison.narrativeWorldId)}`, formatRiskMoney(comparison.narrative.player.netValueCents), formatRiskMoney(comparison.narrative.baseline.netValueCents)],
        ["Difference today", formatRiskDifference(comparison.narrative.differenceCents), "Baseline"],
      ], playerLabel)}
      ${renderComparisonLedger(`Policy ledger · ${worldCount} matched worlds`, [
        [`Average across ${worldCount}`, formatRiskMoney(comparison.player.averageNetValueCents), formatRiskMoney(comparison.baseline.averageNetValueCents)],
        ["Worst result", formatRiskMoney(comparison.player.worstNetValueCents), formatRiskMoney(comparison.baseline.worstNetValueCents)],
        [`Outcomes beyond the −${lossLimit} limit`, String(comparison.player.lossLimitBreachCount), String(comparison.baseline.lossLimitBreachCount)],
        ["Client without cooling through weekend", String(comparison.player.weekendCoolingFailureCount), String(comparison.baseline.weekendCoolingFailureCount)],
      ], playerLabel)}
      <div class="causal-summary"><strong>The only branch difference</strong><span>${escapeHtml(summary)}</span></div>
      <blockquote class="risk-verdict">${escapeHtml(verdict)}</blockquote>
      ${renderHonestLimits("risk-honest-limits-title")}
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
  const worldCount = comparison.player.worlds.length;
  const totalWeight = comparison.player.worlds.reduce((total, world) => total + world.weightBasisPoints, 0);
  const routineWorlds = countWorlds(comparison.player, "ROUTINE_PART_AVAILABLE");
  const disruptionWorlds = countWorlds(comparison.player, "PART_UNAVAILABLE_UNTIL_MONDAY");
  return `<main id="main-content" class="trace-shell phase-enter phase-risk-trace">
    <header class="trace-heading"><div><p class="eyebrow">Reading depth four · reproducible trace</p><h1 tabindex="-1">Risk replay trace</h1></div><button class="secondary-button" type="button" data-action="close-risk-trace">Back to debrief</button></header>
    <p class="trace-intro">This trace exposes the fixed narrative world, explicit ${worldCount}-world manifest, exact plan inputs, paired outcomes, and aggregate fingerprint. The authored likelihood is an assumption, not a measured or predicted failure rate.</p>
    <dl class="trace-facts">
      <div><dt>Case version</dt><dd><code>${escapeHtml(comparison.caseVersion)}</code></dd></div>
      <div><dt>Narrative world</dt><dd><code>${escapeHtml(comparison.narrativeWorldId)}</code></dd></div>
      <div><dt>World manifest</dt><dd>${worldCount} worlds · ${totalWeight.toLocaleString("en-US")} basis points · ${routineWorlds} routine / ${disruptionWorlds} part delay</dd></div>
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
    <nav class="source-links" aria-label="Risk engine source and tests"><a href="https://github.com/connectwithclayton/windward/blob/main/src/risk.ts">Open risk engine source</a><a href="https://github.com/connectwithclayton/windward/blob/main/test/risk.test.mjs">Open risk replay tests</a></nav>
    ${renderRiskProvenance()}
  </main>`;
}

function renderJsonPanel(title: string, value: unknown): string {
  return `<details class="json-panel"><summary>${escapeHtml(title)}</summary><pre><code>${escapeHtml(JSON.stringify(value, null, 2))}</code></pre></details>`;
}

function renderRiskProvenance(): string {
  const cohort = DIRECT_RISK_COHORT;
  const disruptionWorlds = countWorlds(cohort, "PART_UNAVAILABLE_UNTIL_MONDAY");
  const lossLimit = formatUnsignedRiskMoney(cohort.lossLimitCents);
  return `<footer class="provenance"><strong>Focused simulation, fictional data.</strong> The ${disruptionWorlds} marked weekends, ${lossLimit} loss limit, plans, outcomes, and money are authored assumptions—not real HVAC pricing, actuarial evidence, or advice. Windward does not show how any real vendor model behaves. This independent portfolio project is not affiliated with, endorsed by, or built for any company.</footer>`;
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

function formatUnsignedRiskMoney(cents: number): string {
  return `$${Math.abs(cents / 100).toLocaleString("en-US")}`;
}

function formatCompactRiskMoney(cents: number): string {
  const sign = cents < 0 ? "−" : cents > 0 ? "+" : "";
  const dollars = Math.abs(cents / 100);
  return dollars >= 1_000 && dollars % 1_000 === 0
    ? `${sign}$${dollars / 1_000}k`
    : `${sign}$${dollars.toLocaleString("en-US")}`;
}

function formatRiskWorldLabel(worldId: string): string {
  return worldId.replace(/^world-/, "world ");
}

function describeLossLimitCoverage(cohort: RiskCohortResult, subject: string): string {
  return cohort.lossLimitBreachCount === 0
    ? `${subject} keeps all ${cohort.worlds.length} replayed worlds inside the stated boundary.`
    : `${subject} crosses the stated boundary in ${cohort.lossLimitBreachCount} worlds.`;
}

function describeProtectedPolicy(cohort: RiskCohortResult, lossLimit: string): string {
  return cohort.lossLimitBreachCount === 0
    ? `Your decision was still sound under the stated ${lossLimit} loss limit: ${describeLossLimitCoverage(cohort, "it")}`
    : `Your decision reduced downside but still exceeded the stated ${lossLimit} loss limit: ${describeLossLimitCoverage(cohort, "it")}`;
}

function countWorlds(cohort: RiskCohortResult, condition: RiskWorldCondition): number {
  return cohort.worlds.filter((world) => world.condition === condition).length;
}

function weightForCondition(cohort: RiskCohortResult, condition: RiskWorldCondition): number {
  return cohort.worlds
    .filter((world) => world.condition === condition)
    .reduce((total, world) => total + world.weightBasisPoints, 0);
}

function valuePosition(minimum: number, maximum: number, value: number): number {
  if (maximum <= minimum) return 50;
  const position = ((value - minimum) / (maximum - minimum)) * 100;
  return Math.round(Math.min(100, Math.max(0, position)) * 100) / 100;
}
