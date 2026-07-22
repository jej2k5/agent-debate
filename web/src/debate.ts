import { ApiError, fetchDebate, interject, kickoffDebate } from "./api";
import {
  conclusionSummary,
  escapeHtml,
  isMacPlatform,
  participantName,
  refreshTimestamps,
  renderRich,
  timeSpan,
} from "./format";
import { announce } from "./announce";
import { agentStateLabel, bindSystemActions, launchButton, startBridgeButton } from "./system";
import type { DebateDetail, Message, Participant } from "./types";

function kickoffPrompt(agent: Participant, debateId: string): string {
  const skill = agent === "claude" ? "Use the debate-peer skill." : "Use $debate-peer.";
  return `${skill} Join debate ${debateId}. Choose your own position and continue until you agree or explicitly agree to disagree.`;
}

export class DebateView {
  private root: HTMLElement;
  private debateId: string;
  private data: DebateDetail | null = null;
  private lastMaxId = 0;
  private firstRender = true;
  private optimistic: Message | null = null;
  private composerError = "";
  private notFound = false;
  private renderedDelivered = new Map<number, boolean>();
  private optimisticEl: HTMLElement | null = null;
  private announcedMaxId: number | null = null;
  private announcedResolutionId: number | null = null;
  private announcedStatus: string | null = null;

  constructor(root: HTMLElement, debateId: string) {
    this.root = root;
    this.debateId = debateId;
    this.root.innerHTML = `
      <div class="room">
        <div class="transcript-col">
          <header class="room-head">
            <h1 data-topic tabindex="-1"><span class="skeleton" style="display:inline-block;width:18ch;height:1.2em"></span></h1>
            <div class="room-sub" data-sub></div>
          </header>
          <div class="transcript" data-transcript>
            <div class="transcript-part" data-messages></div>
            <div class="transcript-part" data-tail></div>
          </div>
          <div class="composer-wrap" data-composer-wrap hidden></div>
        </div>
        <aside class="rail" data-rail aria-label="Debate state"></aside>
      </div>`;
  }

  focusHeading(): void {
    this.root.querySelector<HTMLElement>("[data-topic]")?.focus({ preventScroll: true });
  }

  async refresh(): Promise<void> {
    try {
      this.data = await fetchDebate(this.debateId);
    } catch (error) {
      if (error instanceof ApiError && error.status === 404) {
        this.notFound = true;
        this.renderNotFound();
      }
      return;
    }
    if (this.notFound) return;
    // A confirmed server copy supersedes the optimistic row.
    if (
      this.optimistic &&
      this.data.messages.some(
        (m) => m.sender === "moderator" && m.content === this.optimistic!.content,
      )
    ) {
      this.optimistic = null;
    }
    this.announceChanges();
    this.render();
  }

  /** Screen-reader narration of live events; silent on the first load. */
  private announceChanges(): void {
    if (!this.data) return;
    const { debate, messages } = this.data;
    const maxId = messages.reduce((max, m) => Math.max(max, m.id), 0);
    const resolutionId = debate.pending_resolution?.id ?? null;
    if (this.announcedMaxId === null) {
      this.announcedMaxId = maxId;
      this.announcedResolutionId = resolutionId;
      this.announcedStatus = debate.status;
      return;
    }
    for (const message of messages) {
      if (message.id > this.announcedMaxId && message.sender !== "moderator") {
        announce(`${participantName(message.sender)} replied`);
      }
    }
    this.announcedMaxId = maxId;
    if (resolutionId !== this.announcedResolutionId && debate.pending_resolution) {
      const res = debate.pending_resolution;
      const other = res.proposer === "claude" ? "Codex" : "Claude";
      announce(`Resolution proposed by ${participantName(res.proposer)}, awaiting ${other}`);
    }
    this.announcedResolutionId = resolutionId;
    if (debate.status !== this.announcedStatus && debate.status === "completed") {
      announce(
        debate.resolution_type === "agreement" ? "Agreement reached" : "Agreed to disagree",
      );
    }
    this.announcedStatus = debate.status;
  }

  private renderNotFound(): void {
    this.root.innerHTML = `
      <div class="overview">
        <section class="empty">
          <h2>Debate not found</h2>
          <p>No debate named <code>${escapeHtml(this.debateId)}</code> exists in the relay.</p>
          <p style="margin-top: var(--s4)"><a href="#/">Back to debates</a></p>
        </section>
      </div>`;
  }

