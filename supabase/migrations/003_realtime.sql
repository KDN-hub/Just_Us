-- ============================================================
--  Just Us — Realtime publication
--  Migration: 003_realtime.sql
--
--  postgres_changes events are only emitted for tables that are
--  members of the `supabase_realtime` publication. Without this
--  the chat page subscribes successfully but never receives
--  anything. Idempotent: safe to run if a table is already added.
--
--  Presence writes (users UPDATE) and read receipts (messages
--  UPDATE) are already allowed by the anon policies in
--  002_rls_policies.sql. No auth.uid()-based policy is added
--  because this app has no Supabase Auth session (auth.uid() is
--  always NULL for the anon role), which would block all writes.
-- ============================================================

DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['messages', 'users', 'call_log']
  LOOP
    IF NOT EXISTS (
      SELECT 1
      FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime'
        AND schemaname = 'public'
        AND tablename = t
    ) THEN
      EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', t);
    END IF;
  END LOOP;
END $$;
