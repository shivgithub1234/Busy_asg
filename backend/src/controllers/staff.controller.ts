import { Request, Response } from "express";
import { z } from "zod";
import prisma from "../lib/prisma";

const assignSchema = z.object({ userId: z.string().uuid() });

export async function listStaffUsers(_req: Request, res: Response): Promise<void> {
  const users = await prisma.user.findMany({
    where: { role: "STAFF" },
    select: { id: true, email: true, role: true, createdAt: true },
  });
  res.json(users);
}

export async function listSessionStaff(req: Request, res: Response): Promise<void> {
  const session = await prisma.session.findUnique({ where: { id: req.params.sessionId } });
  if (!session) {
    res.status(404).json({ error: "Session not found" });
    return;
  }
  const assignments = await prisma.staffAssignment.findMany({
    where: { sessionId: req.params.sessionId },
    include: { user: { select: { id: true, email: true, role: true } } },
  });
  res.json(assignments);
}

export async function assignStaff(req: Request, res: Response): Promise<void> {
  const parsed = assignSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }

  const session = await prisma.session.findUnique({ where: { id: req.params.sessionId } });
  if (!session) {
    res.status(404).json({ error: "Session not found" });
    return;
  }

  const staffUser = await prisma.user.findUnique({ where: { id: parsed.data.userId } });
  if (!staffUser || staffUser.role !== "STAFF") {
    res.status(400).json({ error: "User is not a STAFF member" });
    return;
  }

  try {
    const assignment = await prisma.staffAssignment.create({
      data: { userId: parsed.data.userId, sessionId: req.params.sessionId },
      include: { user: { select: { id: true, email: true, role: true } } },
    });
    res.status(201).json(assignment);
  } catch {
    res.status(409).json({ error: "Already assigned" });
  }
}

export async function unassignStaff(req: Request, res: Response): Promise<void> {
  const assignment = await prisma.staffAssignment.findUnique({
    where: { userId_sessionId: { userId: req.params.userId, sessionId: req.params.sessionId } },
  });
  if (!assignment) {
    res.status(404).json({ error: "Assignment not found" });
    return;
  }
  await prisma.staffAssignment.delete({ where: { id: assignment.id } });
  res.status(204).send();
}

export async function myAssignedSessions(req: Request, res: Response): Promise<void> {
  const assignments = await prisma.staffAssignment.findMany({
    where: { userId: req.user!.userId },
    include: {
      session: {
        include: {
          event: { select: { id: true, name: true, venue: true } },
          _count: {
            select: {
              registrations: { where: { status: { in: ["RESERVED", "CONFIRMED", "CHECKED_IN"] } } },
            },
          },
        },
      },
    },
  });
  res.json(assignments.map((a) => a.session));
}
