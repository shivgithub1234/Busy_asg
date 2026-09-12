import { api } from "@/lib/api";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface Session {
  id: string;
  eventId: string;
  title: string;
  startTime: string;
  durationMinutes: number;
  location: string;
  capacity: number;
  capacityFillEpoch: number;
  createdAt: string;
  updatedAt: string;
  _count?: { registrations: number };
}

export interface Event {
  id: string;
  name: string;
  description?: string;
  startDate: string;
  endDate: string;
  venue: string;
  archived: boolean;
  createdAt: string;
  updatedAt: string;
  sessions: Session[];
}

export interface CreateEventPayload {
  name: string;
  description?: string;
  startDate: string; // YYYY-MM-DD
  endDate: string;   // YYYY-MM-DD
  venue: string;
}

export interface CreateSessionPayload {
  title: string;
  startTime: string; // ISO datetime
  durationMinutes: number;
  location: string;
  capacity: number;
}

// ─── Events ───────────────────────────────────────────────────────────────────

export const eventsService = {
  list: (showArchived = false) =>
    api.get<Event[]>("/api/events", { params: showArchived ? { archived: "true" } : {} }),

  get: (id: string) => api.get<Event>(`/api/events/${id}`),

  create: (payload: CreateEventPayload) => api.post<Event>("/api/events", payload),

  update: (id: string, payload: Partial<CreateEventPayload>) =>
    api.patch<Event>(`/api/events/${id}`, payload),

  archive: (id: string) => api.patch<Event>(`/api/events/${id}/archive`),

  restore: (id: string) => api.patch<Event>(`/api/events/${id}/restore`),

  // ─── Sessions ───────────────────────────────────────────────────────────

  listSessions: (eventId: string) =>
    api.get<Session[]>(`/api/events/${eventId}/sessions`),

  createSession: (eventId: string, payload: CreateSessionPayload) =>
    api.post<Session>(`/api/events/${eventId}/sessions`, payload),

  updateSession: (eventId: string, sessionId: string, payload: Partial<CreateSessionPayload>) =>
    api.patch<Session>(`/api/events/${eventId}/sessions/${sessionId}`, payload),

  deleteSession: (eventId: string, sessionId: string) =>
    api.delete(`/api/events/${eventId}/sessions/${sessionId}`),
};
