"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { CalendarDays, Clock, MapPin, Users } from "lucide-react";
import { staffService, type MySession } from "@/lib/services/staff";
import { getErrorMessage } from "@/lib/api";
import { CapacityBar } from "@/components/shared/CapacityBar";
import { PageHeader } from "@/components/shared/PageHeader";
import { EmptyState } from "@/components/shared/EmptyState";
import { LoadingSpinner } from "@/components/shared/LoadingSpinner";
import { ErrorMessage } from "@/components/shared/ErrorMessage";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

function fmtDateTime(iso: string) {
  return new Date(iso).toLocaleString("en-GB", {
    day: "numeric", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

function isToday(iso: string) {
  const d = new Date(iso);
  const now = new Date();
  return (
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate()
  );
}

export default function MySessionsPage() {
  const [sessions, setSessions] = useState<MySession[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    staffService.mySessions()
      .then(({ data }) => setSessions(data))
      .catch((err) => setError(getErrorMessage(err)))
      .finally(() => setLoading(false));
  }, []);

  // Group by event
  const byEvent = sessions.reduce<Record<string, { event: MySession["event"]; sessions: MySession[] }>>(
    (acc, s) => {
      if (!acc[s.eventId]) acc[s.eventId] = { event: s.event, sessions: [] };
      acc[s.eventId].sessions.push(s);
      return acc;
    },
    {}
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="My Sessions"
        description="Sessions you're assigned to staff."
      />

      {error && <ErrorMessage message={error} />}

      {loading ? (
        <LoadingSpinner />
      ) : sessions.length === 0 ? (
        <EmptyState
          icon={CalendarDays}
          title="No sessions assigned"
          description="An organizer hasn't assigned you to any sessions yet."
        />
      ) : (
        <div className="space-y-8">
          {Object.values(byEvent).map(({ event, sessions: evSessions }) => (
            <div key={event.id}>
              {/* Event header */}
              <div className="mb-4 flex items-center gap-2">
                <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-50">
                  {event.name}
                </h2>
                <span className="text-sm text-zinc-400">·</span>
                <span className="text-sm text-zinc-500">{event.venue}</span>
              </div>

              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {evSessions.map((s) => {
                  const filled = s._count.registrations;
                  const today = isToday(s.startTime);

                  return (
                    <Card key={s.id} className="flex flex-col hover:shadow-md transition-shadow">
                      <CardHeader className="pb-2">
                        <div className="flex items-start justify-between gap-2">
                          <CardTitle className="text-sm font-medium leading-snug">
                            {s.title}
                          </CardTitle>
                          {today && (
                            <Badge variant="info" className="shrink-0 text-[10px]">Today</Badge>
                          )}
                        </div>
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

                      <div className="flex items-center border-t border-zinc-100 px-6 py-3 dark:border-zinc-800">
                        <Button variant="ghost" size="sm" className="text-xs ml-auto" asChild>
                          <Link href={`/events/${s.eventId}/sessions/${s.id}`}>
                            Check-in sheet →
                          </Link>
                        </Button>
                      </div>
                    </Card>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
