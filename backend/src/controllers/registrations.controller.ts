import { Request, Response } from "express";
import { z } from "zod";
import prisma from "../lib/prisma";

const HOLD_MINUTES = parseInt(process.env.RESERVATION_HOLD_MINUTES ?? "15", 10);
const ACTIVE_STATUSES = ["RESERVED", "CONFIRMED", "CHECKED_IN"] as const;

const reserveSchema = z.object({
  attendeeName: z.string().min(1),
  attendeeEmail: z.string().email(),
});

const transitionSchema = z.object({
  status: z.enum(["CONFIRMED", "CHECKED_IN", "CANCELLED"]),
  note: z.string().optional(),
});

const ALLOWED_TRANSITIONS: Record<string, string[]> = {
  RESERVED: ["CONFIRMED", "CANCELLED"],
  CONFIRMED: ["CHECKED_IN", "CANCELLED"],
  CHECKED_IN: [],
  EXPIRED: [],
  CANCELLED: [],
};

export async function reserveSeat(req: Request, res: Response): Promise<void> {
  const parsed = reserveSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }

  const { attendeeName, attendeeEmail } = parsed.data;
  const sessionId = req.params.sessionId;

  try {
    const registration = await prisma.$transaction(async (tx) => {
      const rows = await tx.$queryRaw<Array<{ id: string; capacity: number; capacity_fill_epoch: number }>>`
        SELECT id, capacity, capacity_fill_epoch FROM sessions WHERE id = ${sessionId} FOR UPDATE
      `;
      if (!rows.length) throw new Error("SESSION_NOT_FOUND");

      const { capacity, capacity_fill_epoch } = rows[0];
      const activeCount = await tx.registration.count({
        where: { sessionId, status: { in: [...ACTIVE_STATUSES] } },
      });

      if (activeCount >= capacity) throw new Error("SESSION_FULL");

      const now = new Date();
      const reg = await tx.registration.create({
        data: {
          sessionId,
          attendeeName,
          attendeeEmail,
          status: "RESERVED",
          reservedAt: now,
          expiresAt: new Date(now.getTime() + HOLD_MINUTES * 60 * 1000),
        },
      });

      await tx.registrationEvent.create({
        data: { registrationId: reg.id, newStatus: "RESERVED", changedBy: req.user!.userId },
      });

      if (activeCount + 1 >= capacity) {
        await tx.$executeRaw`
          UPDATE sessions SET capacity_fill_epoch = ${capacity_fill_epoch + 1} WHERE id = ${sessionId}
        `;
      }

      return reg;
    });

    res.status(201).json(registration);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "";
    if (msg === "SESSION_NOT_FOUND") return void res.status(404).json({ error: "Session not found" });
    if (msg === "SESSION_FULL") return void res.status(409).json({ error: "Session is at capacity" });
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
}

export async function listSessionRegistrations(req: Request, res: Response): Promise<void> {
  const session = await prisma.session.findUnique({ where: { id: req.params.sessionId } });
  if (!session) {
    res.status(404).json({ error: "Session not found" });
    return;
  }
  const registrations = await prisma.registration.findMany({
    where: { sessionId: req.params.sessionId },
    orderBy: { createdAt: "desc" },
  });
  res.json(registrations);
}

export async function getRegistration(req: Request, res: Response): Promise<void> {
  const registration = await prisma.registration.findUnique({
    where: { id: req.params.id },
    include: {
      session: { select: { id: true, title: true, eventId: true } },
      registrationEvents: {
        orderBy: { createdAt: "asc" },
        include: { user: { select: { id: true, email: true, role: true } } },
      },
    },
  });

  if (!registration) {
    res.status(404).json({ error: "Registration not found" });
    return;
  }

  if (req.user!.role === "STAFF") {
    const assigned = await prisma.staffAssignment.findUnique({
      where: { userId_sessionId: { userId: req.user!.userId, sessionId: registration.sessionId } },
    });
    if (!assigned) {
      res.status(403).json({ error: "Not assigned to this session" });
      return;
    }
  }

  res.json(registration);
}

export async function transitionStatus(req: Request, res: Response): Promise<void> {
  const parsed = transitionSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }

  const { status: newStatus, note } = parsed.data;
  const registration = await prisma.registration.findUnique({ where: { id: req.params.id } });
  if (!registration) {
    res.status(404).json({ error: "Registration not found" });
    return;
  }

  if (req.user!.role === "STAFF") {
    const assigned = await prisma.staffAssignment.findUnique({
      where: { userId_sessionId: { userId: req.user!.userId, sessionId: registration.sessionId } },
    });
    if (!assigned) {
      res.status(403).json({ error: "Not assigned to this session" });
      return;
    }
  }

  if (!ALLOWED_TRANSITIONS[registration.status]?.includes(newStatus)) {
    res.status(422).json({ error: `Cannot transition from ${registration.status} to ${newStatus}` });
    return;
  }

  const updated = await prisma.$transaction(async (tx) => {
    const reg = await tx.registration.update({
      where: { id: req.params.id },
      data: { status: newStatus, expiresAt: null },
    });
    await tx.registrationEvent.create({
      data: {
        registrationId: req.params.id,
        oldStatus: registration.status,
        newStatus,
        changedBy: req.user!.userId,
        note,
      },
    });
    return reg;
  });

  res.json(updated);
}
