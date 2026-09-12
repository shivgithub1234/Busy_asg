import { api } from "@/lib/api";

// ─── Types ────────────────────────────────────────────────────────────────────

export type RegistrationStatus =
  | "RESERVED"
  | "CONFIRMED"
  | "CHECKED_IN"
  | "EXPIRED"
  | "CANCELLED";

export interface Registration {
  id: string;
  sessionId: string;
  attendeeName: string;
  attendeeEmail: string;
  status: RegistrationStatus;
  reservedAt: string;
  expiresAt?: string | null;
  createdAt: string;
  updatedAt: string;
  session?: {
    id: string;
    title: string;
    eventId?: string;
    event?: { id: string; name: string };
  };
}

export interface RegistrationEvent {
  id: string;
  registrationId: string;
  oldStatus?: RegistrationStatus | null;
  newStatus: RegistrationStatus;
  changedBy?: string | null;
  note?: string | null;
  createdAt: string;
  user?: { id: string; email: string; role: string } | null;
}

export interface RegistrationDetail extends Registration {
  registrationEvents: RegistrationEvent[];
}

export interface ReservePayload {
  attendeeName: string;
  attendeeEmail: string;
}

export interface TransitionPayload {
  status: "CONFIRMED" | "CHECKED_IN" | "CANCELLED";
  note?: string;
}

// ─── Service ──────────────────────────────────────────────────────────────────

export const registrationsService = {
  listBySession: (sessionId: string) =>
    api.get<Registration[]>(`/api/sessions/${sessionId}/registrations`),

  reserve: (sessionId: string, payload: ReservePayload) =>
    api.post<Registration>(`/api/sessions/${sessionId}/registrations`, payload),

  get: (id: string) => api.get<RegistrationDetail>(`/api/registrations/${id}`),

  transition: (id: string, payload: TransitionPayload) =>
    api.patch<Registration>(`/api/registrations/${id}/status`, payload),
};

// Allowed next statuses per current status (mirrors the server-side state machine)
export const ALLOWED_TRANSITIONS: Record<RegistrationStatus, TransitionPayload["status"][]> = {
  RESERVED: ["CONFIRMED", "CANCELLED"],
  CONFIRMED: ["CHECKED_IN", "CANCELLED"],
  CHECKED_IN: [],
  EXPIRED: [],
  CANCELLED: [],
};
