import "./styles.css";
import { initAnnouncer } from "./announce";
import { connectEvents, type ConnectionState } from "./api";
import { DebateView } from "./debate";
import { refreshTimestamps } from "./format";
import { OverviewView } from "./overview";
import type { BridgeStatus } from "./types";

type Theme = "auto" | "light" | "dark";

const WORDMARK_SVG = `
  <svg width="18" height="18" viewBox="0 0 32 32" aria-hidden="true">
    <circle cx="11" cy="16" r="8" fill="var(--claude)" />
    <circle cx="21" cy="16" r="8" fill="var(--codex)" fill-opacity="0.85" />
  </svg>`;

const THEME_ICONS: Record<Theme, string> = {
  auto: `<svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true"><circle cx="8" cy="8" r="6" stroke="currentColor" stroke-width="1.5"/><path d="M8 2 A6 6 0 0 1 8 14 Z" fill="currentColor"/></svg>`,
  light: `<svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true"><circle cx="8" cy="8" r="3.5" stroke="currentColor" stroke-width="1.5"/><path d="M8 0.5v2M8 13.5v2M0.5 8h2M13.5 8h2M2.7 2.7l1.4 1.4M11.9 11.9l1.4 1.4M13.3 2.7l-1.4 1.4M4.1 11.9l-1.4 1.4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>`,
  dark: `<svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="M13.5 9.5A6 6 0 0 1 6.5 2.5a6 6 0 1 0 7 7Z" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/></svg>`,
};

class Shell {
  private outlet: HTMLElement;
  private banners: HTMLElement;
  private bridge: BridgeStatus | null = null;
  private connection: ConnectionState = "live";
  private view: OverviewView | DebateView | null = null;
  private currentRoute = "";
  private theme: Theme;

  constructor(root: HTMLElement) {
    initAnnouncer();
    this.theme = (localStorage.getItem("debate-theme") as Theme) || "auto";
    root.innerHTML = `
      <header class="topbar">
        <a class="wordmark" href="#/" aria-label="Agent Debate — all debates">
          ${WORDMARK_SVG}
          <span>Agent Debate</span>
        </a>
        <a class="back-link" data-back href="#/" hidden>&larr; Debates</a>
        <span class="topbar-topic" data-topbar-topic></span>
        <span class="topbar-spacer"></span>
        <span class="bridge-chip" data-bridge-chip hidden>
          <span class="dot"></span>
          <span data-bridge-text></span>
        </span>
        <button class="theme-toggle" type="button" data-theme-toggle></button>
      </header>
      <div data-banners></div>
      <main id="outlet" style="display: flex; flex-direction: column; flex: 1"></main>`;
    this.outlet = root.querySelector("#outlet")!;
    this.banners = root.querySelector("[data-banners]")!;

    const toggle = root.querySelector<HTMLButtonElement>("[data-theme-toggle]")!;
    toggle.addEventListener("click", () => this.cycleTheme());
    this.applyTheme();

    window.addEventListener("hashchange", () => this.route(true));
    this.route(false);

    connectEvents({
      onChange: () => void this.view?.refresh(),
      onBridge: (bridge) => {
        this.bridge = bridge;
        this.renderStatus();
      },
      onConnection: (state) => {
        if (state !== this.connection) {
          this.connection = state;
          this.renderStatus();
          if (state === "live") void this.view?.refresh();
        }
      },
    });

    window.setInterval(() => refreshTimestamps(document.body), 30_000);
  }

  private cycleTheme(): void {
    const order: Theme[] = ["auto", "light", "dark"];
    this.theme = order[(order.indexOf(this.theme) + 1) % order.length];
    if (this.theme === "auto") localStorage.removeItem("debate-theme");
    else localStorage.setItem("debate-theme", this.theme);
    this.applyTheme();
  }

  private applyTheme(): void {
    if (this.theme === "auto") delete document.documentElement.dataset.theme;
    else document.documentElement.dataset.theme = this.theme;
    const toggle = document.querySelector<HTMLButtonElement>("[data-theme-toggle]")!;
    toggle.innerHTML = THEME_ICONS[this.theme];
    const label = { auto: "System theme", light: "Light theme", dark: "Dark theme" }[this.theme];
    toggle.title = `${label} — click to switch`;
    toggle.setAttribute("aria-label", toggle.title);
  }

  private route(userNavigated: boolean): void {
    const hash = window.location.hash;
    const match = hash.match(/^#\/d\/(.+)$/);
    const route = match ? `debate:${decodeURIComponent(match[1])}` : "overview";
    if (route === this.currentRoute) {
      void this.view?.refresh();
      return;
    }
    this.currentRoute = route;
    const topic = document.querySelector<HTMLElement>("[data-topbar-topic]")!;
    const back = document.querySelector<HTMLElement>("[data-back]")!;
    back.hidden = !match;
    if (match) {
      const debateId = decodeURIComponent(match[1]);
      topic.textContent = debateId;
      this.view = new DebateView(this.outlet, debateId);
    } else {
      topic.textContent = "";
      document.title = "Agent Debate";
      this.view = new OverviewView(this.outlet);
    }
    window.scrollTo({ top: 0 });
    void this.view.refresh().then(() => {
      // Announce navigation to keyboard/screen-reader users; skip the initial load.
      if (userNavigated) this.view?.focusHeading();
    });
  }

  private renderStatus(): void {
    const chip = document.querySelector<HTMLElement>("[data-bridge-chip]")!;
    const text = chip.querySelector<HTMLElement>("[data-bridge-text]")!;
    if (this.bridge) {
      chip.hidden = false;
      chip.dataset.state = this.bridge.running ? "running" : "stopped";
      text.textContent = this.bridge.running ? "bridge" : "bridge stopped";
      chip.title = this.bridge.running
        ? `Bridge daemon running (pid ${this.bridge.pid}) — messages are being delivered`
        : "Bridge daemon is not running — messages will queue until it starts";
    }
    this.banners.innerHTML =
      this.connection === "reconnecting"
        ? `<div class="banner banner--danger" role="status">
             <strong>Connection to the relay lost.</strong>
             <span>Retrying &mdash; the transcript may be stale until it reconnects.</span>
           </div>`
        : "";
  }
}

new Shell(document.querySelector<HTMLElement>("#app")!);
