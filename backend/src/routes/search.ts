import { Router } from "express";
import { authenticateJWT } from "../middleware/authenticateJWT";
import { searchRegistrations } from "../controllers/search.controller";

const router = Router();

router.get("/", authenticateJWT, searchRegistrations);

export default router;
