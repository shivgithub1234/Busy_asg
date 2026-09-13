# Event Booking

A full-stack event registration system for managing multi-day conferences and workshops — organizers set up events and sessions with real seat capacities, check-in staff manage the door, and reservations that go unconfirmed expire automatically.

## Live URLs

| Service | URL |
|---|---|
| Frontend | https://busy-asg-bfha.vercel.app/login |
| Backend API | https://busy-asg-1.onrender.com |
| Health check | https://busy-asg-1.onrender.com/health |

> The Render free tier sleeps after inactivity. The first request after idle can take 30–60 seconds — this is expected, not broken.

## Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js 16 + React 19 + TypeScript, hosted on Vercel |
| Backend | Express 4 + TypeScript, hosted on Render |
| Database | PostgreSQL via Supabase |
| ORM | Prisma 5 |
| Auth | JWT (8-hour expiry), bcrypt password hashing |
| UI | Tailwind CSS v4, Radix UI, Recharts |
| Validation | Zod on all mutating routes |
| Background job | node-cron (every 5 minutes, in-process) |

## Features

1. **Accounts and roles** — email/password auth with two roles: `ORGANIZER` and `STAFF`. Role enforcement lives in Express middleware, not the UI.
2. **Events** — organizers create, edit, archive, and restore events (name, description, dates, venue). Archived events are hidden from default views.
3. **Sessions** — each session belongs to one event and carries a title, start time, duration, location, and seat capacity. Organizers create, edit, and delete sessions.
4. **Registration lifecycle** — `RESERVED → CONFIRMED → CHECKED_IN`; cancellation from `RESERVED` or `CONFIRMED` only. Capacity is checked under a row lock so the session can never be oversold. Reservations not confirmed within the holding window (15 minutes by default) expire automatically.
5. **Staff assignment** — organizers assign any number of staff to any number of sessions. Staff can only act on sessions they are assigned to, checked server-side on every request.
6. **Search and filter** — server-side text search over attendee name and email, filters for event/session/status, sort options, and pagination with total count.
7. **CSV import and export** — bulk-import attendees from a CSV file with a per-row `created / duplicate / rejected` report; valid rows are committed even when others fail. Export any session's check-in sheet as CSV.
8. **Dashboard** — headline counts (sessions today, checked-in today, expired this week, sessions at capacity), status and session breakdowns, 14-day check-ins chart.
9. **Immutable audit log** — every registration carries a full timeline of status changes, who made them, and any notes. The log is insert-only; no code path or DB grant allows mutation.
10. **At-capacity alerts** — a badge in the nav counts sessions at capacity. Organizers can dismiss an alert; it reappears if a seat is freed and the session fills again.

## Running locally

### Prerequisites

- Node.js 20+
- A PostgreSQL database (Supabase free tier works)

### Backend

```bash
cd backend
cp .env.example .env   # fill in DATABASE_URL, DIRECT_URL, JWT_SECRET, FRONTEND_URL
npm install
npm run prisma:migrate
npm run dev            # runs on http://localhost:4000
```

### Frontend

```bash
cd frontend
cp .env.local.example .env.local   # set NEXT_PUBLIC_API_URL=http://localhost:4000
npm install
npm run dev                         # runs on http://localhost:3000
```

### Environment variables

**Backend (`backend/.env`)**

| Variable | Description |
|---|---|
| `DATABASE_URL` | Postgres connection string (pooled, for Prisma runtime) |
| `DIRECT_URL` | Postgres connection string (direct, for migrations) |
| `JWT_SECRET` | Secret used to sign JWTs — keep this long and random |
| `PORT` | Server port, defaults to `4000` |
| `FRONTEND_URL` | Allowed CORS origin in production |
| `RESERVATION_HOLD_MINUTES` | How long a `RESERVED` seat is held before expiry, defaults to `15` |

**Frontend (`frontend/.env.local`)**

| Variable | Description |
|---|---|
| `NEXT_PUBLIC_API_URL` | Base URL of the Express API |

## Project structure

```
EventBooking/
├── backend/
│   ├── prisma/
│   │   └── schema.prisma
│   └── src/
│       ├── controllers/    # route handlers
│       ├── middleware/     # authenticateJWT, authorizeSessionAssignment
│       ├── routes/         # Express routers
│       ├── lib/            # prisma client, expireReservations
│       └── index.ts        # app entry, cron setup
├── frontend/
│   └── app/
│       ├── (auth)/         # login, signup pages
│       └── (app)/          # protected pages (events, sessions, registrations, dashboard, alerts, staff)
└── docs/
    ├── architecture.md
    ├── schema.md
    ├── plan.md
    └── decisions.md
```

## Docs

- [`docs/architecture.md`](docs/architecture.md) — stack, request flow, API surface, what was not built
- [`docs/schema.md`](docs/schema.md) — every table, column, constraint, and index
- [`docs/plan.md`](docs/plan.md) — build phases, order rationale, what to cut if short on time
- [`docs/decisions.md`](docs/decisions.md) — eight key decisions with reasoning and rejected alternatives
