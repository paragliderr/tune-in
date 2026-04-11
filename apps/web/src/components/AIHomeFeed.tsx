import { useState, useEffect } from 'react';
import PostCard from "@/components/home/PostCard";

interface AIHomeFeedProps {
  currentUserId: string;
  onOpenDetail?: (post: any) => void;
}

function mapAPIPostToCard(post: any) {
  return {
    id: post.id,
    clubSlug: post.clubSlug ?? "",
    clubName: post.clubName ?? "Unknown Club",
    clubColor: post.clubColor ?? "from-purple-600 to-indigo-700",
    username: post.username ?? "user",
    time: post.time ? new Date(post.time).toLocaleString() : "",
    title: post.title ?? "",
    content: post.content ? post.content.slice(0, 180) + (post.content.length > 180 ? "…" : "") : "",
    image: post.image ?? null,
    likes: post.likes ?? 0,
    dislikes: post.dislikes ?? 0,
    commentCount: post.commentCount ?? 0,
    ai_source: post.ai_source,
  };
}

const ExploitBadge = () => (
  <span className="inline-flex items-center gap-1 text-[10px] font-semibold tracking-wide px-2.5 py-1 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20 shadow-[0_0_8px_rgba(251,191,36,0.15)]">
    <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
    trending
  </span>
);

const ExploreBadge = () => (
  <span className="inline-flex items-center gap-1 text-[10px] font-semibold tracking-wide px-2.5 py-1 rounded-full bg-violet-500/10 text-violet-400 border border-violet-500/20 shadow-[0_0_8px_rgba(139,92,246,0.15)]">
    <span className="w-1.5 h-1.5 rounded-full bg-violet-400 animate-pulse" />
    for you
  </span>
);

export default function AIHomeFeed({ currentUserId, onOpenDetail }: AIHomeFeedProps) {
  const [posts, setPosts] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!currentUserId) {
      setIsLoading(false);
      return;
    }

    const fetchAIFeed = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const response = await fetch(`http://127.0.0.1:8000/api/v1/feed/${currentUserId}`);
        if (!response.ok) throw new Error(`Feed fetch failed: ${response.status}`);
        const data = await response.json();
        const mapped = (data.feed ?? []).map(mapAPIPostToCard);
        setPosts(mapped);
      } catch (err) {
        console.error("AI Feed Error:", err);
        setError("Could not load your personalized feed.");
        setPosts([]);
      } finally {
        setIsLoading(false);
      }
    };

    fetchAIFeed();
  }, [currentUserId]);

  if (isLoading) {
    return (
      <div className="flex flex-col gap-4 w-full mt-2">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="w-full rounded-2xl border border-border bg-card/60 animate-pulse h-36" />
        ))}
      </div>
    );
  }

  if (error) {
    return <div className="text-red-400 text-sm text-center py-10">{error}</div>;
  }

  if (posts.length === 0) {
    return (
      <div className="text-muted-foreground text-sm text-center py-10">
        No personalized posts yet — join more clubs to get recommendations!
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 w-full">
      {posts.map((post) => (
        <div key={post.id} className="relative w-full">
          <div className="absolute top-3 right-4 z-10 pointer-events-none">
            {post.ai_source === 'exploit' ? <ExploitBadge /> : <ExploreBadge />}
          </div>
          <PostCard
            {...post}
            onOpenDetail={() => onOpenDetail?.(post)}
          />
        </div>
      ))}
    </div>
  );
}