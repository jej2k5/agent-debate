---
name: Agent Debate
description: Mission control for live Claude ↔ Codex debates — calm instrumentation around a reading surface.
colors:
  sea-glass-teal: "oklch(0.5 0.09 172)"
  terminal-rust: "oklch(0.52 0.11 45)"
  ink: "oklch(0.22 0.012 175)"
  ink-muted: "oklch(0.45 0.015 175)"
  ink-faint: "oklch(0.55 0.012 175)"
  bg: "oklch(1 0 0)"
  surface: "oklch(0.967 0.002 175)"
  surface-2: "oklch(0.94 0.004 175)"
  line: "oklch(0.9 0.004 175)"
  line-strong: "oklch(0.82 0.005 175)"
  pending-amber: "oklch(0.5 0.11 80)"
  success-green: "oklch(0.49 0.11 155)"
  danger-red: "oklch(0.5 0.19 25)"
typography:
  title:
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif"
    fontSize: "1.5rem"
    fontWeight: 650
    lineHeight: 1.2
    letterSpacing: "-0.01em"
  headline:
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif"
    fontSize: "1.1875rem"
    fontWeight: 570
    lineHeight: 1.3
    letterSpacing: "-0.005em"
  reading:
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif"
    fontSize: "1.0625rem"
    fontWeight: 400
    lineHeight: 1.65
  body:
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif"
    fontSize: "1rem"
    fontWeight: 400
    lineHeight: 1.5
  label:
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif"
    fontSize: "0.8125rem"
    fontWeight: 550
    lineHeight: 1.4
  mono-meta:
    fontFamily: "ui-monospace, 'SF Mono', 'JetBrains Mono', Menlo, Consolas, monospace"
    fontSize: "0.75rem"
    fontWeight: 400
    lineHeight: 1.5
rounded:
  xs: "4px"
  sm: "6px"
  md: "10px"
  pill: "999px"
spacing:
  s1: "0.25rem"
  s2: "0.5rem"
  s3: "0.75rem"
  s4: "1rem"
  s5: "1.5rem"
  s6: "2rem"
  s7: "3rem"
  s8: "4rem"
components:
  button-primary:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.bg}"
    rounded: "{rounded.sm}"
    padding: "0.5rem 1rem"
    typography: "{typography.label}"
  button-ghost:
    backgroundColor: "{colors.bg}"
    textColor: "{colors.ink-muted}"
    rounded: "{rounded.sm}"
    padding: "0.5rem 1rem"
  pill-claude:
    backgroundColor: "oklch(0.95 0.025 172)"
    textColor: "{colors.sea-glass-teal}"
    rounded: "{rounded.pill}"
    padding: "0.25rem 0.75rem"
  pill-codex:
    backgroundColor: "oklch(0.95 0.03 50)"
    textColor: "{colors.terminal-rust}"
    rounded: "{rounded.pill}"
    padding: "0.25rem 0.75rem"
  input:
    backgroundColor: "{colors.bg}"
    textColor: "{colors.ink}"
    rounded: "{rounded.sm}"
    padding: "0.5rem 0.75rem"
---

# Design System: Agent Debate

## 1. Overview

**Creative North Star: "The Operator's Console"**

This is mission control for a live argument between two AI agents: calm, truthful instrumentation arranged around a reading surface. The system's center of gravity is the transcript — long structured arguments set at a comfortable measure — with everything else (turn state, delivery state, bridge health, the moderator's composer) drawn as quiet instruments at the periphery. Personality is carried by two persistent identity colors (Sea-glass Teal for Claude, Terminal Rust for Codex) on otherwise chroma-zero neutrals; the interface itself stays neutral, like a referee.

The system explicitly rejects the generic SaaS dashboard: no card grids, no stat tiles, no sidebar-with-icons chrome. It equally rejects spectacle — this is an operator's console, not a spectator's scoreboard. Live activity raises attention deliberately (a quiet fade-and-settle, an amber "awaiting delivery"), never through noise. It ships light and dark as equals, keyed to the OS with a manual override, because it lives beside terminals whose theme the user already chose.

**Key Characteristics:**
- The arguments are the interface; chrome recedes to hairlines and metadata.
- Two identity hues (teal 172°, rust 45°) with fixed meaning; all other color is semantic state.
- Chroma-zero neutrals in both themes; pure white / near-black surfaces.
- Mono type marks machine facts (ids, TTYs, timestamps, counts); sans carries everything human.
- State shown is state confirmed — the UI never claims what SQLite hasn't recorded.

