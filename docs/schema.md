# Schema

## Tables

### `users`
| Column | Type | Notes |
|---|---|---|
| id | uuid, PK | `@default(uuid())` |
| email | text, unique, not null | |
| password_hash | text, not null | bcrypt hash (cost 12) |
| role | enum(`ORGANIZER`, `STAFF`), not null | |
| created_at | timestamptz, default now() | |

### `events`
| Column | Type | Notes |
|---|---|---|
| id | uuid, PK | |
| name | text, not null | |
| description | text, nullable | |
| start_date | date, not null | stored as `@db.Date` |
| end_date | date, not null | stored as `@db.Date` |
| venue | text, not null | |
| archived | boolean, default false | hides event from default list views |
| created_at | timestamptz, default now() | |
| updated_at | timestamptz, auto-updated | |

Unique constraint: `(name, start_date, venue)` — prevents duplicate events for the same name at the same venue on the same date.

### `sessions`
| Column | Type | Notes |
|---|---|---|
| id | uuid, PK | |
| event_id | uuid, FK → events.id, not null | |
| title | text, not null | |
| start_time | timestamptz, not null | |
| duration_minutes | int, not null | |
| location | text, not null | room / area within the venue |
| capacity | int, not null | must be > 0 (app-enforced) |
| capacity_fill_epoch | int, default 0 | incremented each time the session transitions from under-capacity to at-capacity; drives alert re-trigger logic |
| created_at | timestamptz, default now() | |
| updated_at | timestamptz, auto-updated | |

Unique constraint: `(event_id, title, start_time)` — prevents duplicate sessions within an event.

### `staff_assignments`
| Column | Type | Notes |
|---|---|---|
| id | uuid, PK | |
| user_id | uuid, FK → users.id, not null | must reference a STAFF user (app-enforced) |
| session_id | uuid, FK → sessions.id, not null | |
| created_at | timestamptz, default now() | |

Unique constraint: `(user_id, session_id)` — prevents assigning the same staff member to the same session twice.

### `registrations`
| Column | Type | Notes |
|---|---|---|
| id | uuid, PK | |
| session_id | uuid, FK → sessions.id, not null | |
| attendee_name | text, not null | |
| attendee_email | text, not null | |
| status | enum(`RESERVED`, `CONFIRMED`, `CHECKED_IN`, `EXPIRED`, `CANCELLED`), not null | |
| reserved_at | timestamptz, not null | set to `now()` at creation |
| expires_at | timestamptz, nullable | set on creation (`reserved_at + RESERVATION_HOLD_MINUTES`); cleared to null when status leaves `RESERVED` |
| created_at | timestamptz, default now() | |
| updated_at | timestamptz, auto-updated | |

Indexes:
- `(session_id, status)` — capacity counts and dashboard queries filter on this pair constantly.
- `(attendee_email)` — search by email.

### `registration_events` (append-only audit log)
| Column | Type | Notes |
|---|---|---|
| id | uuid, PK | |
| registration_id | uuid, FK → registrations.id, not null | |
| old_status | enum, nullable | null on the creation event |
| new_status | enum, not null | |
| changed_by | uuid, FK → users.id, nullable | null when the system (cron expiry) made the change |
| note | text, nullable | optional staff note |
| created_at | timestamptz, default now() | no updated_at — rows are never mutated |

This table is insert-only by construction. No API route exposes an update or delete path for it, and the application's DB role has UPDATE/DELETE revoked on this table as a second enforcement layer.

### `alert_dismissals`
| Column | Type | Notes |
|---|---|---|
| id | uuid, PK | |
| session_id | uuid, FK → sessions.id, not null | |
| fill_epoch | int, not null | the value of `sessions.capacity_fill_epoch` at the time of dismissal |
| dismissed_by | uuid, FK → users.id, not null | must be an ORGANIZER (app-enforced) |
| dismissed_at | timestamptz, default now() | |

Unique constraint: `(session_id, fill_epoch)` — one dismissal per fill event per session.

An alert is considered active when no `alert_dismissals` row exists for `(session_id, current capacity_fill_epoch)`.

## Relationships

- `events` 1—* `sessions`
- `sessions` 1—* `registrations`
- `sessions` 1—* `alert_dismissals`
- `registrations` 1—* `registration_events`
- `users` (STAFF) *—* `sessions` via `staff_assignments`
- `users` 1—* `registration_events` (as `changed_by`, nullable)
- `users` 1—* `alert_dismissals` (as `dismissed_by`)

## Constraints: database vs. application

**Enforced in the database:**
- Foreign keys on all FK columns.
- Unique constraints: `(name, start_date, venue)` on events; `(event_id, title, start_time)` on sessions; `(user_id, session_id)` on staff assignments; `(session_id, fill_epoch)` on alert dismissals.
- Enum types for `role` and `status` — invalid string values are rejected at the DB level.
- Indexes on `(session_id, status)` and `(attendee_email)` on registrations.

**Enforced in application code:**
- Capacity vs. active-count comparison (a computed aggregate, not expressible as a static `CHECK` without a trigger).
- Status state machine: `RESERVED → CONFIRMED → CHECKED_IN`; cancellation only from `RESERVED` or `CONFIRMED`; any other transition returns 422 with an explanation. Enforced under a row lock inside a transaction so concurrent transitions serialise.
- Role-based access: organizer-only routes use `requireRole("ORGANIZER")` middleware; staff routes check `authorizeSessionAssignment` against the `staff_assignments` table on every request.
- `capacity > 0` validation on session creation/edit.
- Duplicate-email check per session before reserving (a registration with the same email and an active status is rejected with 409).

## Deliberate denormalisation

`sessions.capacity_fill_epoch` is a cached counter. It could technically be recomputed from `registration_events` history (count how many times the session transitioned into at-capacity state), but the alert badge and alert list queries run on every page load. Recomputing that from the full event log on every request is unnecessary overhead for something that changes rarely. The counter is incremented atomically inside the same transaction that creates the filling registration, so it is always consistent.

## What degrades first at 100× the data

- **`registrations`** grows fastest. The search endpoint uses `ILIKE` over `attendee_name` and `attendee_email`; past a few hundred thousand rows that becomes a full table scan. Fix: add a `pg_trgm` GIN index on both columns.
- **Dashboard capacity query** aggregates active-registration counts across all sessions. At 100× scale this needs a materialized view or a maintained counter column rather than a live aggregate scan.
- **`registration_events`** is never pruned by design. At 100× scale it outgrows `registrations` and its per-registration timeline query needs an index on `(registration_id, created_at)` — cheap to add now rather than as a hotfix later.