  private nearBottom(): boolean {
    return window.innerHeight + window.scrollY >= document.body.scrollHeight - 200;
  }

  private render(): void {
    if (!this.data) return;
    const { debate } = this.data;
    const wasNearBottom = this.nearBottom();

    const topicSlot = this.root.querySelector<HTMLElement>("[data-topic]")!;
    if (topicSlot.textContent !== debate.topic) topicSlot.textContent = debate.topic;
    const title = `${debate.topic} — Agent Debate`;
    if (document.title !== title) document.title = title;

    this.root.querySelector<HTMLElement>("[data-sub]")!.innerHTML = [
      `<span>${escapeHtml(debate.id)}</span>`,
      `<span>opened ${timeSpan(debate.created_at)}</span>`,
      debate.status === "completed"
        ? `<span class="pill pill--done">${
            debate.resolution_type === "agreement" ? "Agreement" : "Agreed to disagree"
          }</span>`
        : "",
    ]
      .filter(Boolean)
      .join("");

    this.renderTranscript();
    this.renderRail();
    bindSystemActions(this.root.querySelector<HTMLElement>("[data-rail]")!);
    this.renderComposer();
    refreshTimestamps(this.root);

    const maxId = (this.data?.messages ?? []).reduce((max, m) => Math.max(max, m.id), 0);
    const hasNew = maxId > this.lastMaxId;
    if (this.firstRender) {
      window.scrollTo({ top: document.body.scrollHeight });
    } else if (hasNew && wasNearBottom) {
      window.scrollTo({ top: document.body.scrollHeight, behavior: "smooth" });
    } else if (hasNew) {
      this.showNewBelow();
    }
    this.lastMaxId = Math.max(this.lastMaxId, maxId);
    this.firstRender = false;
  }

  private messageHtml(message: Message): string {
    const isNew = message.id > this.lastMaxId && !this.firstRender;
    const sender = message.sender;
    const cls =
      sender === "moderator" ? "msg--moderator" : sender === "claude" ? "msg--claude" : "msg--codex";
    const pendingCls = message.optimistic ? " is-pending" : "";
    const newCls = isNew ? " is-new" : "";
    const undelivered =
      !message.delivered_at && !message.optimistic && this.data?.debate.status === "running"
        ? `<span class="msg-delivery" data-delivery>awaiting delivery to ${participantName(message.recipient)}</span>`
        : "";
    const sending = message.optimistic ? `<span class="msg-delivery">sending&hellip;</span>` : "";
    const time = message.optimistic ? "" : timeSpan(message.created_at, "msg-time");
    return `
      <article class="msg ${cls}${pendingCls}${newCls}" data-msg-id="${message.optimistic ? "optimistic" : message.id}">
        <div class="msg-head">
          <h2 class="msg-speaker">${participantName(sender)}</h2>
          ${time}
          ${undelivered}
          ${sending}
        </div>
        <div class="msg-body">${renderRich(message.content)}</div>
      </article>`;
  }