## 2. Colors

A restrained, semantic palette: neutral bones, two debater identities, three state colors.

### Primary
- **Sea-glass Teal** (oklch(0.5 0.09 172) light / oklch(0.78 0.09 172) dark): Claude's identity — speaker labels, turn dot, turn pill, links, focus rings, selection wash. Also the product's brand hue.

### Secondary
- **Terminal Rust** (oklch(0.52 0.11 45) light / oklch(0.75 0.1 50) dark): Codex's identity — speaker labels, turn dot, turn pill. Never used for errors; danger red is a separate, more saturated hue (25°).

### Tertiary
- **Pending Amber** (oklch(0.5 0.11 80) light / oklch(0.8 0.11 85) dark): undelivered messages, awaiting-join, proposed resolutions — anything queued but unconfirmed.
- **Success Green** (oklch(0.49 0.11 155) light / oklch(0.76 0.1 155) dark): reached agreement, bridge running.
- **Danger Red** (oklch(0.5 0.19 25) light / oklch(0.7 0.16 25) dark): bridge stopped, connection lost, errors only.

### Neutral
- **Ink** (oklch(0.22 0.012 175) light / oklch(0.92 0.006 175) dark): body text and the solid primary button. Carries a whisper of the teal hue (chroma ≈0.01).
- **Ink Muted** (oklch(0.45 0.015 175) / oklch(0.7 0.01 175)): secondary text, labels. Holds ≥4.5:1 on bg and surface.
- **Ink Faint** (oklch(0.55 0.012 175) / oklch(0.6 0.008 175)): mono metadata only — never body copy (≥3:1).
- **Background** (pure white oklch(1 0 0) / near-black oklch(0.135 0 0)): chroma exactly zero in both themes.
- **Surface / Surface-2** (oklch(0.967→0.94 light / 0.17→0.205 dark): panels, code blocks, skeletons — one and two tonal steps from bg.
- **Line / Line-strong** (oklch(0.9 / 0.82 light; 0.24 / 0.32 dark): hairline structure and form-control borders.

### Named Rules
**The Two Voices Rule.** Teal means Claude; rust means Codex — everywhere, always, and for nothing else. UI chrome never borrows an identity hue for decoration; the neutral ink button exists so controls stay referee-neutral.

**The Confirmed State Rule.** Semantic color reports database truth, not intention: amber = stored but undelivered, green = handshake accepted, red = infrastructure down. No color ever anticipates a state.

## 3. Typography

**Display Font:** System sans (-apple-system / Segoe UI / system-ui)
**Body Font:** Same system sans — one family, tuned by weight
**Label/Mono Font:** ui-monospace (SF Mono / JetBrains Mono / Menlo)

**Character:** A native-feeling instrument: the sans disappears into the OS, while the mono marks every machine fact (debate ids, TTYs, pids, counts, timestamps) like engraved panel labels. The contrast axis is sans-vs-mono, not serif-vs-sans.

### Hierarchy
- **Title** (650, 1.5rem, 1.2, -0.01em): page and debate-topic headings. `text-wrap: balance`.
- **Headline** (570, 1.1875rem, 1.3): ledger topics.
- **Reading** (400, 1.0625rem, 1.65): transcript argument text — the system's reason to exist. Max measure 70ch, `text-wrap: pretty`.
- **Body** (400, 1rem, 1.5): panels, notices, composer text.
- **Label** (550, 0.8125rem): form labels, rail section headers, pill text. Sentence case — never uppercase-tracked eyebrows.
- **Mono-meta** (mono 400, 0.75rem): ids, timestamps, tty paths, counts, delivery status.

### Named Rules
**The Engraved Panel Rule.** If a value comes from the machine (id, pid, tty, count, timestamp), it is set in mono; if it comes from a mind (argument, position, topic), it is set in sans. No exceptions, no mixing.

## 4. Elevation

Flat, hairline-drawn. Structure comes from 1px lines (`line`, `line-strong`) and one-or-two-step tonal surfaces, not shadows. Depth in dark mode is lightness-stepped (bg 0.135 → surface 0.17 → surface-2 0.205). Exactly one shadow exists in the system — the floating "new message" pill and its kin — because that element genuinely hovers above the page. Sticky bars (topbar, composer) separate with a hairline plus a backdrop blur of the page behind them, a functional use of blur, not glass decoration.

### Shadow Vocabulary
- **Raised** (`0 1px 2px oklch(0.2 0 0 / 0.06), 0 4px 16px oklch(0.2 0 0 / 0.07)` light; deeper alphas in dark): reserved for elements floating over content (the new-message pill). Nothing at rest carries a shadow.

### Named Rules
**The One Float Rule.** A shadow is a claim that an element sits above the page. Only true floaters (the scroll-return pill) may make that claim. Panels, cards, and bars are flat and hairline-bordered.

## 5. Components

Quiet instrumentation: controls read as calibrated instruments — precise, unhurried, invisible until needed.

### Buttons
- **Shape:** Gently rounded (6px).
- **Primary:** Solid ink on bg text ("Interject", "Create debate") — deliberately neutral, never an identity hue. Padding 0.5rem 1rem, weight 570.
- **Hover / Focus:** Hover eases opacity to 0.88 (120ms ease-out-quint); active scales to 0.98; keyboard focus draws a 2px teal `outline` offset 2px. Disabled drops to 45% opacity.
- **Ghost:** 1px `line-strong` border, muted text; hover fills with `surface` and inks the text.

### Chips
- **Style:** Fully rounded (999px) state pills — tinted wash background with the matching state color as text (e.g. teal wash + teal text for "Claude's turn"), always paired with a 7px dot so color is never the only signal.
- **State:** Identity pills (turn), amber pills (awaiting), green pills (agreement), neutral pills (metadata). The bridge chip is a bordered variant in mono.

### Cards / Containers
- **Corner Style:** 10px for panels, 6px for controls and code blocks, 4px micro-radius for inline elements sized under a line (inline `code` chips, `kbd` keys).
- **Background:** `surface` for moderator interjections and forms; state washes (amber/green soft) for resolution and completion panels.
- **Shadow Strategy:** None at rest (see Elevation). Structure is a full 1px border — `line-strong` for emphasis, dashed for provisional states (awaiting join, optimistic sends).
- **Border:** Always full-perimeter hairlines; colored accents tint the whole border toward the state hue via color-mix, never a side stripe.
- **Internal Padding:** 1rem–1.5rem (s4–s5).

### Inputs / Fields
- **Style:** 1px `line-strong` stroke on `bg`, 6px radius, visible labels above (never placeholder-as-label); placeholders use `ink-muted` (4.5:1).
- **Focus:** 2px teal outline at 0 offset; no glow.
- **Error:** Inline `form-error` text in danger red below the control, `role="alert"`.

### Navigation
- **Style:** A single 56px sticky topbar — wordmark (two overlapping identity dots + "Agent Debate"), current debate id in muted text, bridge-health chip, theme toggle. Hairline bottom border over backdrop blur. No sidebar, ever.

### The Transcript (signature)
- Messages are typographic blocks, not chat bubbles: speaker name in identity color (620 weight), mono timestamp, then Reading-size text at ≤70ch. Moderator interjections are the exception — bordered `surface` boxes that interrupt the flow the way the moderator interrupts the debate. New arrivals fade-and-settle 8px (320ms ease-out-quint, crossfade under reduced motion); a pulsing identity dot marks who holds the floor; auto-follow only when the reader is already at the bottom, else the floating "↓ New message" pill.

## 6. Do's and Don'ts

### Do:
- **Do** keep the transcript's measure at ≤70ch and Reading size (1.0625rem/1.65) — the arguments are the interface.
- **Do** verify every text/background pair at ≥4.5:1 in both themes (the shipped palette ranges 4.9–17:1; keep it there).
- **Do** pair every state color with a non-color signal (dot, label, border style) and give every animation a reduced-motion alternative.
- **Do** use mono for machine facts and sentence-case labels — per the Engraved Panel Rule.
- **Do** show queued/undelivered truthfully in Pending Amber; "awaiting delivery" is a feature, not an embarrassment.

### Don't:
- **Don't** build the "generic SaaS dashboard" PRODUCT.md forbids: no card grids, no stat tiles, no sidebar-with-icons scaffolding.
- **Don't** use teal or rust for anything but Claude and Codex (the Two Voices Rule) — and never use rust for errors.
- **Don't** render arguments as chat bubbles, add avatars, or scroll-jack the reader on new messages.
- **Don't** put shadows on resting surfaces, side-stripe borders on anything, or tint the neutral surfaces toward warmth — neutrals stay chroma ≤0.006 (identity washes ≤0.03).
- **Don't** add uppercase-tracked eyebrow labels, orchestrated page-load choreography, or any animation over 500ms.
- **Don't** imply liveness the store hasn't confirmed — no optimistic "delivered", no green until the handshake is accepted.
