import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { User } from "lucide-react";
import ProfileDropdown from "./ProfileDropdown";
import { supabase } from "@/lib/supabase";

const TABS = ["Clubs", "Cinema", "Games", "Following", "Messages"] as const;
export type HomeTab = (typeof TABS)[number];

interface HomeNavbarProps {
  activeTab: HomeTab;
  onTabChange: (tab: HomeTab) => void;
}

const HomeNavbar = ({ activeTab, onTabChange }: HomeNavbarProps) => {
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [username, setUsername] = useState("");

  useEffect(() => {
    const load = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) return;

      const { data } = await supabase
        .from("profiles")
        .select("username")
        .eq("id", user.id)
        .single();

      if (data?.username) setUsername(data.username);
    };

    load();
  }, []);

  return (
    <nav className="sticky top-0 z-50 flex items-center justify-between px-4 md:px-8 py-3 border-b border-border bg-background/80 backdrop-blur-xl">
      <div className="flex items-center gap-1 overflow-x-auto scrollbar-none">
        {TABS.map((tab) => (
          <button
            key={tab}
            onClick={() => onTabChange(tab)}
            className="relative px-4 py-2 text-sm font-medium whitespace-nowrap transition-colors duration-200"
          >
            {activeTab === tab && (
              <motion.div
                layoutId="tab-bg"
                className="absolute inset-0 rounded-xl bg-primary/10 border border-primary/30 shadow-[0_0_12px_hsl(270_70%_60%/0.15)]"
                transition={{ type: "spring", stiffness: 400, damping: 30 }}
              />
            )}
            <motion.span
              className={`relative z-10 ${
                activeTab === tab ? "text-primary" : "text-muted-foreground"
              }`}
              whileHover={{ scale: 1.05 }}
              transition={{ duration: 0.15 }}
            >
              {tab}
            </motion.span>
            {activeTab === tab && (
              <motion.div
                layoutId="tab-underline"
                className="absolute bottom-0 left-1/4 right-1/4 h-0.5 bg-primary rounded-full"
                transition={{ type: "spring", stiffness: 400, damping: 30 }}
              />
            )}
          </button>
        ))}
      </div>

      <div className="relative shrink-0 ml-4 flex items-center gap-3">
        <span className="text-sm text-foreground font-medium">{username}</span>
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => setDropdownOpen(!dropdownOpen)}
          className="w-9 h-9 rounded-full border border-border bg-card/60 flex items-center justify-center text-muted-foreground hover:border-primary/50 hover:text-foreground transition-colors"
        >
          <User className="w-4 h-4" />
        </motion.button>
        <ProfileDropdown
          open={dropdownOpen}
          onClose={() => setDropdownOpen(false)}
        />
      </div>
    </nav>
  );
};

export default HomeNavbar;
