-- ============================================================
--  Just Us — Lockdown (step 2 of 2, RUN LAST)
--  Migration: 006_lockdown.sql
--
--  ⚠️  Run ONLY after:
--      1. 005_auth.sql has been applied,
--      2. both Auth accounts exist and users.auth_id is filled in,
--      3. the new app version is deployed and BOTH of you have signed in on
--         your devices (see supabase/AUTH_SETUP.md).
--
--  After this, the anon key (which is public, it's in the JS bundle) can no
--  longer read or write anything, and the old PIN hashes are gone.
--  The previous app version will stop working.
-- ============================================================

-- ── Remove every open anon policy from 002_rls_policies.sql ─
DROP POLICY IF EXISTS "anon_select_users"        ON public.users;
DROP POLICY IF EXISTS "anon_update_users"        ON public.users;
DROP POLICY IF EXISTS "anon_select_conversation" ON public.conversation;
DROP POLICY IF EXISTS "anon_update_conversation" ON public.conversation;
DROP POLICY IF EXISTS "anon_select_messages"     ON public.messages;
DROP POLICY IF EXISTS "anon_insert_messages"     ON public.messages;
DROP POLICY IF EXISTS "anon_update_messages"     ON public.messages;
DROP POLICY IF EXISTS "anon_select_reactions"    ON public.reactions;
DROP POLICY IF EXISTS "anon_insert_reactions"    ON public.reactions;
DROP POLICY IF EXISTS "anon_delete_reactions"    ON public.reactions;
DROP POLICY IF EXISTS "anon_select_call_log"     ON public.call_log;
DROP POLICY IF EXISTS "anon_insert_call_log"     ON public.call_log;
DROP POLICY IF EXISTS "anon_update_call_log"     ON public.call_log;

-- ── Belt and braces: anon gets no table privileges at all ───
REVOKE ALL ON ALL TABLES    IN SCHEMA public FROM anon;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM anon;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM anon;

-- ── The server no longer stores PINs (they live only on each device) ──
ALTER TABLE public.users DROP COLUMN IF EXISTS pin_hash;
