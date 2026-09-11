import { Request, Response } from "express";
import { z } from "zod";
import prisma from "../lib/prisma";

function isPrismaUniqueViolation(err: unknown): boolean {
  return (
    typeof err === "object" &&
    err !== null &&
    "code" in err &&
    (err as { code: string }).code === "P2002"
  );
}

const eventSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  venue: z.string().min(1),
});

const sessionSchema = z.object({
  title: z.string().min(1),
  startTime: z.string().datetime(),
  durationMinutes: z.number().int().positive(),
  location: z.string().min(1),
  capacity: z.number().int().positive(),
});

// Active seat statuses used across queries
const ACTIVE_STATUSES = ["RESERVED", "CONFIRMED", "CHECKED_IN"] as const;

export async function listEvents(req: Request, res: Response): Promise<void> {
  const showArchived = req.query.archived === "true" && req.user?.role === "ORGANIZER";
  const events = await prisma.event.findMany({
    where: showArchived ? {} : { archived: false },
    include: {
      sessions: {
        select: {
          id: true,
          title: true,
          startTime: true,
          durationMinutes: true,
          location: true,
          capacity: true,
          capacityFillEpoch: true,
        },
      },
    },
    orderBy: { startDate: "asc" },
  });
  res.json(events);
}

export async function getEvent(req: Request, res: Response): Promise<void> {
  const event = await prisma.event.findUnique({
    where: { id: req.params.id },
    include: {
      sessions: {
        orderBy: { startTime: "asc" },
        include: {
          _count: {
            select: {
              registrations: { where: { status: { in: [...ACTIVE_STATUSES] } } },
            },
          },
        },
      },
    },
  });
  if (!event) {
    res.status(404).json({ error: "Event not found" });
    return;
  }
  res.json(event);
}

export async function createEvent(req: Request, res: Response): Promise<void> {
  const parsed = eventSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }
  const { name, description, startDate, endDate, venue } = parsed.data;
  try {
    const event = await prisma.event.create({
      data: { name, description, startDate: new Date(startDate), endDate: new Date(endDate), venue },
    });
    res.status(201).json(event);
  } catch (err: unknown) {
    if (isPrismaUniqueViolation(err)) {
      res.status(409).json({ error: "An event with this name, start date, and venue already exists" });
      return;
    }
    throw err;
  }
}

export async function updateEvent(req: Request, res: Response): Promise<void> {
  const parsed = eventSchema.partial().safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }
  const existing = await prisma.event.findUnique({ where: { id: req.params.id } });
  if (!existing) {
    res.status(404).json({ error: "Event not found" });
    return;
  }
  const { startDate, endDate, ...rest } = parsed.data;
  const event = await prisma.event.update({
    where: { id: req.params.id },
    data: {
      ...rest,
      ...(startDate ? { startDate: new Date(startDate) } : {}),
      ...(endDate ? { endDate: new Date(endDate) } : {}),
    },
  });
  res.json(event);
}

export async function archiveEvent(req: Request, res: Response): Promise<void> {
  const existing = await prisma.event.findUnique({ where: { id: req.params.id } });
  if (!existing) {
    res.status(404).json({ error: "Event not found" });
    return;
  }
  const event = await prisma.event.update({ where: { id: req.params.id }, data: { archived: true } });
  res.json(event);
}

export async function restoreEvent(req: Request, res: Response): Promise<void> {
  const existing = await prisma.event.findUnique({ where: { id: req.params.id } });
  if (!existing) {
    res.status(404).json({ error: "Event not found" });
    return;
  }
  const event = await prisma.event.update({ where: { id: req.params.id }, data: { archived: false } });
  res.json(event);
}

// Sessions

export async function listSessions(req: Request, res: Response): Promise<void> {
  const event = await prisma.event.findUnique({ where: { id: req.params.eventId } });
  if (!event) {
    res.status(404).json({ error: "Event not found" });
    return;
  }
  const sessions = await prisma.session.findMany({
    where: { eventId: req.params.eventId },
    orderBy: { startTime: "asc" },
    include: {
      _count: {
        select: {
          registrations: { where: { status: { in: [...ACTIVE_STATUSES] } } },
        },
      },
    },
  });
  res.json(sessions);
}

export async function createSession(req: Request, res: Response): Promise<void> {
  const event = await prisma.event.findUnique({ where: { id: req.params.eventId } });
  if (!event) {
    res.status(404).json({ error: "Event not found" });
    return;
  }
  const parsed = sessionSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }
  const { title, startTime, durationMinutes, location, capacity } = parsed.data;
  try {
    const session = await prisma.session.create({
      data: { eventId: req.params.eventId, title, startTime: new Date(startTime), durationMinutes, location, capacity },
    });
    res.status(201).json(session);
  } catch (err: unknown) {
    if (isPrismaUniqueViolation(err)) {
      res.status(409).json({ error: "A session with this title and start time already exists for this event" });
      return;
    }
    throw err;
  }
}

export async function updateSession(req: Request, res: Response): Promise<void> {
  const existing = await prisma.session.findFirst({
    where: { id: req.params.sessionId, eventId: req.params.eventId },
  });
  if (!existing) {
    res.status(404).json({ error: "Session not found" });
    return;
  }
  const parsed = sessionSchema.partial().safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }
  const { startTime, ...rest } = parsed.data;
  const session = await prisma.session.update({
    where: { id: req.params.sessionId },
    data: { ...rest, ...(startTime ? { startTime: new Date(startTime) } : {}) },
  });
  res.json(session);
}

export async function deleteSession(req: Request, res: Response): Promise<void> {
  const existing = await prisma.session.findFirst({
    where: { id: req.params.sessionId, eventId: req.params.eventId },
  });
  if (!existing) {
    res.status(404).json({ error: "Session not found" });
    return;
  }
  await prisma.session.delete({ where: { id: req.params.sessionId } });
  res.status(204).send();
}
