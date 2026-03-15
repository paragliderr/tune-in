import { motion, AnimatePresence } from "framer-motion";
import { createPortal } from "react-dom";

interface Props {
  open: boolean;
  anchorRect: DOMRect | null;
  member: any;
}

export default function MemberHoverCard({ open, anchorRect, member }: Props) {
  if (!anchorRect || !member) return null;

  const cardWidth = 320;
  const cardHeight = 132;
  const margin = 20;

  const vw = window.innerWidth;
  const vh = window.innerHeight;

  /* ---------- POSITION ---------- */

  let left = anchorRect.left - cardWidth - margin;
  if (left < margin) left = anchorRect.right + margin;
  if (left + cardWidth > vw - margin) left = vw - cardWidth - margin;

  let top = anchorRect.top + anchorRect.height / 2 - cardHeight / 2;
  if (top < margin) top = margin;
  if (top + cardHeight > vh - margin) top = vh - cardHeight - margin;

  return createPortal(
    <div
      style={{
        position: "fixed",
        top,
        left,
        width: cardWidth,
        zIndex: 999999,
        pointerEvents: "none",
      }}
    >
      {/* ⭐ Glass always mounted → blur never flashes */}
      <div
        className="relative rounded-3xl border border-white/10 overflow-hidden shadow-[0_40px_120px_rgba(0,0,0,0.75)]"
        style={{
          background: "rgba(18,18,22,0.58)",
          backdropFilter: "blur(26px)",
          WebkitBackdropFilter: "blur(26px)",
        }}
      >
        <div className="absolute inset-0 bg-gradient-to-br from-white/10 to-white/5" />

        <AnimatePresence>
          {open && (
            <motion.div
              initial={{
                opacity: 0,
                scale: 0.92,
                x: 28,
                y: 6,
              }}
              animate={{
                opacity: 1,
                scale: 1,
                x: 0,
                y: 0,
              }}
              exit={{
                opacity: 0,
                scale: 0.96,
                x: 18,
                y: 4,
              }}
              transition={{
                type: "spring",
                stiffness: 260,
                damping: 24,
                mass: 0.9,
              }}
              className="relative px-6 py-5 flex items-center gap-4"
            >
              <img
                src={member.avatar_url}
                className="w-[72px] h-[72px] rounded-full object-cover border border-white/20 shadow-xl"
              />

              <div className="min-w-0">
                <p className="text-[15px] font-semibold truncate">
                  @{member.username}
                </p>

                <p className="text-sm text-muted-foreground mt-1 leading-relaxed line-clamp-2">
                  {member.bio || "No bio yet"}
                </p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>,
    document.body,
  );
}
