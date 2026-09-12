"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Plus, Clock, MapPin, Users, Pencil, Trash2 } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { eventsService, type Event, type Session, type CreateSessionPayload } from "@/lib/services/events";
import { getErrorMessage } from "@/lib/api";
import { CapacityBar } from "@/components/shared/CapacityBar";
import { PageHeader } from "@/components/shared/PageHeader";
import { LoadingSpinner } from "@/components/shared/LoadingSpinner";
import { ErrorMessage } from "@/components/shared/ErrorMessage";
import { EmptyState } from "@/components/shared/EmptyState";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";

function fmtDateTime(iso: string) {
  return new Date(iso).toLocaleString("en-GB", {
    day: "numeric", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

type SessionFormData = {
  title: string;
  startTime: string;
  durationMinutes: string;
  location: string;
  capacity: string;
};

const EMPTY_SESSION: SessionFormData = {
  title: "", startTime: "", durationMinutes: "60", location: "", capacity: "50",
};

function SessionDialog({
  open, onClose, onSaved, eventId, editSession,
}: {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  eventId: string;
  editSession?: Session;
}) {
  const [form, setForm] = useState<SessionFormData>(EMPTY_SESSION);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) return;
    if (editSession) {
      setForm({
        title: editSession.title,
        startTime: editSession.startTime.slice(0, 16), // datetime-local format
        durationMinutes: String(editSession.durationMinutes),
        location: editSession.location,
        capacity: String(editSession.capacity),
      });
    } else {
      setForm(EMPTY_SESSION);
    }
    setError("");
  }, [open, editSession]);

  const set = (k: keyof SessionFormData) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      const payload: CreateSessionPayload = {
        title: form.title,
        startTime: new Date(form.startTime).toISOString(),
        durationMinutes: parseInt(form.durationMinutes, 10),
        location: form.location,
        capacity: parseInt(form.capacity, 10),
      };
      if (editSession) {
        await eventsService.updateSession(eventId, editSession.id, payload);
      } else {
        await eventsService.createSession(eventId, payload);
      }
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
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{editSession ? "Edit session" : "New session"}</DialogTitle>
          <DialogDescription>Sessions are nested under this event.</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSave} className="space-y-4 pt-2">
          {error && <ErrorMessage message={error} />}
          <div className="space-y-1.5">
            <Label htmlFor="s-title">Title</Label>
            <Input id="s-title" value={form.title} onChange={set("title")} required />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="s-start">Start time</Label>
            <Input id="s-start" type="datetime-local" value={form.startTime} onChange={set("startTime")} required />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="s-dur">Duration (min)</Label>
              <Input id="s-dur" type="number" min={1} value={form.durationMinutes} onChange={set("durationMinutes")} required />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="s-cap">Capacity</Label>
              <Input id="s-cap" type="number" min={1} value={form.capacity} onChange={set("capacity")} required />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="s-loc">Location</Label>
            <Input id="s-loc" value={form.location} onChange={set("location")} required />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={saving}>{saving ? "Saving…" : "Save"}</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default function EventDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = React.use(params);
  const { isOrganizer } = useAuth();
  const router = useRouter();
  const [event, setEvent] = useState<Event | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [sessionOpen, setSessionOpen] = useState(false);
  const [editSession, setEditSession] = useState<Session | undefined>();

  async function load() {
    setLoading(true);
    setError("");
    try {
      const { data } = await eventsService.get(id);
      setEvent(data);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, [id]); // eslint-disable-line react-hooks/exhaustive-deps

  async function handleDeleteSession(sessionId: string) {
    if (!confirm("Delete this session? This cannot be undone.")) return;
    try {
      await eventsService.deleteSession(id, sessionId);
      load();
    } catch (err) {
      alert(getErrorMessage(err));
    }
  }

  if (loading) return <LoadingSpinner />;
  if (error) return <ErrorMessage message={error} />;
  if (!event) return null;

  return (
    <>
      <div className="space-y-6">
        <div>
          <Button variant="ghost" size="sm" className="mb-3 -ml-2 text-zinc-500" onClick={() => router.back()}>
            <ArrowLeft className="mr-1 h-3.5 w-3.5" />Back
          </Button>
          <PageHeader
            title={event.name}
            description={`${fmtDate(event.startDate)} – ${fmtDate(event.endDate)} · ${event.venue}`}
          >
            {isOrganizer && (
              <Button onClick={() => { setEditSession(undefined); setSessionOpen(true); }}>
                <Plus className="h-4 w-4" />Add session
              </Button>
            )}
          </PageHeader>
          {event.archived && (
            <Badge variant="secondary" className="mt-2">Archived</Badge>
          )}
          {event.description && (
            <p className="mt-3 text-sm text-zinc-600 dark:text-zinc-400 max-w-2xl">{event.description}</p>
          )}
        </div>

        <div>
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-zinc-400">
            Sessions ({event.sessions.length})
          </h2>
          {event.sessions.length === 0 ? (
            <EmptyState
              icon={Clock}
              title="No sessions yet"
              description={isOrganizer ? "Add the first session to this event." : undefined}
            >
              {isOrganizer && (
                <Button onClick={() => { setEditSession(undefined); setSessionOpen(true); }}>
                  <Plus className="h-4 w-4" />Add session
                </Button>
              )}
            </EmptyState>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {event.sessions.map((s) => {
                const filled = (s as Session & { _count?: { registrations: number } })._count?.registrations ?? 0;
                return (
                  <Card key={s.id} className="flex flex-col hover:shadow-md transition-shadow">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-medium leading-snug">
                        <Link href={`/events/${id}/sessions/${s.id}`} className="hover:underline">
                          {s.title}
                        </Link>
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="flex-1 space-y-3">
                      <div className="space-y-1.5 text-xs text-zinc-500">
                        <div className="flex items-center gap-1.5">
                          <Clock className="h-3 w-3 shrink-0" />
                          <span>{fmtDateTime(s.startTime)} · {s.durationMinutes} min</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <MapPin className="h-3 w-3 shrink-0" />
                          <span>{s.location}</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <Users className="h-3 w-3 shrink-0" />
                          <span>Capacity: {s.capacity}</span>
                        </div>
                      </div>
                      <CapacityBar filled={filled} total={s.capacity} />
                    </CardContent>
                    <div className="flex items-center gap-1 border-t border-zinc-100 px-6 py-3 dark:border-zinc-800">
                      <Button variant="ghost" size="sm" className="text-xs" asChild>
                        <Link href={`/events/${id}/sessions/${s.id}`}>View</Link>
                      </Button>
                      {isOrganizer && (
                        <>
                          <Button
                            variant="ghost" size="sm" className="text-xs"
                            onClick={() => { setEditSession(s); setSessionOpen(true); }}
                          >
                            <Pencil className="mr-1 h-3 w-3" />Edit
                          </Button>
                          <Button
                            variant="ghost" size="sm"
                            className="ml-auto text-xs text-red-500 hover:text-red-600"
                            onClick={() => handleDeleteSession(s.id)}
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </>
                      )}
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      </div>

      <SessionDialog
        open={sessionOpen}
        onClose={() => setSessionOpen(false)}
        onSaved={load}
        eventId={id}
        editSession={editSession}
      />
    </>
  );
}
