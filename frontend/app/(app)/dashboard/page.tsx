"use client";

import { useEffect, useState } from "react";
import {
  CalendarCheck, UserCheck, Clock, AlertTriangle,
} from "lucide-react";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell, Legend,
} from "recharts";
import { dashboardService, type DashboardData } from "@/lib/services/dashboard";
import { getErrorMessage } from "@/lib/api";
import { PageHeader } from "@/components/shared/PageHeader";
import { LoadingSpinner } from "@/components/shared/LoadingSpinner";
import { ErrorMessage } from "@/components/shared/ErrorMessage";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const STATUS_COLORS: Record<string, string> = {
  RESERVED: "#f59e0b",
  CONFIRMED: "#3b82f6",
  CHECKED_IN: "#10b981",
  EXPIRED: "#9ca3af",
  CANCELLED: "#ef4444",
};

interface StatCardProps {
  title: string;
  value: number;
  icon: React.ElementType;
  description?: string;
  accent?: string;
}

function StatCard({ title, value, icon: Icon, description, accent = "bg-zinc-100 dark:bg-zinc-800" }: StatCardProps) {
  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-sm text-zinc-500">{title}</p>
            <p className="mt-1 text-3xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
              {value.toLocaleString()}
            </p>
            {description && <p className="mt-1 text-xs text-zinc-400">{description}</p>}
          </div>
          <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${accent}`}>
            <Icon className="h-5 w-5 text-zinc-700 dark:text-zinc-300" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    dashboardService.get()
      .then(({ data }) => setData(data))
      .catch((err) => setError(getErrorMessage(err)))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <LoadingSpinner />;
  if (error) return <ErrorMessage message={error} />;
  if (!data) return null;

  const chartData = data.checkinsChart.map((d) => ({ ...d, date: fmtDate(d.date) }));

  return (
    <div className="space-y-6">
      <PageHeader title="Dashboard" description="Overview of today's activity." />

      {/* Headline stats */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          title="Sessions today"
          value={data.sessionsTodayCount}
          icon={CalendarCheck}
          accent="bg-blue-50 dark:bg-blue-950/30"
        />
        <StatCard
          title="Checked in today"
          value={data.checkedInTodayCount}
          icon={UserCheck}
          accent="bg-emerald-50 dark:bg-emerald-950/30"
        />
        <StatCard
          title="Expired this week"
          value={data.expiredThisWeekCount}
          icon={Clock}
          accent="bg-amber-50 dark:bg-amber-950/30"
        />
        <StatCard
          title="Sessions at capacity"
          value={data.sessionsAtCapacityCount}
          icon={AlertTriangle}
          accent="bg-red-50 dark:bg-red-950/30"
        />
      </div>

      {/* Charts row */}
      <div className="grid gap-4 lg:grid-cols-3">
        {/* 14-day check-ins area chart */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-sm font-medium">Check-ins — last 14 days</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={chartData} margin={{ top: 4, right: 8, bottom: 0, left: -16 }}>
                <defs>
                  <linearGradient id="ciGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.25} />
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                <Tooltip
                  contentStyle={{ borderRadius: 8, fontSize: 12, border: "1px solid #e4e4e7" }}
                  cursor={{ stroke: "#10b981", strokeWidth: 1 }}
                />
                <Area
                  type="monotone" dataKey="count" name="Check-ins"
                  stroke="#10b981" fill="url(#ciGrad)" strokeWidth={2} dot={false}
                />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Status breakdown pie */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Status breakdown</CardTitle>
          </CardHeader>
          <CardContent>
            {data.statusBreakdown.length === 0 ? (
              <p className="text-sm text-zinc-400 py-8 text-center">No data yet</p>
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie
                    data={data.statusBreakdown}
                    dataKey="count"
                    nameKey="status"
                    cx="50%" cy="50%"
                    innerRadius={50}
                    outerRadius={80}
                    paddingAngle={2}
                  >
                    {data.statusBreakdown.map((entry) => (
                      <Cell key={entry.status} fill={STATUS_COLORS[entry.status] ?? "#94a3b8"} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{ borderRadius: 8, fontSize: 12, border: "1px solid #e4e4e7" }}
                    formatter={(v, name) => [v, name]}
                  />
                  <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11 }} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Top sessions */}
      {data.sessionBreakdown.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Top sessions by active registrations</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {data.sessionBreakdown.map((s, i) => (
                <div key={s.sessionId} className="flex items-center gap-3">
                  <span className="w-5 shrink-0 text-right text-xs font-medium text-zinc-400">{i + 1}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate text-zinc-900 dark:text-zinc-50">{s.sessionTitle}</p>
                  </div>
                  <span className="shrink-0 text-sm font-semibold text-zinc-700 dark:text-zinc-300">
                    {s.count}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
