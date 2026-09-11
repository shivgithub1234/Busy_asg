import { Router } from "express";
import { authenticateJWT, requireRole } from "../middleware/authenticateJWT";
import { listAlerts, getAlertCount, dismissAlert } from "../controllers/alerts.controller";

const router = Router();

router.get("/", authenticateJWT, requireRole("ORGANIZER"), listAlerts);
router.get("/count", authenticateJWT, requireRole("ORGANIZER"), getAlertCount);
router.post("/:sessionId/dismiss", authenticateJWT, requireRole("ORGANIZER"), dismissAlert);

export default router;
