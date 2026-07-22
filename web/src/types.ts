export type Participant = "claude" | "codex";

export interface Debate {
  id: string;
  topic: string;
  status: "running" | "completed";
  current_turn: Participant;
  resolution_type: "agreement" | "agree_to_disagree" | null;
  resolution_summary: string | null;
  created_at: string;
  updated_at: string;
}

export interface Resolution {
  id: number;
  debate_id: string;
  proposer: Participant;
  resolution_type: "agreement" | "agree_to_disagree";
  summary: string;
  status: "pending" | "accepted" | "rejected";
  created_at: string;
  responded_at: string | null;
}

export interface DebateStatus extends Debate {
  participants: Partial<Record<Participant, string>>;
  pending_resolution: Resolution | null;
}

export interface DebateListItem extends Debate {
  participants: Partial<Record<Participant, string>>;
  message_count: number;
  undelivered_count: number;
  pending_resolution: {
    proposer: Participant;
    resolution_type: "agreement" | "agree_to_disagree";
  } | null;
}

export interface Message {
  id: number;
  debate_id: string;
  sender: Participant | "moderator";
  recipient: Participant;
  kind: "argument" | "interjection" | string;
  content: string;
  created_at: string;
  delivered_at: string | null;
  /** Client-only flag for optimistic sends. */
  optimistic?: boolean;
}

export interface BridgeStatus {
  running: boolean;
  pid: number | null;
}

export interface AgentStatus {
  registered: boolean;
  running: boolean;
  app: string | null;
  tty: string | null;
}

export type Agents = Record<Participant, AgentStatus>;

export interface Overview {
  debates: DebateListItem[];
  bridge: BridgeStatus;
  agents: Agents;
}

export interface DebateDetail {
  debate: DebateStatus;
  messages: Message[];
  bridge: BridgeStatus;
  agents: Agents;
}
