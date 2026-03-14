import { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import * as Icons from "lucide-react";
import { supabase } from "@/lib/supabase";
import { motion, AnimatePresence } from "framer-motion";
import { Users, Plus, Check } from "lucide-react";
import SearchBar from "./SearchBar";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface Club {
  id: string;
  name: string;
  members: number;
  color: string;
  icon?: string;
}

const COLORS = [
  "from-purple-600 to-indigo-700",
  "from-pink-600 to-purple-700",
  "from-violet-600 to-blue-700",
  "from-indigo-600 to-purple-700",
  "from-blue-600 to-violet-700",
];

const getColor = (i: number) => COLORS[i % COLORS.length];

interface SidebarClubListProps {
  activeClub: string | null;
  onSelectClub: (id: string) => void;
}

const ClubItem = ({
  club,
  isActive,
  onClick,
  index,
  isSuggested = false,
  onJoin,
  onHover,
  onLeave,
  onContextMenu,
}: {
  club: Club;
  isActive: boolean;
  onClick: () => void;
  index: number;
  isSuggested?: boolean;
  onJoin?: () => void;
  onHover?: (e: React.MouseEvent<HTMLButtonElement>) => void;
  onLeave?: () => void;
  onContextMenu?: (e: React.MouseEvent<HTMLButtonElement>) => void;
}) => (
  <motion.button
    initial={{ opacity: 0, y: 8 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ delay: index * 0.04, duration: 0.25, ease: "easeOut" }}
    whileHover={{ scale: 1.015 }}
    whileTap={{ scale: 0.98 }}
    onClick={onClick}
    onMouseEnter={onHover}
    onMouseLeave={onLeave}
    onContextMenu={onContextMenu}
    className={`w-full flex items-center gap-3.5 px-3 py-3 rounded-xl border transition-all duration-300 ${
      isActive
        ? "border-primary bg-primary/10 shadow-[0_0_15px_hsl(270_70%_60%/0.15)]"
        : "border-transparent bg-card/30 hover:border-primary/20 hover:bg-card/50"
    }`}
  >
    <div className="w-11 h-11 rounded-xl bg-black border border-white/10 flex items-center justify-center shrink-0">
      {(() => {
        const LucideIcon =
          (club.icon && (Icons as any)[club.icon]) || Icons.Circle;

        return <LucideIcon className="w-5 h-5 text-white opacity-90" />;
      })()}
    </div>

    <div className="flex-1 text-left min-w-0">
      <p className="text-[15px] font-medium text-foreground truncate">
        {club.name}
      </p>
      <p className="text-[12px] text-muted-foreground flex items-center gap-1.5 mt-0.5">
        <Users className="w-3 h-3" />
        {club.members.toLocaleString()}
      </p>
    </div>

    {isSuggested && (
      <motion.div
        whileHover={{ scale: 1.15 }}
        whileTap={{ scale: 0.9 }}
        onClick={(e) => {
          e.stopPropagation();
          onJoin?.();
        }}
        className="w-7 h-7 rounded-full border border-primary/40 bg-primary/10 flex items-center justify-center text-primary hover:bg-primary/20 transition-colors shrink-0"
      >
        <Plus className="w-3.5 h-3.5" />
      </motion.div>
    )}
  </motion.button>
);

const SidebarClubList = ({
  activeClub,
  onSelectClub,
}: SidebarClubListProps) => {
  const [joinedClubs, setJoinedClubs] = useState<Club[]>([]);
  const [suggestedClubs, setSuggestedClubs] = useState<Club[]>([]);
  const [loading, setLoading] = useState(true);
  const [recentlyJoined, setRecentlyJoined] = useState<Set<string>>(new Set());

  const sidebarRef = useRef<HTMLDivElement>(null);

  const [hoveredClub, setHoveredClub] = useState<Club | null>(null);
  const [hoverTop, setHoverTop] = useState(0);
  const [sidebarRight, setSidebarRight] = useState(280);

  /* ⭐ NEW context menu state */

  const [menuClub, setMenuClub] = useState<Club | null>(null);
  const [menuPos, setMenuPos] = useState({ x: 0, y: 0 });

  const [leaveClub, setLeaveClub] = useState<Club | null>(null);
  const [leavingId, setLeavingId] = useState<string | null>(null);

  /* ⭐ reusable loader */

  const loadClubs = async () => {
    setLoading(true);

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      setLoading(false);
      return;
    }

    const { data: joined } = await supabase
      .from("club_members")
      .select(
        `
        club_id,
        clubs (
          id,
          name,
          slug,
          icon
        )
      `,
      )
      .eq("user_id", user.id);

    const { data: allMembers } = await supabase
      .from("club_members")
      .select("club_id");

    const counts: Record<string, number> = {};

    allMembers?.forEach((m: any) => {
      counts[m.club_id] = (counts[m.club_id] || 0) + 1;
    });

    const mapped =
      joined?.map((row: any, i: number) => ({
        id: row.clubs.id,
        name: row.clubs.name,
        members: counts[row.clubs.id] || 0,
        color: getColor(i),
        icon: row.clubs.icon,
      })) ?? [];

    setJoinedClubs(mapped);

    const { data: allClubs } = await supabase
      .from("clubs")
      .select("id, name, icon");

    const clubIds = joined?.map((j: any) => j.club_id) ?? [];

    const suggested =
      allClubs
        ?.filter((c: any) => !clubIds.includes(c.id))
        .map((c: any, i: number) => ({
          id: c.id,
          name: c.name,
          members: counts[c.id] || 0,
          color: getColor(i + 3),
          icon: c.icon,
        })) ?? [];

    setSuggestedClubs(suggested);

    setLoading(false);
  };

  useEffect(() => {
    loadClubs();
  }, []);

  useEffect(() => {
    const channel = supabase
      .channel("club-member-changes")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "club_members",
        },
        () => {
          loadClubs();
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  

  /* ⭐ close menu on outside click */

  useEffect(() => {
    const close = () => setMenuClub(null);
    window.addEventListener("click", close);
    return () => window.removeEventListener("click", close);
  }, []);

  const handleJoin = async (club: Club) => {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) return;

    setRecentlyJoined((prev) => new Set(prev).add(club.id));

    const { error } = await supabase.from("club_members").insert({
      club_id: club.id,
      user_id: user.id,
    });

    if (error) {
      alert("Failed to join club");
      setRecentlyJoined((prev) => {
        const next = new Set(prev);
        next.delete(club.id);
        return next;
      });
      return;
    }

    setJoinedClubs((prev) => [...prev, club]);
    setSuggestedClubs((prev) => prev.filter((c) => c.id !== club.id));

    setRecentlyJoined((prev) => {
      const next = new Set(prev);
      next.delete(club.id);
      return next;
    });
  };

  useEffect(() => {
    const update = () => {
      if (sidebarRef.current) {
        const rect = sidebarRef.current.getBoundingClientRect();
        setSidebarRight(rect.right + 18); // ⭐ GAP OUTSIDE SIDEBAR
      }
    };

    update();
    window.addEventListener("resize", update);

    return () => window.removeEventListener("resize", update);
  }, []);

  /* ⭐ REAL LEAVE */

const confirmLeave = async () => {
  if (!leaveClub) return;

  const club = leaveClub;

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return;

  setLeavingId(club.id);
  setHoveredClub(null);

  await new Promise((r) => setTimeout(r, 280));

  const { error } = await supabase
    .from("club_members")
    .delete()
    .eq("club_id", club.id)
    .eq("user_id", user.id);

  if (error) {
    alert("Failed to leave club");
    setLeavingId(null);
    return;
  }

  setJoinedClubs((prev) => {
    const next = prev.filter((c) => c.id !== club.id);

    if (activeClub === club.id && next.length > 0) {
      onSelectClub(next[0].id);
    }

    return next;
  });

  setSuggestedClubs((prev) => [
    { ...club, members: Math.max(0, club.members - 1) },
    ...prev,
  ]);

  setLeaveClub(null);
  setMenuClub(null);
  setLeavingId(null);
};

  return (
    <div ref={sidebarRef} className="flex flex-col gap-3 h-full relative">
      <SearchBar />

      <p className="text-[10px] text-muted-foreground uppercase tracking-widest font-semibold px-1 mt-1">
        Your Clubs
      </p>

      <div className="space-y-1.5">
        <AnimatePresence>
          {loading ? (
            <p className="text-xs text-muted-foreground px-2 py-2">
              Loading clubs...
            </p>
          ) : (
            joinedClubs.map((club, i) => (
              <ClubItem
                key={club.id}
                club={club}
                isActive={activeClub === club.id}
                onClick={() => onSelectClub(club.id)}
                index={i}
                onHover={(e) => {
                  const rect = e.currentTarget.getBoundingClientRect();
                  setHoverTop(rect.top + rect.height / 2);
                  setHoveredClub(club);
                }}
                onLeave={() => setHoveredClub(null)}
                onContextMenu={(e) => {
                  e.preventDefault();
                  setMenuClub(club);
                  setMenuPos({ x: e.clientX, y: e.clientY });
                }}
              />
            ))
          )}
        </AnimatePresence>
      </div>

      <div className="h-px bg-border/50 mx-1" />

      <p className="text-[10px] text-muted-foreground uppercase tracking-widest font-semibold px-1">
        Discover Clubs
      </p>

      <div className="flex-1 overflow-y-auto space-y-1.5 pr-1 scrollbar-thin">
        <AnimatePresence>
          {suggestedClubs.map((club, i) => (
            <ClubItem
              key={club.id}
              club={club}
              isActive={false}
              onClick={() => onSelectClub(club.id)}
              index={i}
              isSuggested
              onJoin={() => handleJoin(club)}
              onHover={(e) => {
                const rect = e.currentTarget.getBoundingClientRect();
                setHoverTop(rect.top + rect.height / 2);
                setHoveredClub(club);
              }}
              onLeave={() => setHoveredClub(null)}
            />
          ))}
        </AnimatePresence>
      </div>

      {/* ⭐ CONTEXT MENU */}

      <AnimatePresence>
        {menuClub && (
          <motion.div
            initial={{ opacity: 0, scale: 0.92, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.92, y: 8 }}
            transition={{ duration: 0.15 }}
            style={{
              position: "fixed",
              top: menuPos.y,
              left: menuPos.x,
              zIndex: 99999,
            }}
            className="w-44 rounded-xl border border-white/10 bg-black/90 backdrop-blur-xl shadow-2xl overflow-hidden"
          >
            <button
              onClick={() => {
                setLeaveClub(menuClub);
                setMenuClub(null);
              }}
              className="w-full text-left px-4 py-3 text-sm text-red-400 hover:bg-red-500/10 transition"
            >
              Leave Club
            </button>

            <button
              onClick={() => setMenuClub(null)}
              className="w-full text-left px-4 py-3 text-sm text-muted-foreground hover:bg-white/5 transition"
            >
              Cancel
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ⭐ HOVER CARD */}

      {createPortal(
        <AnimatePresence>
          {hoveredClub && (
            <motion.div
              layoutId="clubHoverCard"
              initial={{ opacity: 0, x: -20, scale: 0.96 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, x: -20, scale: 0.96 }}
              transition={{ type: "spring", stiffness: 260, damping: 22 }}
              style={{
                position: "fixed",
                top: hoverTop - 90,
                left: sidebarRight,
                zIndex: 999999999,
              }}
              className="w-72 rounded-2xl border border-white/10 bg-white/5 backdrop-blur-2xl shadow-[0_20px_60px_rgba(0,0,0,0.6)] p-5 pointer-events-none"
            >
              <p className="text-base font-semibold text-white">
                {hoveredClub.name}
              </p>

              <p className="text-sm text-muted-foreground mt-2 leading-relaxed">
                Community for people interested in{" "}
                {hoveredClub.name.toLowerCase()} discussions, content and
                updates.
              </p>

              <div className="mt-4 flex items-center gap-2 text-sm text-muted-foreground">
                <Users className="w-4 h-4" />
                {hoveredClub.members} members
              </div>
            </motion.div>
          )}
        </AnimatePresence>,
        document.body,
      )}

      <AlertDialog open={!!leaveClub} onOpenChange={() => setLeaveClub(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Leave {leaveClub?.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              You will stop receiving posts and updates from this club. You can
              join again anytime.
            </AlertDialogDescription>
          </AlertDialogHeader>

          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmLeave}>
              Leave Club
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default SidebarClubList;
