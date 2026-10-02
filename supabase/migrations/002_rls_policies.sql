-- ============================================================
--  Just Us — RLS Policies
--  Migration: 002_rls_policies.sql
--
--  Strategy: open anon read/write on all tables.
--  This is correct for a private 2-person app with a hidden
--  URL — the anon key is the only access vector and both
--  users share it. Tighten if Supabase Auth is added later.
-- ============================================================

-- ── USERS ───────────────────────────────────────────────────
CREATE POLICY "anon_select_users"
  ON users FOR SELECT TO anon USING (true);

CREATE POLICY "anon_update_users"
  ON users FOR UPDATE TO anon USING (true);

-- ── CONVERSATION ─────────────────────────────────────────────
CREATE POLICY "anon_select_conversation"
  ON conversation FOR SELECT TO anon USING (true);

CREATE POLICY "anon_update_conversation"
  ON conversation FOR UPDATE TO anon USING (true);

-- ── MESSAGES ─────────────────────────────────────────────────
CREATE POLICY "anon_select_messages"
  ON messages FOR SELECT TO anon USING (true);

CREATE POLICY "anon_insert_messages"
  ON messages FOR INSERT TO anon WITH CHECK (true);

CREATE POLICY "anon_update_messages"
  ON messages FOR UPDATE TO anon USING (true);

-- ── REACTIONS ────────────────────────────────────────────────
CREATE POLICY "anon_select_reactions"
  ON reactions FOR SELECT TO anon USING (true);

CREATE POLICY "anon_insert_reactions"
  ON reactions FOR INSERT TO anon WITH CHECK (true);

CREATE POLICY "anon_delete_reactions"
  ON reactions FOR DELETE TO anon USING (true);

-- ── CALL LOG ─────────────────────────────────────────────────
CREATE POLICY "anon_select_call_log"
  ON call_log FOR SELECT TO anon USING (true);

CREATE POLICY "anon_insert_call_log"
  ON call_log FOR INSERT TO anon WITH CHECK (true);

CREATE POLICY "anon_update_call_log"
  ON call_log FOR UPDATE TO anon USING (true);
