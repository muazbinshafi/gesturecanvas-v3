-- =========================================
-- Migration 1: profiles, user_settings, whiteboards
-- =========================================
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Profiles viewable by owner" ON public.profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Profiles insertable by owner" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY "Profiles updatable by owner" ON public.profiles FOR UPDATE USING (auth.uid() = id);

CREATE TABLE public.user_settings (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  theme TEXT NOT NULL DEFAULT 'dark',
  gesture_mappings JSONB NOT NULL DEFAULT '{}'::jsonb,
  ui_layout JSONB NOT NULL DEFAULT '{}'::jsonb,
  brush_settings JSONB NOT NULL DEFAULT '{}'::jsonb,
  smoothing JSONB NOT NULL DEFAULT '{}'::jsonb,
  smart_ink_mode TEXT NOT NULL DEFAULT 'auto',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.user_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Settings owner select" ON public.user_settings FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Settings owner insert" ON public.user_settings FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Settings owner update" ON public.user_settings FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Settings owner delete" ON public.user_settings FOR DELETE USING (auth.uid() = user_id);

CREATE TABLE public.whiteboards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL DEFAULT 'Untitled board',
  data JSONB NOT NULL DEFAULT '{}'::jsonb,
  thumbnail_url TEXT,
  share_token UUID UNIQUE,
  is_public BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.whiteboards ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Boards owner all" ON public.whiteboards FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Public boards readable" ON public.whiteboards FOR SELECT USING (is_public = true);
CREATE INDEX idx_whiteboards_user ON public.whiteboards(user_id);
CREATE INDEX idx_whiteboards_share ON public.whiteboards(share_token) WHERE share_token IS NOT NULL;

CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

CREATE TRIGGER profiles_touch BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER settings_touch BEFORE UPDATE ON public.user_settings FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER boards_touch BEFORE UPDATE ON public.whiteboards FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name, avatar_url)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)), NEW.raw_user_meta_data->>'avatar_url');
  INSERT INTO public.user_settings (user_id) VALUES (NEW.id);
  RETURN NEW;
END; $$;

CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- =========================================
-- Migration 2: rooms + members
-- =========================================
CREATE TYPE public.room_role AS ENUM ('viewer', 'editor', 'admin');

CREATE TABLE public.rooms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL,
  name text NOT NULL DEFAULT 'Untitled room',
  board_id uuid,
  join_code text UNIQUE NOT NULL DEFAULT substr(encode(gen_random_bytes(6), 'hex'), 1, 8),
  default_role public.room_role NOT NULL DEFAULT 'editor',
  allow_link_join boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.rooms ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.room_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id uuid NOT NULL REFERENCES public.rooms(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  role public.room_role NOT NULL DEFAULT 'viewer',
  joined_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (room_id, user_id)
);
ALTER TABLE public.room_members ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.user_room_role(_room_id uuid, _user_id uuid)
RETURNS public.room_role
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT CASE
    WHEN EXISTS (SELECT 1 FROM public.rooms r WHERE r.id = _room_id AND r.owner_id = _user_id) THEN 'admin'::public.room_role
    ELSE (SELECT role FROM public.room_members WHERE room_id = _room_id AND user_id = _user_id)
  END
$$;

CREATE POLICY "Rooms readable by owner" ON public.rooms FOR SELECT USING (auth.uid() = owner_id);
CREATE POLICY "Rooms readable by members" ON public.rooms FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.room_members m WHERE m.room_id = rooms.id AND m.user_id = auth.uid())
);
CREATE POLICY "Rooms readable by code when allowed" ON public.rooms FOR SELECT USING (allow_link_join = true);
CREATE POLICY "Rooms insertable by owner" ON public.rooms FOR INSERT WITH CHECK (auth.uid() = owner_id);
CREATE POLICY "Rooms updatable by owner" ON public.rooms FOR UPDATE USING (auth.uid() = owner_id);
CREATE POLICY "Rooms deletable by owner" ON public.rooms FOR DELETE USING (auth.uid() = owner_id);

CREATE POLICY "Members readable by self" ON public.room_members FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Members readable by room owner" ON public.room_members FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.rooms r WHERE r.id = room_members.room_id AND r.owner_id = auth.uid())
);
CREATE POLICY "Members insertable by self via link" ON public.room_members FOR INSERT WITH CHECK (
  auth.uid() = user_id AND EXISTS (SELECT 1 FROM public.rooms r WHERE r.id = room_members.room_id AND r.allow_link_join = true)
);
CREATE POLICY "Members insertable by room owner" ON public.room_members FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM public.rooms r WHERE r.id = room_members.room_id AND r.owner_id = auth.uid())
);
CREATE POLICY "Members updatable by room owner" ON public.room_members FOR UPDATE USING (
  EXISTS (SELECT 1 FROM public.rooms r WHERE r.id = room_members.room_id AND r.owner_id = auth.uid())
);
CREATE POLICY "Members deletable by self or owner" ON public.room_members FOR DELETE USING (
  auth.uid() = user_id OR EXISTS (SELECT 1 FROM public.rooms r WHERE r.id = room_members.room_id AND r.owner_id = auth.uid())
);

CREATE TRIGGER rooms_touch BEFORE UPDATE ON public.rooms FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();