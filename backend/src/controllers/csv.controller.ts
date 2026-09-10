import { Request, Response } from "express";
import csvParser from "csv-parser";
import { Readable } from "stream";
import { z } from "zod";
import prisma from "../lib/prisma";

const HOLD_MINUTES = parseInt(process.env.RESERVATION_HOLD_MINUTES ?? "15", 10);
const ACTIVE_STATUSES = ["RESERVED", "CONFIRMED", "CHECKED_IN"] as const;

const rowSchema = z.object({
  attendee_name: z.string().min(1),
  attendee_email: z.string().email(),
});

type RowReport = { row: number; status: string; reason?: string; data?: unknown };

async function parseCSVBuffer(buffer: Buffer): Promise<Record<string, string>[]> {
  return new Promise((resolve, reject) => {
    const results: Record<string, string>[] = [];
    Readable.from(buffer)
      .pipe(csvParser())
      .on("data", (row) => results.push(row))
      .on("end", () => resolve(results))
      .on("error", reject);
  });
}

export async function importCSV(req: Request, res: Response): Promise<void> {
  if (!req.file) {
    res.status(400).json({ error: "No CSV file uploaded (field name: file)" });
    return;
  }

  const { sessionId } = req.params;
  const session = await prisma.session.findUnique({ where: { id: sessionId } });
  if (!session) {
    res.status(404).json({ error: "Session not found" });
    return;
  }

  const rows = await parseCSVBuffer(req.file.buffer);
  const report: RowReport[] = [];
  let created = 0;

  for (let i = 0; i < rows.length; i++) {
    const rowNum = i + 1;
    const parsed = rowSchema.safeParse(rows[i]);

    if (!parsed.success) {
      report.push({ row: rowNum, status: "rejected", reason: JSON.stringify(parsed.error.flatten()) });
      continue;
    }

    const { attendee_name, attendee_email } = parsed.data;

    const duplicate = await prisma.registration.findFirst({
      where: { sessionId, attendeeEmail: attendee_email, status: { in: [...ACTIVE_STATUSES] } },
    });
    if (duplicate) {
      report.push({ row: rowNum, status: "duplicate", reason: `${attendee_email} already has an active registration` });
      continue;
    }

    try {
      const reg = await prisma.$transaction(async (tx) => {
        const rows = await tx.$queryRaw<Array<{ capacity: number; capacity_fill_epoch: number }>>`
          SELECT capacity, capacity_fill_epoch FROM sessions WHERE id = ${sessionId} FOR UPDATE
        `;
        const { capacity, capacity_fill_epoch } = rows[0];

        const activeCount = await tx.registration.count({
          where: { sessionId, status: { in: [...ACTIVE_STATUSES] } },
        });
        if (activeCount >= capacity) throw new Error("SESSION_FULL");

        const now = new Date();
        const registration = await tx.registration.create({
          data: {
            sessionId,
            attendeeName: attendee_name,
            attendeeEmail: attendee_email,
            status: "RESERVED",
            reservedAt: now,
            expiresAt: new Date(now.getTime() + HOLD_MINUTES * 60 * 1000),
          },
        });

        await tx.registrationEvent.create({
          data: { registrationId: registration.id, newStatus: "RESERVED", changedBy: req.user!.userId },
        });

        if (activeCount + 1 >= capacity) {
          await tx.$executeRaw`
            UPDATE sessions SET capacity_fill_epoch = ${capacity_fill_epoch + 1} WHERE id = ${sessionId}
          `;
        }

        return registration;
      });

      report.push({ row: rowNum, status: "created", data: { id: reg.id, email: attendee_email } });
      created++;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "";
      report.push({
        row: rowNum,
        status: "rejected",
        reason: msg === "SESSION_FULL" ? "Session at capacity" : "Unexpected error",
      });
    }
  }

  res.json({ summary: { total: rows.length, created, skipped: rows.length - created }, report });
}

export async function exportCSV(req: Request, res: Response): Promise<void> {
  const session = await prisma.session.findUnique({
    where: { id: req.params.sessionId },
    include: { event: { select: { name: true } } },
  });
  if (!session) {
    res.status(404).json({ error: "Session not found" });
    return;
  }

  if (req.user!.role === "STAFF") {
    const assigned = await prisma.staffAssignment.findUnique({
      where: { userId_sessionId: { userId: req.user!.userId, sessionId: req.params.sessionId } },
    });
    if (!assigned) {
      res.status(403).json({ error: "Not assigned to this session" });
      return;
    }
  }

  const registrations = await prisma.registration.findMany({
    where: { sessionId: req.params.sessionId },
    orderBy: { attendeeName: "asc" },
  });

  const header = "id,attendee_name,attendee_email,status,reserved_at,expires_at";
  const bodyRows = registrations.map(
    (r) =>
      `"${r.id}","${r.attendeeName}","${r.attendeeEmail}","${r.status}","${r.reservedAt.toISOString()}","${r.expiresAt?.toISOString() ?? ""}"`
  );

  const filename = `checkin-${session.title.replace(/\s+/g, "-")}-${new Date().toISOString().split("T")[0]}.csv`;
  res.setHeader("Content-Type", "text/csv");
  res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
  res.send([header, ...bodyRows].join("\n"));
}
