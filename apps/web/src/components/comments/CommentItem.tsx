import { useState, useRef, useEffect } from "react";
import {
  MessageSquare,
  ChevronDown,
  ChevronUp,
  ThumbsUp,
  ThumbsDown,
  MoreHorizontal,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import MarkdownRenderer from "./MarkdownRenderer";
import { useReplies } from "@/hooks/useReplies";
import { supabase } from "@/lib/supabase";
import { useNavigate } from "react-router-dom";
import { WordRotate } from "@/components/ui/word-rotate";

export default function CommentItem({ comment }: any) {
  const navigate = useNavigate();

  const [open, setOpen] = useState(comment.depth < 2);
  const [replying, setReplying] = useState(false);
  const [menu, setMenu] = useState(false);
  const [text, setText] = useState("");

  const [likes, setLikes] = useState(0);
  const [dislikes, setDislikes] = useState(0);
  const [reaction, setReaction] = useState<"like" | "dislike" | null>(null);

  const [isOwner, setIsOwner] = useState(false);

  const ref = useRef<HTMLDivElement>(null);

  const { replies, load, optimistic, loaded } = useReplies(
    comment.id,
    comment.depth < 2,
  );

  const loadCounts = async () => {
    const { data: reactions } = await supabase
      .from("comment_reactions")
      .select("reaction")
      .eq("comment_id", comment.id);

    if (reactions) {
      setLikes(reactions.filter((r) => r.reaction === "like").length);
      setDislikes(reactions.filter((r) => r.reaction === "dislike").length);
    }

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) return;

    if (user.id === comment.user_id) setIsOwner(true);

    const { data } = await supabase
      .from("comment_reactions")
      .select("reaction")
      .eq("comment_id", comment.id)
      .eq("user_id", user.id)
      .maybeSingle();

    setReaction(data?.reaction || null);
  };

  useEffect(() => {
    loadCounts();
  }, []);

  useEffect(() => {
    if (comment.__optimistic && ref.current) {
      ref.current.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, []);

  const react = async (type: "like" | "dislike") => {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) return;

    // Optimistic update
    const prevReaction = reaction;
    const prevLikes = likes;
    const prevDislikes = dislikes;

    if (reaction === type) {
      setReaction(null);
      if (type === "like") setLikes((c) => Math.max(0, c - 1));
      else setDislikes((c) => Math.max(0, c - 1));
    } else {
      if (reaction === "like") setLikes((c) => Math.max(0, c - 1));
      if (reaction === "dislike") setDislikes((c) => Math.max(0, c - 1));
      setReaction(type);
      if (type === "like") setLikes((c) => c + 1);
      else setDislikes((c) => c + 1);
    }

    try {
      if (prevReaction === type) {
        await supabase
          .from("comment_reactions")
          .delete()
          .eq("comment_id", comment.id)
          .eq("user_id", user.id);
      } else {
        await supabase.from("comment_reactions").upsert(
          {
            comment_id: comment.id,
            user_id: user.id,
            reaction: type,
          },
          { onConflict: "comment_id,user_id" },
        );
      }

      await loadCounts();
    } catch {
      setReaction(prevReaction);
      setLikes(prevLikes);
      setDislikes(prevDislikes);
    }
  };

  const reply = async () => {
    if (!text.trim()) return;

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) return;

    const { data: profile } = await supabase
      .from("profiles")
      .select("username, avatar_url")
      .eq("id", user.id)
      .single();

    optimistic(text, profile.username, profile.avatar_url, comment);
    setOpen(true);

    await supabase.from("comments").insert({
      post_id: comment.post_id,
      club_id: comment.club_id,
      user_id: user.id,
      parent_id: comment.id,
      content: text,
    });

    setText("");
    setReplying(false);
  };

  const toggle = () => {
    setOpen(!open);
    if (!loaded) load();
  };

  return (
    <motion.div
      ref={ref}
      layout
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      className="ml-6 border-l border-border/50 pl-5 mt-7"
    >
      <div className="flex gap-4">
        <img
          onClick={() => navigate(`/user/${comment.profiles.username}`)}
          src={
            comment.profiles.avatar_url ||
            `https://api.dicebear.com/7.x/initials/svg?seed=${comment.profiles.username}`
          }
          className="w-10 h-10 rounded-full cursor-pointer"
        />

        <div className="flex-1">
          <div
            onClick={() => navigate(`/user/${comment.profiles.username}`)}
            className="font-semibold text-base hover:text-primary cursor-pointer w-fit"
          >
            @{comment.profiles.username}
          </div>

          <div className="mt-1 text-[15px]">
            <MarkdownRenderer text={comment.content} />
          </div>

          <div className="flex gap-6 mt-3 text-sm text-muted-foreground items-center">
            <motion.button
              whileTap={{ scale: 1.35 }}
              animate={
                reaction === "like"
                  ? { scale: [1, 1.35, 1], boxShadow: "0 0 18px #22c55e" }
                  : {}
              }
              onClick={() => react("like")}
              className={`flex gap-1 items-center px-2 py-1 rounded-lg ${
                reaction === "like" ? "bg-green-500/20 text-green-400" : ""
              }`}
            >
              <ThumbsUp size={18} />
              <WordRotate words={[String(likes)]} />
            </motion.button>

            <motion.button
              whileTap={{ scale: 1.35 }}
              animate={
                reaction === "dislike"
                  ? {
                      x: [0, -3, 3, -2, 2, 0],
                      boxShadow: "0 0 18px #ef4444",
                    }
                  : {}
              }
              onClick={() => react("dislike")}
              className={`flex gap-1 items-center px-2 py-1 rounded-lg ${
                reaction === "dislike" ? "bg-red-500/20 text-red-400" : ""
              }`}
            >
              <ThumbsDown size={18} />
              <WordRotate words={[String(dislikes)]} />
            </motion.button>

            <button
              onClick={() => setReplying(!replying)}
              className="flex gap-1"
            >
              <MessageSquare size={18} /> Reply
            </button>

            {isOwner && (
              <div className="relative">
                <button onClick={() => setMenu(!menu)}>
                  <MoreHorizontal size={18} />
                </button>
              </div>
            )}

            {comment.reply_count > 0 && (
              <button onClick={toggle} className="ml-auto flex gap-1">
                {open ? <ChevronUp /> : <ChevronDown />}
                {open ? "Hide replies" : "Show replies"}
              </button>
            )}
          </div>

          <AnimatePresence>
            {replying && (
              <motion.div
                initial={{ height: 0 }}
                animate={{ height: "auto" }}
                exit={{ height: 0 }}
                className="flex gap-2 mt-3"
              >
                <input
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  className="flex-1 px-3 py-2 rounded-xl border border-border bg-background"
                />
                <button
                  onClick={reply}
                  className="px-4 py-2 bg-primary rounded-xl"
                >
                  Reply
                </button>
              </motion.div>
            )}
          </AnimatePresence>

          <AnimatePresence>
            {open && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                {replies.map((r) => (
                  <CommentItem key={r.id} comment={r} />
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </motion.div>
  );
}
