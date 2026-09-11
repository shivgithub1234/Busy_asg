import { Request, Response } from "express";
import prisma from "../lib/prisma";

export async function getDashboard(_req: Request, res: Response): Promise<void> {
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const todayEnd = new Date(todayStart.getTime() + 86_400_000);
  const weekStart = new Date(todayStart.getTime() - 7 * 86_400_000);
  const fourteenDaysAgo = new Date(todayStart.getTime() - 13 * 86_400_000);

  const [
    sessionsTodayCount,
    checkedInTodayCount,
    expiredThisWeekCount,
    allSessions,
    statusBreakdown,
    sessionBreakdown,
    checkinsRaw,
  ] = await Promise.all([
    prisma.session.count({ where: { startTime: { gte: todayStart, lt: todayEnd } } }),
    prisma.registration.count({ where: { status: "CHECKED_IN", updatedAt: { gte: todayStart, lt: todayEnd } } }),
    prisma.registration.count({ where: { status: "EXPIRED", updatedAt: { gte: weekStart, lt: todayEnd } } }),
    prisma.session.findMany({
      select: {
        id: true,
        capacity: true,
        _count: {
          select: {
            registrations: { where: { status: { in: ["RESERVED", "CONFIRMED", "CHECKED_IN"] } } },
          },
        },
      },
    }),
    prisma.registration.groupBy({ by: ["status"], _count: { status: true } }),
    prisma.registration.groupBy({
      by: ["sessionId"],
      where: { status: { in: ["RESERVED", "CONFIRMED", "CHECKED_IN"] } },
      _count: { sessionId: true },
      orderBy: { _count: { sessionId: "desc" } },
      take: 10,
    }),
    prisma.$queryRaw<Array<{ date: Date; count: bigint }>>`
      SELECT DATE_TRUNC('day', updated_at) AS date, COUNT(*) AS count
      FROM registrations
      WHERE status = 'CHECKED_IN'
        AND updated_at >= ${fourteenDaysAgo}
        AND updated_at < ${todayEnd}
      GROUP BY DATE_TRUNC('day', updated_at)
      ORDER BY date ASC
    `,
  ]);

  const sessionsAtCapacityCount = allSessions.filter(
    (s: typeof allSessions[number]) => s._count.registrations >= s.capacity
  ).length;

  const sessionIds = sessionBreakdown.map((s: typeof sessionBreakdown[number]) => s.sessionId);
  const sessions = await prisma.session.findMany({
    where: { id: { in: sessionIds } },
    select: { id: true, title: true },
  });
  const sessionMap = Object.fromEntries(sessions.map((s: { id: string; title: string }) => [s.id, s.title]));

  res.json({
    sessionsTodayCount,
    checkedInTodayCount,
    expiredThisWeekCount,
    sessionsAtCapacityCount,
    statusBreakdown: statusBreakdown.map((s: typeof statusBreakdown[number]) => ({
      status: s.status,
      count: s._count.status,
    })),
    sessionBreakdown: sessionBreakdown.map((s: typeof sessionBreakdown[number]) => ({
      sessionId: s.sessionId,
      sessionTitle: sessionMap[s.sessionId] ?? "Unknown",
      count: s._count.sessionId,
    })),
    checkinsChart: (checkinsRaw as Array<{ date: Date; count: bigint }>).map((r) => ({
      date: r.date.toISOString().split("T")[0],
      count: Number(r.count),
    })),
  });
}
