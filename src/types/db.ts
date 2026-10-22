// Hand-written row types for the Supabase tables we read in the app.
// See supabase/migrations/0001_init.sql for the full schema.

export type Role = "volunteer" | "organiser";
export type Slot = "lunch" | "dinner";
export type SessionStatus = "planned" | "live" | "done";
export type DeliveryStatus = "pending" | "delivered" | "not_home" | "skipped" | "cancelled";

export type Profile = {
  id: string;
  role: Role;
  display_name: string;
};

export type Centre = {
  id: string;
  name: string;
};

export type SessionSummary = {
  id: string;
  date: string;
  slot: Slot;
  start_time: string;
  status: SessionStatus;
  centres: { name: string; address: string | null } | null;
};

export type ProblemKind = "uneaten" | "no_answer" | "wrong_address";

export type ReminderKind = "evening_before" | "hour_before";

// One message in a session's team chat. sender_name is copied from the sender's profile when it is sent.
export type ChatMessage = {
  id: string;
  session_id: string;
  sender_id: string | null;
  sender_name: string | null;
  sender_is_organiser: boolean;
  body: string;
  created_at: string;
};

// One unit on a checklist, flattened from deliveries + units + blocks.
export type ChecklistItem = {
  id: string;
  status: DeliveryStatus;
  meal_type: string;
  remarks: string | null;
  done_at: string | null;
  unit_no: string;
  floor: number;
  postal_code: string;
  block_no: string;
  // Photo asked for by an organiser (null when not asked), and the photo once taken.
  photo_requested_at: string | null;
  photo_request_note: string | null;
  photo_path: string | null;
  // Problems volunteers reported on this unit, oldest first.
  problems: { kind: ProblemKind; created_at: string }[];
};

// What import_delivery_list returns for each session in the file.
export type ImportSummary = {
  id: string;
  date: string;
  slot: Slot;
  added: number;
  updated: number;
  kept: number;
  cancelled: number;
};
