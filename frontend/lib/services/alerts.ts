import { api } from "@/lib/api";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface Alert {
  sessionId: string;
  sessionTitle: string;
  event: { id: string; name: string };
  capacity: number;
  activeRegistrations: number;
  fillEpoch: number;
}

export interface AlertCount {
  count: number;
}

// ─── Service ──────────────────────────────────────────────────────────────────

export const alertsService = {
  list: () => api.get<Alert[]>("/api/alerts"),

  count: () => api.get<AlertCount>("/api/alerts/count"),

  dismiss: (sessionId: string) => api.post(`/api/alerts/${sessionId}/dismiss`),
};
