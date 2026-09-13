# Architecture

## Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js 16 + React 19 + TypeScript, hosted on Vercel |
| Backend | Express 4 + TypeScript, hosted on Render |
| Database | PostgreSQL via Supabase (free tier) |
| ORM | Prisma 5 |
| Auth | JWT (jsonwebtoken), bcryptjs for password hashing |
| UI | Tailwind CSS v4, Radix UI primitives, shadcn/ui, Recharts |
| Validation | Zod (backend input validation on every mutating route) |
| Background job | node-cron (in-process, runs every 5 minutes) |

## High-level layout

```
Browser  (Next.js SPA, Vercel)
   │  HTTPS fetch, Authorization: Bearer <JWT>
   ▼
Express API  (Render, port 4000)
   │  authenticateJWT → requireRole / authorizeSessionAssignment → controller
   │  Zod validation → Prisma ($transaction with row locks where needed)
   ▼
PostgreSQL  (Supabase)

node-cron  (same Render process, */5 * * * *)
   └─▶  expireReservations()  — sweeps RESERVED rows past their expiresAt
```

The frontend is a pure client: it never connects to the database and has no server-side logic. All business rules — capacity checks, role enforcement, status transitions — live exclusively in the Express API.

## Request path — reserving a seat

1. The user submits the reservation form (attendee name + email) in the Next.js UI.
2. The browser sends `POST /api/sessions/:sessionId/registrations` with `Authorization: Bearer <JWT>`. A CORS preflight fires first; Express replies based on the origin allowlist (`localhost:3000` in dev, `FRONTEND_URL` env var in production).
3. `authenticateJWT` middleware verifies the token signature and expiry, then attaches `{ userId, role }` to `req`. `authorizeSessionAssignment` checks — for STAFF callers — that a `StaffAssignment` row exists for `(userId, sessionId)`. Either check failing returns 401/403 before the handler runs.
4. `reserveSeat` opens a Prisma transaction and issues `SELECT ... FOR UPDATE` on the session row, serialising concurrent requests for the same session.
5. Inside the lock: count `RESERVED | CONFIRMED | CHECKED_IN` registrations. If the count equals `capacity`, throw `SESSION_FULL` → rollback → 409. If the caller's email already has an active registration, throw `ALREADY_REGISTERED` → 409.
6. On success: insert the `Registration` row (`status = RESERVED`, `expiresAt = now + RESERVATION_HOLD_MINUTES`), insert an initial `RegistrationEvent` row, and — if this registration filled the session to capacity — increment `session.capacityFillEpoch` in the same transaction.
7. Commit. Return the new registration as 201.

The row lock in step 4 is what prevents overselling: two simultaneous requests for the last seat serialise at the database, so the second one recomputes the count against the committed state of the first.

## CORS and auth transport

- **CORS:** `cors` middleware uses an explicit origin allowlist. Wildcard is not used because the API carries auth.
- **Auth transport:** Bearer JWT in the `Authorization` header. A cross-origin `httpOnly` cookie would require `SameSite=None; Secure` plus `credentials: include` wired through CORS on both ends and still breaks in some privacy-mode configurations. A header-attached token sidesteps all of that. The frontend stores the token in memory / localStorage and attaches it manually to every request.
- **Token lifetime:** 8 hours (`expiresIn: "8h"`). No refresh token — a short-lived session is sufficient for this use case.

## Background expiry

`node-cron` runs `expireReservations()` on a `*/5 * * * *` schedule inside the same Render process. The function finds all `RESERVED` registrations where `expiresAt <= now`, locks each row individually, updates status to `EXPIRED`, and writes a `RegistrationEvent` row with `changedBy = null` and note `"Auto-expired by cron sweep"`. There is also an HTTP trigger at `POST /api/cron/expire-reservations` for manual runs or external cron services.

## API surface

All routes require `Authorization: Bearer <JWT>` unless noted.

| Method | Path | Role | Purpose |
|---|---|---|---|
| POST | `/api/auth/signup` | — | Create account |
| POST | `/api/auth/login` | — | Obtain JWT |
| GET | `/api/events` | any | List events (hides archived by default) |
| GET | `/api/events/:id` | any | Get event |
| POST | `/api/events` | ORGANIZER | Create event |
| PATCH | `/api/events/:id` | ORGANIZER | Edit event |
| PATCH | `/api/events/:id/archive` | ORGANIZER | Archive event |
| PATCH | `/api/events/:id/restore` | ORGANIZER | Restore event |
| GET | `/api/events/:eventId/sessions` | any | List sessions for an event |
| POST | `/api/events/:eventId/sessions` | ORGANIZER | Create session |
| PATCH | `/api/events/:eventId/sessions/:sessionId` | ORGANIZER | Edit session |
| DELETE | `/api/events/:eventId/sessions/:sessionId` | ORGANIZER | Delete session |
| POST | `/api/sessions/:sessionId/registrations` | any* | Reserve seat |
| GET | `/api/sessions/:sessionId/registrations` | any* | List registrations for session |
| GET | `/api/registrations/:id` | any* | Get registration + timeline |
| PATCH | `/api/registrations/:id/status` | any* | Transition status |
| GET | `/api/registrations` | any | Search / filter / paginate registrations |
| GET | `/api/staff` | ORGANIZER | List all STAFF users |
| GET | `/api/sessions/:sessionId/staff` | ORGANIZER | List staff assigned to session |
| POST | `/api/sessions/:sessionId/staff` | ORGANIZER | Assign staff to session |
| DELETE | `/api/sessions/:sessionId/staff/:userId` | ORGANIZER | Unassign staff |
| GET | `/api/staff/my-sessions` | STAFF | Sessions assigned to caller |
| POST | `/api/sessions/:sessionId/registrations/import` | ORGANIZER | Bulk CSV import |
| GET | `/api/sessions/:sessionId/registrations/export` | any | Download check-in sheet CSV |
| GET | `/api/dashboard` | any | Headline stats + chart data |
| GET | `/api/alerts` | ORGANIZER | List active at-capacity alerts |
| GET | `/api/alerts/count` | ORGANIZER | Alert badge count |
| POST | `/api/alerts/:sessionId/dismiss` | ORGANIZER | Dismiss alert for current epoch |
| POST | `/api/cron/expire-reservations` | — | Manual expiry trigger |
| GET | `/health` | — | Health check |

\* STAFF callers are additionally checked by `authorizeSessionAssignment` — the request is rejected with 403 if there is no `StaffAssignment` row for `(userId, sessionId)`.

## What was deliberately not built

- **Refresh tokens.** An 8-hour JWT covers any realistic demo or working session; the extra endpoint and storage complexity is not worth it here.
- **WebSockets / server-sent events.** Seat counts are correct at the database regardless of what the UI shows; real-time push is a UX nicety, not a correctness requirement.
- **A message queue for expiry.** A sweep cron is simpler, has no additional infrastructure, and approximate expiry timing (within the 5-minute sweep interval) is fine for a holding window measured in minutes.
- **SSR on the frontend.** The app is behind a login and has no SEO requirement; a client-rendered SPA keeps the frontend entirely decoupled from the backend.
