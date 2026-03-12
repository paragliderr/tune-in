import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ThumbsUp,
  ThumbsDown,
  MessageSquare,
  ChevronDown,
  ChevronUp,
} from "lucide-react";

interface Comment {
  id: string;
  user: string;
  text: string;
  likes: number;
  dislikes: number;
  time: string;
  replies?: Comment[];
}

const MOCK_COMMENTS: Comment[] = [
  {
    id: "1",
    user: "neonwalker",
    text: "This is exactly what I was thinking about. Great perspective!",
    likes: 24,
    dislikes: 1,
    time: "2h ago",
    replies: [
      {
        id: "1a",
        user: "pixeldust",
        text: "Totally agree, been saying this for months.",
        likes: 8,
        dislikes: 0,
        time: "1h ago",
        replies: [
          {
            id: "1a1",
            user: "synthwave",
            text: "Same here. The community is really coming together on this.",
            likes: 3,
            dislikes: 0,
            time: "45m ago",
          },
        ],
      },
    ],
  },
  {
    id: "2",
    user: "glitchcore",
    text: "Hot take but I think the opposite is true. Here's why...",
    likes: 12,
    dislikes: 5,
    time: "3h ago",
  },
  {
    id: "3",
    user: "voidrunner",
    text: "Can someone link the original source? I want to dig deeper.",
    likes: 6,
    dislikes: 0,
    time: "4h ago",
  },
];

const SORT_OPTIONS = ["Top", "New", "Controversial"] as const;

const SingleComment = ({
  comment,
  depth = 0,
}: {
  comment: Comment;
  depth?: number;
}) => {
  const [collapsed, setCollapsed] = useState(false);
  const [liked, setLiked] = useState<"like" | "dislike" | null>(null);

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="relative"
    >
      <div className="flex gap-3">
        {depth > 0 && (
          <div className="flex flex-col items-center">
            <div className="w-px flex-1 bg-border/50" />
          </div>
        )}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-semibold text-foreground">
              @{comment.user}
            </span>
            <span className="text-xs text-muted-foreground">
              · {comment.time}
            </span>
          </div>
          <p className="text-sm text-foreground/80 mb-2">{comment.text}</p>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setLiked(liked === "like" ? null : "like")}
              className={`flex items-center gap-1 text-xs transition-colors ${
                liked === "like"
                  ? "text-primary"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <ThumbsUp className="w-3.5 h-3.5" />
              {comment.likes + (liked === "like" ? 1 : 0)}
            </button>
            <button
              onClick={() => setLiked(liked === "dislike" ? null : "dislike")}
              className={`flex items-center gap-1 text-xs transition-colors ${
                liked === "dislike"
                  ? "text-destructive"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <ThumbsDown className="w-3.5 h-3.5" />
              {comment.dislikes + (liked === "dislike" ? 1 : 0)}
            </button>
            <button className="text-xs text-muted-foreground hover:text-primary transition-colors flex items-center gap-1">
              <MessageSquare className="w-3.5 h-3.5" /> Reply
            </button>
            {comment.replies && comment.replies.length > 0 && (
              <button
                onClick={() => setCollapsed(!collapsed)}
                className="text-xs text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1"
              >
                {collapsed ? (
                  <ChevronDown className="w-3.5 h-3.5" />
                ) : (
                  <ChevronUp className="w-3.5 h-3.5" />
                )}
                {collapsed ? "Show" : "Hide"} replies
              </button>
            )}
          </div>

          <AnimatePresence>
            {!collapsed && comment.replies && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.3 }}
                className="mt-3 ml-3 pl-3 border-l border-border/40 space-y-3"
              >
                {comment.replies.map((reply) => (
                  <SingleComment
                    key={reply.id}
                    comment={reply}
                    depth={depth + 1}
                  />
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </motion.div>
  );
};

interface CommentThreadProps {
  postId: string;
}

const CommentThread = ({ postId }: CommentThreadProps) => {
  const [sortBy, setSortBy] = useState<(typeof SORT_OPTIONS)[number]>("Top");

  return (
    <motion.div
      initial={{ height: 0, opacity: 0 }}
      animate={{ height: "auto", opacity: 1 }}
      exit={{ height: 0, opacity: 0 }}
      transition={{ duration: 0.3 }}
      className="border-t border-border/40 pt-4 mt-4"
    >
      <div className="flex items-center gap-2 mb-4">
        <span className="text-xs text-muted-foreground">Sort by:</span>
        {SORT_OPTIONS.map((opt) => (
          <button
            key={opt}
            onClick={() => setSortBy(opt)}
            className={`text-xs px-2 py-0.5 rounded-full transition-colors ${
              sortBy === opt
                ? "bg-primary/20 text-primary"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {opt}
          </button>
        ))}
      </div>

      <div className="space-y-4">
        {MOCK_COMMENTS.map((comment) => (
          <SingleComment key={comment.id} comment={comment} />
        ))}
      </div>

      <div className="mt-4 flex gap-2">
        <input
          placeholder="Add a comment..."
          className="flex-1 px-3 py-2 rounded-xl border border-border bg-background text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/50"
        />
        <button className="px-4 py-2 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition-opacity">
          Post
        </button>
      </div>
    </motion.div>
  );
};

export default CommentThread;
