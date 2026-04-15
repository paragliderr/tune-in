import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "@/lib/supabase";
import { ArrowLeft, Trophy, Film, Gamepad2, Music, Code2, Dumbbell, Users, TrendingUp } from "lucide-react";

// ─── Types ─────────────────────────────────────────────────────────────────

interface LeaderboardEntry {
  user_id: string;
  username: string;
  avatar_url: string | null;
  score: number;
  breakdown: {
    movies?: number;
    games?: number;
    posts?: number;
  };
}

// ─── Club / category config ────────────────────────────────────────────────

const CATEGORIES = [
  { key: "overall",  label: "Overall",  icon: <Trophy size={14} />,   color: "text-yellow-400" },
  { key: "cinema",   label: "Cinema",   icon: <Film size={14} />,     color: "text-blue-400" },
  { key: "games",    label: "Games",    icon: <Gamepad2 size={14} />, color: "text-emerald-400" },
  { key: "music",    label: "Music",    icon: <Music size={14} />,    color: "text-pink-400" },
  { key: "tech",     label: "Tech",     icon: <Code2 size={14} />,    color: "text-purple-400" },
  { key: "fitness",  label: "Fitness",  icon: <Dumbbell size={14} />, color: "text-orange-400" },
  { key: "social",   label: "Social",   icon: <Users size={14} />,    color: "text-teal-400" },
] as const;

type CategoryKey = typeof CATEGORIES[number]["key"];

// ─── Score fetchers ────────────────────────────────────────────────────────

async function fetchOverallLeaderboard(): Promise<LeaderboardEntry[]> {

  // ❌ OLD LOGIC (COMMENTED OUT — DO NOT DELETE)
  /*
  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, username, avatar_url");

  return (profiles ?? [])
    .map((p, i) => {
      const hgtScore = null;

      return {
        user_id: p.id,
        username: p.username || `User_${i}`,
        avatar_url: p.avatar_url,
        score: hgtScore ?? 0,
        breakdown: {
          movies: 0,
          games: 0,
          posts: 0,
        },
      };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, 50);
  */

  // ✅ NEW LOGIC (YOUR SCORING SYSTEM)

  const [{ data: profiles }, { data: posts }, { data: movieReviews }, { data: gameReviews }] = await Promise.all([
    supabase.from("profiles").select("id, username, avatar_url"),
    supabase.from("posts").select("user_id"),
    supabase.from("movie_reviews").select("user_id"),
    supabase.from("game_reviews").select("user_id"),
  ]);

  const postCount: Record<string, number> = {};
  const movieCount: Record<string, number> = {};
  const gameCount: Record<string, number> = {};

  posts?.forEach((p) => {
    postCount[p.user_id] = (postCount[p.user_id] ?? 0) + 1;
  });

  movieReviews?.forEach((m) => {
    movieCount[m.user_id] = (movieCount[m.user_id] ?? 0) + 1;
  });

  gameReviews?.forEach((g) => {
    gameCount[g.user_id] = (gameCount[g.user_id] ?? 0) + 1;
  });

  return (profiles ?? [])
    .map((p) => {
      const postsScore = postCount[p.id] ?? 0;
      const moviesScore = movieCount[p.id] ?? 0;
      const gamesScore = gameCount[p.id] ?? 0;

      const totalScore =
        postsScore * 1 +
        moviesScore * 3 +
        gamesScore * 3;

      return {
        user_id: p.id,
        username: p.username || "User",
        avatar_url: p.avatar_url,
        score: totalScore,
        breakdown: {
          posts: postsScore,
          movies: moviesScore,
          games: gamesScore,
        },
      };
    })
    .filter((e) => e.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 50);

}

async function fetchCinemaLeaderboard(): Promise<LeaderboardEntry[]> {
  const [{ data: profiles }, { data: reviews }] = await Promise.all([
    supabase.from("profiles").select("id, username, avatar_url"),
    supabase.from("movie_reviews").select("user_id, rating"),
  ]);

  const scoreMap: Record<string, number> = {};
  reviews?.forEach((r) => { scoreMap[r.user_id] = (scoreMap[r.user_id] ?? 0) + 1; });

  return (profiles ?? [])
    .map((p) => ({ 
      user_id: p.id, 
      username: p.username || "User", // Safe fallback
      avatar_url: p.avatar_url, 
      score: scoreMap[p.id] ?? 0, 
      breakdown: { movies: scoreMap[p.id] ?? 0 } 
    }))
    .filter((e) => e.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 50);
}

