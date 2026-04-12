import { useEffect, useState } from "react";
import { Share2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { toast } from "@/components/ui/use-toast";
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
  Trash2,
  Loader2,
  XCircle,
} from "lucide-react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import CommentThread from "./CommentThread";
import { motion } from "framer-motion";
import { supabase } from "@/lib/supabase";
import { trackFeedLike } from "@/lib/api";
import {WordRotate} from "@/components/ui/word-rotate";

const getClubIcon = (club: string) => {
  switch (club?.toLowerCase()) {
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

export default function PostDetailDialog({ open, onOpenChange, post }: any) {
  const [reaction, setReaction] = useState<"like" | "dislike" | null>(null);
  const [likeCount, setLikeCount] = useState(0);
  const [dislikeCount, setDislikeCount] = useState(0);
  const [saved, setSaved] = useState(false);
  const [currentUser, setCurrentUser] = useState<any>(null);

  const [showConfirmDelete, setShowConfirmDelete] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const navigate = useNavigate();

  const share = async () => {
    await navigator.clipboard.writeText(window.location.href);
    toast({
      title: "Link copied",
      description: "Post link copied to clipboard",
    });
  };

  const [layoutReady, setLayoutReady] = useState(false);

  useEffect(() => {
    if (open) {
      const raf = requestAnimationFrame(() => setLayoutReady(true));
      return () => cancelAnimationFrame(raf);
    } else {
      setLayoutReady(false);
    }
  }, [open]);

  const [localCommentCount, setLocalCommentCount] = useState(post?.commentCount || 0);

  useEffect(() => {
    if (post) setLocalCommentCount(post.commentCount);
  }, [post]);

  const loadCounts = async () => {
    if (!post) return;

    const { data: reactions } = await supabase
      .from("post_reactions")
      .select("reaction")
      .eq("post_id", post.id);

    if (reactions) {
      setLikeCount(reactions.filter((r) => r.reaction === "like").length);
      setDislikeCount(reactions.filter((r) => r.reaction === "dislike").length);
    }

    const { count: comments } = await supabase
      .from("comments")
      .select("*", { count: "exact", head: true })
      .eq("post_id", post.id);

    if (comments !== null) setLocalCommentCount(comments);

    const {
      data: { user },
    } = await supabase.auth.getUser();

    setCurrentUser(user);

    if (!user) return;

    const { data } = await supabase
      .from("post_reactions")
      .select("reaction")
      .eq("post_id", post.id)
      .eq("user_id", user.id)
      .maybeSingle();

    setReaction(data?.reaction || null);
  };

  useEffect(() => {
    if (open && post) {
      loadCounts();
      const handler = () => loadCounts();
      window.addEventListener("reactionUpdated", handler);
      window.addEventListener("commentUpdated", handler);
      return () => {
        window.removeEventListener("reactionUpdated", handler);
        window.removeEventListener("commentUpdated", handler);
      };
    }
  }, [open, post]);

  const handleDeletePost = async () => {
    if (!post) return;
    try {
      const { error } = await supabase.from("posts").delete().eq("id", post.id);
      if (error) throw error;
      toast({
        title: "Deleted",
        description: "Post deleted successfully",
      });
      window.dispatchEvent(new CustomEvent("postDeleted", { detail: { id: post.id } }));
      onOpenChange(false);
    } catch {
      toast({
        title: "Error",
        description: "Failed to delete post",
        variant: "destructive"
      });
    } finally {
      setIsDeleting(false);
      setShowConfirmDelete(false);
    }
  };

  const react = async (type: "like" | "dislike") => {
    if (!post) return;

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) return;

    // Optimistic update
    const prevReaction = reaction;
    const prevLikes = likeCount;
    const prevDislikes = dislikeCount;

    if (reaction === type) {
      setReaction(null);
      if (type === "like") setLikeCount((c) => Math.max(0, c - 1));
      else setDislikeCount((c) => Math.max(0, c - 1));
    } else {
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
          .eq("post_id", post.id)
          .eq("user_id", user.id);
      } else {
        await supabase.from("post_reactions").upsert(
          {
            post_id: post.id,
            user_id: user.id,
            reaction: type,
          },
          { onConflict: "post_id,user_id" },
        );
        if (
          type === "like" &&
          typeof post.id === "string" &&
          !String(post.id).startsWith("optimistic-")
        ) {
          void trackFeedLike(user.id, post.id);
        }
      }

      await loadCounts();
      window.dispatchEvent(new Event("reactionUpdated"));
    } catch {
      setReaction(prevReaction);
      setLikeCount(prevLikes);
      setDislikeCount(prevDislikes);
    }
  };

  const Icon = getClubIcon(post?.clubName);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {post && (
        <DialogContent className="p-0 bg-transparent border-none shadow-none w-screen max-w-none h-screen flex items-center justify-center">
          <motion.div
            layoutId={layoutReady ? `post-card-${post.id}` : undefined}
            layout="position"
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 30 }}
            transition={{ type: "spring", stiffness: 260, damping: 28 }}
            className="w-[96vw] sm:w-[92vw] md:w-[84vw] lg:w-[72vw] xl:w-[64vw] 2xl:w-[56vw] h-[92vh] rounded-2xl border border-border bg-card/95 backdrop-blur-xl shadow-2xl overflow-y-auto"
          >
            <DialogTitle className="sr-only">{post.title}</DialogTitle>

            <div className="sticky top-0 z-10 bg-card/90 backdrop-blur-md border-b border-border px-6 py-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-muted flex items-center justify-center">
                <Icon size={18} />
              </div>

              <div>
                <p className="text-sm font-semibold">{post.clubName}</p>
                <p className="text-xs text-muted-foreground">
                  <span
                    onClick={() => navigate(`/user/${post.username}`)}
                    className="hover:text-primary cursor-pointer transition"
                  >
                    @{post.username}
                  </span>{" "}
                  · {post.time}
                </p>
              </div>

              {/* Delete Box */}
              {currentUser?.id === post.user_id && (
                <div className="ml-auto flex items-center h-full">
                  {showConfirmDelete ? (
                    <div className="flex items-center gap-1.5 bg-destructive/10 text-destructive text-xs px-2 py-1.5 rounded-md border border-destructive/20 z-10">
                      <span>Delete?</span>
                      <button
                        onClick={(e) => { e.stopPropagation(); setIsDeleting(true); handleDeletePost(); }}
                        disabled={isDeleting}
                        className="font-bold hover:underline px-1 uppercase"
                      >
                        {isDeleting ? <Loader2 className="w-3 h-3 animate-spin" /> : "Yes"}
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); setShowConfirmDelete(false); }}
                        disabled={isDeleting}
                        className="hover:text-foreground text-destructive/70"
                      >
                        <XCircle className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={(e) => { e.stopPropagation(); setShowConfirmDelete(true); }}
                      className="p-2 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-lg transition-colors z-10"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              )}
            </div>

            <div className="px-6 py-5 space-y-4">
              <motion.h2 layout className="text-xl font-bold">
                {post.title}
              </motion.h2>

              <p className="text-sm text-foreground/75 leading-relaxed">
                {post.content}
              </p>

              {post.image && (
                <motion.div
                  // layoutId={`post-image-${post.id}`}
                  className="relative w-full rounded-xl overflow-hidden border border-border bg-black"
                >
                  <img
                    src={post.image}
                    className="absolute inset-0 w-full h-full object-cover blur-sm scale-105 opacity-15"
                  />

                  <img
                    src={post.image}
                    className="relative w-full max-h-[70vh] object-contain"
                  />
                </motion.div>
              )}

              <div className="flex items-center gap-1 pt-3 border-t border-border">
                <motion.button
                  whileTap={{ scale: 1.3 }}
                  animate={
                    reaction === "like"
                      ? { scale: [1, 1.35, 1], boxShadow: "0 0 22px #22c55e" }
                      : { scale: 1 }
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
                      ? {
                          x: [0, -4, 4, -3, 3, 0],
                          boxShadow: "0 0 22px #ef4444",
                        }
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

                <div className="flex items-center gap-1 px-3 text-sm text-muted-foreground">
                  <MessageSquare size={16} />
                  {localCommentCount}
                </div>

                <motion.button
                  whileTap={{ scale: 1.25, rotate: -8 }}
                  onClick={share}
                  className="px-3 text-muted-foreground hover:text-primary transition"
                >
                  <Share2 size={16} />
                </motion.button>

                <button
                  onClick={() => setSaved(!saved)}
                  className="ml-auto px-3"
                >
                  <Bookmark
                    size={16}
                    className={saved ? "fill-primary text-primary" : ""}
                  />
                </button>
              </div>
            </div>

            <div className="border-t border-border px-6 py-4">
              <CommentThread postId={post.id} />
            </div>
          </motion.div>
        </DialogContent>
      )}
    </Dialog>
  );
}
