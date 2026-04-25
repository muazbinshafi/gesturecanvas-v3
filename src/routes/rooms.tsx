import { useEffect, useState, useCallback } from "react";
import { Link, createFileRoute } from "@tanstack/react-router";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  ArrowLeft, Copy, Crown, Eye, Pencil, Plus, Trash2, UserMinus, Users, Link as LinkIcon, LogIn, Loader2,
} from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/rooms")({
  head: () => ({
    meta: [
      { title: "Rooms — Gesture Whiteboard" },
      { name: "description", content: "Manage collaborative rooms: invite members by join code and change roles." },
    ],
  }),
  component: () => (
    <AuthProvider>
      <RoomsPage />
    </AuthProvider>
  ),
});

type Role = "viewer" | "editor" | "admin";

interface Room {
  id: string;
  name: string;
  owner_id: string;
  join_code: string;
  allow_link_join: boolean;
  default_role: Role;
  created_at: string;
}

interface MemberRow {
  id: string;
  room_id: string;
  user_id: string;
  role: Role;
  joined_at: string;
  display_name?: string | null;
  avatar_url?: string | null;
}

const ROLE_META: Record<Role, { icon: typeof Eye; label: string; desc: string }> = {
  viewer: { icon: Eye, label: "Viewer", desc: "Read-only access" },
  editor: { icon: Pencil, label: "Editor", desc: "Can draw and edit" },
  admin: { icon: Crown, label: "Admin", desc: "Full control" },
};

function RoomsPage() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background px-4">
        <div className="glass rounded-2xl p-8 max-w-md text-center">
          <Users className="w-10 h-10 mx-auto mb-3 text-primary" />
          <h1 className="text-xl font-semibold">Sign in to manage rooms</h1>
          <p className="text-sm text-muted-foreground mt-2">
            Rooms let you invite collaborators by a short join code and assign viewer / editor / admin roles.
          </p>
          <div className="mt-6 flex justify-center gap-2">
            <Button asChild><Link to="/auth">Sign in</Link></Button>
            <Button asChild variant="outline"><Link to="/">Home</Link></Button>
          </div>
        </div>
      </div>
    );
  }

  return <RoomsManager userId={user.id} />;
}

