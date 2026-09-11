-- AddUniqueConstraint: events (name, start_date, venue)
-- Prevents duplicate event creation on double-submit / network retry.
CREATE UNIQUE INDEX "events_name_start_date_venue_key" ON "events"("name", "start_date", "venue");

-- AddUniqueConstraint: sessions (event_id, title, start_time)
-- Prevents duplicate session creation under the same event on double-submit.
CREATE UNIQUE INDEX "sessions_event_id_title_start_time_key" ON "sessions"("event_id", "title", "start_time");
