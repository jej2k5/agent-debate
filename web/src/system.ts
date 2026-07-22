import { launchAgent, startBridge } from "./api";
import { participantName } from "./format";
import type { Agents, BridgeStatus, Participant } from "./types";

/** Actions in flight, so SSE-driven re-renders keep buttons in their pending state. */
const pending = new Map<string, number>();

function markPending(key: string): void {
  const timer = window.setTimeout(() => pending.delete(key), 15_000);
  const old = pending.get(key);
  if (old) window.clearTimeout(old);
  pending.set(key, timer);
}

function clearPending(key: string): void {
  const timer = pending.get(key);
  if (timer) window.clearTimeout(timer);
  pending.delete(key);
}

/** Suggested models per agent (non-binding; the field is free-text and empty = CLI default). */
const MODEL_SUGGESTIONS: Record<Participant, string[]> = {
  claude: ["opus", "sonnet", "haiku"],
  codex: ["gpt-5.2-codex", "gpt-5-codex", "gpt-5.1-codex-mini"],
};

export function launchButton(participant: Participant, label = "Launch terminal"): string {
  if (pending.has(participant)) {
    return `<button class="btn btn--ghost btn--sm" type="button" data-launch="${participant}" disabled>Opened &mdash; registering&hellip;</button>`;
  }
  const listId = `models-${participant}`;
  const options = MODEL_SUGGESTIONS[participant].map((m) => `<option value="${m}"></option>`).join("");
  return `
    <span class="launch-control">
      <input class="model-input" type="text" list="${listId}" data-model="${participant}"
        placeholder="default model" aria-label="${participantName(participant)} model"
        autocomplete="off" spellcheck="false" />
      <datalist id="${listId}">${options}</datalist>
      <button class="btn btn--ghost btn--sm" type="button" data-launch="${participant}">${label}</button>
    </span>`;
}

export function startBridgeButton(label = "Start bridge"): string {
  if (pending.has("bridge")) {
    return `<button class="btn btn--ghost btn--sm" type="button" data-start-bridge disabled>Starting&hellip;</button>`;
  }
  return `<button class="btn btn--ghost btn--sm" type="button" data-start-bridge>${label}</button>`;
}

export function agentStateLabel(agents: Agents, participant: Participant): string {
  const status = agents[participant];
  if (!status) return "";
  if (status.running) return `${status.app} &middot; ${(status.tty ?? "").replace("/dev/", "")}`;
  if (status.registered) return `${status.app} tab registered &middot; agent not running`;
  return "not launched";
}

/** Units for anything not currently running; empty string when all systems are go. */
export function systemStrip(agents: Agents, bridge: BridgeStatus): string {
  const units: string[] = [];
  for (const participant of ["claude", "codex"] as Participant[]) {
    const status = agents[participant];
    if (!status) continue;
    if (status.running) {
      clearPending(participant);
      continue;
    }
    units.push(`
      <div class="system-unit">
        <span class="system-name"><span class="dot dot--${participant}"></span>${participantName(participant)}</span>
        <span class="system-state">${agentStateLabel(agents, participant)}</span>
        ${launchButton(participant)}
      </div>`);
  }
  if (bridge.running) {
    clearPending("bridge");
  } else {
    units.push(`
      <div class="system-unit">
        <span class="system-name"><span class="dot" style="background: var(--danger)"></span>Bridge</span>
        <span class="system-state">stopped &middot; messages queue until it runs</span>
        ${startBridgeButton()}
      </div>`);
  }
  if (units.length === 0) return "";
  return `
    <section class="system-strip" aria-label="System status">
      ${units.join("")}
      <span class="form-error" role="alert" data-system-error></span>
    </section>`;
}

/** Wire every [data-launch] / [data-start-bridge] button under root. Idempotent per render. */
export function bindSystemActions(root: ParentNode): void {
  const errorSlot = (button: HTMLElement): HTMLElement | null =>
    (button.closest("[aria-label], .rail, .empty")?.querySelector("[data-system-error]") as HTMLElement) ??
    root.querySelector<HTMLElement>("[data-system-error]");

  root.querySelectorAll<HTMLButtonElement>("[data-launch]").forEach((button) => {
    button.addEventListener("click", async () => {
      const participant = button.dataset.launch!;
      const modelInput = button
        .closest(".launch-control")
        ?.querySelector<HTMLInputElement>("[data-model]");
      const model = modelInput?.value.trim() || undefined;
      const original = button.textContent ?? "Launch terminal";
      button.disabled = true;
      button.textContent = "Opening…";
      markPending(participant);
      try {
        await launchAgent(participant, model);
        button.textContent = "Opened — registering…";
        // SSE picks up the registration write and re-renders.
      } catch (error) {
        clearPending(participant);
        button.disabled = false;
        button.textContent = original;
        const slot = errorSlot(button);
        if (slot) slot.textContent = error instanceof Error ? error.message : "Launch failed.";
      }
    });
  });

  root.querySelectorAll<HTMLButtonElement>("[data-start-bridge]").forEach((button) => {
    button.addEventListener("click", async () => {
      button.disabled = true;
      button.textContent = "Starting…";
      markPending("bridge");
      try {
        await startBridge();
        // SSE notices the bridge flip and re-renders.
      } catch (error) {
        clearPending("bridge");
        button.disabled = false;
        button.textContent = "Start bridge";
        const slot = errorSlot(button);
        if (slot) slot.textContent = error instanceof Error ? error.message : "Couldn't start the bridge.";
      }
    });
  });
}
