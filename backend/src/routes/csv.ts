import { Router } from "express";
import multer from "multer";
import { authenticateJWT, requireRole } from "../middleware/authenticateJWT";
import { importCSV, exportCSV } from "../controllers/csv.controller";

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });

router.post(
  "/sessions/:sessionId/registrations/import",
  authenticateJWT,
  requireRole("ORGANIZER"),
  upload.single("file"),
  importCSV
);

router.get("/sessions/:sessionId/registrations/export", authenticateJWT, exportCSV);

export default router;
