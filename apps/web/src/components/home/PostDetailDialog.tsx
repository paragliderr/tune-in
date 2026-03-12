import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ThumbsUp, ThumbsDown, MessageSquare, Bookmark, X } from "lucide-react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import CommentThread from "./CommentThread";

interface PostDetailDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  post: {
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
  } | null;
}

const PostDetailDialog = ({
  open,
  onOpenChange,
  post,
}: PostDetailDialogProps) => {
  const [reaction, setReaction] = useState<"like" | "dislike" | null>(null);
  const [saved, setSaved] = useState(false);

  if (!post) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto bg-card/95 backdrop-blur-xl border-border/60 p-0 gap-0 rounded-2xl">
        <DialogTitle className="sr-only">{post.title}</DialogTitle>

        {/* Header */}
        <div className="sticky top-0 z-10 bg-card/90 backdrop-blur-md border-b border-border/40 px-6 py-4 flex items-center gap-3">
          <div
            className={`w-10 h-10 rounded-xl bg-gradient-to-br ${post.clubColor} flex items-center justify-center text-sm font-bold text-primary-foreground shrink-0`}
          >
            {post.clubName.charAt(0)}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-foreground">
              {post.clubName}
            </p>
            <p className="text-xs text-muted-foreground">
              @{post.username} · {post.time}
            </p>
          </div>
        </div>

        {/* Content */}
        <div className="px-6 py-5 space-y-4">
          <h2 className="text-xl font-bold text-foreground leading-tight">
            {post.title}
          </h2>
          <p className="text-sm text-foreground/75 leading-relaxed">
            {post.content}
          </p>

          {post.hasImage && (
            <div className="w-full aspect-video rounded-xl bg-gradient-to-br from-primary/10 to-accent/20 border border-border/30 flex items-center justify-center">
              <span className="text-muted-foreground text-xs">
                Image placeholder
              </span>
            </div>
          )}

          {/* Interactions */}
          <div className="flex items-center gap-1 pt-2 border-t border-border/30">
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
                {post.likes + (reaction === "like" ? 1 : 0)}
              </span>
            </motion.button>

            <motion.button
              whileTap={{ scale: 1.3 }}
              onClick={() =>
                setReaction(reaction === "dislike" ? null : "dislike")
              }
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm transition-colors ${
                reaction === "dislike"
                  ? "bg-destructive/15 text-destructive"
                  : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
              }`}
            >
              <ThumbsDown className="w-4 h-4" />
              <span className="text-xs font-medium">
                {post.dislikes + (reaction === "dislike" ? 1 : 0)}
              </span>
            </motion.button>

            <div className="flex items-center gap-1.5 px-3 py-1.5 text-muted-foreground text-sm">
              <MessageSquare className="w-4 h-4" />
              <span className="text-xs font-medium">{post.commentCount}</span>
            </div>

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
        </div>

        {/* Comments always visible in detail view */}
        <div className="border-t border-border/40 px-6 py-4">
          <CommentThread postId={post.id} />
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default PostDetailDialog;
