import { Router } from "express";
import { authenticateJWT, requireRole } from "../middleware/authenticateJWT";
import {
  listStaffUsers,
  listSessionStaff,
  assignStaff,
  unassignStaff,
  myAssignedSessions,
} from "../controllers/staff.controller";

const router = Router();

// Organizer-facing
router.get("/staff", authenticateJWT, requireRole("ORGANIZER"), listStaffUsers);
router.get("/sessions/:sessionId/staff", authenticateJWT, requireRole("ORGANIZER"), listSessionStaff);
router.post("/sessions/:sessionId/staff", authenticateJWT, requireRole("ORGANIZER"), assignStaff);
router.delete("/sessions/:sessionId/staff/:userId", authenticateJWT, requireRole("ORGANIZER"), unassignStaff);

// Staff-facing
router.get("/staff/my-sessions", authenticateJWT, requireRole("STAFF"), myAssignedSessions);

export default router;
