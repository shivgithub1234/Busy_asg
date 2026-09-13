# Decisions

## 1 — Separate Express API and Next.js frontend, not a Next.js monolith

**Chose:** Express + TypeScript on Render as a standalone API, Next.js 16 (pure client SPA) on Vercel, communicating over REST with a bearer JWT.

**Rejected:** A single Next.js app using API routes as the backend and pages as the frontend.

**Why:** A clean boundary means the frontend has no framework-level access to the database, the backend has no dependency on a rendering layer, and each half can be deployed and reasoned about independently. The costs are real — CORS configuration, a bearer-token auth scheme instead of a same-origin cookie, two deploy pipelines — and they are accepted deliberately in exchange for that separation.

---

## 2 — Row lock + transaction for capacity checks, not optimistic read-then-insert

**Chose:** `SELECT ... FOR UPDATE` on the session row inside a Prisma `$transaction`, then count active registrations, then insert — all atomic.

**Rejected:** Read the current count in application code, compare to capacity, then insert if it passes.

**Why:** The read-then-insert pattern has a race: two concurrent requests for the last seat both read "1 free" before either commits, and both succeed — the double-booking the brief describes as the current spreadsheet failure mode. The row lock forces the second request to wait for the first to commit and then recount against the real state. The same lock pattern is used in `transitionStatus` to prevent two concurrent callers from both writing a `RegistrationEvent` row for the same transition.

---

## 3 — Bearer JWT in an Authorization header, not a cross-origin session cookie

**Chose:** Backend issues a signed JWT on login (`expiresIn: "8h"`); the frontend attaches it as `Authorization: Bearer <token>` on every request; `authenticateJWT` middleware verifies it on every protected route.

**Rejected:** An `httpOnly` session cookie set by the Express API, sent automatically by the browser.

**Why:** A cookie issued by one origin (Render) sent to another (Vercel) requires `SameSite=None; Secure` plus `credentials: include` wired through CORS on both ends, and still breaks in some browser privacy-mode/third-party-cookie configurations. A header-attached token sidesteps all of that. The frontend is responsible for storing the token and attaching it — there is no automatic CSRF protection either, but CSRF only applies to cookies that the browser sends automatically; bearer tokens are immune by design.

---

## 4 — Epoch counter for at-capacity alerts, not a boolean dismissed flag

**Chose:** `sessions.capacity_fill_epoch`, an integer incremented each time a session transitions from under-capacity to at-capacity (inside the same transaction as the filling reservation). An `AlertDismissal` row is keyed to a specific epoch value. An alert is active when no dismissal row exists for `(session_id, current_epoch)`.

**Rejected:** A plain `alert_dismissed: boolean` on the session, cleared whenever the session drops below capacity.

**Why:** A boolean can't distinguish "dismissed and still full from the same fill event" from "dismissed, then a cancellation freed a seat and a new reservation filled it back up." The clear-on-drop logic only fires if the count is checked at exactly the moment it drops below capacity — easy to miss under concurrent writes. The epoch makes each fill event a distinct, comparable value, so "is the current fill event dismissed" is a direct lookup with no timing sensitivity.

---

## 5 — Audit log immutability enforced by no mutation code path, backed by revoked DB grants

**Chose:** `registration_events` rows are insert-only. No API route exposes an update or delete path for this table, and the application's DB role has UPDATE/DELETE revoked on it as a second layer.

**Rejected:** Relying on code discipline alone ("we just never call update on this table").

**Why:** The brief is explicit that the history cannot be rewritten "including by organizers" — that is a guarantee, not a convention. Application-only discipline is one refactor away from being silently violated. A DB-level grant restriction fails loudly (a query error) if anything ever attempts a mutation, and does so regardless of which code path triggered it.

---

## 6 — In-process node-cron for expiry, not a per-reservation scheduled job

**Chose:** A single `node-cron` job (`*/5 * * * *`) that sweeps all `RESERVED` rows where `expiresAt <= now` in one pass, running inside the same Render process as the Express API.

**Rejected:** Scheduling an individual delayed job per reservation (e.g., via a queue with delayed delivery or a Render Cron Job hitting an HTTP endpoint per registration).

**Why:** The holding window only needs to be approximately enforced — a few minutes of slack is fine for "don't sit on a seat forever." A sweep query is a single index-backed `WHERE expires_at <= now AND status = 'RESERVED'`, needs no extra infrastructure, and is simple enough to reason about and test. Each expired row is still processed under a row lock so concurrent requests can't observe a stale `RESERVED` status during the sweep window.

---

## 7 — Multer memory storage for CSV import, not disk storage

**Chose:** `multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } })` — the uploaded file is held in a `Buffer` on `req.file.buffer` and processed in-request.

**Rejected:** Writing the upload to a temp file on disk, then reading it back.

**Why:** Attendee list CSVs are small (hundreds to low thousands of rows). Processing them in memory is simpler, has no temp-file cleanup to manage, and is faster. The 5 MB limit is a reasonable ceiling for the expected input size and prevents trivially large uploads from exhausting server memory.

---

## 8 — Next.js 16 as a client-rendered SPA, not using SSR or Server Components

**Chose:** All pages use `"use client"` and fetch data from the Express API via `axios` after the component mounts. The app is effectively a client-side SPA hosted on Vercel.

**Rejected:** Using Next.js Server Components or `getServerSideProps` to fetch data from the API at render time.

**Why:** The entire application is behind a login. No page needs to be publicly indexable, and there is no SEO requirement. Server-rendering would add complexity (forwarding auth tokens from the server side, handling Render cold-start latency in the SSR path) for no user-facing benefit. A client-rendered approach keeps the frontend entirely stateless and decoupled from the backend's availability at build time.
