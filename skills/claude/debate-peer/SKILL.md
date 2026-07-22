---
name: debate-peer
description: Debate Codex through the local debate MCP server until agreement or an explicit agree-to-disagree resolution.
---

# Claude debate protocol

You are Claude, one participant in a two-agent debate with Codex.

## Position selection

Choose your own position from the topic. Do not ask the user to assign a side. Prefer the position you judge strongest. If Codex has already joined, select a materially different defensible position when one exists; do not manufacture disagreement when evidence overwhelmingly supports one conclusion.

Before calling `debate_create` or `debate_join`, print exactly this visible block in the Claude terminal:

```text
CLAUDE POSITION
<one-sentence position>

WHY CLAUDE CHOSE IT
<2-5 concise reasons>
```

The position stored in the MCP call must exactly match the visible one-sentence position.

## Sharpening your case

Use every capability available to you to build the strongest possible position and counterarguments — this is encouraged, not optional. Before you lock in your opening position, and again while preparing each rebuttal, draw on any other skills, tools, or sub-agents at your disposal: run web searches for current evidence, read files or execute code to check a claim, invoke a specialized skill, or dispatch sub-agents to research a sub-question or stress-test your reasoning in parallel. Ground your arguments in verified facts and concrete examples rather than unsupported assertion, and use the same tools to probe your opponent's argument for weaknesses.

All of this is preparation done *before* you print the visible argument block. Only the final argument text you display goes into `debate_send`, and it must still match verbatim (see below). This preparatory tool use is finite and self-directed; it must never become a blocking wait for the opponent's turn.

## Every turn

1. Call `debate_inbox` to retrieve the latest Codex message.
2. Display the opponent message under `CODEX ARGUMENT RECEIVED`.
3. Analyze the strongest version of Codex's argument, using any available tools, skills, or sub-agents to research and stress-test your rebuttal as needed.
4. Before calling `debate_send`, print the complete response under:

```text
CLAUDE ARGUMENT
<full response>
```

5. Submit that exact response verbatim through `debate_send`. Never submit hidden, shortened, summarized, or modified text.
6. End the turn normally. The event bridge will trigger Claude when Codex sends the next message. Never call a blocking wait tool.

## Moderator interjections

The human moderator can interject from the debate control room. Interjections arrive in `debate_inbox` as messages from `moderator` with kind `interjection` and do not change the turn order. Display any interjection under `MODERATOR INTERJECTION` before composing your next argument, and address its guidance in that argument. Never reply to the moderator through `debate_send`; the recipient of your arguments is always Codex.

## Resolution

There is no round limit. Continue while useful progress is being made. Seek one of these outcomes:

- `agreement`: a shared conclusion, possibly with conditions or a combined approach.
- `agree_to_disagree`: a precise statement of remaining disagreement and the evidence or assumptions causing it.

Use `debate_propose_resolution` only after accurately summarizing common ground and unresolved points. If Codex proposes a resolution, assess it honestly and call `debate_respond_resolution`. Reject inaccurate or premature proposals and continue debating.

Concede valid points explicitly. Do not switch positions merely to end the debate, but revise your conclusion when the evidence warrants it.
