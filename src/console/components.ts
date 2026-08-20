export type SurfaceTag = "article" | "aside" | "div" | "section";
export type ComponentTone = "neutral" | "accent" | "warning" | "danger" | "quiet";

export interface SurfaceView {
  readonly tag?: SurfaceTag;
  readonly className?: string;
  readonly labelledBy?: string;
  readonly role?: string;
  readonly content: string;
}

export interface StatCellView {
  readonly label: string;
  readonly value: string;
  readonly detail?: string;
  readonly className?: string;
  readonly tone?: ComponentTone;
}

export interface LabelledFieldView {
  readonly label: string;
  readonly value: string;
  readonly className?: string;
}

export interface BadgeView {
  readonly label: string;
  readonly icon?: string;
  readonly tone?: ComponentTone;
  readonly className?: string;
}

export interface DecisionPanelView {
  readonly titleId: string;
  readonly eyebrow: string;
  readonly title: string;
  readonly content: string;
  readonly badge?: BadgeView;
  readonly className?: string;
  readonly contentClassName?: string;
}

export interface EventLogView {
  readonly titleId: string;
  readonly entries: readonly string[];
  readonly className?: string;
  readonly hideWhenEmpty?: boolean;
  readonly emptyLabel?: string;
}

export function renderSurface(view: SurfaceView): string {
  const tag = view.tag ?? "section";
  return `<${tag} class="surface${classSuffix(view.className)}"${attribute("aria-labelledby", view.labelledBy)}${attribute("role", view.role)}>${view.content}</${tag}>`;
}

export function renderStatCell(view: StatCellView): string {
  const tone = view.tone ?? "neutral";
  return `<div class="stat-cell tone-${tone}${classSuffix(view.className)}">
    <span class="component-label">${escapeHtml(view.label)}</span>
    <strong>${escapeHtml(view.value)}</strong>
    ${view.detail === undefined ? "" : `<small>${escapeHtml(view.detail)}</small>`}
  </div>`;
}

export function renderLabelledField(view: LabelledFieldView): string {
  return `<div class="labelled-field${classSuffix(view.className)}"><dt class="component-label">${escapeHtml(view.label)}</dt><dd>${escapeHtml(view.value)}</dd></div>`;
}

export function renderBadge(view: BadgeView): string {
  const tone = view.tone ?? "neutral";
  return `<span class="badge tone-${tone}${classSuffix(view.className)}">${view.icon === undefined ? "" : `<span aria-hidden="true">${escapeHtml(view.icon)}</span>`}${escapeHtml(view.label)}</span>`;
}

export function renderDecisionPanel(view: DecisionPanelView): string {
  return `<section class="surface decision-panel${classSuffix(view.className)}" aria-labelledby="${escapeHtml(view.titleId)}">
    <header class="decision-header">
      <p class="eyebrow">${escapeHtml(view.eyebrow)}</p>
      <h1 id="${escapeHtml(view.titleId)}" tabindex="-1">${escapeHtml(view.title)}</h1>
      ${view.badge === undefined ? "" : renderBadge(view.badge)}
    </header>
    <div class="decision-content${classSuffix(view.contentClassName)}">${view.content}</div>
  </section>`;
}

export function renderEventLog(view: EventLogView): string {
  if (view.entries.length === 0 && view.hideWhenEmpty === true) return "";
  const entries = view.entries.length === 0
    ? [view.emptyLabel ?? "No decisions recorded yet."]
    : view.entries;
  return `<aside class="surface event-log${classSuffix(view.className)}" aria-labelledby="${escapeHtml(view.titleId)}">
    <h2 id="${escapeHtml(view.titleId)}">Event log</h2>
    <ol aria-live="polite">${entries.map((entry) => `<li class="log-entry">${escapeHtml(entry)}</li>`).join("")}</ol>
  </aside>`;
}

export function renderHonestLimits(titleId: string): string {
  return `<aside class="honest-limits" aria-labelledby="${escapeHtml(titleId)}">
    <p class="eyebrow">Scope boundary</p>
    <h2 id="${escapeHtml(titleId)}">What this authored case study does not prove</h2>
    <p class="honest-limits-lede">Windward uses a deliberately myopic simulated dispatcher. It does not show how any real vendor's model behaves, and it is not a faithful production dispatcher or a claim about the full complexity of field-service operations.</p>
    <dl>
      <div><dt>Simulation limits</dt><dd>It is not a real-time system or a model-powered or procedural simulation.</dd></div>
      <div><dt>Product limits</dt><dd>It is not a backend service, an account system, a persistent product, or a system of record.</dd></div>
      <div><dt>What is actually here</dt><dd>The deployable product is a static client that consumes the pure engine package. It has no backend, accounts, database, or persistence. This zero-infrastructure architecture is intentional.</dd></div>
    </dl>
  </aside>`;
}

export function escapeHtml(value: unknown): string {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function attribute(name: string, value: string | undefined): string {
  return value === undefined ? "" : ` ${name}="${escapeHtml(value)}"`;
}

function classSuffix(value: string | undefined): string {
  return value === undefined || value.trim() === "" ? "" : ` ${escapeHtml(value.trim())}`;
}
