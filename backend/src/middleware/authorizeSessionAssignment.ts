import { Request, Response, NextFunction } from "express";
import prisma from "../lib/prisma";

export async function authorizeSessionAssignment(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  if (!req.user) {
    res.status(401).json({ error: "Unauthenticated" });
    return;
  }

  if (req.user.role === "ORGANIZER") {
    next();
    return;
  }

  const assigned = await prisma.staffAssignment.findUnique({
    where: {
      userId_sessionId: {
        userId: req.user.userId,
        sessionId: req.params.sessionId,
      },
    },
  });

  if (!assigned) {
    res.status(403).json({ error: "Not assigned to this session" });
    return;
  }

  next();
}