function RoomsManager({ userId }: { userId: string }) {
  const [rooms, setRooms] = useState<Room[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [newName, setNewName] = useState("");
  const [joinCode, setJoinCode] = useState("");

  const loadRooms = useCallback(async () => {
    setBusy(true);
    // RLS: owner OR member can read.
    const { data, error } = await supabase
      .from("rooms")
      .select("id,name,owner_id,join_code,allow_link_join,default_role,created_at")
      .order("created_at", { ascending: false });
    setBusy(false);
    if (error) { toast.error("Failed to load rooms: " + error.message); return; }
    setRooms((data ?? []) as Room[]);
    if (data && data.length && !activeId) setActiveId(data[0].id);
  }, [activeId]);

  useEffect(() => { void loadRooms(); }, [loadRooms]);

  const createRoom = async () => {
    const name = newName.trim() || "Untitled room";
    const { data, error } = await supabase
      .from("rooms")
      .insert([{ name, owner_id: userId }])
      .select()
      .single();
    if (error) { toast.error("Could not create room: " + error.message); return; }
    setNewName("");
    toast.success(`Room "${data.name}" created`);
    await loadRooms();
    setActiveId(data.id);
  };

  const joinByCode = async () => {
    const code = joinCode.trim().toLowerCase();
    if (!code) return;
    // First find the room by code (RLS allows reading rooms where allow_link_join = true).
    const { data: rs, error: e1 } = await supabase
      .from("rooms")
      .select("id,name,default_role,allow_link_join")
      .eq("join_code", code)
      .maybeSingle();
    if (e1) { toast.error(e1.message); return; }
    if (!rs) { toast.error("No room found for that code, or link-join is disabled"); return; }
    if (!rs.allow_link_join) { toast.error("This room does not allow link join"); return; }
    // Insert self as a member (RLS policy: "Members insertable by self via link" allows this).
    const { error: e2 } = await supabase
      .from("room_members")
      .insert([{ room_id: rs.id, user_id: userId, role: rs.default_role }]);
    if (e2 && !e2.message.includes("duplicate")) { toast.error(e2.message); return; }
    toast.success(`Joined "${rs.name}"`);
    setJoinCode("");
    await loadRooms();
    setActiveId(rs.id);
  };

  const deleteRoom = async (id: string) => {
    if (!confirm("Delete this room? Members will lose access.")) return;
    const { error } = await supabase.from("rooms").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success("Room deleted");
    setActiveId(null);
    await loadRooms();
  };

  const active = rooms.find((r) => r.id === activeId) ?? null;

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="glass sticky top-0 z-20 px-4 py-3 flex items-center gap-3">
        <Button asChild variant="ghost" size="icon" aria-label="Back">
          <Link to="/app"><ArrowLeft className="w-4 h-4" /></Link>
        </Button>
        <div className="min-w-0">
          <h1 className="text-sm font-semibold truncate">Rooms</h1>
          <p className="text-[11px] text-muted-foreground truncate">Invite collaborators by code · manage roles</p>
        </div>
        <div className="ml-auto" />
      </header>

      <div className="max-w-6xl mx-auto px-4 py-6 grid lg:grid-cols-[320px_1fr] gap-6">
        {/* LEFT: list + create + join */}
        <aside className="space-y-6">
          <section className="glass rounded-xl p-4 space-y-2">
            <h2 className="text-sm font-semibold flex items-center gap-2"><Plus className="w-4 h-4" /> Create room</h2>
            <Input
              placeholder="Room name"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              maxLength={80}
            />
            <Button onClick={createRoom} className="w-full gap-1.5">
              <Plus className="w-4 h-4" /> Create
            </Button>
          </section>

          <section className="glass rounded-xl p-4 space-y-2">
            <h2 className="text-sm font-semibold flex items-center gap-2"><LogIn className="w-4 h-4" /> Join by code</h2>
            <Input
              placeholder="e.g. 4b7e1a2c"
              value={joinCode}
              onChange={(e) => setJoinCode(e.target.value)}
              maxLength={32}
              className="font-mono"
            />
            <Button onClick={joinByCode} variant="outline" className="w-full gap-1.5">
              <LinkIcon className="w-4 h-4" /> Join
            </Button>
          </section>

          <section className="glass rounded-xl p-4">
            <h2 className="text-sm font-semibold mb-2 flex items-center gap-2">
              <Users className="w-4 h-4" /> Your rooms
              {busy && <Loader2 className="w-3 h-3 animate-spin text-muted-foreground" />}
            </h2>
            {rooms.length === 0 && !busy && (
              <p className="text-xs text-muted-foreground">No rooms yet. Create one above or join by code.</p>
            )}
            <ul className="space-y-1">
              {rooms.map((r) => {
                const isOwner = r.owner_id === userId;
                const on = r.id === activeId;
                return (
                  <li key={r.id}>
                    <button
                      onClick={() => setActiveId(r.id)}
                      className={`w-full text-left rounded-md p-2 text-sm border transition-colors ${
                        on ? "border-primary bg-primary/10" : "border-border hover:bg-muted/40"
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <span className="font-medium truncate flex-1">{r.name}</span>
                        {isOwner && <Crown className="w-3 h-3 text-warning" aria-label="Owner" />}
                      </div>
                      <div className="text-[10px] text-muted-foreground font-mono mt-0.5">{r.join_code}</div>
                    </button>
                  </li>
                );
              })}
            </ul>
          </section>
        </aside>

        {/* RIGHT: detail panel */}
        <main className="min-w-0">
          {active ? (
            <RoomDetail
              room={active}
              userId={userId}
              onChanged={loadRooms}
              onDelete={() => deleteRoom(active.id)}
            />
          ) : (
            <div className="glass rounded-2xl p-10 text-center text-muted-foreground">
              <Users className="w-10 h-10 mx-auto mb-3 opacity-60" />
              <p className="text-sm">Select a room on the left, or create one to get started.</p>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}

function RoomDetail({
  room, userId, onChanged, onDelete,
}: {
  room: Room;
  userId: string;
  onChanged: () => void;
  onDelete: () => void;
}) {
  const isOwner = room.owner_id === userId;
  const [members, setMembers] = useState<MemberRow[]>([]);
  const [loadingMembers, setLoadingMembers] = useState(false);

  const loadMembers = useCallback(async () => {
    setLoadingMembers(true);
    const { data: rows, error } = await supabase
      .from("room_members")
      .select("id,room_id,user_id,role,joined_at")
      .eq("room_id", room.id)
      .order("joined_at", { ascending: true });
    if (error) { toast.error(error.message); setLoadingMembers(false); return; }
    const list = (rows ?? []) as MemberRow[];
    // Best-effort hydrate display names for members the current user can read.
    const ids = Array.from(new Set(list.map((m) => m.user_id)));
    if (ids.length) {
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id,display_name,avatar_url")
        .in("id", ids);
      const byId = new Map((profiles ?? []).map((p) => [p.id, p]));
      list.forEach((m) => {
        const p = byId.get(m.user_id);
        m.display_name = p?.display_name ?? null;
        m.avatar_url = p?.avatar_url ?? null;
      });
    }
    setMembers(list);
    setLoadingMembers(false);
  }, [room.id]);

  useEffect(() => { void loadMembers(); }, [loadMembers]);

  const ownerInList = members.some((m) => m.user_id === room.owner_id);

  const updateRoom = async (patch: Partial<Pick<Room, "name" | "allow_link_join" | "default_role">>) => {
    const { error } = await supabase.from("rooms").update(patch).eq("id", room.id);
    if (error) { toast.error(error.message); return; }
    toast.success("Room updated");
    onChanged();
  };

  const updateRole = async (memberId: string, role: Role) => {
    if (!isOwner) { toast.error("Only the owner can change roles"); return; }
    const { error } = await supabase.from("room_members").update({ role }).eq("id", memberId);
    if (error) { toast.error("Update failed: " + error.message); return; }
    toast.success("Role updated");
    setMembers((prev) => prev.map((m) => (m.id === memberId ? { ...m, role } : m)));
  };

  const removeMember = async (memberId: string, name: string) => {
    if (!confirm(`Remove ${name} from the room?`)) return;
    const { error } = await supabase.from("room_members").delete().eq("id", memberId);
    if (error) { toast.error(error.message); return; }
    toast.success("Member removed");
    await loadMembers();
  };

  const leaveRoom = async () => {
    if (!confirm("Leave this room?")) return;
    const me = members.find((m) => m.user_id === userId);
    if (!me) return;
    const { error } = await supabase.from("room_members").delete().eq("id", me.id);
    if (error) { toast.error(error.message); return; }
    toast.success("Left room");
    onChanged();
  };

  const copyCode = () => {
    void navigator.clipboard.writeText(room.join_code);
    toast.success("Join code copied");
  };
  const copyLink = () => {
    const url = `${window.location.origin}/rooms?code=${room.join_code}`;
    void navigator.clipboard.writeText(url);
    toast.success("Invite link copied");
  };

  return (
    <div className="space-y-6">
      <section className="glass rounded-xl p-5">
        <div className="flex items-start gap-3">
          <div className="flex-1 min-w-0">
            {isOwner ? (
              <Input
                defaultValue={room.name}
                onBlur={(e) => {
                  const v = e.currentTarget.value.trim();
                  if (v && v !== room.name) void updateRoom({ name: v });
                }}
                className="text-lg font-semibold !h-auto py-1"
                maxLength={80}
              />
            ) : (
              <h2 className="text-lg font-semibold truncate">{room.name}</h2>
            )}
            <p className="text-xs text-muted-foreground mt-1">
              {isOwner ? "You own this room" : "You are a member"}
            </p>
          </div>
          {isOwner && (
            <Button variant="ghost" size="icon" onClick={onDelete} aria-label="Delete room" title="Delete room">
              <Trash2 className="w-4 h-4 text-destructive" />
            </Button>
          )}
        </div>

        <div className="mt-4 grid sm:grid-cols-2 gap-3">
          <div className="rounded-lg border border-border p-3">
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Join code</div>
            <div className="flex items-center gap-2 mt-1">
              <code className="font-mono text-lg">{room.join_code}</code>
              <Button size="icon" variant="ghost" onClick={copyCode} aria-label="Copy code">
                <Copy className="w-3.5 h-3.5" />
              </Button>
            </div>
            <Button size="sm" variant="outline" className="mt-2 gap-1.5 w-full" onClick={copyLink}>
              <LinkIcon className="w-3.5 h-3.5" /> Copy invite link
            </Button>
          </div>

          <div className="rounded-lg border border-border p-3 space-y-2">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={room.allow_link_join}
                disabled={!isOwner}
                onChange={(e) => void updateRoom({ allow_link_join: e.target.checked })}
              />
              Allow join via code / link
            </label>
            <label className="text-[10px] uppercase tracking-wider text-muted-foreground block">Default role for new joiners</label>
            <select
              value={room.default_role}
              disabled={!isOwner}
              onChange={(e) => void updateRoom({ default_role: e.target.value as Role })}
              className="w-full bg-input rounded-md px-2 py-1.5 text-sm border border-border"
            >
              <option value="viewer">Viewer</option>
              <option value="editor">Editor</option>
              <option value="admin">Admin</option>
            </select>
          </div>
        </div>
      </section>

      <section className="glass rounded-xl p-5">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold flex items-center gap-2">
            <Users className="w-4 h-4" /> Members ({members.length + (ownerInList ? 0 : 1)})
            {loadingMembers && <Loader2 className="w-3 h-3 animate-spin text-muted-foreground" />}
          </h3>
          {!isOwner && (
            <Button size="sm" variant="outline" onClick={leaveRoom} className="gap-1.5">
              <UserMinus className="w-3.5 h-3.5" /> Leave
            </Button>
          )}
        </div>

        <ul className="divide-y divide-border">
          {/* Owner row (always visible to anyone with read access) */}
          {!ownerInList && (
            <MemberItem
              key="owner-shadow"
              name={room.owner_id === userId ? "You" : "Owner"}
              roleLabel="Owner"
              isOwnerRow
              isSelf={room.owner_id === userId}
              canEdit={false}
              onRoleChange={() => {}}
              onRemove={() => {}}
            />
          )}
          {members.map((m) => {
            const isOwnerRow = m.user_id === room.owner_id;
            const isSelf = m.user_id === userId;
            const name = isSelf ? "You" : m.display_name || `User ${m.user_id.slice(0, 6)}`;
            return (
              <MemberItem
                key={m.id}
                name={name}
                avatar={m.avatar_url ?? undefined}
                role={isOwnerRow ? undefined : m.role}
                roleLabel={isOwnerRow ? "Owner" : undefined}
                isOwnerRow={isOwnerRow}
                isSelf={isSelf}
                canEdit={isOwner && !isOwnerRow}
                onRoleChange={(r) => void updateRole(m.id, r)}
                onRemove={() => void removeMember(m.id, name)}
              />
            );
          })}
        </ul>

        {!isOwner && (
          <p className="mt-4 text-[11px] text-muted-foreground">
            Only the room owner can change roles or remove members. RLS enforces this on the server too.
          </p>
        )}
      </section>
    </div>
  );
}

function MemberItem({
  name, avatar, role, roleLabel, isOwnerRow, isSelf, canEdit, onRoleChange, onRemove,
}: {
  name: string;
  avatar?: string;
  role?: Role;
  roleLabel?: string;
  isOwnerRow: boolean;
  isSelf: boolean;
  canEdit: boolean;
  onRoleChange: (r: Role) => void;
  onRemove: () => void;
}) {
  const Meta = role ? ROLE_META[role] : null;
  return (
    <li className="flex items-center gap-3 py-2.5">
      <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center overflow-hidden shrink-0">
        {avatar ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={avatar} alt="" className="w-full h-full object-cover" />
        ) : (
          <span className="text-xs font-semibold">{name.slice(0, 1).toUpperCase()}</span>
        )}
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium truncate flex items-center gap-1.5">
          {name}
          {isSelf && <span className="text-[10px] text-muted-foreground">(you)</span>}
          {isOwnerRow && <Crown className="w-3 h-3 text-warning" aria-label="Owner" />}
        </div>
        {Meta && (
          <div className="text-[11px] text-muted-foreground flex items-center gap-1">
            <Meta.icon className="w-3 h-3" /> {Meta.desc}
          </div>
        )}
        {roleLabel && !Meta && (
          <div className="text-[11px] text-muted-foreground">{roleLabel}</div>
        )}
      </div>

      {canEdit && role ? (
        <select
          value={role}
          onChange={(e) => onRoleChange(e.target.value as Role)}
          className="bg-input text-foreground rounded-md px-2 py-1 text-xs border border-border"
        >
          <option value="viewer">Viewer</option>
          <option value="editor">Editor</option>
          <option value="admin">Admin</option>
        </select>
      ) : (
        role && (
          <span className="text-xs px-2 py-0.5 rounded-md border border-border capitalize">{role}</span>
        )
      )}

      {canEdit && (
        <Button size="icon" variant="ghost" aria-label="Remove member" onClick={onRemove}>
          <UserMinus className="w-4 h-4" />
        </Button>
      )}
    </li>
  );
}
