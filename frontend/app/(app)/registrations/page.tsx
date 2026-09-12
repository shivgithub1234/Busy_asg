"use client";

import { Suspense, useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import { Search, SlidersHorizontal } from "lucide-react";
import { searchService, type SearchParams } from "@/lib/services/search";
import { eventsService, type Event } from "@/lib/services/events";
import { type RegistrationStatus } from "@/lib/services/registrations";
import { getErrorMessage } from "@/lib/api";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { PageHeader } from "@/components/shared/PageHeader";
import { LoadingSpinner } from "@/components/shared/LoadingSpinner";
import { ErrorMessage } from "@/components/shared/ErrorMessage";
import { EmptyState } from "@/components/shared/EmptyState";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";

const STATUSES: RegistrationStatus[] = [
  "RESERVED", "CONFIRMED", "CHECKED_IN", "EXPIRED", "CANCELLED",
];

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "numeric", month: "short", year: "numeric",
  });
}

// ── Inner component — uses useSearchParams (must be inside <Suspense>) ────────

function RegistrationsInner() {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();

  const [q, setQ] = useState(sp.get("q") ?? "");
  const [status, setStatus] = useState<string>(sp.get("status") ?? "");
  const [eventId, setEventId] = useState<string>(sp.get("eventId") ?? "");
  const [page, setPage] = useState(parseInt(sp.get("page") ?? "1", 10));

  const [results, setResults] = useState<Awaited<ReturnType<typeof searchService.search>>["data"] | null>(null);
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Load events for filter dropdown once
  useEffect(() => {
    eventsService.list().then(({ data }) => setEvents(data)).catch(() => {});
  }, []);

  const doSearch = useCallback(async (params: SearchParams) => {
    setLoading(true);
    setError("");
    try {
      const { data } = await searchService.search({ pageSize: 25, ...params });
      setResults(data);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, []);

  // Sync URL params → local state → fetch
  useEffect(() => {
    const params: SearchParams = {
      q: sp.get("q") ?? undefined,
      status: (sp.get("status") as RegistrationStatus) ?? undefined,
      eventId: sp.get("eventId") ?? undefined,
      page: parseInt(sp.get("page") ?? "1", 10),
      pageSize: 25,
    };
    setQ(params.q ?? "");
    setStatus(params.status ?? "");
    setEventId(params.eventId ?? "");
    setPage(params.page ?? 1);
    doSearch(params);
  }, [sp, doSearch]);

  function pushParams(overrides: Record<string, string | undefined>) {
    const next = new URLSearchParams(sp.toString());
    Object.entries({ q, status, eventId, page: String(page), ...overrides }).forEach(
      ([k, v]) => { if (v) next.set(k, v); else next.delete(k); }
    );
    next.set("page", overrides.page ?? "1");
    router.push(`${pathname}?${next.toString()}`);
  }

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    pushParams({
      q: q || undefined,
      status: status || undefined,
      eventId: eventId || undefined,
      page: "1",
    });
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Registrations" description="Search and manage all registrations." />

      {/* Filters */}
      <form onSubmit={handleSearch} className="flex flex-wrap gap-2 items-end">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400 pointer-events-none" />
          <Input
            className="pl-9"
            placeholder="Name or email…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>

        <Select value={status || "__all"} onValueChange={(v) => setStatus(v === "__all" ? "" : v)}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="All statuses" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all">All statuses</SelectItem>
            {STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
          </SelectContent>
        </Select>

        <Select value={eventId || "__all"} onValueChange={(v) => setEventId(v === "__all" ? "" : v)}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="All events" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all">All events</SelectItem>
            {events.map((e) => <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>)}
          </SelectContent>
        </Select>

        <Button type="submit" variant="outline" className="gap-1.5">
          <SlidersHorizontal className="h-4 w-4" />Filter
        </Button>
      </form>

      {error && <ErrorMessage message={error} />}

      {loading ? (
        <LoadingSpinner />
      ) : !results || results.data.length === 0 ? (
        <EmptyState
          icon={Search}
          title="No registrations found"
          description="Try adjusting your filters."
        />
      ) : (
        <>
          <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-zinc-50 dark:bg-zinc-900 text-zinc-500 text-xs uppercase tracking-wide">
                <tr>
                  <th className="px-4 py-3 text-left font-medium">Attendee</th>
                  <th className="px-4 py-3 text-left font-medium hidden sm:table-cell">Event / Session</th>
                  <th className="px-4 py-3 text-left font-medium">Status</th>
                  <th className="px-4 py-3 text-left font-medium hidden md:table-cell">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                {results.data.map((r) => (
                  <tr key={r.id} className="hover:bg-zinc-50/50 dark:hover:bg-zinc-900/50">
                    <td className="px-4 py-3">
                      <Link href={`/registrations/${r.id}`} className="font-medium hover:underline">
                        {r.attendeeName}
                      </Link>
                      <div className="text-xs text-zinc-400">{r.attendeeEmail}</div>
                    </td>
                    <td className="px-4 py-3 hidden sm:table-cell">
                      <div className="text-zinc-900 dark:text-zinc-50 truncate max-w-xs">
                        {r.session?.event?.name ?? "—"}
                      </div>
                      <div className="text-xs text-zinc-400 truncate max-w-xs">
                        {r.session?.title}
                      </div>
                    </td>
                    <td className="px-4 py-3"><StatusBadge status={r.status} /></td>
                    <td className="px-4 py-3 hidden md:table-cell text-zinc-500 text-xs">
                      {fmtDate(r.createdAt)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {results.pagination.totalPages > 1 && (
            <div className="flex items-center justify-between text-sm">
              <p className="text-zinc-500">
                Showing {(page - 1) * 25 + 1}–
                {Math.min(page * 25, results.pagination.total)} of{" "}
                {results.pagination.total}
              </p>
              <div className="flex gap-2">
                <Button
                  variant="outline" size="sm"
                  disabled={page <= 1}
                  onClick={() => pushParams({ page: String(page - 1) })}
                >
                  Previous
                </Button>
                <Button
                  variant="outline" size="sm"
                  disabled={page >= results.pagination.totalPages}
                  onClick={() => pushParams({ page: String(page + 1) })}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ── Page export — wraps inner in Suspense (required for useSearchParams) ──────

export default function RegistrationsPage() {
  return (
    <Suspense fallback={<LoadingSpinner />}>
      <RegistrationsInner />
    </Suspense>
  );
}