async function fetchGamesLeaderboard(): Promise<LeaderboardEntry[]> {
  const [{ data: profiles }, { data: reviews }] = await Promise.all([
    supabase.from("profiles").select("id, username, avatar_url"),
    supabase.from("game_reviews").select("user_id"),
  ]);

  const scoreMap: Record<string, number> = {};
  reviews?.forEach((r) => { scoreMap[r.user_id] = (scoreMap[r.user_id] ?? 0) + 1; });

  return (profiles ?? [])
    .map((p) => ({ 
      user_id: p.id, 
      username: p.username || "User", // Safe fallback
      avatar_url: p.avatar_url, 
      score: scoreMap[p.id] ?? 0, 
      breakdown: { games: scoreMap[p.id] ?? 0 } 
    }))
    .filter((e) => e.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 50);
}

async function fetchClubLeaderboard(clubSlug: string): Promise<LeaderboardEntry[]> {
  const { data: club } = await supabase.from("clubs").select("id, name").eq("slug", clubSlug).single();
  if (!club) return [];

  const [{ data: members }, { data: posts }] = await Promise.all([
    supabase.from("club_members").select("user_id").eq("club_id", club.id),
    supabase.from("posts").select("user_id, like_count, comment_count").eq("club_id", club.id),
  ]);

  const memberIds = members?.map((m) => m.user_id) ?? [];
  if (!memberIds.length) return [];

  const { data: profiles } = await supabase.from("profiles").select("id, username, avatar_url").in("id", memberIds);

  const postScore: Record<string, number> = {};
  posts?.forEach((p) => {
    postScore[p.user_id] = (postScore[p.user_id] ?? 0) + 1 + (p.like_count ?? 0) * 2 + (p.comment_count ?? 0);
  });

  return (profiles ?? [])
    .map((p) => ({ 
      user_id: p.id, 
      username: p.username || "User", // Safe fallback
      avatar_url: p.avatar_url, 
      score: postScore[p.id] ?? 0, 
      breakdown: { posts: postScore[p.id] ?? 0 } 
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 50);
}

// ─── Avatar ────────────────────────────────────────────────────────────────

const Avatar = ({ url, username, size = 36 }: { url: string | null; username: string | null; size?: number }) => {
  const safeName = username || "??"; // Prevents crash if null
  const initials = safeName.slice(0, 2).toUpperCase();
  
  return url ? (
    <img src={url} alt={safeName} style={{ width: size, height: size }} className="rounded-full object-cover" />
  ) : (
    <div style={{ width: size, height: size }} className="rounded-full bg-muted flex items-center justify-center text-muted-foreground font-medium text-xs">
      {initials}
    </div>
  );
};

// ─── Rank badge ────────────────────────────────────────────────────────────

const RankBadge = ({ rank }: { rank: number }) => {
  if (rank === 1) return <span className="text-lg">🥇</span>;
  if (rank === 2) return <span className="text-lg">🥈</span>;
  if (rank === 3) return <span className="text-lg">🥉</span>;
  return <span className="text-sm text-muted-foreground font-medium w-6 text-center">{rank}</span>;
};

// ─── Score bar ─────────────────────────────────────────────────────────────

const ScoreBar = ({ score, max }: { score: number; max: number }) => (
  <div className="w-20 h-1.5 bg-muted rounded-full overflow-hidden">
    <motion.div
      className="h-full bg-primary rounded-full"
      initial={{ width: 0 }}
      animate={{ width: `${max > 0 ? (score / max) * 100 : 0}%` }}
      transition={{ duration: 0.6, ease: "easeOut" }}
    />
  </div>
);

// ─── Main component ────────────────────────────────────────────────────────

const Leaderboard = () => {
  const navigate = useNavigate();
  const [category, setCategory] = useState<CategoryKey>("overall");
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [currentUserRank, setCurrentUserRank] = useState<number | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setCurrentUserId(session?.user?.id ?? null);
    });
  }, []);

  useEffect(() => {
    setLoading(true);
    const fetch = async () => {
      let data: LeaderboardEntry[] = [];
      if (category === "overall") data = await fetchOverallLeaderboard();
      else if (category === "cinema") data = await fetchCinemaLeaderboard();
      else if (category === "games") data = await fetchGamesLeaderboard();
      else data = await fetchClubLeaderboard(category); // tech, music, fitness, social map to club slugs
      setEntries(data);
      if (currentUserId) {
        const idx = data.findIndex((e) => e.user_id === currentUserId);
        setCurrentUserRank(idx >= 0 ? idx + 1 : null);
      }
      setLoading(false);
    };
    fetch();
  }, [category, currentUserId]);

  const maxScore = entries[0]?.score ?? 1;
  const topThree = entries.slice(0, 3);
  const rest = entries.slice(3);

  const catMeta = CATEGORIES.find((c) => c.key === category)!;

  return (
    <div className="h-screen bg-background flex flex-col overflow-hidden">
      {/* Header */}
      <header className="h-14 border-b border-border flex items-center px-5 gap-4 flex-shrink-0">
        <button onClick={() => navigate(-1)} className="text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft size={18} />
        </button>
        <div className="flex items-center gap-2">
          <TrendingUp size={16} className="text-primary" />
          <span className="text-sm font-medium">Leaderboard</span>
        </div>
        {currentUserRank && (
          <span className="ml-auto text-xs text-muted-foreground">
            Your rank: <span className="text-foreground font-medium">#{currentUserRank}</span>
          </span>
        )}
      </header>

      <div className="flex-1 overflow-y-auto scrollbar-thin scrollbar-thumb-muted">
        <div className="max-w-2xl mx-auto px-5 py-6 space-y-6">

          {/* Category tabs */}
          <div className="flex gap-2 flex-wrap">
            {CATEGORIES.map((c) => (
              <button
                key={c.key}
                onClick={() => setCategory(c.key)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                  category === c.key
                    ? "bg-primary/10 text-primary border border-primary/30"
                    : "text-muted-foreground border border-border hover:border-foreground/20 hover:text-foreground"
                }`}
              >
                <span className={category === c.key ? c.color : ""}>{c.icon}</span>
                {c.label}
              </button>
            ))}
          </div>

          {loading ? (
            <div className="space-y-3">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="h-16 rounded-xl bg-muted/40 animate-pulse" />
              ))}
            </div>
          ) : entries.length === 0 ? (
            <div className="py-20 text-center text-muted-foreground text-sm">
              No data yet for this category
            </div>
          ) : (
            <AnimatePresence mode="wait">
              <motion.div
                key={category}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.18 }}
                className="space-y-4"
              >
                {/* Podium top 3 */}
                {topThree.length >= 3 && (
                  <div className="rounded-2xl border border-border bg-card p-5">
                    <p className="text-xs font-semibold tracking-wider text-muted-foreground uppercase mb-5">
                      {catMeta.label} Top 3
                    </p>
                    <div className="flex items-end justify-center gap-4">
                      {/* 2nd */}
                      <PodiumCard entry={topThree[1]} rank={2} height="h-24" navigate={navigate} />
                      {/* 1st */}
                      <PodiumCard entry={topThree[0]} rank={1} height="h-32" navigate={navigate} highlight />
                      {/* 3rd */}
                      <PodiumCard entry={topThree[2]} rank={3} height="h-20" navigate={navigate} />
                    </div>
                  </div>
                )}

                {/* Full list */}
                <div className="rounded-2xl border border-border bg-card divide-y divide-border overflow-hidden">
                  {entries.map((entry, idx) => {
                    const isMe = entry.user_id === currentUserId;
                    const safeName = entry.username || "User"; // Safe fallback
                    return (
                      <motion.div
                        key={entry.user_id}
                        initial={{ opacity: 0, x: -8 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: idx * 0.03 }}
                        onClick={() => navigate(`/user/${safeName}`)}
                        className={`flex items-center gap-4 px-5 py-3.5 hover:bg-muted/40 cursor-pointer transition-colors ${
                          isMe ? "bg-primary/5" : ""
                        }`}
                      >
                        <div className="w-8 flex items-center justify-center flex-shrink-0">
                          <RankBadge rank={idx + 1} />
                        </div>
                        <Avatar url={entry.avatar_url} username={safeName} />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className={`text-sm font-medium ${isMe ? "text-primary" : ""}`}>
                              @{safeName}
                            </span>
                            {isMe && (
                              <span className="text-xs px-1.5 py-0.5 rounded-full bg-primary/10 text-primary">
                                you
                              </span>
                            )}
                          </div>
                          <BreakdownLine breakdown={entry.breakdown} category={category} />
                        </div>
                        <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
                          <span className="text-sm font-semibold tabular-nums">{entry.score.toLocaleString()}</span>
                          <ScoreBar score={entry.score} max={maxScore} />
                        </div>
                      </motion.div>
                    );
                  })}
                </div>

                {/* Scoring legend */}
                <ScoringNote category={category} />
              </motion.div>
            </AnimatePresence>
          )}
        </div>
      </div>
    </div>
  );
};

// ─── Podium card ───────────────────────────────────────────────────────────

const PodiumCard = ({
  entry,
  rank,
  height,
  navigate,
  highlight = false,
}: {
  entry: LeaderboardEntry;
  rank: number;
  height: string;
  navigate: ReturnType<typeof useNavigate>;
  highlight?: boolean;
}) => {
  const safeName = entry.username || "User"; // Prevents crash
  return (
    <div
      className="flex flex-col items-center gap-2 cursor-pointer"
      onClick={() => navigate(`/user/${safeName}`)}
    >
      <div className={`relative ${rank === 1 ? "ring-2 ring-yellow-400/60 rounded-full" : ""}`}>
        {entry.avatar_url ? (
          <img src={entry.avatar_url} alt={safeName} className={`${rank === 1 ? "w-14 h-14" : "w-10 h-10"} rounded-full object-cover`} />
        ) : (
          <div className={`${rank === 1 ? "w-14 h-14 text-sm" : "w-10 h-10 text-xs"} rounded-full bg-muted flex items-center justify-center text-muted-foreground font-medium`}>
            {safeName.slice(0, 2).toUpperCase()}
          </div>
        )}
      </div>
      <span className="text-xs text-muted-foreground truncate max-w-[72px]">@{safeName}</span>
      <div className={`${height} w-20 rounded-t-xl flex flex-col items-center justify-end pb-3 gap-1 ${
        rank === 1 ? "bg-yellow-400/10 border border-yellow-400/20" :
        rank === 2 ? "bg-muted/60 border border-border" :
        "bg-muted/40 border border-border"
      }`}>
        <RankBadge rank={rank} />
        <span className={`text-xs font-semibold ${rank === 1 ? "text-yellow-400" : "text-muted-foreground"}`}>
          {entry.score.toLocaleString()}
        </span>
      </div>
    </div>
  );
};

// ─── Breakdown line ────────────────────────────────────────────────────────

const BreakdownLine = ({ breakdown, category }: { breakdown: LeaderboardEntry["breakdown"]; category: CategoryKey }) => {
  const parts: string[] = [];
  if (breakdown.movies)    parts.push(`${breakdown.movies} films`);
  if (breakdown.games)     parts.push(`${breakdown.games} games`);
  if (breakdown.posts)     parts.push(`${breakdown.posts} posts`);
  return (
    <p className="text-xs text-muted-foreground truncate mt-0.5">
      {parts.join(" · ") || "No activity"}
    </p>
  );
};

// ─── Scoring note ──────────────────────────────────────────────────────────

const ScoringNote = ({ category }: { category: CategoryKey }) => {
  const notes: Record<CategoryKey, string> = {
    overall:  "Score = movies ×3 + games ×3 + posts ×1",
    cinema:   "Score = total movies logged via Letterboxd / reviews",
    games:    "Score = total games reviewed",
    music:    "Score = posts + engagement in Music club",
    tech:     "Score = posts + engagement in Tech club",
    fitness:  "Score = posts + engagement in Fitness club",
    social:   "Score = posts + engagement in Social club",
  };
  return (
    <p className="text-center text-xs text-muted-foreground/60 pb-2">
      {notes[category]}
    </p>
  );
};

export default Leaderboard;