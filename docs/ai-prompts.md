# AI Prompts

I used Kiro (AI-powered IDE) / ChatGPT primarily to speed up boilerplate generation, write Prisma schemas, and figure out specific syntax (like database locking and date grouping). Below are the main prompts I used, grouped by feature, including where the AI gave me incorrect output and how I fixed it.

## 1. Initial Setup & Schema

**Prompt:**
> "Generate a Prisma schema for an event registration system. I need a User model (organizer/staff), Event, Session (with capacity), Registration (with status enum Reserved, Confirmed, CheckedIn, Expired, Cancelled), and an append-only RegistrationEvent table for audit logs. Use UUIDs."

**Prompt:**
> "Set up a basic Express + TypeScript server with dotenv, CORS (no wildcards), and a health check route. Also provide the middleware for JWT verification that attaches the user role to the request."

## 2. Concurrency & Seat Locking (Core Logic)

**Prompt:**
> "In Prisma, how do I safely check a session's capacity and create a registration without race conditions? I need to use a row lock (`SELECT ... FOR UPDATE`) so two people don't grab the last seat at the exact same time."

* **Bad Output:** The AI generated a Prisma `$transaction` that successfully executed the raw SQL lock (`$executeRaw`), but then it did the subsequent `prisma.registration.count()` and `prisma.registration.create()` outside the transaction context (using `prisma.` instead of `tx.`).
* **The Fix:** I had to manually rewrite the function to ensure all reads and writes happened inside the transaction callback block using the `tx` client, otherwise the lock would be useless.

## 3. CSV Import

**Prompt:**
> "Write an Express route using multer (memory storage) and csv-parse to handle bulk importing attendees into a session. Expect 'name' and 'email' columns. Check for duplicates."

* **Bad Output:** The AI wrapped the entire CSV parsing and database insertion loop into a single massive `$transaction`. Because of this, if a CSV had 99 valid rows and 1 invalid row (e.g., bad email), the entire transaction rolled back, rejecting everything.
* **The Fix:** I ripped out the overarching transaction. I rewrote the logic to process rows individually, catching errors per row, and returning a detailed JSON report to the frontend detailing exactly which rows succeeded and which failed.

## 4. Search & Pagination

**Prompt:**
> "Write a Prisma query to fetch Registrations with server-side pagination (page, pageSize). Include optional filters for eventId, sessionId, and a text search on attendeeName or attendeeEmail."

* **Bad Output:** The AI used `contains: searchQuery` for the text search, which in PostgreSQL is case-sensitive by default. Searching for "john" wouldn't find "John".
* **The Fix:** I added `mode: 'insensitive'` to the Prisma query parameters for the text fields.

## 5. Dashboard Analytics

**Prompt:**
> "Write a Prisma query to get the number of check-ins per day for the last 14 days."

* **Bad Output:** The AI queried the `Registration` table and grouped by `updatedAt` where `status = CHECKED_IN`.
* **The Fix:** This was fundamentally flawed because if a staff member added a note to a registration days later, the `updatedAt` timestamp would change, ruining the historical chart data. I rewrote the query to aggregate against the `RegistrationEvent` audit table instead, specifically targeting `createdAt` where `newStatus = CHECKED_IN`.

## 6. Frontend / UI

**Prompt:**
> "Create a React component using Tailwind CSS and shadcn/ui for a vertical timeline. It should take an array of audit events (timestamp, old status, new status, changed by) and render them with connecting lines."

*(This worked perfectly and saved me about 45 minutes of CSS fiddling).*