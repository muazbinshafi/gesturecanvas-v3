-- Roles enum
CREATE TYPE public.room_role AS ENUM ('viewer', 'editor', 'admin');

-- Rooms
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

-- Members
CREATE TABLE public.room_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id uuid NOT NULL REFERENCES public.rooms(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  role public.room_role NOT NULL DEFAULT 'viewer',
  joined_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (room_id, user_id)
);

ALTER TABLE public.room_members ENABLE ROW LEVEL SECURITY;

-- Helper: is the user an admin/owner/editor of a given room (security definer to avoid recursion)
CREATE OR REPLACE FUNCTION public.user_room_role(_room_id uuid, _user_id uuid)
RETURNS public.room_role
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE
    WHEN EXISTS (SELECT 1 FROM public.rooms r WHERE r.id = _room_id AND r.owner_id = _user_id) THEN 'admin'::public.room_role
    ELSE (SELECT role FROM public.room_members WHERE room_id = _room_id AND user_id = _user_id)
  END
$$;

-- ROOMS policies
CREATE POLICY "Rooms readable by owner" ON public.rooms
  FOR SELECT USING (auth.uid() = owner_id);

CREATE POLICY "Rooms readable by members" ON public.rooms
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.room_members m WHERE m.room_id = rooms.id AND m.user_id = auth.uid())
  );

CREATE POLICY "Rooms readable by code when allowed" ON public.rooms
  FOR SELECT USING (allow_link_join = true);

CREATE POLICY "Rooms insertable by owner" ON public.rooms
  FOR INSERT WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "Rooms updatable by owner" ON public.rooms
  FOR UPDATE USING (auth.uid() = owner_id);

CREATE POLICY "Rooms deletable by owner" ON public.rooms
  FOR DELETE USING (auth.uid() = owner_id);

-- ROOM_MEMBERS policies
CREATE POLICY "Members readable by self" ON public.room_members
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Members readable by room owner" ON public.room_members
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.rooms r WHERE r.id = room_members.room_id AND r.owner_id = auth.uid())
  );

CREATE POLICY "Members insert by self via link join" ON public.room_members
  FOR INSERT WITH CHECK (
    auth.uid() = user_id AND
    EXISTS (SELECT 1 FROM public.rooms r WHERE r.id = room_id AND r.allow_link_join = true)
  );

CREATE POLICY "Members insert by owner" ON public.room_members
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM public.rooms r WHERE r.id = room_id AND r.owner_id = auth.uid())
  );

CREATE POLICY "Members updatable by owner" ON public.room_members
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM public.rooms r WHERE r.id = room_members.room_id AND r.owner_id = auth.uid())
  );

CREATE POLICY "Members deletable by owner or self" ON public.room_members
  FOR DELETE USING (
    auth.uid() = user_id OR
    EXISTS (SELECT 1 FROM public.rooms r WHERE r.id = room_members.room_id AND r.owner_id = auth.uid())
  );

-- Auto-add owner as admin member
CREATE OR REPLACE FUNCTION public.handle_new_room()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.room_members (room_id, user_id, role) VALUES (NEW.id, NEW.owner_id, 'admin');
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_room_created
AFTER INSERT ON public.rooms
FOR EACH ROW EXECUTE FUNCTION public.handle_new_room();

CREATE TRIGGER touch_rooms_updated_at
BEFORE UPDATE ON public.rooms
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();