import { Router } from "express";
import { authenticateJWT } from "../middleware/authenticateJWT";
import { authorizeSessionAssignment } from "../middleware/authorizeSessionAssignment";
import {
  reserveSeat,
  listSessionRegistrations,
  getRegistration,
  transitionStatus,
} from "../controllers/registrations.controller";

const router = Router();

router.post("/sessions/:sessionId/registrations", authenticateJWT, authorizeSessionAssignment, reserveSeat);
router.get("/sessions/:sessionId/registrations", authenticateJWT, authorizeSessionAssignment, listSessionRegistrations);
router.get("/registrations/:id", authenticateJWT, getRegistration);
router.patch("/registrations/:id/status", authenticateJWT, transitionStatus);

export default router;