  private renderTranscript(): void {
    if (!this.data) return;
    const { debate } = this.data;
    const messagesEl = this.root.querySelector<HTMLElement>("[data-messages]")!;
    const joined = Object.keys(debate.participants) as Participant[];

    // Incremental: append only unseen messages, update delivery badges in place.
    // Keeps text selection and screen-reader position stable during live updates.
    for (const message of this.data.messages) {
      const delivered = Boolean(message.delivered_at);
      if (!this.renderedDelivered.has(message.id)) {
        messagesEl.insertAdjacentHTML("beforeend", this.messageHtml(message));
        this.renderedDelivered.set(message.id, delivered);
      } else if (delivered && this.renderedDelivered.get(message.id) === false) {
        messagesEl.querySelector(`[data-msg-id="${message.id}"] [data-delivery]`)?.remove();
        this.renderedDelivered.set(message.id, delivered);
      }
    }
    if (this.optimistic && !this.optimisticEl) {
      messagesEl.insertAdjacentHTML("beforeend", this.messageHtml(this.optimistic));
      this.optimisticEl = messagesEl.querySelector<HTMLElement>('[data-msg-id="optimistic"]');
    } else if (!this.optimistic && this.optimisticEl) {
      this.optimisticEl.remove();
      this.optimisticEl = null;
    }
    // The debate completing retires every "awaiting delivery" badge at once.
    if (debate.status !== "running") {
      messagesEl.querySelectorAll("[data-delivery]").forEach((node) => node.remove());
    }

    const parts: string[] = [];

    if (debate.status === "running" && joined.length < 2) {
      const roster = ["claude", "codex"] as Participant[];
      const registered = (agent: Participant) => Boolean(this.data!.agents[agent]?.registered);
      const anyRegistered = roster.some(registered);
      const opener = debate.current_turn;
      const other: Participant = opener === "claude" ? "codex" : "claude";
      const manual = roster.filter((agent) => !registered(agent));
      parts.push(`
        <div class="awaiting">
          <p><strong>This debate hasn&#8217;t started.</strong></p>
          <p style="margin-top: var(--s2)">Send the opening prompt to both terminals &#8212; ${participantName(
            opener,
          )} opens, ${participantName(other)} joins and waits.</p>
          <div class="kickoff-row" style="margin-top: var(--s3)">
            <button class="btn btn--primary" type="button" data-kickoff ${
              anyRegistered ? "" : "disabled"
            }>Start debate</button>
            ${
              anyRegistered
                ? ""
                : `<span>Launch both agents first so their terminals register.</span>`
            }
          </div>
          <span class="form-error" role="alert" data-kickoff-error></span>
          ${manual
            .map((agent) => {
              const prompt = kickoffPrompt(agent, debate.id);
              return `
            <details style="margin-top: var(--s3)">
              <summary>Or paste into ${participantName(agent)}&#8217;s terminal manually</summary>
              <div class="kickoff-row" style="margin-top: var(--s2)">
                <code>${escapeHtml(prompt)}</code>
                <button class="btn btn--ghost btn--sm" type="button" data-copy="${escapeHtml(prompt)}">Copy</button>
              </div>
            </details>`;
            })
            .join("")}
        </div>`);
    }

    if (debate.pending_resolution && debate.status === "running") {
      const res = debate.pending_resolution;
      const other = res.proposer === "claude" ? "Codex" : "Claude";
      parts.push(`
        <div class="panel panel--pending">
          <h2 class="panel-title">Resolution proposed &middot; ${
            res.resolution_type === "agreement" ? "agreement" : "agree to disagree"
          }</h2>
          <div class="panel-body">${renderRich(res.summary)}</div>
          <div class="panel-meta">proposed by ${participantName(res.proposer)} ${timeSpan(
            res.created_at,
          )} &middot; awaiting ${other}</div>
          <div class="panel-meta">The agents decide the resolution &#8212; interject to steer the outcome.</div>
        </div>`);
    }

    if (debate.status === "completed") {
      parts.push(`
        <div class="panel panel--success">
          <h2 class="panel-title">${
            debate.resolution_type === "agreement" ? "Agreement reached" : "Agreed to disagree"
          }</h2>
          ${debate.resolution_summary ? `<div class="panel-body">${renderRich(debate.resolution_summary)}</div>` : ""}
          <div class="panel-meta">concluded ${timeSpan(debate.updated_at)}</div>
        </div>`);
    } else if (joined.length === 2 && !debate.pending_resolution) {
      const turn = debate.current_turn;
      parts.push(`
        <div class="turn-marker">
          <span class="dot dot--${turn}"></span>
          ${participantName(turn)} holds the floor
        </div>`);
    }

    const tailEl = this.root.querySelector<HTMLElement>("[data-tail]")!;
    tailEl.innerHTML = parts.join("");
    tailEl
      .querySelector<HTMLButtonElement>("[data-kickoff]")
      ?.addEventListener("click", () => void this.startDebate());
    tailEl.querySelectorAll<HTMLButtonElement>("[data-copy]").forEach((button) => {
      button.addEventListener("click", async () => {
        try {
          await navigator.clipboard.writeText(button.dataset.copy ?? "");
          button.textContent = "Copied ✓";
          window.setTimeout(() => {
            button.textContent = "Copy";
          }, 1500);
        } catch {
          button.textContent = "Select and copy manually";
        }
      });
    });
  }

