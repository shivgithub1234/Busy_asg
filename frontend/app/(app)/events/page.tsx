"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Plus, Archive, RotateCcw, CalendarDays, MapPin } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { eventsService, type Event } from "@/lib/services/events";
import { getErrorMessage } from "@/lib/api";
import { PageHeader } from "@/components/shared/PageHeader";
import { EmptyState } from "@/components/shared/EmptyState";
import { LoadingSpinner } from "@/components/shared/LoadingSpinner";
import { ErrorMessage } from "@/components/shared/ErrorMessage";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

interface EventFormData {
  name: string;
  description: string;
  startDate: string;
  endDate: string;
  venue: string;
}

const EMPTY_FORM: EventFormData = { name: "", description: "", startDate: "", endDate: "", venue: "" };

function EventFormDialog({
  open,
  onClose,
  onSaved,
  initial,
  editId,
}: {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  initial?: EventFormData;
  editId?: string;
}) {
  const [form, setForm] = useState<EventFormData>(initial ?? EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (open) { setForm(initial ?? EMPTY_FORM); setError(""); }
  }, [open, initial]);

  const set = (k: keyof EventFormData) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      if (editId) {
        await eventsService.update(editId, form);
      } else {
        await eventsService.create(form);
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
          <DialogTitle>{editId ? "Edit event" : "New event"}</DialogTitle>
          <DialogDescription>Fill in the event details below.</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSave} className="space-y-4 pt-2">
          {error && <ErrorMessage message={error} />}
          <div className="space-y-1.5">
            <Label htmlFor="ev-name">Name</Label>
            <Input id="ev-name" value={form.name} onChange={set("name")} required />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ev-desc">Description</Label>
            <Input id="ev-desc" value={form.description} onChange={set("description")} placeholder="Optional" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="ev-start">Start date</Label>
              <Input id="ev-start" type="date" value={form.startDate} onChange={set("startDate")} required />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ev-end">End date</Label>
              <Input id="ev-end" type="date" value={form.endDate} onChange={set("endDate")} required />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ev-venue">Venue</Label>
            <Input id="ev-venue" value={form.venue} onChange={set("venue")} required />
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

export default function EventsPage() {
  const { isOrganizer } = useAuth();
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [tab, setTab] = useState<"active" | "archived">("active");
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Event | null>(null);

  async function load() {
    setLoading(true);
    setError("");
    try {
      const { data } = await eventsService.list(isOrganizer && tab === "archived");
      // When showing "active", filter out archived on client side too (backend already does this,
      // but keeps the logic explicit).
      setEvents(tab === "archived" ? data.filter((e) => e.archived) : data.filter((e) => !e.archived));
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, [tab]); // eslint-disable-line react-hooks/exhaustive-deps

  async function handleArchive(id: string) {
    try { await eventsService.archive(id); load(); } catch { /* ignore */ }
  }

  async function handleRestore(id: string) {
    try { await eventsService.restore(id); load(); } catch { /* ignore */ }
  }

  const editInitial = editing
    ? {
        name: editing.name,
        description: editing.description ?? "",
        startDate: editing.startDate.slice(0, 10),
        endDate: editing.endDate.slice(0, 10),
        venue: editing.venue,
      }
    : undefined;

  return (
    <>
      <div className="space-y-6">
        <PageHeader title="Events" description="Manage your events and sessions.">
          {isOrganizer && (
            <Button onClick={() => { setEditing(null); setFormOpen(true); }}>
              <Plus className="h-4 w-4" />
              New event
            </Button>
          )}
        </PageHeader>

        {isOrganizer && (
          <Tabs value={tab} onValueChange={(v) => setTab(v as "active" | "archived")}>
            <TabsList>
              <TabsTrigger value="active">Active</TabsTrigger>
              <TabsTrigger value="archived">Archived</TabsTrigger>
            </TabsList>
          </Tabs>
        )}

        {error && <ErrorMessage message={error} />}

        {loading ? (
          <LoadingSpinner />
        ) : events.length === 0 ? (
          <EmptyState
            icon={CalendarDays}
            title={tab === "archived" ? "No archived events" : "No events yet"}
            description={isOrganizer ? "Create your first event to get started." : undefined}
          >
            {isOrganizer && tab === "active" && (
              <Button onClick={() => { setEditing(null); setFormOpen(true); }}>
                <Plus className="h-4 w-4" />New event
              </Button>
            )}
          </EmptyState>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {events.map((ev) => (
              <Card key={ev.id} className="group flex flex-col hover:shadow-md transition-shadow">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-2">
                    <CardTitle className="text-base leading-snug">
                      <Link href={`/events/${ev.id}`} className="hover:underline">
                        {ev.name}
                      </Link>
                    </CardTitle>
                    {ev.archived && <Badge variant="secondary" className="shrink-0">Archived</Badge>}
                  </div>
                  {ev.description && (
                    <CardDescription className="line-clamp-2">{ev.description}</CardDescription>
                  )}
                </CardHeader>
                <CardContent className="flex-1 space-y-2">
                  <div className="flex items-center gap-1.5 text-sm text-zinc-500">
                    <CalendarDays className="h-3.5 w-3.5 shrink-0" />
                    <span>{formatDate(ev.startDate)} – {formatDate(ev.endDate)}</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-sm text-zinc-500">
                    <MapPin className="h-3.5 w-3.5 shrink-0" />
                    <span className="truncate">{ev.venue}</span>
                  </div>
                  <p className="text-xs text-zinc-400">
                    {ev.sessions.length} session{ev.sessions.length !== 1 ? "s" : ""}
                  </p>
                </CardContent>
                {isOrganizer && (
                  <div className="flex items-center gap-1 border-t border-zinc-100 px-6 py-3 dark:border-zinc-800">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-xs"
                      onClick={() => { setEditing(ev); setFormOpen(true); }}
                    >
                      Edit
                    </Button>
                    {ev.archived ? (
                      <Button variant="ghost" size="sm" className="text-xs" onClick={() => handleRestore(ev.id)}>
                        <RotateCcw className="mr-1 h-3 w-3" />Restore
                      </Button>
                    ) : (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-xs text-zinc-500"
                        onClick={() => handleArchive(ev.id)}
                      >
                        <Archive className="mr-1 h-3 w-3" />Archive
                      </Button>
                    )}
                    <Button variant="ghost" size="sm" className="ml-auto text-xs" asChild>
                      <Link href={`/events/${ev.id}`}>View →</Link>
                    </Button>
                  </div>
                )}
              </Card>
            ))}
          </div>
        )}
      </div>

      <EventFormDialog
        open={formOpen}
        onClose={() => setFormOpen(false)}
        onSaved={load}
        initial={editInitial}
        editId={editing?.id}
      />
    </>
  );
}
