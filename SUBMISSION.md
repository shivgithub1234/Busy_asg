# SUBMISSION

## Repository

**GitHub:** https://github.com/shivgithub1234/Busy_asg

## Live Application

**URL:** https://busy-asg-bfha.vercel.app/login

> **Note on cold starts:** The backend is hosted on Render's free tier, which spins down after 15 minutes of inactivity. The first request after an idle period may take 30–60 seconds to respond. Subsequent requests are fast. If the page appears to hang on first load, wait a moment and refresh.

---

## Demo Credentials

All accounts use the same password: **`Password123`**

| Role | Email | What they can do |
|---|---|---|
| Organizer | `organizer@test.com` | Full access — create/edit/archive events, manage sessions, all registrations, staff assignments, alerts, CSV import/export, dashboard |
| Organizer | `organizer2@test.com` | Second organizer account — useful for testing concurrent actions or multi-user scenarios |
| Staff | `staff1@test.com` | Assigned to: React Advanced Patterns, Docker & Kubernetes, AI in Production, Opening Keynote |
| Staff | `staff2@test.com` | Assigned to: Cloud Architecture Patterns, Modern Web Development, Security Best Practices, DB Performance Tuning |
| Staff | `staff3@test.com` | Assigned to: all three Spring Summit 2026 sessions |

---

## Seeded Demo Data

The database is pre-loaded with enough data to exercise every feature without manual setup.

### Events

| Event | Status | Date | Sessions |
|---|---|---|---|
| Developer Workshop Day | Active — **today** | Today | 3 sessions with live check-ins (hits dashboard counters) |
| TechConf 2026 | Active — upcoming | +5 days from seed | 5 sessions, one at capacity with an active alert |
| Spring Summit 2026 | Active — past | −14 days from seed | 3 sessions with full registration lifecycle history |
| Legacy Systems Summit | **Archived** | −60 days from seed | 1 session — hidden from default views |

### Registration lifecycle coverage

Every possible status is present in the seeded data:

