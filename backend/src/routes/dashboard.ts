import { Router } from "express";
import { authenticateJWT } from "../middleware/authenticateJWT";
import { getDashboard } from "../controllers/dashboard.controller";

const router = Router();

router.get("/", authenticateJWT, getDashboard);

export default router;
