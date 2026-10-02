-- ============================================================
--  Just Us — Server-side timestamps
--  Migration: 004_server_timestamps.sql
--
--  The chat timeline interleaves messages and call-log entries
--  by timestamp. If timestamps come from each device's own clock,
--  a phone and a laptop that disagree by a few seconds produce
--  out-of-order conversations. Let the database stamp them.
--
--  messages.created_at already defaults to now(); call_log.started_at
--  did not, so the client used to supply it.
-- ============================================================

ALTER TABLE call_log ALTER COLUMN started_at SET DEFAULT now();
