import { Request, Response } from "express";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import prisma from "../lib/prisma";

const querySchema = z.object({
  q: z.string().optional(),
  eventId: z.string().uuid().optional(),
  sessionId: z.string().uuid().optional(),
  status: z.enum(["RESERVED", "CONFIRMED", "CHECKED_IN", "EXPIRED", "CANCELLED"]).optional(),
  sortBy: z.enum(["createdAt", "attendeeName", "attendeeEmail", "status"]).optional(),
  sortOrder: z.enum(["asc", "desc"]).optional(),
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(100).default(20),
});

export async function searchRegistrations(req: Request, res: Response): Promise<void> {
  const parsed = querySchema.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }

  const { q, eventId, sessionId, status, sortBy, sortOrder, page, pageSize } = parsed.data;

  let allowedSessionIds: string[] | undefined;
  if (req.user!.role === "STAFF") {
    const assignments = await prisma.staffAssignment.findMany({
      where: { userId: req.user!.userId },
      select: { sessionId: true },
    });
    allowedSessionIds = assignments.map((a: { sessionId: string }) => a.sessionId);
  }

  const where: Record<string, unknown> = {};

  if (status) where.status = status;

  if (sessionId) {
    if (allowedSessionIds && !allowedSessionIds.includes(sessionId)) {
      res.status(403).json({ error: "Not assigned to this session" });
      return;
    }
    where.sessionId = sessionId;
  } else if (allowedSessionIds) {
    where.sessionId = { in: allowedSessionIds };
  }

  if (eventId) where.session = { eventId };

  if (q) {
    where.OR = [
      { attendeeName: { contains: q, mode: "insensitive" } },
      { attendeeEmail: { contains: q, mode: "insensitive" } },
    ];
  }

  const orderBy: Record<string, string> = { [sortBy ?? "createdAt"]: sortOrder ?? "desc" };
  const whereClause = where as Prisma.RegistrationWhereInput;

  const [total, registrations] = await prisma.$transaction([
    prisma.registration.count({ where: whereClause }),
    prisma.registration.findMany({
      where: whereClause,
      orderBy,
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: {
        session: {
          select: { id: true, title: true, event: { select: { id: true, name: true } } },
        },
      },
    }),
  ]);

  res.json({
    data: registrations,
    pagination: { total, page, pageSize, totalPages: Math.ceil(total / pageSize) },
  });
}