  private async startDebate(): Promise<void> {
    const button = this.root.querySelector<HTMLButtonElement>("[data-kickoff]");
    const errorSlot = this.root.querySelector<HTMLElement>("[data-kickoff-error]");
    if (button) {
      button.disabled = true;
      button.textContent = "Sending…";
    }
    if (errorSlot) errorSlot.textContent = "";
    try {
      const result = await kickoffDebate(this.debateId);
      const entries = Object.entries(result.results);
      const sent = entries.filter(([, r]) => r.injected).map(([agent]) => participantName(agent));
      const skipped = entries.filter(([, r]) => !r.injected);
      if (sent.length) announce(`Opening prompt sent to ${sent.join(" and ")}`);
      if (skipped.length && errorSlot) {
        errorSlot.textContent = skipped
          .map(([agent, r]) => `${participantName(agent)}: ${r.reason}`)
          .join(" · ");
      }
      await this.refresh();
    } catch (error) {
      if (errorSlot) {
        errorSlot.textContent =
          error instanceof Error ? error.message : "Couldn't start the debate.";
      }
      if (button) {
        button.disabled = false;
        button.textContent = "Start debate";
      }
    }
  }

  private renderRail(): void {
    if (!this.data) return;
    const { debate, bridge, agents } = this.data;
    const rail = this.root.querySelector<HTMLElement>("[data-rail]")!;
    const sections: string[] = [];

    if (debate.status === "running") {
      const turn = debate.current_turn;
      const bothJoined = Object.keys(debate.participants).length === 2;
      sections.push(`
        <section class="rail-section">
          <h2 class="rail-label">Floor</h2>
          <span class="rail-turn is-${turn}"><span class="dot dot--${turn}"></span>${participantName(turn)}${
            bothJoined ? "" : `<span class="rail-note" style="font-weight: 400">&nbsp;opens</span>`
          }</span>
          <span class="rail-note">${
            bothJoined
              ? "Interjections are delivered to whoever holds the floor."
              : "The debate starts once both agents join; interjections queue until then."
          }</span>
        </section>`);
    } else {
      sections.push(`
        <section class="rail-section">
          <h2 class="rail-label">Outcome</h2>
          <span class="pill pill--done">${
            debate.resolution_type === "agreement" ? "Agreement" : "Agreed to disagree"
          }</span>
          ${
            debate.resolution_summary
              ? `<p class="rail-outcome-summary" title="${escapeHtml(
                  debate.resolution_summary,
                )}">${escapeHtml(conclusionSummary(debate.resolution_summary))}</p>`
              : ""
          }
        </section>`);
    }

    const participantRows = (["claude", "codex"] as Participant[])
      .map((agent) => {
        const position = debate.participants[agent];
        const status = agents[agent];
        const terminal = status?.running
          ? `<span class="v">${agentStateLabel(agents, agent)}</span>`
          : `<span class="v absent">${agentStateLabel(agents, agent)}</span>
             ${debate.status === "running" ? launchButton(agent) : ""}`;
        return `
          <div class="rail-participant">
            <span class="name"><span class="dot dot--${agent}"></span>${participantName(agent)}</span>
            <span class="position">${
              position ? escapeHtml(position) : `<span class="absent">hasn&#8217;t joined yet</span>`
            }</span>
            ${terminal}
          </div>`;
      })
      .join("");
    sections.push(`
      <section class="rail-section">
        <h2 class="rail-label">Participants</h2>
        ${participantRows}
      </section>`);

    sections.push(`
      <section class="rail-section">
        <h2 class="rail-label">Bridge</h2>
        ${
          bridge.running
            ? `<div class="rail-kv"><span>relay daemon</span><span class="v">running &middot; pid ${bridge.pid}</span></div>`
            : `<div class="rail-kv"><span style="color: var(--danger)">stopped</span></div>
               <span class="rail-note">Messages stay queued until it runs.</span>
               ${debate.status === "running" ? startBridgeButton() : ""}`
        }
        <span class="form-error" role="alert" data-system-error></span>
      </section>`);

    sections.push(`
      <section class="rail-section">
        <h2 class="rail-label">Debate</h2>
        <div class="rail-kv"><span>id</span><span class="v">${escapeHtml(debate.id)}</span></div>
        <div class="rail-kv"><span>messages</span><span class="v">${this.data.messages.length}</span></div>
        <div class="rail-kv"><span>opened</span><span class="v">${timeSpan(debate.created_at)}</span></div>
        <a class="btn btn--ghost btn--sm" style="margin-top: var(--s3)" href="/api/debates/${encodeURIComponent(
          debate.id,
        )}/transcript.md" download="${escapeHtml(debate.id)}.md">Export transcript (Markdown)</a>
      </section>`);

    rail.innerHTML = sections.join("");
  }

  private renderComposer(): void {
    if (!this.data) return;
    const wrap = this.root.querySelector<HTMLElement>("[data-composer-wrap]")!;
    const { debate } = this.data;
    wrap.hidden = false;

    if (debate.status !== "running") {
      wrap.innerHTML = `<p class="composer-closed">This debate has concluded &#8212; interjections are closed.</p>`;
      return;
    }

    // Build once; later refreshes only update the delivery target label.
    let form = wrap.querySelector<HTMLFormElement>("form");
    if (!form) {
      wrap.innerHTML = `
        <form class="composer">
          <div class="composer-head">
            <label class="composer-label" for="interject-input">Interject as moderator</label>
            <span class="composer-target" data-target></span>
          </div>
          <div class="composer-row">
            <textarea id="interject-input" rows="1" placeholder="Steer the debate&hellip;"></textarea>
            <button class="btn btn--primary" type="submit" disabled>Interject</button>
          </div>
          <span class="composer-hint">${
            isMacPlatform ? "<kbd>&#8984;</kbd>" : "<kbd>Ctrl</kbd>"
          }<kbd>&#9166;</kbd> to send</span>
          <span class="form-error" role="alert" data-composer-error></span>
        </form>`;
      form = wrap.querySelector("form")!;
      const textarea = form.querySelector("textarea")!;
      const submit = form.querySelector("button")!;
      textarea.addEventListener("input", () => {
        textarea.style.height = "auto";
        textarea.style.height = `${Math.min(textarea.scrollHeight, 168)}px`;
        submit.disabled = textarea.value.trim() === "";
      });
      textarea.addEventListener("keydown", (event) => {
        if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
          event.preventDefault();
          form!.requestSubmit();
        }
      });
      form.addEventListener("submit", (event) => {
        event.preventDefault();
        void this.submitInterjection(form!);
      });
    }
    const target = wrap.querySelector<HTMLElement>("[data-target]");
    if (target) {
      const bothJoined = Object.keys(debate.participants).length === 2;
      const name = participantName(debate.current_turn);
      target.innerHTML =
        bothJoined && this.data.bridge.running
          ? `&rarr; ${name} reads it next`
          : `&rarr; queued for ${name}`;
    }
    const errorSlot = wrap.querySelector<HTMLElement>("[data-composer-error]");
    if (errorSlot) errorSlot.textContent = this.composerError;
  }

  private async submitInterjection(form: HTMLFormElement): Promise<void> {
    if (!this.data) return;
    const textarea = form.querySelector("textarea")!;
    const button = form.querySelector("button")!;
    const content = textarea.value.trim();
    if (!content) return;
    this.composerError = "";
    this.optimistic = {
      id: this.lastMaxId + 1_000_000,
      debate_id: this.debateId,
      sender: "moderator",
      recipient: this.data.debate.current_turn,
      kind: "interjection",
      content,
      created_at: new Date().toISOString(),
      delivered_at: null,
      optimistic: true,
    };
    textarea.value = "";
    textarea.style.height = "auto";
    button.disabled = true;
    this.render();
    try {
      await interject(this.debateId, content);
      await this.refresh();
    } catch (error) {
      this.optimistic = null;
      textarea.value = content;
      this.composerError =
        error instanceof Error ? error.message : "The interjection didn't reach the relay.";
      this.render();
    } finally {
      button.disabled = textarea.value.trim() === "";
    }
  }

  private showNewBelow(): void {
    const col = this.root.querySelector<HTMLElement>(".transcript-col")!;
    if (col.querySelector(".new-below")) return;
    const pill = document.createElement("button");
    pill.type = "button";
    pill.className = "new-below";
    pill.innerHTML = "&darr; New message";
    pill.addEventListener("click", () => {
      window.scrollTo({ top: document.body.scrollHeight, behavior: "smooth" });
      pill.remove();
    });
    const onScroll = () => {
      if (this.nearBottom()) {
        pill.remove();
        window.removeEventListener("scroll", onScroll);
      }
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    col.insertBefore(pill, col.querySelector("[data-composer-wrap]"));
  }
}
