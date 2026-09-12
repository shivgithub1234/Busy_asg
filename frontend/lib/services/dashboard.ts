import { api } from "@/lib/api";
import type { RegistrationStatus } from "./registrations";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface DashboardData {
  sessionsTodayCount: number;
  checkedInTodayCount: number;
  expiredThisWeekCount: number;
  sessionsAtCapacityCount: number;
  statusBreakdown: Array<{ status: RegistrationStatus; count: number }>;
  sessionBreakdown: Array<{ sessionId: string; sessionTitle: string; count: number }>;
  checkinsChart: Array<{ date: string; count: number }>;
}

// ─── Service ──────────────────────────────────────────────────────────────────

export const dashboardService = {
  get: () => api.get<DashboardData>("/api/dashboard"),
};
