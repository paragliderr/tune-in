import { motion, AnimatePresence } from "framer-motion";
import { User, Settings, Bookmark, LogOut } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabase";

interface ProfileDropdownProps {
  open: boolean;
  onClose: () => void;
  username?: string;
}

const ProfileDropdown = ({ open, onClose, username }: ProfileDropdownProps) => {
  const navigate = useNavigate();

  const items = [
    { label: "Profile", icon: User, action: username ? `/user/${username}` : "/profile" },
    // { label: "Account Settings", icon: Settings, action: "/settings" },
    { label: "Saved", icon: Bookmark, action: "/saved" },
    { label: "Logout", icon: LogOut, action: "logout" },
  ];

  const handleClick = async (action: string) => {
    onClose();

    if (action === "logout") {
      await supabase.auth.signOut();

      // ⭐ VERY IMPORTANT — clear stuck session
      localStorage.clear();
      sessionStorage.clear();

      navigate("/login", { replace: true });

      // ⭐ force full refresh (fixes redirect loop)
      window.location.href = "/login";
    } else {
      navigate(action);
    }
  };

  return (
    <AnimatePresence>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={onClose} />
          <motion.div
            initial={{ opacity: 0, y: -10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.95 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            className="absolute right-0 top-full mt-2 z-50 w-56 rounded-2xl border border-border/40 bg-black/90 backdrop-blur-2xl shadow-[0_8px_30px_hsl(0_0%_0%/0.6)] overflow-hidden"
          >
            {items.map((item) => {
              const Icon = item.icon;
              return (
                <button
                  key={item.label}
                  onClick={() => handleClick(item.action)}
                  className="flex w-full items-center gap-3 px-4 py-3 text-sm text-foreground transition-all duration-200 hover:bg-primary/10 hover:text-primary"
                >
                  <Icon className="w-4 h-4" />
                  {item.label}
                </button>
              );
            })}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};

export default ProfileDropdown;
