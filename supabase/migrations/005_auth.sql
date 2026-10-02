-- ============================================================
--  Just Us — Real authentication (step 1 of 2, ADDITIVE / SAFE)
--  Migration: 005_auth.sql
--
--  Adds everything needed for Supabase-Auth-based access control
--  WITHOUT removing the old anon policies, so the currently
--  deployed app keeps working while you migrate.
--  Run 006_lockdown.sql last — see supabase/AUTH_SETUP.md.
-- ============================================================

-- ── Link each app user to a Supabase Auth account ───────────
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS auth_id uuid UNIQUE REFERENCES auth.users(id) ON DELETE SET NULL;

-- ── Helpers (SECURITY DEFINER so policies can look up users/conversation
--    without recursing into their own RLS) ────────────────────
CREATE OR REPLACE FUNCTION public.current_app_user()
RETURNS uuid
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id FROM public.users WHERE auth_id = auth.uid() LIMIT 1
$$;

CREATE OR REPLACE FUNCTION public.is_conversation_member(conv uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.conversation c
    WHERE c.id = conv
      AND public.current_app_user() IN (c.user_a_id, c.user_b_id)
  )
$$;

REVOKE ALL ON FUNCTION public.current_app_user()          FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.is_conversation_member(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.current_app_user()          TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_conversation_member(uuid) TO authenticated;

-- ── USERS: both partners are visible; you may only edit your own row ──
CREATE POLICY "auth_select_users" ON public.users
  FOR SELECT TO authenticated
  USING (public.current_app_user() IS NOT NULL);

CREATE POLICY "auth_update_own_user" ON public.users
  FOR UPDATE TO authenticated
  USING (id = public.current_app_user())
  WITH CHECK (id = public.current_app_user());

REVOKE UPDATE ON public.users FROM authenticated;
GRANT  UPDATE (nickname, avatar_color, is_online, last_seen) ON public.users TO authenticated;

-- ── CONVERSATION ────────────────────────────────────────────
CREATE POLICY "auth_select_conversation" ON public.conversation
  FOR SELECT TO authenticated
  USING (public.current_app_user() IN (user_a_id, user_b_id));

CREATE POLICY "auth_update_conversation" ON public.conversation
  FOR UPDATE TO authenticated
  USING      (public.current_app_user() IN (user_a_id, user_b_id))
  WITH CHECK (public.current_app_user() IN (user_a_id, user_b_id));

REVOKE UPDATE ON public.conversation FROM authenticated;
GRANT  UPDATE (together_since) ON public.conversation TO authenticated;

-- ── MESSAGES ────────────────────────────────────────────────
CREATE POLICY "auth_select_messages" ON public.messages
  FOR SELECT TO authenticated
  USING (public.is_conversation_member(conversation_id));

-- You can only send as yourself, into your own conversation
CREATE POLICY "auth_insert_messages" ON public.messages
  FOR INSERT TO authenticated
  WITH CHECK (
    sender_id = public.current_app_user()
    AND public.is_conversation_member(conversation_id)
  );

-- Only the RECEIVER updates a message (delivered / read), and only its status
CREATE POLICY "auth_update_messages" ON public.messages
  FOR UPDATE TO authenticated
  USING (
    public.is_conversation_member(conversation_id)
    AND sender_id <> public.current_app_user()
  )
  WITH CHECK (
    public.is_conversation_member(conversation_id)
    AND sender_id <> public.current_app_user()
  );

REVOKE UPDATE ON public.messages FROM authenticated;
GRANT  UPDATE (status) ON public.messages TO authenticated;

-- ── REACTIONS ───────────────────────────────────────────────
CREATE POLICY "auth_select_reactions" ON public.reactions
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.messages m
    WHERE m.id = reactions.message_id
      AND public.is_conversation_member(m.conversation_id)
  ));

CREATE POLICY "auth_insert_reactions" ON public.reactions
  FOR INSERT TO authenticated
  WITH CHECK (
    user_id = public.current_app_user()
    AND EXISTS (
      SELECT 1 FROM public.messages m
      WHERE m.id = reactions.message_id
        AND public.is_conversation_member(m.conversation_id)
    )
  );

CREATE POLICY "auth_delete_reactions" ON public.reactions
  FOR DELETE TO authenticated
  USING (user_id = public.current_app_user());

-- ── CALL LOG ────────────────────────────────────────────────
CREATE POLICY "auth_select_call_log" ON public.call_log
  FOR SELECT TO authenticated
  USING (public.is_conversation_member(conversation_id));

CREATE POLICY "auth_insert_call_log" ON public.call_log
  FOR INSERT TO authenticated
  WITH CHECK (
    caller_id = public.current_app_user()
    AND public.is_conversation_member(conversation_id)
  );

-- The caller finalises the log entry
CREATE POLICY "auth_update_call_log" ON public.call_log
  FOR UPDATE TO authenticated
  USING      (caller_id = public.current_app_user())
  WITH CHECK (caller_id = public.current_app_user());

REVOKE UPDATE ON public.call_log FROM authenticated;
GRANT  UPDATE (status, ended_at, duration_seconds) ON public.call_log TO authenticated;

-- ── REALTIME: private call-signalling channel ───────────────
--  The client joins the broadcast channel with { private: true }; only signed-in
--  members may receive or send on it. (The chat's postgres_changes stream is
--  already protected by the table policies above.)
CREATE POLICY "members receive call signalling" ON realtime.messages
  FOR SELECT TO authenticated
  USING (
    realtime.topic() = 'call-signal-c0000000-0000-0000-0000-000000000003'
    AND realtime.messages.extension IN ('broadcast')
    AND public.current_app_user() IS NOT NULL
  );

CREATE POLICY "members send call signalling" ON realtime.messages
  FOR INSERT TO authenticated
  WITH CHECK (
    realtime.topic() = 'call-signal-c0000000-0000-0000-0000-000000000003'
    AND realtime.messages.extension IN ('broadcast')
    AND public.current_app_user() IS NOT NULL
  );