- `RESERVED` — seat held, not yet confirmed
- `CONFIRMED` — organizer/staff confirmed the reservation
- `CHECKED_IN` — attendee has arrived (contributes to today's dashboard count)
- `EXPIRED` — reservation was never confirmed and auto-expired
- `CANCELLED` — attendee or organizer cancelled before check-in

Every status change has a corresponding audit entry in the registration timeline, including automated expiries (recorded with `changedBy = null`).

### Capacity and alert states

- **AI in Production** (TechConf 2026, capacity 5) — fully booked with 5 active registrations. Alert is **active and undismissed** — visible immediately in the Alerts panel with the nav badge count.
- **DB Performance Tuning** (Workshop Day, capacity 3) — fully booked, but the alert has been **dismissed** by the organizer. Cancelling one registration and re-booking to capacity will trigger the alert to reappear (epoch re-trigger logic).

---

## Feature Checklist

All ten required goals from the brief are implemented.

### 1. Accounts and roles

- Sign up and log in with email + password (bcrypt hashed, cost 12).
- Two roles: `ORGANIZER` and `STAFF`.
- Role enforcement is **server-side** — `requireRole("ORGANIZER")` middleware on every organizer-only route, `authorizeSessionAssignment` on every staff-scoped registration mutation. Hiding a button in the UI is not the enforcement; the API rejects the request with 403 regardless of what the client does.

### 2. Events

- Organizers can create, edit, archive, and restore events.
- Each event has a name, description, start date, end date, and venue.
- Archived events are hidden from default list views. A toggle reveals them. Archiving does not delete sessions or registrations.

### 3. Sessions inside events

- Sessions belong to exactly one event and carry a title, start time, duration, location within the venue, and seat capacity.
- Organizers can create, edit, and delete sessions. STAFF cannot.
- Opening an event shows all its sessions with their current booking counts.

### 4. Registration lifecycle

- Reserving a seat checks capacity under a `SELECT ... FOR UPDATE` row lock inside a transaction — two simultaneous requests for the last seat cannot both succeed.
- State machine: `RESERVED → CONFIRMED → CHECKED_IN`. Cancellation allowed from `RESERVED` or `CONFIRMED` only, never from `CHECKED_IN`. Any other transition is rejected with a 422 and a message explaining why.
- Reservations not confirmed within the holding window (`RESERVATION_HOLD_MINUTES`, default 15) are automatically marked `EXPIRED` by a `node-cron` sweep running every 5 minutes.

### 5. Staff assignment

- Organizers assign and unassign staff members to sessions.
- A staff member can be assigned to any number of sessions across any event.
- Staff see a dedicated **My Sessions** page listing only the sessions they are assigned to.

### 6. Finding registrations

- A global registrations list supports: text search over attendee name and email, filters for event/session/status, sorting by reserved time/status/session, and pagination with a total count.
- All filtering, searching, sorting, and pagination run **on the server in Postgres**. Nothing is loaded into the browser to be filtered client-side.

### 7. Bulk CSV actions

- **Import:** Upload a CSV of attendees into a session. Each row is reported as `created`, `duplicate` (same email already registered for that session), or `rejected` (invalid data with a reason). Valid rows are committed even when other rows in the same file are rejected.
- **Export:** Download a session's complete check-in sheet as a CSV file — all registered attendees and their current status.

### 8. Dashboard

- Headline numbers: sessions today, attendees checked in today, registrations expired this week, sessions currently at capacity.
- Status breakdown (count per status across visible registrations).
- Per-session registration breakdown.
- Check-ins per day over the last 14 days, rendered as a bar chart (Recharts).

### 9. Immutable registration timeline

- Every registration has a timeline showing: when it was created, every status change with old status, new status, and who made the change, and any notes staff left.
- `registration_events` rows are **insert-only**. No API route exposes an update or delete path for this table. The application's database role has `UPDATE`/`DELETE` revoked on this table as a second enforcement layer — a code change that accidentally attempts a mutation gets a database error, not silent corruption.

### 10. At-capacity alerts

- A session that reaches full capacity appears in the Alerts panel. The navigation badge shows the count of active alerts.
- An organizer can dismiss an alert for the current fill event.
- If a cancellation or expiry later frees a seat and a new reservation fills the session to capacity again, the alert **reappears** — implemented via a `capacity_fill_epoch` integer on the session, incremented atomically inside the filling reservation's transaction. Dismissals are keyed to a specific epoch, so a new fill event is a new alert.

---

## Technical Notes

### Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js 16 + React 19 + TypeScript |
| Backend | Express 4 + TypeScript |
| Database | PostgreSQL via Supabase (free tier) |
| ORM | Prisma 5 |
| Auth | JWT (8h expiry), bcryptjs (cost 12) |
| UI | Tailwind CSS v4, Radix UI, shadcn/ui, Recharts |
| Validation | Zod (every mutating backend route) |
| Background jobs | node-cron (in-process, every 5 minutes) |

### Hosting

- **Database** — Supabase (managed PostgreSQL, free tier)
- **Backend** — Render (Express API, free tier — see cold start note above)
- **Frontend** — Vercel (Next.js, free tier)

### Environment variables

No secrets are committed to the repository. All connection strings, JWT secrets, and API URLs are set as environment variables in each host's dashboard.

### Running locally

```bash
# Backend
cd backend
cp .env.example .env   # fill in DATABASE_URL, DIRECT_URL, JWT_SECRET
npm install
npx prisma generate
npm run dev            # starts on port 4000

# Frontend (separate terminal)
cd frontend
cp .env.local.example .env.local   # set NEXT_PUBLIC_API_URL=http://localhost:4000
npm install
npm run dev            # starts on port 3000

# Seed demo data (clears existing data first)
cd backend
npx tsx prisma/seed.ts
```

---

## Documentation

All required `docs/` files are committed to the repository:

| File | Contents |
|---|---|
| `docs/architecture.md` | Stack, high-level diagram, representative request path (reserving a seat end-to-end), CORS/auth decisions, API surface table, what was deliberately not built |
| `docs/schema.md` | Every table with columns and types, relationship types (1:many vs many:many), database vs application constraints, deliberate denormalisation, what degrades first at 100× the data |
| `docs/plan.md` | Work phases in build order, rationale for the ordering, time estimates vs actuals, what to cut first if time runs short |
| `docs/decisions.md` | Eight documented decisions — what was chosen, what was rejected, and why — including one reversal |
| `docs/ai-prompts.md` | AI prompts used throughout the project, grouped by task, including prompts that produced incorrect output and what was changed |
