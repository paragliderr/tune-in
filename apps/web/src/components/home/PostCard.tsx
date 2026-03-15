import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ThumbsUp,
  ThumbsDown,
  MessageSquare,
  Bookmark,
  Cpu,
  Music,
  Film,
  Gamepad2,
  Sparkles,
  Dumbbell,
} from "lucide-react";
import CommentThread from "./CommentThread";

const getClubIcon = (club: string) => {
  switch (club.toLowerCase()) {
    case "tech":
      return Cpu;
    case "music":
      return Music;
    case "cinema":
      return Film;
    case "gaming":
      return Gamepad2;
    case "anime":
      return Sparkles;
    case "fitness":
      return Dumbbell;
    default:
      return Cpu;
  }
};

interface Props {
  id: string;
  clubName: string;
  clubColor: string;
  username: string;
  time: string;
  title: string;
  content: string;
  image?: string | null;
  likes: number;
  dislikes: number;
  commentCount: number;
  onOpenDetail?: () => void;
}

export default function PostCard({
  id,
  clubName,
  username,
  time,
  title,
  content,
  image,
  likes,
  dislikes,
  commentCount,
  onOpenDetail,
}: Props) {
  const Icon = getClubIcon(clubName);

  const [reaction, setReaction] = useState<"like" | "dislike" | null>(null);
  const [saved, setSaved] = useState(false);
  const [showComments, setShowComments] = useState(false);

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 30 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ scale: 1.015 }}
      className="max-w-2xl mx-auto rounded-2xl border border-border bg-card/60 backdrop-blur-xl p-5 cursor-pointer transition"
      onClick={(e) => {
        if ((e.target as HTMLElement).closest("button")) return;
        onOpenDetail?.();
      }}
    >
      {/* header */}
      <div className="flex items-center gap-3 mb-3">
        <div className="w-9 h-9 rounded-xl bg-muted flex items-center justify-center">
          <Icon size={18} />
        </div>

        <div>
          <p className="text-xs font-semibold">{clubName}</p>
          <p className="text-xs text-muted-foreground">
            @{username} · {time}
          </p>
        </div>
      </div>

      <h3 className="font-semibold mb-2">{title}</h3>

      {content && (
        <p className="text-sm text-foreground/70 mb-3 leading-relaxed">
          {content}
        </p>
      )}

      {image && (
        <img
          src={image}
          className="w-full rounded-xl mb-3 max-h-[420px] object-cover border border-border"
        />
      )}

      {/* actions */}
      <div className="flex items-center gap-1">
        <motion.button
          whileTap={{ scale: 1.2 }}
          onClick={() => setReaction(reaction === "like" ? null : "like")}
          className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm ${
            reaction === "like"
              ? "bg-primary/15 text-primary"
              : "text-muted-foreground hover:bg-muted/50"
          }`}
        >
          <ThumbsUp size={16} />
          {likes + (reaction === "like" ? 1 : 0)}
        </motion.button>

        <motion.button
          whileTap={{ scale: 1.2 }}
          onClick={() => setReaction(reaction === "dislike" ? null : "dislike")}
          className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm ${
            reaction === "dislike"
              ? "bg-destructive/15 text-destructive"
              : "text-muted-foreground hover:bg-muted/50"
          }`}
        >
          <ThumbsDown size={16} />
          {dislikes + (reaction === "dislike" ? 1 : 0)}
        </motion.button>

        <button
          onClick={() => setShowComments(!showComments)}
          className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm text-muted-foreground hover:bg-muted/50"
        >
          <MessageSquare size={16} />
          {commentCount}
        </button>

        <button onClick={() => setSaved(!saved)} className="ml-auto px-3">
          <Bookmark
            size={16}
            className={saved ? "fill-primary text-primary" : ""}
          />
        </button>
      </div>

      <AnimatePresence>
        {showComments && <CommentThread postId={id} />}
      </AnimatePresence>
    </motion.div>
  );
}
