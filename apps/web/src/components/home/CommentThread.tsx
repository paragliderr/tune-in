import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { supabase } from "@/lib/supabase";
import { useComments } from "@/hooks/useComments";
import CommentItem from "@/components/comments/CommentItem";

interface Props {
  postId: string;
}

export default function CommentThread({ postId }: Props) {
  const [sort, setSort] = useState<"Top" | "New">("Top");
  const { comments, load, addOptimistic } = useComments(postId, sort);

  const [text, setText] = useState("");
  const [clubId, setClubId] = useState<string | null>(null);

  useEffect(() => {
    const loadClub = async () => {
      const { data } = await supabase
        .from("posts")
        .select("club_id")
        .eq("id", postId)
        .single();

      if (data) setClubId(data.club_id);
    };

    loadClub();
  }, [postId]);

  const post = async () => {
    if (!text.trim() || !clubId) return;

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) return;

    const { data: profile } = await supabase
      .from("profiles")
      .select("username, avatar_url")
      .eq("id", user.id)
      .single();

    addOptimistic(text, profile.username, clubId, profile.avatar_url);

    await supabase.from("comments").insert({
      post_id: postId,
      club_id: clubId,
      user_id: user.id,
      content: text,
    });

    setText("");
    window.dispatchEvent(new Event("commentUpdated"));
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="mt-6"
    >
      <div className="flex gap-3 mb-5">
        {["Top", "New"].map((s) => (
          <button
            key={s}
            onClick={() => setSort(s as any)}
            className={`px-3 py-1 rounded-full text-sm ${
              sort === s
                ? "bg-primary/20 text-primary"
                : "text-muted-foreground"
            }`}
          >
            {s}
          </button>
        ))}
      </div>

      <div className="flex gap-3 mb-6">
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          maxLength={5000}
          placeholder="Add comment (markdown supported)"
          className="flex-1 px-4 py-3 rounded-2xl border border-border bg-background text-sm"
        />
        <button
          onClick={post}
          className="px-6 py-3 bg-primary rounded-2xl font-semibold"
        >
          Post
        </button>
      </div>

      <div>
        {comments.map((c) => (
          <CommentItem key={c.id} comment={c} />
        ))}
      </div>

      <button
        onClick={() => load()}
        className="mt-6 text-primary text-sm hover:underline"
      >
        Load more comments
      </button>
    </motion.div>
  );
}
