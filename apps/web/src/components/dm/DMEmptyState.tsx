import { motion } from "framer-motion";
import { MessageSquare } from "lucide-react";

const DMEmptyState = () => (
  <motion.div
    initial={{ opacity: 0, scale: 0.95 }}
    animate={{ opacity: 1, scale: 1 }}
    exit={{ opacity: 0, scale: 0.95 }}
    className="flex-1 flex flex-col items-center justify-center gap-4 text-center p-8"
  >
    {/* Animated icon */}
    <motion.div
      animate={{
        y: [0, -8, 0],
        rotate: [0, 5, -5, 0],
      }}
      transition={{ repeat: Infinity, duration: 4, ease: "easeInOut" }}
      className="relative"
    >
      <div className="w-20 h-20 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center shadow-[0_0_40px_hsl(270_70%_60%/0.15)]">
        <MessageSquare className="w-9 h-9 text-primary" />
      </div>
      {/* Orbiting dots */}
      {[0, 1, 2].map((i) => (
        <motion.div
          key={i}
          animate={{ rotate: 360 }}
          transition={{ repeat: Infinity, duration: 6 + i * 2, ease: "linear" }}
          className="absolute inset-0"
          style={{ transformOrigin: "center" }}
        >
          <div
            className="absolute w-2 h-2 rounded-full bg-primary/40"
            style={{
              top: i === 0 ? -4 : i === 1 ? "50%" : "auto",
              bottom: i === 2 ? -4 : "auto",
              left: i === 1 ? -4 : "50%",
              transform: i !== 1 ? "translateX(-50%)" : "translateY(-50%)",
            }}
          />
        </motion.div>
      ))}
    </motion.div>

    <div>
      <motion.h3
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="text-lg font-semibold text-foreground mb-1"
      >
        Your Messages
      </motion.h3>
      <motion.p
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="text-sm text-muted-foreground max-w-xs"
      >
        Select a conversation to start chatting. Your messages are private and secure.
      </motion.p>
    </div>

    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ delay: 0.5 }}
      className="flex gap-1 mt-2"
    >
      {[0, 1, 2].map((i) => (
        <motion.div
          key={i}
          animate={{ opacity: [0.3, 1, 0.3] }}
          transition={{ repeat: Infinity, duration: 1.5, delay: i * 0.3 }}
          className="w-1.5 h-1.5 rounded-full bg-primary/50"
        />
      ))}
    </motion.div>
  </motion.div>
);

export default DMEmptyState;
