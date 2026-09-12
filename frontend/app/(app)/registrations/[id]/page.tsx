"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, UserCheck, UserX, MessageSquare } from "lucide-react";
import { registrationsService, type RegistrationDetail, ALLOWED_TRANSITIONS } from "@/lib/services/registrations";
import { getErrorMessage } from "@/lib/api";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { PageHeader } from "@/components/shared/PageHeader";
import { LoadingSpinner } from "@/components/shared/LoadingSpinner";
import { ErrorMessage } from "@/components/shared/ErrorMessage";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

function fmtDateTime(iso: string) {
  return new Date(iso).toLocaleString("en-GB", {
    day: "numeric", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

const STATUS_DOT: Record<string, string> = {
  RESERVED: "bg-amber-400",
  CONFIRMED: "bg-blue-400",
  CHECKED_IN: "bg-emerald-500",
  EXPIRED: "bg-zinc-300",
  CANCELLED: "bg-red-400",
};

function TransitionDialog({
  open, onClose, onDone, regId,
  targetStatus,
}: {
  open: boolean; onClose: () => void; onDone: () => void;
  regId: string; targetStatus: "CONFIRMED" | "CHECKED_IN" | "CANCELLED";
}) {
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => { if (open) { setNote(""); setError(""); } }, [open]);

  const labels: Record<string, string> = {
    CONFIRMED: "Confirm registration",
    CHECKED_IN: "Check in attendee",
    CANCELLED: "Cancel registration",
  };

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      await registrationsService.transition(regId, { status: targetStatus, note: note || undefined });
      onDone();
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
          <DialogTitle>{labels[targetStatus]}</DialogTitle>
          <DialogDescription>You can optionally add a note to the audit log.</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          {error && <ErrorMessage message={error} />}
          <div className="space-y-1.5">
            <Label htmlFor="t-note">Note (optional)</Label>
            <Input
              id="t-note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="e.g. ID verified"
            />
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button
              type="submit"
              disabled={saving}
              variant={targetStatus === "CANCELLED" ? "destructive" : "default"}
            >
              {saving ? "Saving…" : labels[targetStatus]}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default function RegistrationDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = React.use(params);
  const router = useRouter();

  const [reg, setReg] = useState<RegistrationDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [transitionTarget, setTransitionTarget] = useState<"CONFIRMED" | "CHECKED_IN" | "CANCELLED" | null>(null);

  async function load() {
    setLoading(true);
    setError("");
    try {
      const { data } = await registrationsService.get(id);
      setReg(data);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, [id]); // eslint-disable-line react-hooks/exhaustive-deps

  if (loading) return <LoadingSpinner />;
  if (error) return <ErrorMessage message={error} />;
  if (!reg) return null;

  const nextStatuses = ALLOWED_TRANSITIONS[reg.status];

  return (
    <>
      <div className="space-y-6">
        <div>
          <Button variant="ghost" size="sm" className="mb-3 -ml-2 text-zinc-500" onClick={() => router.back()}>
            <ArrowLeft className="mr-1 h-3.5 w-3.5" />Back
          </Button>
          <PageHeader
            title={reg.attendeeName}
            description={reg.attendeeEmail}
          >
            <div className="flex items-center gap-2">
              <StatusBadge status={reg.status} />
              {nextStatuses.includes("CONFIRMED") && (
                <Button size="sm" variant="outline" onClick={() => setTransitionTarget("CONFIRMED")}>
                  <UserCheck className="h-4 w-4" />Confirm
                </Button>
              )}
              {nextStatuses.includes("CHECKED_IN") && (
                <Button size="sm" onClick={() => setTransitionTarget("CHECKED_IN")}>
                  <UserCheck className="h-4 w-4" />Check in
                </Button>
              )}
              {nextStatuses.includes("CANCELLED") && (
                <Button size="sm" variant="destructive" onClick={() => setTransitionTarget("CANCELLED")}>
                  <UserX className="h-4 w-4" />Cancel
                </Button>
              )}
            </div>
          </PageHeader>
        </div>

        <div className="grid gap-4 lg:grid-cols-3">
          {/* Details card */}
          <div className="lg:col-span-1 space-y-4">
            <Card>
              <CardHeader><CardTitle className="text-sm">Details</CardTitle></CardHeader>
              <CardContent className="space-y-3 text-sm">
                <Row label="Session">
                  {reg.session ? (
                    <Link
                      href={`/events/${reg.session.eventId ?? reg.session.id}/sessions/${reg.session.id}`}
                      className="font-medium hover:underline text-zinc-900 dark:text-zinc-50"
                    >
                      {reg.session.title}
                    </Link>
                  ) : "—"}
                </Row>
                <Separator />
                <Row label="Reserved">{fmtDateTime(reg.reservedAt)}</Row>
                {reg.expiresAt && <Row label="Expires">{fmtDateTime(reg.expiresAt)}</Row>}
                <Separator />
                <Row label="Created">{fmtDateTime(reg.createdAt)}</Row>
                <Row label="Updated">{fmtDateTime(reg.updatedAt)}</Row>
              </CardContent>
            </Card>
          </div>

          {/* Timeline */}
          <div className="lg:col-span-2">
            <Card>
              <CardHeader><CardTitle className="text-sm">Audit timeline</CardTitle></CardHeader>
              <CardContent>
                {reg.registrationEvents.length === 0 ? (
                  <p className="text-sm text-zinc-400">No events recorded.</p>
                ) : (
                  <ol className="relative border-l border-zinc-200 dark:border-zinc-700 space-y-6 pl-6">
                    {reg.registrationEvents.map((ev, i) => (
                      <li key={ev.id} className="relative">
                        {/* dot */}
                        <span
                          className={cn(
                            "absolute -left-[25px] flex h-4 w-4 items-center justify-center rounded-full border-2 border-white dark:border-zinc-950",
                            STATUS_DOT[ev.newStatus] ?? "bg-zinc-300"
                          )}
                        />
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <p className="text-sm font-medium text-zinc-900 dark:text-zinc-50">
                              {ev.oldStatus ? (
                                <>{ev.oldStatus} → {ev.newStatus}</>
                              ) : (
                                <>Created as {ev.newStatus}</>
                              )}
                            </p>
                            {ev.note && (
                              <p className="mt-1 flex items-start gap-1 text-xs text-zinc-500">
                                <MessageSquare className="mt-0.5 h-3 w-3 shrink-0" />
                                {ev.note}
                              </p>
                            )}
                            {ev.user && (
                              <p className="mt-0.5 text-xs text-zinc-400">by {ev.user.email}</p>
                            )}
                          </div>
                          <time className="shrink-0 text-xs text-zinc-400">
                            {fmtDateTime(ev.createdAt)}
                          </time>
                        </div>
                      </li>
                    ))}
                  </ol>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      {transitionTarget && (
        <TransitionDialog
          open
          onClose={() => setTransitionTarget(null)}
          onDone={load}
          regId={id}
          targetStatus={transitionTarget}
        />
      )}
    </>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <span className="text-zinc-500 shrink-0">{label}</span>
      <span className="text-right text-zinc-900 dark:text-zinc-50">{children}</span>
    </div>
  );
}
