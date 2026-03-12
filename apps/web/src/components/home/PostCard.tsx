import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ThumbsUp, ThumbsDown, MessageSquare, Bookmark } from "lucide-react";
import CommentThread from "./CommentThread";

interface PostCardProps {
  id: string;
  clubName: string;
  clubColor: string;
  username: string;
  time: string;
  title: string;
  content: string;
  likes: number;
  dislikes: number;
  commentCount: number;
  hasImage?: boolean;
  onOpenDetail?: () => void;
}

const PostCard = ({
  id,
  clubName,
  clubColor,
  username,
  time,
  title,
  content,
  likes,
  dislikes,
  commentCount,
  hasImage,
  onOpenDetail,
}: PostCardProps) => {
  const [reaction, setReaction] = useState<"like" | "dislike" | null>(null);
  const [saved, setSaved] = useState(false);
  const [showComments, setShowComments] = useState(false);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ scale: 1.01 }}
      transition={{ duration: 0.3 }}
      className="rounded-2xl border border-border bg-card/50 backdrop-blur-md p-5 transition-shadow duration-300 hover:shadow-[0_0_20px_hsl(270_70%_60%/0.08)] cursor-pointer"
      onClick={(e) => {
        // Don't open detail if clicking interactive elements
        const target = e.target as HTMLElement;
        if (target.closest("button")) return;
        onOpenDetail?.();
      }}
    >
      {/* Header */}
      <div className="flex items-center gap-3 mb-3">
        <div
          className={`w-8 h-8 rounded-lg bg-gradient-to-br ${clubColor} flex items-center justify-center text-xs font-bold text-primary-foreground shrink-0`}
        >
          {clubName.charAt(0)}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold text-foreground">{clubName}</p>
          <p className="text-xs text-muted-foreground">
            @{username} · {time}
          </p>
        </div>
      </div>

      {/* Content */}
      <h3 className="text-base font-semibold text-foreground mb-2">{title}</h3>
      <p className="text-sm text-foreground/70 mb-3 leading-relaxed">
        {content}
      </p>

      {hasImage && (
        <div className="w-full aspect-video rounded-xl bg-gradient-to-br from-primary/10 to-accent/20 border border-border/30 mb-3 flex items-center justify-center">
          <span className="text-muted-foreground text-xs">
            Image placeholder
          </span>
        </div>
      )}

      {/* Interactions */}
      <div className="flex items-center gap-1">
        <motion.button
          whileTap={{ scale: 1.3 }}
          onClick={() => setReaction(reaction === "like" ? null : "like")}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm transition-colors ${
            reaction === "like"
              ? "bg-primary/15 text-primary"
              : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
          }`}
        >
          <ThumbsUp className="w-4 h-4" />
          <span className="text-xs font-medium">
            {likes + (reaction === "like" ? 1 : 0)}
          </span>
        </motion.button>

        <motion.button
          whileTap={{ scale: 1.3 }}
          onClick={() => setReaction(reaction === "dislike" ? null : "dislike")}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm transition-colors ${
            reaction === "dislike"
              ? "bg-destructive/15 text-destructive"
              : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
          }`}
        >
          <ThumbsDown className="w-4 h-4" />
          <span className="text-xs font-medium">
            {dislikes + (reaction === "dislike" ? 1 : 0)}
          </span>
        </motion.button>

        <button
          onClick={() => setShowComments(!showComments)}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm transition-colors ${
            showComments
              ? "bg-primary/10 text-primary"
              : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
          }`}
        >
          <MessageSquare className="w-4 h-4" />
          <span className="text-xs font-medium">{commentCount}</span>
        </button>

        <motion.button
          whileTap={{ scale: 1.3 }}
          onClick={() => setSaved(!saved)}
          className={`ml-auto px-3 py-1.5 rounded-lg transition-colors ${
            saved
              ? "text-primary"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <Bookmark className={`w-4 h-4 ${saved ? "fill-primary" : ""}`} />
        </motion.button>
      </div>

      {/* Comments */}
      <AnimatePresence>
        {showComments && <CommentThread postId={id} />}
      </AnimatePresence>
    </motion.div>
  );
};

export default PostCard;
