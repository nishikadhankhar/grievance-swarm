export type Role = "student" | "technician" | "warden" | "dean";

export interface Ticket {
  id: string;
  title: string;
  category: string;
  status: "reported" | "assigned" | "in_progress" | "resolved";
  place: { id: string; name: string };
  assignee: { id: string; name: string } | null;
  eta: string | null;
  eta_reason: string | null;
  report_count: number;
  suggestion: string | null;
  suggestion_call_id: string | null;
  visits: number;
  created_at: string;
  closed_at: string | null;
}

export interface MekoRef {
  call_id: string;
  op: string;
  datapack: string;
  skipped: boolean;
  recalled: string[];
}

export interface TicketEvent {
  id: number;
  ticket_id: string;
  actor_type: "person" | "agent";
  actor_id: string;
  actor_name: string;
  action: string;
  reason: string | null;
  meko_call_id: string | null;
  simulated: boolean;
  at: string;
  meko: MekoRef | null;
}

export interface TicketDetail {
  ticket: Ticket;
  events: TicketEvent[];
  reporters: string[];
}

export interface MekoCall {
  id: string;
  at: string;
  actor: string;
  actor_id: string | null;
  target: string | null;
  op: "write" | "recall" | "share" | "promote" | "directive" | "approval";
  datapack: string;
  summary: string;
  result_ids: string[];
  result_preview: string[];
  latency_ms: number;
  error: string | null;
  skipped: boolean;
  simulated: boolean;
  ticket_id: string | null;
}

export interface Message {
  id: number;
  at: string;
  from: string;
  to: string;
  text: string;
  kind: string;
  ticket_id: string | null;
  meko_call_id: string | null;
  simulated: boolean;
}

export interface Approval {
  id: number;
  kind: "lesson" | "escalation" | "closure" | "pattern";
  payload: { lesson?: string; pattern?: string; evidence?: string; category?: string; stat?: string };
  proposed_by_agent: string;
  decided_by: string | null;
  status: "pending" | "approved" | "rejected";
  ticket_id: string | null;
  meko_call_id: string | null;
  simulated: boolean;
  created_at: string;
  decided_at: string | null;
}

export interface Counters {
  notes: number;
  reads: number;
  promotions: number;
  directives: number;
  approvals: number;
  errors: number;
  skipped: number;
}

export interface Settings {
  llm_base_url: string;
  model: string;
  llm_enabled: boolean;
  meko_enabled: boolean;
  clock_offset_minutes: number;
  now: string;
}

export interface Place {
  id: string;
  name: string;
  type: string;
  hostel: string | null;
}

export interface User {
  id: string;
  role: Role;
  name: string;
  hostel: string | null;
  department: string | null;
}

/** The signed-in account (GET /auth/me). Students' `name` is their pseudonym. */
export interface Me extends User {
  email: string | null;
}

export type BusEvent =
  | { type: "hello"; data: Record<string, never> }
  | { type: "ticket.updated"; data: { ticket: Ticket; event: TicketEvent } }
  | { type: "meko.call"; data: MekoCall }
  | { type: "message"; data: Message }
  | { type: "approval.created" | "approval.decided"; data: Approval }
  | { type: "settings.updated"; data: Settings };
