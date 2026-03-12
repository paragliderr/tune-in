import { useState } from "react";
import { Search } from "lucide-react";
import { motion } from "framer-motion";

const SearchBar = () => {
  const [focused, setFocused] = useState(false);

  return (
    <motion.div
      className={`relative flex items-center rounded-xl border bg-card/60 backdrop-blur-md transition-all duration-300 ${
        focused
          ? "border-primary shadow-[0_0_15px_hsl(270_70%_60%/0.2)]"
          : "border-border"
      }`}
    >
      <Search className="absolute left-3 w-4 h-4 text-muted-foreground" />
      <input
        type="text"
        placeholder="Search posts or clubs..."
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        className="w-full bg-transparent py-2.5 pl-10 pr-4 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none"
      />
    </motion.div>
  );
};

export default SearchBar;
