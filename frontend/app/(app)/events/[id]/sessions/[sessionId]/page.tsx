"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft, Plus, Download, Upload, Clock, MapPin,
  Users, UserCheck, UserX, Timer,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { eventsService, type Session } from "@/lib/services/events";
import { registrationsService, type Registration, ALLOWED_TRANSITIONS } from "@/lib/services/registrations";
import { staffService, type StaffAssignment } from "@/lib/services/staff";
import { csvService } from "@/lib/services/csv";
import { getErrorMessage } from "@/lib/api";
import { getToken } from "@/lib/auth";
import { CapacityBar } from "@/components/shared/CapacityBar";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { PageHeader } from "@/components/shared/PageHeader";
import { LoadingSpinner } from "@/components/shared/LoadingSpinner";
import { ErrorMessage } from "@/components/shared/ErrorMessage";
import { EmptyState } from "@/components/shared/EmptyState";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";

function fmtDateTime(iso: string) {
  return new Date(iso).toLocaleString("en-GB", {
    day: "numeric", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

function ExpiryCountdown({ expiresAt }: { expiresAt: string }) {
  const [remaining, setRemaining] = useState("");

  useEffect(() => {
    function calc() {
      const diff = new Date(expiresAt).getTime() - Date.now();
      if (diff <= 0) { setRemaining("Expired"); return; }
      const m = Math.floor(diff / 60000);
      const s = Math.floor((diff % 60000) / 1000);
      setRemaining(`${m}m ${s}s`);
    }
    calc();
    const id = setInterval(calc, 1000);
    return () => clearInterval(id);
  }, [expiresAt]);

  return (
    <span className="flex items-center gap-1 text-xs text-amber-600">
      <Timer className="h-3 w-3" />{remaining}
    </span>
  );
}

function ReserveDialog({
  open, onClose, onSaved, sessionId,
}: {
  open: boolean; onClose: () => void; onSaved: () => void; sessionId: string;
}) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => { if (open) { setName(""); setEmail(""); setError(""); } }, [open]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      await registrationsService.reserve(sessionId, { attendeeName: name, attendeeEmail: email });
      onSaved();
      onClose();
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Reserve a seat</DialogTitle>
          <DialogDescription>The attendee will hold a seat for 15 minutes.</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          {error && <ErrorMessage message={error} />}
          <div className="space-y-1.5">
            <Label htmlFor="r-name">Full name</Label>
            <Input id="r-name" value={name} onChange={(e) => setName(e.target.value)} required />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="r-email">Email</Label>
            <Input id="r-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={saving}>{saving ? "Reserving…" : "Reserve"}</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default function SessionDetailPage({ params }: { params: Promise<{ id: string; sessionId: string }> }) {
  const { id: eventId, sessionId } = React.use(params);
  const { isOrganizer } = useAuth();
  const router = useRouter();

  const [session, setSession] = useState<(Session & { _count?: { registrations: number } }) | null>(null);
  const [eventName, setEventName] = useState<string>("");
  const [registrations, setRegistrations] = useState<Registration[]>([]);
  const [staffAssignments, setStaffAssignments] = useState<StaffAssignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [reserveOpen, setReserveOpen] = useState(false);
  const [transitioning, setTransitioning] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError("");
    try {
      // Load session info from the event
      const [eventRes, regsRes] = await Promise.all([
        eventsService.get(eventId),
        registrationsService.listBySession(sessionId),
      ]);
      const s = eventRes.data.sessions.find((s) => s.id === sessionId);
      if (!s) throw new Error("Session not found");
      setSession(s);
      setEventName(eventRes.data.name);
      setRegistrations(regsRes.data);

      if (isOrganizer) {
        const staffRes = await staffService.listSessionStaff(sessionId);
        setStaffAssignments(staffRes.data);
      }
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, [sessionId]); // eslint-disable-line react-hooks/exhaustive-deps

  async function handleTransition(regId: string, status: "CONFIRMED" | "CHECKED_IN" | "CANCELLED") {
    setTransitioning(regId);
    try {
      await registrationsService.transition(regId, { status });
      load();
    } catch (err) {
      alert(getErrorMessage(err));
    } finally {
      setTransitioning(null);
    }
  }

  function handleExportCSV() {
    const url = csvService.exportUrl(sessionId);
    const token = getToken();
    // Open in new tab with token in URL is not possible securely — we construct
    // a temporary anchor with the Authorization header via fetch+blob instead.
    fetch(url, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.blob())
      .then((blob) => {
        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = `checkin-${sessionId}.csv`;
        a.click();
        URL.revokeObjectURL(a.href);
      })
      .catch(() => alert("Export failed"));
  }

  const activeCount = registrations.filter(
    (r) => ["RESERVED", "CONFIRMED", "CHECKED_IN"].includes(r.status)
  ).length;

  if (loading) return <LoadingSpinner />;
  if (error) return <ErrorMessage message={error} />;
  if (!session) return null;

  return (
    <>
      <div className="space-y-6">
        <div>
          <Button variant="ghost" size="sm" className="mb-3 -ml-2 text-zinc-500" onClick={() => router.back()}>
            <ArrowLeft className="mr-1 h-3.5 w-3.5" />Back
          </Button>
          <PageHeader title={session.title} description={eventName ? `Part of "${eventName}"` : ""}>
            <div className="flex items-center gap-2">
              {isOrganizer && (
                <Button variant="outline" size="sm" asChild>
                  <Link href={`/events/${eventId}/sessions/${sessionId}/import`}>
                    <Upload className="h-4 w-4" />Import CSV
                  </Link>
                </Button>
              )}
              <Button variant="outline" size="sm" onClick={handleExportCSV}>
                <Download className="h-4 w-4" />Export CSV
              </Button>
              <Button size="sm" onClick={() => setReserveOpen(true)}>
                <Plus className="h-4 w-4" />Reserve seat
              </Button>
            </div>
          </PageHeader>
        </div>

        {/* Session meta */}
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Card><CardContent className="pt-4">
            <div className="flex items-center gap-2 text-sm text-zinc-500 mb-1"><Clock className="h-4 w-4" />Start time</div>
            <p className="text-sm font-medium">{fmtDateTime(session.startTime)}</p>
          </CardContent></Card>
          <Card><CardContent className="pt-4">
            <div className="flex items-center gap-2 text-sm text-zinc-500 mb-1"><Clock className="h-4 w-4" />Duration</div>
            <p className="text-sm font-medium">{session.durationMinutes} minutes</p>
          </CardContent></Card>
          <Card><CardContent className="pt-4">
            <div className="flex items-center gap-2 text-sm text-zinc-500 mb-1"><MapPin className="h-4 w-4" />Location</div>
            <p className="text-sm font-medium">{session.location}</p>
          </CardContent></Card>
          <Card><CardContent className="pt-4">
            <div className="flex items-center gap-2 text-sm text-zinc-500 mb-1"><Users className="h-4 w-4" />Capacity</div>
            <CapacityBar filled={activeCount} total={session.capacity} />
          </CardContent></Card>
        </div>

        {/* Staff (organizer only) */}
        {isOrganizer && staffAssignments.length > 0 && (
          <div>
            <h3 className="mb-2 text-sm font-semibold text-zinc-500 uppercase tracking-wide">Assigned staff</h3>
            <div className="flex flex-wrap gap-2">
              {staffAssignments.map((a) => (
                <span key={a.id} className="rounded-full border border-zinc-200 bg-white px-3 py-1 text-xs font-medium dark:border-zinc-700 dark:bg-zinc-900">
                  {a.user.email}
                </span>
              ))}
            </div>
          </div>
        )}

        <Separator />

        {/* Registrations table */}
        <div>
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-zinc-400">
            Registrations ({registrations.length})
          </h2>
          {registrations.length === 0 ? (
            <EmptyState icon={UserCheck} title="No registrations yet" description="Reserve the first seat." />
          ) : (
            <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-zinc-50 dark:bg-zinc-900 text-zinc-500 text-xs uppercase tracking-wide">
                  <tr>
                    <th className="px-4 py-3 text-left font-medium">Attendee</th>
                    <th className="px-4 py-3 text-left font-medium">Status</th>
                    <th className="px-4 py-3 text-left font-medium hidden sm:table-cell">Reserved</th>
                    <th className="px-4 py-3 text-left font-medium hidden sm:table-cell">Expiry</th>
                    <th className="px-4 py-3 text-right font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                  {registrations.map((r) => {
                    const nextStatuses = ALLOWED_TRANSITIONS[r.status];
                    return (
                      <tr key={r.id} className="hover:bg-zinc-50/50 dark:hover:bg-zinc-900/50">
                        <td className="px-4 py-3">
                          <Link href={`/registrations/${r.id}`} className="font-medium hover:underline">
                            {r.attendeeName}
                          </Link>
                          <div className="text-xs text-zinc-400">{r.attendeeEmail}</div>
                        </td>
                        <td className="px-4 py-3"><StatusBadge status={r.status} /></td>
                        <td className="px-4 py-3 text-zinc-500 hidden sm:table-cell text-xs">
                          {fmtDateTime(r.reservedAt)}
                        </td>
                        <td className="px-4 py-3 hidden sm:table-cell">
                          {r.status === "RESERVED" && r.expiresAt ? (
                            <ExpiryCountdown expiresAt={r.expiresAt} />
                          ) : (
                            <span className="text-xs text-zinc-300">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex items-center justify-end gap-1">
                            {nextStatuses.includes("CONFIRMED") && (
                              <Button
                                size="sm" variant="outline" className="h-7 text-xs"
                                disabled={transitioning === r.id}
                                onClick={() => handleTransition(r.id, "CONFIRMED")}
                              >
                                <UserCheck className="h-3 w-3" />Confirm
                              </Button>
                            )}
                            {nextStatuses.includes("CHECKED_IN") && (
                              <Button
                                size="sm" className="h-7 text-xs"
                                disabled={transitioning === r.id}
                                onClick={() => handleTransition(r.id, "CHECKED_IN")}
                              >
                                Check in
                              </Button>
                            )}
                            {nextStatuses.includes("CANCELLED") && (
                              <Button
                                size="sm" variant="ghost"
                                className="h-7 text-xs text-red-500 hover:text-red-600"
                                disabled={transitioning === r.id}
                                onClick={() => handleTransition(r.id, "CANCELLED")}
                              >
                                <UserX className="h-3 w-3" />Cancel
                              </Button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      <ReserveDialog
        open={reserveOpen}
        onClose={() => setReserveOpen(false)}
        onSaved={load}
        sessionId={sessionId}
      />
    </>
  );
}
