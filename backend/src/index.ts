import "dotenv/config";
import "express-async-errors";
import express, { Request, Response, NextFunction } from "express";
import cors from "cors";
import cron from "node-cron";

import authRouter from "./routes/auth";
import eventsRouter from "./routes/events";
import registrationsRouter from "./routes/registrations";
import staffRouter from "./routes/staff";
import searchRouter from "./routes/search";
import csvRouter from "./routes/csv";
import dashboardRouter from "./routes/dashboard";
import alertsRouter from "./routes/alerts";
import { expireReservations } from "./lib/expireReservations";

const app = express();
const PORT = process.env.PORT ?? 4000;

const allowedOrigins = ["http://localhost:3000", process.env.FRONTEND_URL].filter(Boolean) as string[];

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin) return callback(null, true);
      if (allowedOrigins.includes(origin)) return callback(null, true);
      callback(new Error(`CORS: origin ${origin} not allowed`));
    },
    credentials: true,
  })
);

app.use(express.json());

app.use("/api/auth", authRouter);
app.use("/api/events", eventsRouter);
app.use("/api", registrationsRouter);
app.use("/api", staffRouter);
app.use("/api", csvRouter);
app.use("/api/registrations", searchRouter);
app.use("/api/dashboard", dashboardRouter);
app.use("/api/alerts", alertsRouter);

app.get("/health", (_req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

app.post("/api/cron/expire-reservations", async (_req, res) => {
  const result = await expireReservations();
  res.json(result);
});

cron.schedule("*/5 * * * *", async () => {
  const result = await expireReservations();
  if (result.expired > 0) console.log(`[cron] Expired ${result.expired} reservation(s)`);
});

app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  console.error(err);
  res.status(500).json({ error: "Internal server error" });
});

app.listen(PORT, () => {
  console.log(`Backend running on http://localhost:${PORT}`);
});

export default app;
