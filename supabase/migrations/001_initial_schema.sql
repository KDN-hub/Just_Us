-- ============================================================
--  Just Us – Initial Schema
--  Migration: 001_initial_schema.sql
-- ============================================================

-- ────────────────────────────────────────────────────────────
--  USERS
--  One row per person in the couple.
-- ────────────────────────────────────────────────────────────
CREATE TABLE users (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  name         text        NOT NULL,
  nickname     text,
  pin_hash     text,                  -- bcrypt hash of the user's 4-digit PIN; NULL until set on first login
  avatar_color text        DEFAULT '#7A2C3B',
  last_seen    timestamptz,
  is_online    boolean     DEFAULT false,
  created_at   timestamptz DEFAULT now()
);

ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- ────────────────────────────────────────────────────────────
--  CONVERSATION
--  Singleton — exactly one row links the two partners.
-- ────────────────────────────────────────────────────────────
CREATE TABLE conversation (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_a_id     uuid REFERENCES users(id),
  user_b_id     uuid REFERENCES users(id),
  together_since date,
  created_at    timestamptz DEFAULT now()
);

ALTER TABLE conversation ENABLE ROW LEVEL SECURITY;

-- ────────────────────────────────────────────────────────────
--  MESSAGES
-- ────────────────────────────────────────────────────────────
CREATE TABLE messages (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid        REFERENCES conversation(id),
  sender_id       uuid        REFERENCES users(id),
  type            text        DEFAULT 'text'
                              CHECK (type IN ('text', 'image', 'ping')),
  content         text,
  status          text        DEFAULT 'sent'
                              CHECK (status IN ('sent', 'delivered', 'read')),
  created_at      timestamptz DEFAULT now()
);

ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

-- ────────────────────────────────────────────────────────────
--  REACTIONS
-- ────────────────────────────────────────────────────────────
CREATE TABLE reactions (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id uuid        REFERENCES messages(id) ON DELETE CASCADE,
  user_id    uuid        REFERENCES users(id),
  emoji      text        NOT NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE reactions ENABLE ROW LEVEL SECURITY;

-- ────────────────────────────────────────────────────────────
--  CALL LOG
-- ────────────────────────────────────────────────────────────
CREATE TABLE call_log (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id  uuid        REFERENCES conversation(id),
  caller_id        uuid        REFERENCES users(id),
  type             text        CHECK (type IN ('voice', 'video')),
  status           text        CHECK (status IN ('missed', 'answered', 'declined')),
  started_at       timestamptz,
  ended_at         timestamptz,
  duration_seconds integer
);

ALTER TABLE call_log ENABLE ROW LEVEL SECURITY;
