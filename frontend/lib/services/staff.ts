import { api } from "@/lib/api";
import type { Session } from "./events";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface StaffUser {
  id: string;
  email: string;
  role: "STAFF";
  createdAt: string;
}

export interface StaffAssignment {
  id: string;
  userId: string;
  sessionId: string;
  createdAt: string;
  user: { id: string; email: string; role: string };
}

export type MySession = Session & {
  event: { id: string; name: string; venue: string };
  _count: { registrations: number };
};

// ─── Service ──────────────────────────────────────────────────────────────────

export const staffService = {
  listStaff: () => api.get<StaffUser[]>("/api/staff"),

  listSessionStaff: (sessionId: string) =>
    api.get<StaffAssignment[]>(`/api/sessions/${sessionId}/staff`),

  assign: (sessionId: string, userId: string) =>
    api.post<StaffAssignment>(`/api/sessions/${sessionId}/staff`, { userId }),

  unassign: (sessionId: string, userId: string) =>
    api.delete(`/api/sessions/${sessionId}/staff/${userId}`),

  mySessions: () => api.get<MySession[]>("/api/staff/my-sessions"),
};
