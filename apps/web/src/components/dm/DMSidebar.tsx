import { motion, AnimatePresence } from "framer-motion";
import { Search } from "lucide-react";
import type { Conversation } from "./DMPage";

interface DMSidebarProps {
  people: Conversation[];
  selectedId: string | null;
  onSelect: (c: Conversation) => void;
  searchQuery: string;
  onSearchChange: (q: string) => void;
}

const ConvoItem = ({
  convo,
  isSelected,
  onSelect,
  index,
}: {
  convo: Conversation;
  isSelected: boolean;
  onSelect: () => void;
  index: number;
}) => (
  <motion.button
    layout
    initial={false}
    animate={{ opacity: 1, x: 0 }}
    transition={{ duration: 0.15 }}
    whileTap={{ scale: 0.97 }}
    whileHover={{ scale: 1.01 }}
    onClick={onSelect}
    className={`w-full flex items-center gap-3 px-3 py-3 rounded-r-xl transition-all duration-200 group relative ${
      isSelected
        ? "bg-muted/30"
        : "hover:bg-card/80 border border-transparent"
    }`}
  >
    {isSelected && (
      <motion.div
        layoutId="dm-selected-indicator"
        className="absolute left-0 top-1/4 bottom-1/4 w-1 bg-primary rounded-r-full"
      />
    )}

    <div className="relative shrink-0 z-10">
      <div className="w-10 h-10 rounded-full flex items-center justify-center text-xs font-semibold overflow-hidden bg-card border border-border">
        {convo.avatar}
      </div>

      <AnimatePresence>
        {convo.online && (
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            exit={{ scale: 0 }}
            className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-emerald-500 border-2 border-background"
          />
        )}
      </AnimatePresence>
    </div>

    <div className="flex-1 min-w-0 text-left z-10">
      <div className="flex items-center justify-between">
        <span className={`text-sm font-medium truncate ${
          isSelected ? "text-primary" : "text-foreground"
        }`}>
          {convo.name}
        </span>
        <span className="text-[10px] text-muted-foreground ml-2">
          {convo.time}
        </span>
      </div>

      <p className="text-xs text-muted-foreground truncate mt-0.5">
        {convo.lastMessage}
      </p>
    </div>

    {convo.unread > 0 && (
      <motion.div 
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        className="min-w-[18px] h-4.5 px-1.5 py-0.5 rounded-full bg-red-500 flex items-center justify-center shadow-lg shadow-red-500/20"
      >
        <span className="text-[10px] font-bold text-white leading-none">
          {convo.unread}
        </span>
      </motion.div>
    )}
  </motion.button>
);

const DMSidebar = ({
  people,
  selectedId,
  onSelect,
  searchQuery,
  onSearchChange,
}: DMSidebarProps) => {
  const filteredPeople = people
    .filter((p) =>
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.lastMessage.toLowerCase().includes(searchQuery.toLowerCase())
    )
    .sort((a, b) => {
      const timeA = a.lastMessageAt ? new Date(a.lastMessageAt).getTime() : 0;
      const timeB = b.lastMessageAt ? new Date(b.lastMessageAt).getTime() : 0;
      return timeB - timeA;
    });

  return (
    <motion.aside 
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.25, ease: "easeOut" }}
      className="w-80 border-r border-border flex flex-col bg-background h-full"
    >
      
      {/* Header */}
      <div className="p-4 flex flex-col gap-4 shrink-0">
        <h2 className="text-xl font-bold">Messages</h2>

        <div className="relative flex items-center">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="absolute left-3"
          >
            <Search className="w-4 h-4 text-white/90" />
          </motion.div>
          <input
            type="text"
            placeholder="Search people..."
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className="w-full pl-10 pr-8 py-2.5 bg-muted/40 border border-border/50 rounded-xl text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 transition-all backdrop-blur-md"
          />
          {searchQuery && (
            <button
              onClick={() => onSearchChange("")}
              className="absolute right-3 text-muted-foreground hover:text-foreground transition-colors"
            >
              ✕
            </button>
          )}
        </div>
      </div>

      {/* List */}
<div className="flex-1 overflow-y-auto scrollbar-hide">
  {filteredPeople.length > 0 ? (
    <motion.div layout className="py-2">
      {filteredPeople.map((c, i) => (
        <ConvoItem
          key={c.id}
          convo={c}
          isSelected={selectedId === c.id}
          onSelect={() => onSelect(c)}
          index={i}
        />
      ))}
    </motion.div>
  ) : (
    <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
      <div className="w-12 h-12 rounded-full bg-muted/20 flex items-center justify-center mb-4">
        <Search className="w-6 h-6 text-muted-foreground/40" />
      </div>
      <p className="text-sm font-medium text-foreground">
        No conversations yet
      </p>
      <p className="text-xs text-muted-foreground mt-1">
        {searchQuery
          ? "No results found for your search."
          : "Click on a profile to message someone and start chatting."}
      </p>
    </div>
  )}
</div>
    </motion.aside>
  );
};

export default DMSidebar;