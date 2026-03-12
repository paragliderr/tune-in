import { motion } from "framer-motion";

const FILTERS = [
  "Trending",
  "Top Week",
  "Top Month",
  "Top Year",
  "All Time",
  "New",
];

interface FeedFilterBarProps {
  active: string;
  onChange: (filter: string) => void;
}

const FeedFilterBar = ({ active, onChange }: FeedFilterBarProps) => {
  return (
    <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
      {FILTERS.map((filter) => (
        <button
          key={filter}
          onClick={() => onChange(filter)}
          className="relative px-4 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-colors duration-200"
        >
          {active === filter && (
            <motion.div
              layoutId="filter-pill"
              className="absolute inset-0 rounded-full bg-primary/20 border border-primary/40"
              transition={{ type: "spring", stiffness: 400, damping: 30 }}
            />
          )}
          <span
            className={`relative z-10 ${
              active === filter
                ? "text-primary"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {filter}
          </span>
        </button>
      ))}
    </div>
  );
};

export default FeedFilterBar;
