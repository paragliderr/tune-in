import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Users, Plus, Check } from "lucide-react";
import SearchBar from "./SearchBar";

interface Club {
  id: string;
  name: string;
  members: number;
  color: string;
}

const JOINED_CLUBS: Club[] = [
  {
    id: "1",
    name: "Indie Films",
    members: 2340,
    color: "from-purple-600 to-indigo-700",
  },
  {
    id: "2",
    name: "Lo-Fi Beats",
    members: 5120,
    color: "from-pink-600 to-purple-700",
  },
  {
    id: "3",
    name: "Retro Gaming",
    members: 8900,
    color: "from-violet-600 to-blue-700",
  },
  {
    id: "4",
    name: "Anime Hub",
    members: 12400,
    color: "from-indigo-600 to-purple-700",
  },
];

const SUGGESTED_CLUBS: Club[] = [
  {
    id: "s1",
    name: "Tech Talks",
    members: 3200,
    color: "from-blue-600 to-violet-700",
  },
  {
    id: "s2",
    name: "Photography",
    members: 4500,
    color: "from-purple-500 to-pink-600",
  },
  {
    id: "s3",
    name: "Book Club",
    members: 1800,
    color: "from-emerald-600 to-teal-700",
  },
  {
    id: "s4",
    name: "Street Art",
    members: 2100,
    color: "from-orange-500 to-red-600",
  },
];

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
}: {
  club: Club;
  isActive: boolean;
  onClick: () => void;
  index: number;
  isSuggested?: boolean;
  onJoin?: () => void;
}) => (
  <motion.button
    initial={{ opacity: 0, y: 8 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ delay: index * 0.04, duration: 0.25, ease: "easeOut" }}
    whileHover={{ scale: 1.015 }}
    whileTap={{ scale: 0.98 }}
    onClick={onClick}
    className={`w-full flex items-center gap-3 p-2.5 rounded-xl border transition-all duration-300 ${
      isActive
        ? "border-primary bg-primary/10 shadow-[0_0_15px_hsl(270_70%_60%/0.15)]"
        : "border-transparent bg-card/30 hover:border-primary/20 hover:bg-card/50"
    }`}
  >
    <div
      className={`w-9 h-9 rounded-lg bg-gradient-to-br ${club.color} flex items-center justify-center text-xs font-bold text-primary-foreground shrink-0`}
    >
      {club.name.charAt(0)}
    </div>
    <div className="flex-1 text-left min-w-0">
      <p className="text-sm font-medium text-foreground truncate">
        {club.name}
      </p>
      <p className="text-xs text-muted-foreground flex items-center gap-1">
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
  const [joinedClubs, setJoinedClubs] = useState(JOINED_CLUBS);
  const [suggestedClubs, setSuggestedClubs] = useState(SUGGESTED_CLUBS);
  const [recentlyJoined, setRecentlyJoined] = useState<Set<string>>(new Set());

  const handleJoin = (club: Club) => {
    setRecentlyJoined((prev) => new Set(prev).add(club.id));
    setTimeout(() => {
      setJoinedClubs((prev) => [...prev, club]);
      setSuggestedClubs((prev) => prev.filter((c) => c.id !== club.id));
      setRecentlyJoined((prev) => {
        const next = new Set(prev);
        next.delete(club.id);
        return next;
      });
    }, 600);
  };

  return (
    <div className="flex flex-col gap-3 h-full">
      <SearchBar />

      {/* Joined Clubs */}
      <p className="text-[10px] text-muted-foreground uppercase tracking-widest font-semibold px-1 mt-1">
        Your Clubs
      </p>
      <div className="space-y-1.5">
        <AnimatePresence>
          {joinedClubs.map((club, i) => (
            <ClubItem
              key={club.id}
              club={club}
              isActive={activeClub === club.id}
              onClick={() => onSelectClub(club.id)}
              index={i}
            />
          ))}
        </AnimatePresence>
      </div>

      {/* Divider */}
      <div className="h-px bg-border/50 mx-1" />

      {/* Suggested Clubs */}
      <p className="text-[10px] text-muted-foreground uppercase tracking-widest font-semibold px-1">
        Discover Clubs
      </p>
      <div className="flex-1 overflow-y-auto space-y-1.5 pr-1 scrollbar-thin">
        <AnimatePresence>
          {suggestedClubs.map((club, i) => (
            <motion.div
              key={club.id}
              exit={{ opacity: 0, height: 0, marginBottom: 0 }}
              transition={{ duration: 0.3 }}
            >
              {recentlyJoined.has(club.id) ? (
                <motion.div
                  initial={{ scale: 1 }}
                  animate={{ scale: [1, 1.05, 1] }}
                  className="w-full flex items-center gap-3 p-2.5 rounded-xl border border-primary/40 bg-primary/10"
                >
                  <div
                    className={`w-9 h-9 rounded-lg bg-gradient-to-br ${club.color} flex items-center justify-center text-xs font-bold text-primary-foreground shrink-0`}
                  >
                    {club.name.charAt(0)}
                  </div>
                  <p className="text-sm font-medium text-primary flex-1 text-left">
                    Joined!
                  </p>
                  <Check className="w-4 h-4 text-primary" />
                </motion.div>
              ) : (
                <ClubItem
                  club={club}
                  isActive={false}
                  onClick={() => onSelectClub(club.id)}
                  index={i}
                  isSuggested
                  onJoin={() => handleJoin(club)}
                />
              )}
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
};

export default SidebarClubList;
