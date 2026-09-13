# Plan

Work split into phases, each ending at a committed, working state. The order follows data dependencies — auth and models first, then the features that build on them.

| # | Phase | What it delivers | Est. |
|---|---|---|---|
| 0 | Scaffold | Express + TypeScript project, Prisma + Supabase connection, CORS allowlist, `/health` route. Next.js 16 + React 19 frontend, calling `/health` to confirm the wire is live. JWT signup/login + `authenticateJWT` middleware. App shell with sidebar navigation. | 1.5h |
| 1 | Events & Sessions CRUD | `Event` + `Session` Prisma models + migration. Organizer-only create/edit/archive/restore for events. Nested session create/edit/delete under an event. Event list hides archived by default. | 1.5h |
| 2 | Registration lifecycle | `Registration` + `RegistrationEvent` models. Reserve endpoint with row-lock transaction and capacity check. Status transition endpoint (`RESERVED → CONFIRMED → CHECKED_IN`, cancel from `RESERVED`/`CONFIRMED` only, transitions serialised under row lock). Every change writes an audit row. | 2.0h |
| 3 | Roles & staff assignment | `StaffAssignment` model. Organizer-only assign/unassign UI. `authorizeSessionAssignment` middleware wired into every registration mutation route. "My sessions" view for STAFF. | 1.0h |
| 4 | Auto-expiry | `expiresAt` set on reservation (`now + RESERVATION_HOLD_MINUTES`). `expireReservations()` function with per-row lock. `node-cron` running it on `*/5 * * * *`. HTTP trigger at `POST /api/cron/expire-reservations`. | 0.75h |
| 5 | Search & filter | Server-side text search over `attendee_name` + `attendee_email`, filters for event/session/status, sort options, pagination with total count — all computed in Postgres, nothing filtered in the browser. | 1.0h |
| 6 | CSV import & export | Bulk import with per-row `created / duplicate / rejected` report; valid rows committed even when others in the same file fail. Export session check-in sheet as CSV. Multer for file upload (5 MB limit, memory storage). | 1.5h |
| 7 | Dashboard | Headline counts: sessions today, checked-in today, expired this week, sessions at capacity. Status breakdown and per-session breakdown. 14-day check-ins chart (Recharts). | 1.5h |
| 8 | At-capacity alerts | `capacityFillEpoch` increment in the reservation transaction. Alert list + nav badge count. Dismiss endpoint keyed to the current epoch so alerts reappear after a cancellation fills the session again. | 1.0h |
| 9 | Registration timeline UI | Read-only timeline over `RegistrationEvent` rows per registration (data exists from phase 2). Staff note field on status transitions. | 0.5h |
| 10 | Deploy & docs | Deploy order: Supabase → Render (Express + env vars) → Vercel (Next.js + `NEXT_PUBLIC_API_URL`). Seed script with demo data for both roles. Fill `SUBMISSION.md`. Finish all `docs/` files. Run the 10-goal checklist against the live URL. | 1.5h |

**Total estimate: ~13.25h**

## Build order rationale

Auth and data models come first because every later feature depends on them. The registration lifecycle (phase 2) is built before staff scoping (phase 3) deliberately — it's easier to verify the state machine against an organizer-only surface, then layer the assignment restriction on top of working endpoints, than to build both simultaneously.

Search, CSV, and the dashboard (phases 5–7) are independent of each other and can reorder freely if one takes longer than expected. Alerts (8) and the timeline UI (9) are derived views over data that earlier phases already produce, so they're the safest to trim if time runs short — nothing downstream depends on them.

## What to cut first if short on time

1. Dashboard chart (ship headline numbers without the 14-day Recharts chart)
2. Alert re-trigger nuance (ship simpler "dismissed until next manual reset" and note it)
3. CSV export (import matters more — it has the per-row validation rules the brief spells out in detail)

Never cut: the capacity/overselling guarantee (row-lock transaction), server-side role enforcement (`requireRole` + `authorizeSessionAssignment`), or the immutable audit log (`registration_events`). Those are the core correctness requirements.
