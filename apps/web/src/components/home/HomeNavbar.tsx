import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { User } from "lucide-react";
import ProfileDropdown from "./ProfileDropdown";
import { supabase } from "@/lib/supabase";
import { Link, useLocation } from "react-router-dom"; // <-- Added Router imports

import { Users, Film, Gamepad2, MessageCircle, Trophy } from "lucide-react"; // <-- Added Trophy icon

export const TABS = [
  { name: "Clubs", id: "Clubs", icon: Users },
  { name: "Cinema", id: "Cinema", icon: Film },
  { name: "Games", id: "Games", icon: Gamepad2 },
  { name: "Messages", id: "Messages", icon: MessageCircle }
] as const;

export type HomeTab = (typeof TABS)[number]["id"];

interface HomeNavbarProps {
  activeTab: HomeTab;
  onTabChange: (tab: HomeTab) => void;
}

const HomeNavbar = ({ activeTab, onTabChange }: HomeNavbarProps) => {
  const [unreadCount, setUnreadCount] = useState(0);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [username, setUsername] = useState("");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  
  const location = useLocation(); // Keep track of current route for Leaderboard tab

  useEffect(() => {
    const load = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) return;
      setCurrentUserId(user.id);

      const { data } = await supabase
        .from("profiles")
        .select("username, avatar_url")
        .eq("id", user.id)
        .single();

      if (data) {
        setUsername(data.username);
        setAvatarUrl(data.avatar_url);
      }

      // Initial unread count
      fetchUnreadCount(user.id);
    };

    load();
  }, []);

  const fetchUnreadCount = async (userId: string) => {
    try {
      // 1. Get all conversations user is part of
      const { data: participants } = await supabase
        .from("conversation_participants")
        .select("conversation_id, last_read_at")
        .eq("user_id", userId);

      if (!participants || participants.length === 0) {
        setUnreadCount(0);
        return;
      }

      // 2. For each, check if there are newer messages from others (Concurrently)
      const unreadChecks = participants.map(async (p) => {
        const { count: msgCount } = await supabase
          .from("messages")
          .select("*", { count: "exact", head: true })
          .eq("conversation_id", p.conversation_id)
          .gt("created_at", p.last_read_at)
          .neq("sender_id", userId);
        
        return msgCount && msgCount > 0 ? 1 : 0;
      });

      const results = await Promise.all(unreadChecks);
      const totalUnreadConversations = results.reduce((acc, val) => acc + val, 0);

      setUnreadCount(totalUnreadConversations);
    } catch (err) {
      console.error("Error fetching unread count:", err);
    }
  };

  // Realtime subscription for unread updates
  useEffect(() => {
    if (!currentUserId) return;

    const channel = supabase
      .channel("unread-count")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
        },
        () => fetchUnreadCount(currentUserId)
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "conversation_participants",
          filter: `user_id=eq.${currentUserId}`,
        },
        () => fetchUnreadCount(currentUserId)
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [currentUserId]);

  const isLeaderboardActive = location.pathname === "/leaderboard";

  return (
    <nav className="sticky top-0 z-50 flex items-center justify-between px-4 md:px-8 py-3 border-b border-border bg-background/80 backdrop-blur-xl">
      <div className="flex items-center gap-1 overflow-x-auto scrollbar-none">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => onTabChange(tab.id as HomeTab)}
            className="flex items-center gap-2 relative px-4 py-2 text-sm font-medium whitespace-nowrap transition-colors duration-200"
          >
            {activeTab === tab.id && !isLeaderboardActive && (
              <motion.div
                layoutId="tab-bg"
                className="absolute inset-0 rounded-xl bg-primary/10 border border-primary/30 shadow-[0_0_12px_hsl(270_70%_60%/0.15)]"
                transition={{ type: "spring", stiffness: 400, damping: 30 }}
              />
            )}
            <motion.div
              className={`relative z-10 flex items-center gap-1.5 ${
                activeTab === tab.id && !isLeaderboardActive ? "text-primary" : "text-muted-foreground"
              }`}
              whileHover={{ scale: 1.05 }}
              transition={{ duration: 0.15 }}
            >
              <tab.icon className="w-4 h-4" />
              <span>{tab.name}</span>
              {tab.id === "Messages" && unreadCount > 0 && (
                <span className="flex items-center justify-center min-w-[18px] h-[18px] px-1 bg-red-500 text-white text-[10px] font-bold rounded-full shadow-[0_0_8px_rgba(239,68,68,0.4)] ml-0.5">
                  {unreadCount}
                </span>
              )}
            </motion.div>
            {activeTab === tab.id && !isLeaderboardActive && (
              <motion.div
                layoutId="tab-underline"
                className="absolute bottom-0 left-1/4 right-1/4 h-0.5 bg-primary rounded-full"
                transition={{ type: "spring", stiffness: 400, damping: 30 }}
              />
            )}
          </button>
        ))}

        {/* --- LEADERBOARD LINK --- */}
        <Link
          to="/leaderboard"
          className="flex items-center gap-2 relative px-4 py-2 text-sm font-medium whitespace-nowrap transition-colors duration-200"
        >
          {isLeaderboardActive && (
             <div className="absolute inset-0 rounded-xl bg-primary/10 border border-primary/30 shadow-[0_0_12px_hsl(270_70%_60%/0.15)]" />
          )}
          <motion.div
            className={`relative z-10 flex items-center gap-1.5 ${
              isLeaderboardActive ? "text-primary" : "text-muted-foreground"
            }`}
            whileHover={{ scale: 1.05 }}
            transition={{ duration: 0.15 }}
          >
            <Trophy className="w-4 h-4" />
            <span>Leaderboard</span>
          </motion.div>
          {isLeaderboardActive && (
             <div className="absolute bottom-0 left-1/4 right-1/4 h-0.5 bg-primary rounded-full" />
          )}
        </Link>

      </div>

      <div className="relative shrink-0 ml-4 flex items-center gap-3">
        <span className="text-sm text-foreground font-medium">{username}</span>
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => setDropdownOpen(!dropdownOpen)}
          className="w-9 h-9 rounded-full border border-border bg-card/60 overflow-hidden flex items-center justify-center"
        >
          {avatarUrl ? (
            <img
              src={avatarUrl}
              alt="avatar"
              className="w-full h-full object-cover"
            />
          ) : (
            <User className="w-4 h-4 text-muted-foreground" />
          )}
        </motion.button>
        <ProfileDropdown
          open={dropdownOpen}
          onClose={() => setDropdownOpen(false)}
          username={username}
        />
      </div>
    </nav>
  );
};

export default HomeNavbar;