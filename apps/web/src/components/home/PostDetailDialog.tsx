import { useState } from "react";
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
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
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

export default function PostDetailDialog({ open, onOpenChange, post }: any) {
  const [reaction, setReaction] = useState<"like" | "dislike" | null>(null);
  const [saved, setSaved] = useState(false);

  if (!post) return null;

  const Icon = getClubIcon(post.clubName);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto bg-card/95 backdrop-blur-xl border-border/60 p-0 rounded-2xl">
        <DialogTitle className="sr-only">{post.title}</DialogTitle>

        {/* header */}
        <div className="sticky top-0 z-10 bg-card/90 backdrop-blur-md border-b border-border px-6 py-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-muted flex items-center justify-center">
            <Icon size={18} />
          </div>

          <div>
            <p className="text-sm font-semibold">{post.clubName}</p>
            <p className="text-xs text-muted-foreground">
              @{post.username} · {post.time}
            </p>
          </div>
        </div>

        <div className="px-6 py-5 space-y-4">
          <h2 className="text-xl font-bold">{post.title}</h2>

          <p className="text-sm text-foreground/75 leading-relaxed">
            {post.content}
          </p>

          {post.image && (
            <img
              src={post.image}
              className="w-full rounded-xl max-h-[520px] object-cover border border-border"
            />
          )}

          {/* actions */}
          <div className="flex items-center gap-1 pt-3 border-t border-border">
            <button
              onClick={() => setReaction(reaction === "like" ? null : "like")}
              className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm hover:bg-muted/50"
            >
              <ThumbsUp size={16} />
              {post.likes}
            </button>

            <button
              onClick={() =>
                setReaction(reaction === "dislike" ? null : "dislike")
              }
              className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm hover:bg-muted/50"
            >
              <ThumbsDown size={16} />
              {post.dislikes}
            </button>

            <div className="flex items-center gap-1 px-3 text-sm text-muted-foreground">
              <MessageSquare size={16} />
              {post.commentCount}
            </div>

            <button onClick={() => setSaved(!saved)} className="ml-auto px-3">
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
      </DialogContent>
    </Dialog>
  );
}
