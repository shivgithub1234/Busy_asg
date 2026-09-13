import { api } from "@/lib/api";

// ─── Types ────────────────────────────────────────────────────────────────────

export type RowStatus = "created" | "duplicate" | "rejected";

export interface ImportReportRow {
  row: number;
  status: RowStatus;
  data?: { id: string; email: string };
  reason?: string;
}

export interface ImportResult {
  summary: { total: number; created: number; skipped: number };
  report: ImportReportRow[];
}

// ─── Service ──────────────────────────────────────────────────────────────────

export const csvService = {
  /** Upload a CSV file for bulk registration import. */
  import: (sessionId: string, file: File) => {
    const form = new FormData();
    form.append("file", file);
    return api.post<ImportResult>(
      `/api/sessions/${sessionId}/registrations/import`,
      form,
      {
        headers: {
          // Let the browser set Content-Type with the correct multipart boundary.
          // Explicitly deleting the instance default prevents axios from locking
          // it to application/json, which breaks multer's file parsing.
          "Content-Type": undefined,
        },
      }
    );
  },

  /** Returns the download URL for the check-in sheet CSV. */
  exportUrl: (sessionId: string): string => {
    const base = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";
    return `${base}/api/sessions/${sessionId}/registrations/export`;
  },
};
