"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Bell, BellOff, CheckCheck } from "lucide-react";
import { alertsService, type Alert } from "@/lib/services/alerts";
import { getErrorMessage } from "@/lib/api";
import { AuthGuard } from "@/components/shared/AuthGuard";
import { PageHeader } from "@/components/shared/PageHeader";
import { EmptyState } from "@/components/shared/EmptyState";
import { LoadingSpinner } from "@/components/shared/LoadingSpinner";
import { ErrorMessage } from "@/components/shared/ErrorMessage";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export default function AlertsPage() {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [dismissing, setDismissing] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError("");
    try {
      const { data } = await alertsService.list();
      setAlerts(data);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  async function handleDismiss(sessionId: string) {
    setDismissing(sessionId);
    try {
      await alertsService.dismiss(sessionId);
      load();
    } catch (err) {
      alert(getErrorMessage(err));
    } finally {
      setDismissing(null);
    }
  }

  async function handleDismissAll() {
    for (const a of alerts) {
      try { await alertsService.dismiss(a.sessionId); } catch { /* continue */ }
    }
    load();
  }

  return (
    <AuthGuard requireOrganizer>
      <div className="space-y-6">
        <PageHeader
          title="Alerts"
          description="Sessions that have reached capacity."
        >
          {alerts.length > 1 && (
            <Button variant="outline" size="sm" onClick={handleDismissAll}>
              <CheckCheck className="h-4 w-4" />Dismiss all
            </Button>
          )}
        </PageHeader>

        {error && <ErrorMessage message={error} />}

        {loading ? (
          <LoadingSpinner />
        ) : alerts.length === 0 ? (
          <EmptyState
            icon={BellOff}
            title="No active alerts"
            description="You'll see an alert here when a session reaches full capacity."
          />
        ) : (
          <div className="space-y-3">
            {alerts.map((alert) => (
              <Card key={alert.sessionId} className="border-amber-200 bg-amber-50/50 dark:border-amber-800 dark:bg-amber-950/20">
                <CardContent className="pt-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-3">
                      <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-amber-100 dark:bg-amber-900/40">
                        <Bell className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                      </div>
                      <div>
                        <p className="font-medium text-zinc-900 dark:text-zinc-50">
                          {alert.sessionTitle}
                        </p>
                        <p className="text-sm text-zinc-500">
                          <Link href={`/events/${alert.event.id}`} className="hover:underline">
                            {alert.event.name}
                          </Link>
                        </p>
                        <p className="mt-1.5 text-sm font-medium text-amber-700 dark:text-amber-400">
                          Session is at capacity —{" "}
                          <span>
                            {alert.activeRegistrations} / {alert.capacity} seats filled
                          </span>
                        </p>
                      </div>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      className="shrink-0"
                      disabled={dismissing === alert.sessionId}
                      onClick={() => handleDismiss(alert.sessionId)}
                    >
                      {dismissing === alert.sessionId ? "Dismissing…" : "Dismiss"}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </AuthGuard>
  );
}
