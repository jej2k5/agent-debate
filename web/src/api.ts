import type { BridgeStatus, DebateDetail, DebateStatus, Overview } from "./types";

export class ApiError extends Error {
  status: number;

  constructor(status: number, detail: string) {
    super(detail);
    this.status = status;
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let response: Response;
  try {
    response = await fetch(path, init);
  } catch {
    throw new ApiError(0, "The relay server isn't responding. Is debate-web still running?");
  }
  if (!response.ok) {
    let detail = `Request failed (${response.status})`;
    try {
      const body = await response.json();
      if (typeof body.detail === "string") detail = body.detail;
    } catch {
      /* keep the generic detail */
    }
    throw new ApiError(response.status, detail);
  }
  return response.json() as Promise<T>;
}

export function fetchOverview(): Promise<Overview> {
  return request<Overview>("/api/overview");
}

export function fetchDebate(id: string): Promise<DebateDetail> {
  return request<DebateDetail>(`/api/debates/${encodeURIComponent(id)}`);
}

export function createDebate(debateId: string, topic: string, firstSpeaker: string): Promise<DebateStatus> {
  return request<DebateStatus>("/api/debates", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ debate_id: debateId, topic, first_speaker: firstSpeaker }),
  });
}

export function startBridge(): Promise<{ running: boolean; pid: number | null }> {
  return request("/api/bridge/start", { method: "POST" });
}

export function launchAgent(
  participant: string,
  model?: string,
): Promise<{ launched: boolean; app: string }> {
  return request(`/api/agents/${encodeURIComponent(participant)}/launch`, {
    method: "POST",
    headers: model ? { "Content-Type": "application/json" } : undefined,
    body: model ? JSON.stringify({ model }) : undefined,
  });
}

export interface KickoffResult {
  debate_id: string;
  results: Record<string, { injected: boolean; app?: string; tty?: string; reason?: string }>;
}

export function kickoffDebate(debateId: string): Promise<KickoffResult> {
  return request<KickoffResult>(`/api/debates/${encodeURIComponent(debateId)}/kickoff`, {
    method: "POST",
  });
}

export function interject(debateId: string, content: string): Promise<unknown> {
  return request(`/api/debates/${encodeURIComponent(debateId)}/interject`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ content }),
  });
}

export type ConnectionState = "live" | "reconnecting";

export interface EventsHandlers {
  onChange: () => void;
  onBridge: (bridge: BridgeStatus) => void;
  onConnection: (state: ConnectionState) => void;
}

/** SSE subscription; EventSource handles reconnection natively. */
export function connectEvents(handlers: EventsHandlers): () => void {
  const source = new EventSource("/api/events");
  const parseBridge = (event: MessageEvent) => {
    try {
      const payload = JSON.parse(event.data) as { bridge?: BridgeStatus };
      if (payload.bridge) handlers.onBridge(payload.bridge);
    } catch {
      /* malformed payload; the next event will correct it */
    }
  };
  source.addEventListener("change", (event) => {
    handlers.onConnection("live");
    parseBridge(event as MessageEvent);
    handlers.onChange();
  });
  source.addEventListener("heartbeat", (event) => {
    handlers.onConnection("live");
    parseBridge(event as MessageEvent);
  });
  source.addEventListener("open", () => handlers.onConnection("live"));
  source.addEventListener("error", () => handlers.onConnection("reconnecting"));
  return () => source.close();
}
