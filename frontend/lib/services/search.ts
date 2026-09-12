import { api } from "@/lib/api";
import type { Registration, RegistrationStatus } from "./registrations";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface SearchParams {
  q?: string;
  eventId?: string;
  sessionId?: string;
  status?: RegistrationStatus;
  sortBy?: "createdAt" | "attendeeName" | "attendeeEmail" | "status";
  sortOrder?: "asc" | "desc";
  page?: number;
  pageSize?: number;
}

export interface PaginationMeta {
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface SearchResult {
  data: Registration[];
  pagination: PaginationMeta;
}

// ─── Service ──────────────────────────────────────────────────────────────────

export const searchService = {
  search: (params: SearchParams = {}) =>
    api.get<SearchResult>("/api/registrations", {
      params: Object.fromEntries(
        Object.entries(params).filter(([, v]) => v !== undefined && v !== "")
      ),
    }),
};
