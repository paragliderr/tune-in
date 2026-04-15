import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { User, Users, Film, Gamepad2, MessageCircle, Sparkles, Trophy } from "lucide-react";
import ProfileDropdown from "./ProfileDropdown";
import { supabase } from "@/lib/supabase";
import { Link, useLocation } from "react-router-dom";

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
  const [username, setUsername] = useState("");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  
  const location = useLocation();

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase.from("profiles").select("username, avatar_url").eq("id", user.id).single();
      if (data) { setUsername(data.username); setAvatarUrl(data.avatar_url); }
    };
    load();
  }, []);

  // Tracking which special tab is active
  const isTuneInActive = location.pathname === "/tune-in";
  const isLeaderboardActive = location.pathname === "/leaderboard";
  const isSpecialTabActive = isTuneInActive || isLeaderboardActive;

  return (
    <nav className="sticky top-0 z-50 flex items-center justify-between px-4 md:px-8 py-3 border-b border-border bg-background/80 backdrop-blur-xl">
      <div className="flex items-center gap-1 overflow-x-auto scrollbar-none">
        {/* Standard Tabs (Clubs, Cinema, etc.) */}
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => onTabChange(tab.id as HomeTab)}
            className="flex items-center gap-2 relative px-4 py-2 text-sm font-medium whitespace-nowrap transition-colors duration-200"
          >
            {activeTab === tab.id && !isSpecialTabActive && (
              <motion.div layoutId="tab-bg" className="absolute inset-0 rounded-xl bg-primary/10 border border-primary/30 shadow-[0_0_12px_hsl(270_70%_60%/0.15)]" />
            )}
            <motion.div className={`relative z-10 flex items-center gap-1.5 ${activeTab === tab.id && !isSpecialTabActive ? "text-primary" : "text-muted-foreground"}`} whileHover={{ scale: 1.05 }}>
              <tab.icon className="w-4 h-4" />
              <span>{tab.name}</span>
            </motion.div>
          </button>
        ))}

        {/* ── LEADERBOARD TAB ── */}
        <Link to="/leaderboard" className="flex items-center gap-2 relative px-4 py-2 text-sm font-medium whitespace-nowrap transition-colors duration-200">
          {isLeaderboardActive && (
            <motion.div layoutId="tab-bg" className="absolute inset-0 rounded-xl bg-primary/10 border border-primary/30 shadow-[0_0_12px_hsl(270_70%_60%/0.15)]" />
          )}
          <motion.div className={`relative z-10 flex items-center gap-1.5 ${isLeaderboardActive ? "text-primary" : "text-muted-foreground"}`} whileHover={{ scale: 1.05 }}>
            <Trophy className="w-4 h-4" />
            <span>Leaderboard</span>
          </motion.div>
        </Link>

        {/* ── TUNE-IN AI TAB ── */}
        <Link to="/tune-in" className="flex items-center gap-2 relative px-4 py-2 text-sm font-medium whitespace-nowrap transition-colors duration-200">
          {isTuneInActive && (
            <motion.div layoutId="tab-bg" className="absolute inset-0 rounded-xl bg-primary/10 border border-primary/30 shadow-[0_0_12px_hsl(270_70%_60%/0.15)]" />
          )}
          <motion.div className={`relative z-10 flex items-center gap-1.5 ${isTuneInActive ? "text-primary" : "text-muted-foreground"}`} whileHover={{ scale: 1.05 }}>
            <Sparkles className="w-4 h-4" />
            <span className="font-bold tracking-wide">Tune-In</span>
          </motion.div>
        </Link>
      </div>

      <div className="relative shrink-0 ml-4 flex items-center gap-3">
        <span className="text-sm text-foreground font-medium">{username}</span>
        <motion.button onClick={() => setDropdownOpen(!dropdownOpen)} className="w-9 h-9 rounded-full border border-border bg-card/60 overflow-hidden flex items-center justify-center hover:ring-2 hover:ring-primary/40 transition-all">
          {avatarUrl ? <img src={avatarUrl} alt="avatar" className="w-full h-full object-cover" /> : <User className="w-4 h-4 text-muted-foreground" />}
        </motion.button>
        <ProfileDropdown open={dropdownOpen} onClose={() => setDropdownOpen(false)} username={username} />
      </div>
    </nav>
  );
};

export default HomeNavbar;