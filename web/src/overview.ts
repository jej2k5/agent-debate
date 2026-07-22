import { ApiError, createDebate, fetchOverview } from "./api";
import { conclusionSummary, escapeHtml, refreshTimestamps, slugify, timeSpan } from "./format";
import { bindSystemActions, launchButton, startBridgeButton, systemStrip } from "./system";
import type { Agents, BridgeStatus, DebateListItem, Overview } from "./types";

const REGISTER_CLAUDE = "~/.local/share/claude-codex-debate/venv/bin/debate-bridge register claude && claude";
const REGISTER_CODEX = "~/.local/share/claude-codex-debate/venv/bin/debate-bridge register codex && codex";
const START_BRIDGE = "~/.local/share/claude-codex-debate/venv/bin/debate-bridge start";

function statePill(debate: DebateListItem): string {
  if (debate.status === "completed") {
    const label = debate.resolution_type === "agreement" ? "Agreement" : "Agreed to disagree";
    return `<span class="pill pill--done">${label}</span>`;
  }
  if (debate.pending_resolution) {
    const other = debate.pending_resolution.proposer === "claude" ? "Codex" : "Claude";
    return `<span class="pill pill--waiting"><span class="dot dot--pending"></span>Resolution awaiting ${other}</span>`;
  }
  const joined = Object.keys(debate.participants).length;
  if (joined < 2) {
    return `<span class="pill pill--waiting"><span class="dot dot--pending"></span>Awaiting ${
      joined === 0 ? "both agents" : debate.participants.claude ? "Codex" : "Claude"
    }</span>`;
  }
  const turn = debate.current_turn;
  const cls = turn === "claude" ? "claude" : "codex";
  const name = turn === "claude" ? "Claude" : "Codex";
  return `<span class="pill pill--${cls}"><span class="dot dot--${cls}"></span>${name}&#8217;s turn</span>`;
}

function ledgerRow(debate: DebateListItem): string {
  const participants =
    Object.keys(debate.participants).length === 2
      ? "claude &middot; codex"
      : Object.keys(debate.participants).join(" &middot; ") || "no agents yet";
  const messages =
    debate.message_count === 1 ? "1 message" : `${debate.message_count} messages`;
  const undelivered =
    debate.undelivered_count > 0
      ? `<span class="mono" style="color: var(--pending)">${debate.undelivered_count} undelivered</span>`
      : "";
  const outcome =
    debate.status === "completed" && debate.resolution_summary
      ? `<span class="ledger-outcome" title="${escapeHtml(
          debate.resolution_summary,
        )}">${escapeHtml(conclusionSummary(debate.resolution_summary))}</span>`
      : "";
  return `
    <a class="ledger-row" href="#/d/${encodeURIComponent(debate.id)}" title="${escapeHtml(debate.topic)}">
      <span class="ledger-topic">${escapeHtml(debate.topic)}</span>
      <span class="ledger-meta">
        <span>${escapeHtml(debate.id)}</span>
        <span>${participants}</span>
        <span>${messages}</span>
        ${undelivered}
        ${timeSpan(debate.updated_at)}
      </span>
      ${outcome}
      <span class="ledger-state">${statePill(debate)}</span>
    </a>`;
}

function emptyStep(n: number, done: boolean, doneLabel: string, action: string): string {
  const body = done
    ? `<span class="empty-done">${doneLabel}</span>`
    : action;
  return `<div class="empty-step"><span class="empty-step-n">${n}</span><div class="empty-step-body">${body}</div></div>`;
}

function emptyState(agents: Agents, bridge: BridgeStatus): string {
  return `
    <section class="empty">
      <h2>No debates yet</h2>
      <p>Open a terminal for each agent, start the bridge, then create a debate here &#8212; the agents join it from their own terminals.</p>
      <div class="empty-steps">
        ${emptyStep(1, agents.claude?.running ?? false, "Claude is running", launchButton("claude", "Launch Claude&#8217;s terminal"))}
        ${emptyStep(2, agents.codex?.running ?? false, "Codex is running", launchButton("codex", "Launch Codex&#8217;s terminal"))}
        ${emptyStep(3, bridge.running, "Bridge is running", startBridgeButton("Start the bridge"))}
      </div>
      <span class="form-error" role="alert" data-system-error></span>
      <details class="empty-manual">
        <summary>Or run the commands manually</summary>
        <code>${escapeHtml(REGISTER_CLAUDE)}</code>
        <code>${escapeHtml(REGISTER_CODEX)}</code>
        <code>${escapeHtml(START_BRIDGE)}</code>
      </details>
    </section>`;
}

export class OverviewView {
  private root: HTMLElement;
  private data: Overview | null = null;
  private formOpen = false;
  private submitting = false;

  constructor(root: HTMLElement) {
    this.root = root;
    this.root.innerHTML = `
      <div class="overview">
        <div class="overview-head">
          <h1 tabindex="-1">Debates</h1>
          <span class="overview-count" data-count></span>
        </div>
        <div data-system></div>
        <button class="create-toggle" type="button" data-create-toggle aria-expanded="false">
          <span aria-hidden="true">+</span> New debate
        </button>
        <div data-form-slot></div>
        <div data-list>
          <div class="ledger" aria-hidden="true">
            <div class="skeleton" style="height: 3.4rem; margin-block: var(--s3)"></div>
            <div class="skeleton" style="height: 3.4rem; margin-block: var(--s3); opacity: 0.7"></div>
            <div class="skeleton" style="height: 3.4rem; margin-block: var(--s3); opacity: 0.4"></div>
          </div>
        </div>
      </div>`;
    this.root
      .querySelector("[data-create-toggle]")!
      .addEventListener("click", () => this.toggleForm());
  }

