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
      const existingReg = await tx.registration.findFirst({
        where: { sessionId, attendeeEmail, status: { in: [...ACTIVE_STATUSES] } },
      });
      if (existingReg) throw new Error("ALREADY_REGISTERED");

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
    if (msg === "ALREADY_REGISTERED") return void res.status(409).json({ error: "Attendee already has an active registration for this session" });
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

  // Initial read to get sessionId for the STAFF auth check.
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

  // Fast pre-check on the outside read to give an early 422 for obviously
  // invalid transitions (e.g. CHECKED_IN → anything). The definitive check
  // is re-done under a row lock inside the transaction.
  if (!ALLOWED_TRANSITIONS[registration.status]?.includes(newStatus)) {
    res.status(422).json({ error: `Cannot transition from ${registration.status} to ${newStatus}` });
    return;
  }

  try {
    const updated = await prisma.$transaction(async (tx) => {
      // Lock the row so concurrent transitions serialize at the DB level.
      // Re-validate the transition against this locked status so that two
      // simultaneous requests cannot both write a RegistrationEvent row for
      // the same transition (which would corrupt the audit log).
      const locked = await tx.$queryRaw<Array<{ status: string }>>`
        SELECT status FROM registrations WHERE id = ${req.params.id} FOR UPDATE
      `;
      const currentStatus = locked[0].status;
      if (!ALLOWED_TRANSITIONS[currentStatus]?.includes(newStatus)) {
        throw new Error(`INVALID_TRANSITION:${currentStatus}`);
      }

      const reg = await tx.registration.update({
        where: { id: req.params.id },
        data: { status: newStatus, expiresAt: null },
      });
      await tx.registrationEvent.create({
        data: {
          registrationId: req.params.id,
          oldStatus: currentStatus as Parameters<typeof tx.registrationEvent.create>[0]["data"]["oldStatus"],
          newStatus,
          changedBy: req.user!.userId,
          note,
        },
      });
      return reg;
    });

    res.json(updated);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "";
    if (msg.startsWith("INVALID_TRANSITION:")) {
      const currentStatus = msg.split(":")[1];
      res.status(422).json({ error: `Cannot transition from ${currentStatus} to ${newStatus}` });
      return;
    }
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
}
