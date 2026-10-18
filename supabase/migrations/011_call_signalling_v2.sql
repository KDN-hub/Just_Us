-- ============================================================
--  011 — Dedicated private Realtime topic for the v2 call engine
--
--  lib/callEngine.ts signals on `call-signal-<conversationId>-v2`
--  so call traffic no longer shares the chat channel lifecycle.
--  This migration is ADDITIVE: it grants send/receive on that
--  topic to signed-in members only. No tables are touched, no
--  existing policies are modified or removed, and the previous
--  `call-signal-...` policies in 005_auth.sql stay valid.
--
--  Run in the Supabase SQL editor (or supabase db push) once per
--  environment. Safe to re-run: the DROP POLICY IF EXISTS lines
--  only remove these two policies if they already exist.
-- ============================================================

DROP POLICY IF EXISTS "members receive call signalling v2" ON realtime.messages;

CREATE POLICY "members receive call signalling v2"
  ON realtime.messages
  FOR SELECT TO authenticated
  USING (
    realtime.topic() = 'call-signal-c0000000-0000-0000-0000-000000000003-v2'
    AND realtime.messages.extension IN ('broadcast')
    AND public.current_app_user() IS NOT NULL
  );

DROP POLICY IF EXISTS "members send call signalling v2" ON realtime.messages;

CREATE POLICY "members send call signalling v2"
  ON realtime.messages
  FOR INSERT TO authenticated
  WITH CHECK (
    realtime.topic() = 'call-signal-c0000000-0000-0000-0000-000000000003-v2'
    AND realtime.messages.extension IN ('broadcast')
    AND public.current_app_user() IS NOT NULL
  );
