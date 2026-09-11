import { Request, Response } from "express";
import prisma from "../lib/prisma";

type SessionWithAlerts = {
  id: string;
  title: string;
  capacity: number;
  capacityFillEpoch: number;
  event: { id: string; name: string };
  alertDismissals: { fillEpoch: number }[];
  _count: { registrations: number };
};

function isAlertActive(session: SessionWithAlerts): boolean {
  return !session.alertDismissals.some((d) => d.fillEpoch === session.capacityFillEpoch);
}

async function getSessionsWithEpoch() {
  return prisma.session.findMany({
    where: { capacityFillEpoch: { gt: 0 } },
    select: {
      id: true,
      title: true,
      capacity: true,
      capacityFillEpoch: true,
      event: { select: { id: true, name: true } },
      alertDismissals: { select: { fillEpoch: true } },
      _count: {
        select: {
          registrations: { where: { status: { in: ["RESERVED", "CONFIRMED", "CHECKED_IN"] } } },
        },
      },
    },
  });
}

export async function listAlerts(_req: Request, res: Response): Promise<void> {
  const sessions = await getSessionsWithEpoch();
  const active = (sessions as SessionWithAlerts[]).filter(isAlertActive);

  res.json(
    active.map((s) => ({
      sessionId: s.id,
      sessionTitle: s.title,
      event: s.event,
      capacity: s.capacity,
      activeRegistrations: s._count.registrations,
      fillEpoch: s.capacityFillEpoch,
    }))
  );
}

export async function getAlertCount(_req: Request, res: Response): Promise<void> {
  const sessions = await getSessionsWithEpoch();
  const count = (sessions as SessionWithAlerts[]).filter(isAlertActive).length;
  res.json({ count });
}

export async function dismissAlert(req: Request, res: Response): Promise<void> {
  const session = await prisma.session.findUnique({
    where: { id: req.params.sessionId },
    select: { id: true, capacityFillEpoch: true },
  });
  if (!session) {
    res.status(404).json({ error: "Session not found" });
    return;
  }
  if (session.capacityFillEpoch === 0) {
    res.status(400).json({ error: "No active alert to dismiss" });
    return;
  }

  try {
    const dismissal = await prisma.alertDismissal.create({
      data: { sessionId: session.id, fillEpoch: session.capacityFillEpoch, dismissedBy: req.user!.userId },
    });
    res.status(201).json(dismissal);
  } catch {
    res.status(409).json({ error: "Alert already dismissed for this epoch" });
  }
}
