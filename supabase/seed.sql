-- ============================================================
--  Just Us – Seed Data
--  supabase/seed.sql
--
--  Just inserts the two users and their shared conversation.
--  PIN hashes start as NULL — each person sets their PIN
--  on first launch through the app's setup screen.
-- ============================================================

-- ────────────────────────────────────────────────────────────
--  Two users (no PIN yet — set in-app on first login)
-- ────────────────────────────────────────────────────────────
INSERT INTO users (id, name, nickname, avatar_color)
VALUES
  (
    'a0000000-0000-0000-0000-000000000001',
    'Kam',
    'Kam',
    '#7A2C3B'
  ),
  (
    'b0000000-0000-0000-0000-000000000002',
    'Nono❤️',
    'Nono❤️',
    '#C4A882'
  );

-- ────────────────────────────────────────────────────────────
--  One conversation linking them
-- ────────────────────────────────────────────────────────────
INSERT INTO conversation (id, user_a_id, user_b_id, together_since)
VALUES
  (
    'c0000000-0000-0000-0000-000000000003',
    'a0000000-0000-0000-0000-000000000001',  -- Kamsi
    'b0000000-0000-0000-0000-000000000002',  -- Baby
    NULL  -- set your actual anniversary date later, e.g. '2023-06-15'
  );
