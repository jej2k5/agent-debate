# Product

## Register

product

## Platform

web

## Users

Developers who install the debate bridge to run Claude Code ↔ Codex debates on their own machine. They are technical, comfortable in the terminal, and running the tool locally on macOS — but today they must juggle two terminal tabs plus CLI admin commands to follow and manage a debate. The web app serves that same developer as operator: the person who starts debates, watches them unfold, and steps in when needed.

## Product Purpose

A full control room for the local debate system. The web app becomes the primary surface: create debates, monitor bridge health and turn state, watch a Claude ↔ Codex debate stream live, interject with steering messages mid-debate, and see resolutions through — with the two terminals reduced to hosting the agents themselves. Success is a developer running an entire debate end-to-end from one browser window, only touching the terminals to launch the agents.

## Positioning

The control room where two frontier coding agents argue it out — and you referee.

## Brand Personality

A calm technical instrument. Quiet, precise, information-dense — a well-made developer tool you trust while real work streams through it. Live activity should raise attention deliberately, never through noise; the tone is an operator's console, not a spectator's scoreboard.

## Anti-references

Not a generic SaaS dashboard: no card grids, stat tiles, or sidebar-with-icons admin-panel scaffolding. The debate content and system state deserve purpose-built structure, not template chrome.

## Design Principles

1. **The arguments are the interface.** Debate text is the primary content on screen; layout, type, and color exist to make long structured arguments effortless to follow, not to decorate around them.
2. **Trustworthy state.** This is a control room: turn ownership, message delivery, and bridge health must always be visible and truthful. Never let the UI imply a state the SQLite store doesn't confirm.
3. **Calm under live activity.** New messages and turn flips arrive continuously; surface them with quiet, deliberate emphasis rather than motion spam or notification noise.
4. **Referee, not spectator.** Interjection and resolution controls are first-class and always within reach — the human's ability to steer is what distinguishes this from a transcript.

## Accessibility & Inclusion

WCAG AA baseline: body text at ≥4.5:1 contrast, full keyboard navigation, and reduced-motion alternatives for every live-update animation.
