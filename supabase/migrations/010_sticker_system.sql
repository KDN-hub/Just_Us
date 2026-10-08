-- ============================================================
--  Just Us — Chat Page Sticker System
--  Migration: 010_sticker_system.sql
-- ============================================================

-- ── 1. Update messages type check constraint to include 'sticker' ──
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'messages_type_check'
  ) THEN
    ALTER TABLE public.messages DROP CONSTRAINT messages_type_check;
  END IF;
END $$;

ALTER TABLE public.messages
  ADD CONSTRAINT messages_type_check
  CHECK (type IN ('text', 'image', 'ping', 'sticker'));

-- ── 2. Create sticker_packs table ──────────────────────────────
CREATE TABLE IF NOT EXISTS public.sticker_packs (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text NOT NULL,
  creator_id  uuid REFERENCES public.users(id) ON DELETE SET NULL,
  cover_url   text,
  created_at  timestamptz DEFAULT now(),
  updated_at  timestamptz DEFAULT now()
);

ALTER TABLE public.sticker_packs ENABLE ROW LEVEL SECURITY;

-- ── 3. Create stickers table ───────────────────────────────────
CREATE TABLE IF NOT EXISTS public.stickers (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pack_id      uuid REFERENCES public.sticker_packs(id) ON DELETE CASCADE,
  owner_id     uuid REFERENCES public.users(id) ON DELETE SET NULL,
  storage_path text NOT NULL,
  url          text NOT NULL,
  mime_type    text DEFAULT 'image/webp',
  width        integer,
  height       integer,
  created_at   timestamptz DEFAULT now(),
  updated_at   timestamptz DEFAULT now()
);

ALTER TABLE public.stickers ENABLE ROW LEVEL SECURITY;

-- ── 4. Create recent_stickers table ────────────────────────────
CREATE TABLE IF NOT EXISTS public.recent_stickers (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid REFERENCES public.users(id) ON DELETE CASCADE,
  sticker_id uuid REFERENCES public.stickers(id) ON DELETE CASCADE,
  used_at    timestamptz DEFAULT now(),
  CONSTRAINT recent_stickers_user_sticker_key UNIQUE (user_id, sticker_id)
);

ALTER TABLE public.recent_stickers ENABLE ROW LEVEL SECURITY;

-- ── 5. Create favorite_stickers table ──────────────────────────
CREATE TABLE IF NOT EXISTS public.favorite_stickers (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid REFERENCES public.users(id) ON DELETE CASCADE,
  sticker_id uuid REFERENCES public.stickers(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  CONSTRAINT favorite_stickers_user_sticker_key UNIQUE (user_id, sticker_id)
);

ALTER TABLE public.favorite_stickers ENABLE ROW LEVEL SECURITY;

-- ── 6. RLS Policies for Sticker Tables ─────────────────────────
-- For sticker_packs: Both authenticated partners can view and manage
CREATE POLICY "allow_authenticated_select_packs" ON public.sticker_packs
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "allow_authenticated_insert_packs" ON public.sticker_packs
  FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "allow_authenticated_update_packs" ON public.sticker_packs
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "allow_authenticated_delete_packs" ON public.sticker_packs
  FOR DELETE TO authenticated USING (true);

-- For stickers: Both authenticated partners can view and manage
CREATE POLICY "allow_authenticated_select_stickers" ON public.stickers
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "allow_authenticated_insert_stickers" ON public.stickers
  FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "allow_authenticated_update_stickers" ON public.stickers
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "allow_authenticated_delete_stickers" ON public.stickers
  FOR DELETE TO authenticated USING (true);

-- For recent_stickers: Users can manage their own recents
CREATE POLICY "allow_authenticated_select_recents" ON public.recent_stickers
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "allow_authenticated_insert_recents" ON public.recent_stickers
  FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "allow_authenticated_update_recents" ON public.recent_stickers
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "allow_authenticated_delete_recents" ON public.recent_stickers
  FOR DELETE TO authenticated USING (true);

-- For favorite_stickers: Users can manage their favorites
CREATE POLICY "allow_authenticated_select_favorites" ON public.favorite_stickers
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "allow_authenticated_insert_favorites" ON public.favorite_stickers
  FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "allow_authenticated_delete_favorites" ON public.favorite_stickers
  FOR DELETE TO authenticated USING (true);

-- ── 7. Storage Policies for existing 'stickers' Bucket ─────────
-- Allow authenticated users to view, upload, update and delete objects in the stickers bucket
CREATE POLICY "allow_authenticated_select_stickers_storage" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'stickers');

CREATE POLICY "allow_authenticated_insert_stickers_storage" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'stickers');

CREATE POLICY "allow_authenticated_update_stickers_storage" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'stickers')
  WITH CHECK (bucket_id = 'stickers');

CREATE POLICY "allow_authenticated_delete_stickers_storage" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'stickers');

-- Fallback for public bucket reads if configured as public
CREATE POLICY "allow_public_select_stickers_storage" ON storage.objects
  FOR SELECT TO public
  USING (bucket_id = 'stickers');
