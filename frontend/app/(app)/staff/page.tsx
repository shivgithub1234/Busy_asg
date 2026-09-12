"use client";

import { useEffect, useState } from "react";
import { Plus, Trash2, Users } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { staffService, type StaffUser, type StaffAssignment } from "@/lib/services/staff";
import { eventsService, type Event } from "@/lib/services/events";
import { getErrorMessage } from "@/lib/api";
import { AuthGuard } from "@/components/shared/AuthGuard";
import { PageHeader } from "@/components/shared/PageHeader";
import { EmptyState } from "@/components/shared/EmptyState";
import { LoadingSpinner } from "@/components/shared/LoadingSpinner";
import { ErrorMessage } from "@/components/shared/ErrorMessage";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

function AssignDialog({
  open, onClose, onSaved,
  sessionId, staffList, existing,
}: {
  open: boolean; onClose: () => void; onSaved: () => void;
  sessionId: string; staffList: StaffUser[]; existing: StaffAssignment[];
}) {
  const [userId, setUserId] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const assignedIds = new Set(existing.map((a) => a.userId));
  const available = staffList.filter((u) => !assignedIds.has(u.id));

  useEffect(() => { if (open) { setUserId(""); setError(""); } }, [open]);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!userId) return;
    setSaving(true);
    setError("");
    try {
      await staffService.assign(sessionId, userId);
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
          <DialogTitle>Assign staff to session</DialogTitle>
          <DialogDescription>Select a staff member to add to this session.</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSave} className="space-y-4 pt-2">
          {error && <ErrorMessage message={error} />}
          {available.length === 0 ? (
            <p className="text-sm text-zinc-500">All staff members are already assigned.</p>
          ) : (
            <>
              <div className="space-y-1.5">
                <Label htmlFor="assign-user">Staff member</Label>
                <Select value={userId} onValueChange={setUserId}>
                  <SelectTrigger id="assign-user">
                    <SelectValue placeholder="Select staff…" />
                  </SelectTrigger>
                  <SelectContent>
                    {available.map((u) => (
                      <SelectItem key={u.id} value={u.id}>{u.email}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex justify-end gap-2 pt-1">
                <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
                <Button type="submit" disabled={saving || !userId}>
                  {saving ? "Assigning…" : "Assign"}
                </Button>
              </div>
            </>
          )}
          {available.length === 0 && (
            <div className="flex justify-end">
              <Button type="button" variant="outline" onClick={onClose}>Close</Button>
            </div>
          )}
        </form>
      </DialogContent>
    </Dialog>
  );
}

function SessionStaffPanel({ session, eventId, staffList }: {
  session: { id: string; title: string };
  eventId: string;
  staffList: StaffUser[];
}) {
  const [assignments, setAssignments] = useState<StaffAssignment[]>([]);
  const [loadingA, setLoadingA] = useState(true);
  const [assignOpen, setAssignOpen] = useState(false);
  const [removing, setRemoving] = useState<string | null>(null);

  async function loadAssignments() {
    setLoadingA(true);
    try {
      const { data } = await staffService.listSessionStaff(session.id);
      setAssignments(data);
    } finally {
      setLoadingA(false);
    }
  }

  useEffect(() => { loadAssignments(); }, [session.id]); // eslint-disable-line react-hooks/exhaustive-deps

  async function handleUnassign(userId: string) {
    setRemoving(userId);
    try {
      await staffService.unassign(session.id, userId);
      loadAssignments();
    } catch (err) {
      alert(getErrorMessage(err));
    } finally {
      setRemoving(null);
    }
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm">{session.title}</CardTitle>
          <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={() => setAssignOpen(true)}>
            <Plus className="h-3 w-3" />Assign
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {loadingA ? (
          <p className="text-xs text-zinc-400">Loading…</p>
        ) : assignments.length === 0 ? (
          <p className="text-xs text-zinc-400">No staff assigned.</p>
        ) : (
          <div className="space-y-2">
            {assignments.map((a) => (
              <div key={a.id} className="flex items-center justify-between text-sm">
                <span className="text-zinc-700 dark:text-zinc-300">{a.user.email}</span>
                <Button
                  variant="ghost" size="sm"
                  className="h-6 w-6 p-0 text-red-400 hover:text-red-600"
                  disabled={removing === a.userId}
                  onClick={() => handleUnassign(a.userId)}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </CardContent>
      <AssignDialog
        open={assignOpen}
        onClose={() => setAssignOpen(false)}
        onSaved={loadAssignments}
        sessionId={session.id}
        staffList={staffList}
        existing={assignments}
      />
    </Card>
  );
}

export default function StaffPage() {
  const { isOrganizer } = useAuth();
  const [staffList, setStaffList] = useState<StaffUser[]>([]);
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    Promise.all([staffService.listStaff(), eventsService.list()])
      .then(([staffRes, eventsRes]) => {
        setStaffList(staffRes.data);
        setEvents(eventsRes.data);
      })
      .catch((err) => setError(getErrorMessage(err)))
      .finally(() => setLoading(false));
  }, []);

  return (
    <AuthGuard requireOrganizer>
      <div className="space-y-6">
        <PageHeader title="Staff" description="Manage staff accounts and session assignments." />

        {error && <ErrorMessage message={error} />}
        {loading ? (
          <LoadingSpinner />
        ) : (
          <Tabs defaultValue="assignments">
            <TabsList>
              <TabsTrigger value="assignments">Session assignments</TabsTrigger>
              <TabsTrigger value="members">Staff members</TabsTrigger>
            </TabsList>

            {/* Assignments tab */}
            <TabsContent value="assignments" className="mt-4 space-y-6">
              {events.length === 0 ? (
                <EmptyState icon={Users} title="No events found" description="Create an event first." />
              ) : (
                events.map((ev) => (
                  <div key={ev.id}>
                    <h3 className="mb-3 text-sm font-semibold text-zinc-700 dark:text-zinc-300">{ev.name}</h3>
                    {ev.sessions.length === 0 ? (
                      <p className="text-xs text-zinc-400 pl-1">No sessions in this event.</p>
                    ) : (
                      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                        {ev.sessions.map((s) => (
                          <SessionStaffPanel
                            key={s.id}
                            session={s}
                            eventId={ev.id}
                            staffList={staffList}
                          />
                        ))}
                      </div>
                    )}
                  </div>
                ))
              )}
            </TabsContent>

            {/* Members tab */}
            <TabsContent value="members" className="mt-4">
              {staffList.length === 0 ? (
                <EmptyState icon={Users} title="No staff accounts" description="Staff accounts are created via the signup page." />
              ) : (
                <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-zinc-50 dark:bg-zinc-900 text-zinc-500 text-xs uppercase tracking-wide">
                      <tr>
                        <th className="px-4 py-3 text-left font-medium">Email</th>
                        <th className="px-4 py-3 text-left font-medium">Role</th>
                        <th className="px-4 py-3 text-left font-medium hidden sm:table-cell">Member since</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                      {staffList.map((u) => (
                        <tr key={u.id}>
                          <td className="px-4 py-3 font-medium">{u.email}</td>
                          <td className="px-4 py-3">
                            <Badge variant="secondary">{u.role}</Badge>
                          </td>
                          <td className="px-4 py-3 text-zinc-500 hidden sm:table-cell text-xs">
                            {fmtDate(u.createdAt)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </TabsContent>
          </Tabs>
        )}
      </div>
    </AuthGuard>
  );
}