  focusHeading(): void {
    this.root.querySelector<HTMLElement>("h1")?.focus({ preventScroll: true });
  }

  async refresh(): Promise<void> {
    try {
      this.data = await fetchOverview();
    } catch {
      // Connection loss is surfaced by the shell banner; keep the last data.
      return;
    }
    this.renderList();
  }

  private toggleForm(): void {
    this.formOpen = !this.formOpen;
    const toggle = this.root.querySelector<HTMLButtonElement>("[data-create-toggle]")!;
    toggle.setAttribute("aria-expanded", String(this.formOpen));
    this.renderForm();
    if (this.formOpen) {
      this.root.querySelector<HTMLInputElement>("[data-topic]")?.focus();
    }
  }

  private renderForm(): void {
    const slot = this.root.querySelector("[data-form-slot]")!;
    if (!this.formOpen) {
      slot.innerHTML = "";
      return;
    }
    slot.innerHTML = `
      <form class="create-form">
        <div class="form-row">
          <div class="field">
            <label for="new-topic">Topic</label>
            <input id="new-topic" data-topic required placeholder="Should this service use a modular monolith or microservices?" autocomplete="off" />
          </div>
          <div class="field">
            <label for="new-first">Opening speaker</label>
            <select id="new-first" data-first>
              <option value="claude">Claude</option>
              <option value="codex">Codex</option>
            </select>
          </div>
        </div>
        <div class="form-row">
          <div class="field">
            <label for="new-id">Debate id</label>
            <input id="new-id" data-id class="mono" required pattern="[A-Za-z0-9._\-]+" placeholder="monolith-vs-microservices" autocomplete="off" spellcheck="false" />
            <span class="hint">The agents join with this id; letters, digits, dots, dashes.</span>
          </div>
        </div>
        <div class="create-actions">
          <button class="btn btn--primary" type="submit" data-submit>Create debate</button>
          <button class="btn btn--ghost" type="button" data-cancel>Cancel</button>
          <span class="form-error" role="alert" data-error></span>
        </div>
      </form>`;
    const form = slot.querySelector("form")!;
    const topic = slot.querySelector<HTMLInputElement>("[data-topic]")!;
    const idField = slot.querySelector<HTMLInputElement>("[data-id]")!;
    let idTouched = false;
    topic.addEventListener("input", () => {
      if (!idTouched) idField.value = slugify(topic.value);
    });
    idField.addEventListener("input", () => {
      idTouched = idField.value.length > 0;
    });
    slot.querySelector("[data-cancel]")!.addEventListener("click", () => this.toggleForm());
    form.addEventListener("keydown", (event) => {
      if (event.key === "Escape") {
        event.stopPropagation();
        this.toggleForm();
        this.root.querySelector<HTMLButtonElement>("[data-create-toggle]")?.focus();
      }
    });
    form.addEventListener("submit", (event) => {
      event.preventDefault();
      void this.submit(form);
    });
  }

  private async submit(form: HTMLFormElement): Promise<void> {
    if (this.submitting) return;
    const topic = form.querySelector<HTMLInputElement>("[data-topic]")!.value.trim();
    const id = form.querySelector<HTMLInputElement>("[data-id]")!.value.trim();
    const first = form.querySelector<HTMLSelectElement>("[data-first]")!.value;
    const button = form.querySelector<HTMLButtonElement>("[data-submit]")!;
    const errorSlot = form.querySelector<HTMLElement>("[data-error]")!;
    this.submitting = true;
    button.disabled = true;
    button.textContent = "Creating…";
    errorSlot.textContent = "";
    try {
      const debate = await createDebate(id, topic, first);
      window.location.hash = `#/d/${encodeURIComponent(debate.id)}`;
    } catch (error) {
      errorSlot.textContent =
        error instanceof ApiError && error.status === 409
          ? `A debate named ${id} already exists. Pick a different id.`
          : error instanceof Error
            ? error.message
            : "Couldn't create the debate.";
      button.disabled = false;
      button.textContent = "Create debate";
    } finally {
      this.submitting = false;
    }
  }

  private renderList(): void {
    if (!this.data) return;
    const list = this.root.querySelector<HTMLElement>("[data-list]")!;
    const count = this.root.querySelector<HTMLElement>("[data-count]")!;
    const system = this.root.querySelector<HTMLElement>("[data-system]")!;
    const debates = this.data.debates;
    count.textContent = debates.length === 0 ? "" : `${debates.length} total`;
    if (debates.length === 0) {
      // The empty state carries its own launch controls; skip the strip.
      system.innerHTML = "";
      list.innerHTML = emptyState(this.data.agents, this.data.bridge);
      bindSystemActions(list);
      return;
    }
    system.innerHTML = systemStrip(this.data.agents, this.data.bridge);
    bindSystemActions(system);
    list.innerHTML = `<nav class="ledger" aria-label="Debates">${debates
      .map(ledgerRow)
      .join("")}</nav>`;
    refreshTimestamps(list);
  }
}
