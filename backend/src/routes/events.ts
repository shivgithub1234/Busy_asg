import { Router } from "express";
import { authenticateJWT, requireRole } from "../middleware/authenticateJWT";
import {
  listEvents,
  getEvent,
  createEvent,
  updateEvent,
  archiveEvent,
  restoreEvent,
  listSessions,
  createSession,
  updateSession,
  deleteSession,
} from "../controllers/events.controller";

const router = Router();

router.get("/", authenticateJWT, listEvents);
router.get("/:id", authenticateJWT, getEvent);
router.post("/", authenticateJWT, requireRole("ORGANIZER"), createEvent);
router.patch("/:id", authenticateJWT, requireRole("ORGANIZER"), updateEvent);
router.patch("/:id/archive", authenticateJWT, requireRole("ORGANIZER"), archiveEvent);
router.patch("/:id/restore", authenticateJWT, requireRole("ORGANIZER"), restoreEvent);

// Nested session routes
router.get("/:eventId/sessions", authenticateJWT, listSessions);
router.post("/:eventId/sessions", authenticateJWT, requireRole("ORGANIZER"), createSession);
router.patch("/:eventId/sessions/:sessionId", authenticateJWT, requireRole("ORGANIZER"), updateSession);
router.delete("/:eventId/sessions/:sessionId", authenticateJWT, requireRole("ORGANIZER"), deleteSession);

export default router;
