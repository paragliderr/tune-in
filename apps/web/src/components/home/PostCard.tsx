import { useEffect, useState } from "react";
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
import { supabase } from "@/lib/supabase";
import { trackFeedLike } from "@/lib/api";
import {WordRotate} from "@/components/ui/word-rotate";

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

export default function PostCard({
  id,
  clubName,
  username,
  time,
  title,
  content,
  image,
  commentCount,
  onOpenDetail,
}: any) {
  const Icon = getClubIcon(clubName);

  const [reaction, setReaction] = useState<"like" | "dislike" | null>(null);
  const [likeCount, setLikeCount] = useState(0);
  const [dislikeCount, setDislikeCount] = useState(0);
  const [saved, setSaved] = useState(false);
  const [showComments, setShowComments] = useState(false);

  const [localCommentCount, setLocalCommentCount] = useState(commentCount || 0);

  useEffect(() => {
    setLocalCommentCount(commentCount);
  }, [commentCount]);

  const [layoutReady, setLayoutReady] = useState(false);

  useEffect(() => {
    const raf = requestAnimationFrame(() => setLayoutReady(true));
    return () => cancelAnimationFrame(raf);
  }, []);

  const loadCounts = async () => {
    const { count: likes } = await supabase
      .from("post_reactions")
      .select("*", { count: "exact", head: true })
      .eq("post_id", id)
      .eq("reaction", "like");

    const { count: dislikes } = await supabase
      .from("post_reactions")
      .select("*", { count: "exact", head: true })
      .eq("post_id", id)
      .eq("reaction", "dislike");

    const { count: comments } = await supabase
      .from("comments")
      .select("*", { count: "exact", head: true })
      .eq("post_id", id);

    setLikeCount(likes || 0);
    setDislikeCount(dislikes || 0);
    if (comments !== null) setLocalCommentCount(comments);

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) return;

    const { data } = await supabase
      .from("post_reactions")
      .select("reaction")
      .eq("post_id", id)
      .eq("user_id", user.id)
      .maybeSingle();

    setReaction(data?.reaction || null);
  };

  useEffect(() => {
    loadCounts();
    const handler = () => loadCounts();
    window.addEventListener("reactionUpdated", handler);
    window.addEventListener("commentUpdated", handler);
    return () => {
      window.removeEventListener("reactionUpdated", handler);
      window.removeEventListener("commentUpdated", handler);
    };
  }, [id]);

  const react = async (type: "like" | "dislike") => {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) return;

    // Optimistic update
    const prevReaction = reaction;
    const prevLikes = likeCount;
    const prevDislikes = dislikeCount;

    if (reaction === type) {
      // Toggling off
      setReaction(null);
      if (type === "like") setLikeCount((c) => Math.max(0, c - 1));
      else setDislikeCount((c) => Math.max(0, c - 1));
    } else {
      // Switching or setting new
      if (reaction === "like") setLikeCount((c) => Math.max(0, c - 1));
      if (reaction === "dislike") setDislikeCount((c) => Math.max(0, c - 1));
      setReaction(type);
      if (type === "like") setLikeCount((c) => c + 1);
      else setDislikeCount((c) => c + 1);
    }

    try {
      if (prevReaction === type) {
        await supabase
          .from("post_reactions")
          .delete()
          .eq("post_id", id)
          .eq("user_id", user.id);
      } else {
        await supabase.from("post_reactions").upsert(
          {
            post_id: id,
            user_id: user.id,
            reaction: type,
          },
          { onConflict: "post_id,user_id" },
        );
        if (
          type === "like" &&
          typeof id === "string" &&
          !id.startsWith("optimistic-")
        ) {
          void trackFeedLike(user.id, id);
        }
      }

      // Re-sync with server to ensure consistency
      await loadCounts();
    } catch {
      // Rollback on error
      setReaction(prevReaction);
      setLikeCount(prevLikes);
      setDislikeCount(prevDislikes);
    }
  };

  return (
    <motion.div
      layoutId={layoutReady ? `post-card-${id}` : undefined}
      layout="position"
      initial={{ opacity: 0, y: 30 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ scale: 1.02 }}
      transition={{ type: "spring", stiffness: 260, damping: 22 }}
      className="w-full text-left rounded-2xl border border-border bg-card/60 backdrop-blur-xl p-5 cursor-pointer"
      onClick={(e) => {
        if ((e.target as HTMLElement).closest("button")) return;
        onOpenDetail?.();
      }}
    >
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
        <motion.div
          layoutId={`post-image-${id}`}
          className="relative w-full mb-3 rounded-xl overflow-hidden border border-border bg-black"
        >
          {/* blurred fill */}
          <img
            src={image}
            className="absolute inset-0 w-full h-full object-cover blur-sm scale-105 opacity-15"
          />

          {/* real image */}
          <img
            src={image}
            className="relative w-full max-h-[520px] object-contain"
          />
        </motion.div>
      )}

      <div className="flex items-center gap-1">
        <motion.button
          whileTap={{ scale: 1.3 }}
          animate={
            reaction === "like"
              ? { scale: [1, 1.3, 1], boxShadow: "0 0 20px #22c55e" }
              : { scale: 1, boxShadow: "0 0 0px transparent" }
          }
          transition={{ duration: 0.15 }}
          onClick={() => react("like")}
          className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm ${
            reaction === "like"
              ? "bg-green-500/20 text-green-400"
              : "text-muted-foreground hover:bg-muted/50"
          }`}
        >
          <ThumbsUp size={16} />
          <WordRotate words={[String(likeCount)]} />
        </motion.button>

        <motion.button
          whileTap={{ scale: 1.3 }}
          animate={
            reaction === "dislike"
              ? { x: [0, -3, 3, -2, 2, 0], boxShadow: "0 0 20px #ef4444" }
              : {}
          }
          transition={{ duration: 0.15 }}
          onClick={() => react("dislike")}
          className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm ${
            reaction === "dislike"
              ? "bg-red-500/20 text-red-400"
              : "text-muted-foreground hover:bg-muted/50"
          }`}
        >
          <ThumbsDown size={16} />
          <WordRotate words={[String(dislikeCount)]} />
        </motion.button>

        <button
          onClick={(e) => {
            e.stopPropagation();
            onOpenDetail?.();
          }}
          className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm text-muted-foreground hover:bg-muted/50"
        >
          <MessageSquare size={16} />
          {localCommentCount}
        </button>

        <button onClick={() => setSaved(!saved)} className="ml-auto px-3">
          <Bookmark
            size={16}
            className={saved ? "fill-primary text-primary" : ""}
          />
        </button>
      </div>

      
    </motion.div>
  );
}
