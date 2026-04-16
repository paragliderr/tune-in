import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "@/lib/supabase";
import { ArrowLeft, Trophy, Film, Gamepad2, Code2, Dumbbell, TrendingUp, Tv } from "lucide-react";

// ─── Types ─────────────────────────────────────────────────────────────────

interface LeaderboardEntry {
  user_id: string;
  username: string;
  avatar_url: string | null;
  score: number;
  hgt_signal?: number;
  breakdown: {
    movies?: number;
    anime?: number;
    games?: number;
    tech?: number;
    fitness?: number;
    posts?: number;
    likes?: number;
    clubs?: number;
  };
}

// ─── Club / category config ────────────────────────────────────────────────

const CATEGORIES = [
  { key: "overall",  label: "Overall",  icon: <Trophy size={14} />,   color: "text-yellow-400" },
  { key: "cinema",   label: "Cinema",   icon: <Film size={14} />,     color: "text-blue-400" },
  { key: "anime",    label: "Anime",    icon: <Tv size={14} />,       color: "text-pink-400" },
  { key: "gaming",   label: "Gaming",   icon: <Gamepad2 size={14} />, color: "text-emerald-400" },
  { key: "fitness",  label: "Fitness",  icon: <Dumbbell size={14} />, color: "text-orange-400" },
  { key: "tech",     label: "Tech",     icon: <Code2 size={14} />,    color: "text-purple-400" },
] as const;

type CategoryKey = typeof CATEGORIES[number]["key"];

// ─── Score fetchers ────────────────────────────────────────────────────────

async function fetchOverallLeaderboard(): Promise<LeaderboardEntry[]> {
  try {
    const [cinema, anime, gaming, fitness, tech, { data: profiles }] = await Promise.all([
      fetchCinemaLeaderboard(),
      fetchAnimeLeaderboard(),
      fetchGamingLeaderboard(),
      fetchFitnessLeaderboard(),
      fetchTechLeaderboard(),
      supabase.from("profiles").select("id, username, avatar_url")
    ]);

    // Fetch HGT details from backend
    const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";
    const res = await fetch(`${API_URL}/api/tune-in/leaderboard?top_k=50`);
    const backendData = res.ok ? await res.json() : [];

    const getScore = (arr: LeaderboardEntry[], id: string) => arr.find(x => x.user_id === id)?.score || 0;

    return (profiles ?? []).map(p => {
      const cinemaScore = getScore(cinema, p.id);
      const animeScore = getScore(anime, p.id);
      const gamingScore = getScore(gaming, p.id);
      const fitnessScore = getScore(fitness, p.id);
      const techScore = getScore(tech, p.id);

      // CHANGE 2: Overall score formula
      const categoryScores = [cinemaScore, animeScore, gamingScore, fitnessScore, techScore];
      const avg = categoryScores.reduce((a, b) => a + b, 0) / categoryScores.length;

      // Extract from backend data if available, default to 0
      const backendUser = backendData.find((b: any) => b.user_id === p.id);
      const mentorsCount = backendUser?.mentors?.length || 0;
      const menteesCount = backendUser?.mentees?.length || 0;
      const hgtMatchCount = mentorsCount + menteesCount;

      const diversityMultiplier = 1 + Math.min(hgtMatchCount * 0.05, 0.5);
      const overallScore = Math.round(avg * diversityMultiplier * 10) / 10;

      return {
        user_id: p.id,
        username: p.username || "User",
        avatar_url: p.avatar_url,
        score: overallScore,
        breakdown: {
          movies: cinemaScore,
          anime: animeScore,
          games: gamingScore,
          tech: techScore,
          fitness: fitnessScore
        }
      };
    }).filter(e => e.score > 0).sort((a, b) => b.score - a.score).slice(0, 50);

  } catch (error) {
    console.error("Overall fetch failed:", error);
    return [];
  }
}

async function fetchCinemaLeaderboard(): Promise<LeaderboardEntry[]> {
  const [{ data: profiles }, { data: reviews }] = await Promise.all([
    supabase.from("profiles").select("id, username, avatar_url"),
    supabase.from("movie_reviews").select("user_id"),
  ]);
  const scoreMap: Record<string, number> = {};
  reviews?.forEach((r) => { scoreMap[r.user_id] = (scoreMap[r.user_id] ?? 0) + 1; });
  return (profiles ?? []).map((p) => ({ 
    user_id: p.id, username: p.username || "User", avatar_url: p.avatar_url, 
    score: scoreMap[p.id] ?? 0, breakdown: { movies: scoreMap[p.id] ?? 0 } 
  })).filter((e) => e.score > 0).sort((a, b) => b.score - a.score).slice(0, 50);
}

async function fetchAnimeLeaderboard(): Promise<LeaderboardEntry[]> {
  const [{ data: profiles }, { data: reviews }] = await Promise.all([
    supabase.from("profiles").select("id, username, avatar_url"),
    supabase.from("anime_reviews").select("user_id"),
  ]);
  const scoreMap: Record<string, number> = {};
  reviews?.forEach((r) => { scoreMap[r.user_id] = (scoreMap[r.user_id] ?? 0) + 1; });
  return (profiles ?? []).map((p) => ({ 
    user_id: p.id, username: p.username || "User", avatar_url: p.avatar_url, 
    score: scoreMap[p.id] ?? 0, breakdown: { anime: scoreMap[p.id] ?? 0 } 
  })).filter((e) => e.score > 0).sort((a, b) => b.score - a.score).slice(0, 50);
}

async function fetchGamingLeaderboard(): Promise<LeaderboardEntry[]> {
  const [{ data: profiles }, { data: reviews }] = await Promise.all([
    supabase.from("profiles").select("id, username, avatar_url"),
    supabase.from("game_reviews").select("user_id"),
  ]);
  const scoreMap: Record<string, number> = {};
  reviews?.forEach((r) => { scoreMap[r.user_id] = (scoreMap[r.user_id] ?? 0) + 1; });
  return (profiles ?? []).map((p) => ({ 
    user_id: p.id, username: p.username || "User", avatar_url: p.avatar_url, 
    score: scoreMap[p.id] ?? 0, breakdown: { games: scoreMap[p.id] ?? 0 } 
  })).filter((e) => e.score > 0).sort((a, b) => b.score - a.score).slice(0, 50);
}

// CHANGE 3: Custom Fitness logic using Strava
async function fetchFitnessLeaderboard(): Promise<LeaderboardEntry[]> {
  const [{ data: profiles }, { data: strava }] = await Promise.all([
    supabase.from("profiles").select("id, username, avatar_url"),
    supabase.from("strava_stats").select("user_id, score")
  ]);

  const scoreMap: Record<string, number> = {};
  strava?.forEach(s => {
    // The new strava_service.py already does the complex math. 
    // We just use the exact score directly now!
    scoreMap[s.user_id] = (scoreMap[s.user_id] || 0) + (s.score || 0);
  });

  return (profiles ?? []).map(p => ({
    user_id: p.id, username: p.username || "User", avatar_url: p.avatar_url,
    score: scoreMap[p.id] ? Math.round(scoreMap[p.id] * 10) / 10 : 0, 
    breakdown: { fitness: scoreMap[p.id] ?? 0 }
  })).filter(e => e.score > 0).sort((a,b) => b.score - a.score).slice(0, 50);
}

// CHANGE 3: Custom Tech logic using GitHub + Clubs
async function fetchTechLeaderboard(): Promise<LeaderboardEntry[]> {
  const [{ data: profiles }, { data: github }, { data: clubs }] = await Promise.all([
    supabase.from("profiles").select("id, username, avatar_url"),
    supabase.from("github_stats").select("user_id, total_commits, streak_days"),
    supabase.from("club_members").select("user_id, clubs!inner(name)").ilike("clubs.name", "%tech%")
  ]);

  const scoreMap: Record<string, number> = {};
  
  github?.forEach(g => {
    scoreMap[g.user_id] = (scoreMap[g.user_id] || 0) + (g.total_commits || 0) * 1.0 + (g.streak_days || 0) * 5.0;
  });
  
  clubs?.forEach(c => {
    scoreMap[c.user_id] = (scoreMap[c.user_id] || 0) + 15.0; // techClubs * 15
  });

  return (profiles ?? []).map(p => ({
    user_id: p.id, username: p.username || "User", avatar_url: p.avatar_url,
    score: scoreMap[p.id] ?? 0, breakdown: { tech: scoreMap[p.id] ?? 0 }
  })).filter(e => e.score > 0).sort((a,b) => b.score - a.score).slice(0, 50);
}

// ─── Avatar ────────────────────────────────────────────────────────────────

const Avatar = ({ url, username, size = 36 }: { url: string | null; username: string | null; size?: number }) => {
  const safeName = username || "??"; 
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
    const load = async () => {
      let data: LeaderboardEntry[] = [];
      if (category === "overall")       data = await fetchOverallLeaderboard();
      else if (category === "cinema")   data = await fetchCinemaLeaderboard();
      else if (category === "anime")    data = await fetchAnimeLeaderboard();
      else if (category === "gaming")   data = await fetchGamingLeaderboard();
      else if (category === "tech")     data = await fetchTechLeaderboard();
      else if (category === "fitness")  data = await fetchFitnessLeaderboard();
      
      setEntries(data);
      if (currentUserId) {
        const idx = data.findIndex(e => e.user_id === currentUserId);
        setCurrentUserRank(idx >= 0 ? idx + 1 : null);
      }
      setLoading(false);
    };
    load();
  }, [category, currentUserId]);

  const maxScore = entries[0]?.score ?? 1;
  const topThree = entries.slice(0, 3);

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
                      <PodiumCard entry={topThree[1]} rank={2} height="h-24" navigate={navigate} />
                      <PodiumCard entry={topThree[0]} rank={1} height="h-32" navigate={navigate} highlight />
                      <PodiumCard entry={topThree[2]} rank={3} height="h-20" navigate={navigate} />
                    </div>
                  </div>
                )}

                {/* Full list */}
                <div className="rounded-2xl border border-border bg-card divide-y divide-border overflow-hidden">
                  {entries.map((entry, idx) => {
                    const isMe = entry.user_id === currentUserId;
                    const safeName = entry.username || "User";
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
                          <BreakdownLine entry={entry} category={category} />
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
  entry, rank, height, navigate, highlight = false,
}: {
  entry: LeaderboardEntry; rank: number; height: string; navigate: ReturnType<typeof useNavigate>; highlight?: boolean;
}) => {
  const safeName = entry.username || "User"; 
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

const BreakdownLine = ({ entry, category }: { entry: LeaderboardEntry; category: CategoryKey }) => {
  const { breakdown } = entry;
  const parts: string[] = [];
  
  if (category === "overall") {
    if (breakdown.tech)    parts.push(`${breakdown.tech} tech`);
    if (breakdown.fitness) parts.push(`${breakdown.fitness} fitness`);
    if (breakdown.movies)  parts.push(`${breakdown.movies} movies`);
    if (breakdown.games)   parts.push(`${breakdown.games} games`);
  } else if (category === "tech") {
    if (breakdown.tech)    parts.push(`${breakdown.tech} points`);
  } else if (category === "fitness") {
    if (breakdown.fitness) parts.push(`${breakdown.fitness} points`);
  } else {
    if (breakdown.movies) parts.push(`${breakdown.movies} films`);
    if (breakdown.anime)  parts.push(`${breakdown.anime} series`);
    if (breakdown.games)  parts.push(`${breakdown.games} games`);
  }

  return (
    <p className="text-xs text-muted-foreground truncate mt-0.5">
      {parts.join(" · ") || "No activity"}
    </p>
  );
};

// ─── Scoring note ──────────────────────────────────────────────────────────

const ScoringNote = ({ category }: { category: CategoryKey }) => {
  const notes: Record<CategoryKey, string> = {
    overall:  "AI Average of all categories × Graph Diversity Multiplier",
    cinema:   "Score = total movies reviewed",
    anime:    "Score = total anime reviewed",
    gaming:   "Score = total games reviewed",
    tech:     "Score = GitHub commits + (streak × 5) + (Tech clubs × 15)",
    fitness:  "Score = (Strava km × 0.5) + (Strava points × 0.1)",
  };
  return (
    <p className="text-center text-xs text-muted-foreground/60 pb-2">
      {notes[category]}
    </p>
  );
};

export default Leaderboard;



// import { useState, useEffect } from "react";
// import { useNavigate } from "react-router-dom";
// import { motion, AnimatePresence } from "framer-motion";
// import { supabase } from "@/lib/supabase";
// import { ArrowLeft, Trophy, Film, Gamepad2, Code2, Dumbbell, TrendingUp, Tv } from "lucide-react";

// // ─── Types ─────────────────────────────────────────────────────────────────
// interface LeaderboardEntry {
//   user_id: string;
//   username: string;
//   avatar_url: string | null;
//   score: number;
//   breakdown: {
//     movies?: number;
//     anime?: number;
//     games?: number;
//     tech?: number;
//     fitness?: number;
//     likes?: number;
//     clubs?: number;
//   };
// }

// const CATEGORIES = [
//   { key: "overall",  label: "Overall",  icon: <Trophy size={14} />,   color: "text-yellow-400" },
//   { key: "cinema",   label: "Cinema",   icon: <Film size={14} />,     color: "text-blue-400" },
//   { key: "anime",    label: "Anime",    icon: <Tv size={14} />,       color: "text-pink-400" },
//   { key: "gaming",   label: "Gaming",   icon: <Gamepad2 size={14} />, color: "text-emerald-400" },
//   { key: "fitness",  label: "Fitness",  icon: <Dumbbell size={14} />, color: "text-orange-400" },
//   { key: "tech",     label: "Tech",     icon: <Code2 size={14} />,    color: "text-purple-400" },
// ] as const;

// type CategoryKey = typeof CATEGORIES[number]["key"];

// // ─── Score fetchers ────────────────────────────────────────────────────────

// // ✅ FIXED: Now reads EXACTLY from your Python backend so it matches the Tune-In page
// async function fetchOverallLeaderboard(): Promise<LeaderboardEntry[]> {
//   try {
//     const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";
//     const res = await fetch(`${API_URL}/api/tune-in/leaderboard?top_k=50`);
//     if (!res.ok) throw new Error("Backend leaderboard failed");
    
//     const backendData = await res.json();
//     if (!backendData || backendData.length === 0) return [];

//     const userIds = backendData.map((b: any) => b.user_id);
//     const { data: profiles } = await supabase.from("profiles").select("id, username, avatar_url").in("id", userIds);
//     const profileMap = new Map(profiles?.map((p) => [p.id, p]));

//     return backendData.map((b: any) => ({
//       user_id: b.user_id,
//       username: profileMap.get(b.user_id)?.username || "User",
//       avatar_url: profileMap.get(b.user_id)?.avatar_url || null,
//       score: Math.round(b.total_score), // EXACT score from Python
//       breakdown: { likes: b.likes_count, clubs: b.clubs_count }
//     }));
//   } catch (error) {
//     console.error("Overall fetch failed:", error);
//     return [];
//   }
// }

// // Wrapped all others in try/catch so empty tables (like Strava) don't crash the whole app
// async function fetchCinemaLeaderboard(): Promise<LeaderboardEntry[]> {
//   try {
//     const [{ data: profiles }, { data: reviews }] = await Promise.all([
//       supabase.from("profiles").select("id, username, avatar_url"),
//       supabase.from("movie_reviews").select("user_id"),
//     ]);
//     const scoreMap: Record<string, number> = {};
//     reviews?.forEach((r) => { scoreMap[r.user_id] = (scoreMap[r.user_id] ?? 0) + 1; });
//     return (profiles ?? []).map((p) => ({ user_id: p.id, username: p.username || "User", avatar_url: p.avatar_url, score: scoreMap[p.id] ?? 0, breakdown: { movies: scoreMap[p.id] ?? 0 } })).filter((e) => e.score > 0).sort((a, b) => b.score - a.score).slice(0, 50);
//   } catch { return []; }
// }

// async function fetchAnimeLeaderboard(): Promise<LeaderboardEntry[]> {
//   try {
//     const [{ data: profiles }, { data: reviews }] = await Promise.all([
//       supabase.from("profiles").select("id, username, avatar_url"),
//       supabase.from("anime_reviews").select("user_id"),
//     ]);
//     const scoreMap: Record<string, number> = {};
//     reviews?.forEach((r) => { scoreMap[r.user_id] = (scoreMap[r.user_id] ?? 0) + 1; });
//     return (profiles ?? []).map((p) => ({ user_id: p.id, username: p.username || "User", avatar_url: p.avatar_url, score: scoreMap[p.id] ?? 0, breakdown: { anime: scoreMap[p.id] ?? 0 } })).filter((e) => e.score > 0).sort((a, b) => b.score - a.score).slice(0, 50);
//   } catch { return []; }
// }

// async function fetchGamingLeaderboard(): Promise<LeaderboardEntry[]> {
//   try {
//     const [{ data: profiles }, { data: reviews }] = await Promise.all([
//       supabase.from("profiles").select("id, username, avatar_url"),
//       supabase.from("game_reviews").select("user_id"),
//     ]);
//     const scoreMap: Record<string, number> = {};
//     reviews?.forEach((r) => { scoreMap[r.user_id] = (scoreMap[r.user_id] ?? 0) + 1; });
//     return (profiles ?? []).map((p) => ({ user_id: p.id, username: p.username || "User", avatar_url: p.avatar_url, score: scoreMap[p.id] ?? 0, breakdown: { games: scoreMap[p.id] ?? 0 } })).filter((e) => e.score > 0).sort((a, b) => b.score - a.score).slice(0, 50);
//   } catch { return []; }
// }

// async function fetchFitnessLeaderboard(): Promise<LeaderboardEntry[]> {
//   try {
//     const [{ data: profiles }, { data: strava }] = await Promise.all([
//       supabase.from("profiles").select("id, username, avatar_url"),
//       supabase.from("strava_stats").select("user_id, score")
//     ]);
//     const scoreMap: Record<string, number> = {};
//     strava?.forEach(s => { scoreMap[s.user_id] = (scoreMap[s.user_id] || 0) + (s.score || 0); });
//     return (profiles ?? []).map(p => ({ user_id: p.id, username: p.username || "User", avatar_url: p.avatar_url, score: scoreMap[p.id] ? Math.round(scoreMap[p.id] * 10) / 10 : 0, breakdown: { fitness: scoreMap[p.id] ?? 0 } })).filter(e => e.score > 0).sort((a,b) => b.score - a.score).slice(0, 50);
//   } catch { return []; }
// }

// async function fetchTechLeaderboard(): Promise<LeaderboardEntry[]> {
//   try {
//     const [{ data: profiles }, { data: github }, { data: clubs }] = await Promise.all([
//       supabase.from("profiles").select("id, username, avatar_url"),
//       supabase.from("github_stats").select("user_id, total_commits, streak_days"),
//       supabase.from("club_members").select("user_id, clubs!inner(name)").ilike("clubs.name", "%tech%")
//     ]);
//     const scoreMap: Record<string, number> = {};
//     github?.forEach(g => { scoreMap[g.user_id] = (scoreMap[g.user_id] || 0) + (g.total_commits || 0) * 1.0 + (g.streak_days || 0) * 5.0; });
//     clubs?.forEach(c => { scoreMap[c.user_id] = (scoreMap[c.user_id] || 0) + 15.0; });
//     return (profiles ?? []).map(p => ({ user_id: p.id, username: p.username || "User", avatar_url: p.avatar_url, score: scoreMap[p.id] ?? 0, breakdown: { tech: scoreMap[p.id] ?? 0 } })).filter(e => e.score > 0).sort((a,b) => b.score - a.score).slice(0, 50);
//   } catch { return []; }
// }

// // ─── Avatar, Badge, ScoreBar ───────────────────────────────────────────────
// const Avatar = ({ url, username, size = 36 }: { url: string | null; username: string | null; size?: number }) => {
//   const safeName = username || "??"; 
//   const initials = safeName.slice(0, 2).toUpperCase();
//   return url ? <img src={url} alt={safeName} style={{ width: size, height: size }} className="rounded-full object-cover" /> : <div style={{ width: size, height: size }} className="rounded-full bg-muted flex items-center justify-center text-muted-foreground font-medium text-xs">{initials}</div>;
// };

// const RankBadge = ({ rank }: { rank: number }) => {
//   if (rank === 1) return <span className="text-lg">🥇</span>;
//   if (rank === 2) return <span className="text-lg">🥈</span>;
//   if (rank === 3) return <span className="text-lg">🥉</span>;
//   return <span className="text-sm text-muted-foreground font-medium w-6 text-center">{rank}</span>;
// };

// const ScoreBar = ({ score, max }: { score: number; max: number }) => (
//   <div className="w-20 h-1.5 bg-muted rounded-full overflow-hidden">
//     <motion.div className="h-full bg-primary rounded-full" initial={{ width: 0 }} animate={{ width: `${max > 0 ? (score / max) * 100 : 0}%` }} transition={{ duration: 0.6, ease: "easeOut" }} />
//   </div>
// );

// // ─── Main component ────────────────────────────────────────────────────────
// const Leaderboard = () => {
//   const navigate = useNavigate();
//   const [category, setCategory] = useState<CategoryKey>("overall");
//   const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
//   const [loading, setLoading] = useState(false);
//   const [currentUserId, setCurrentUserId] = useState<string | null>(null);
//   const [currentUserRank, setCurrentUserRank] = useState<number | null>(null);

//   useEffect(() => { supabase.auth.getSession().then(({ data: { session } }) => setCurrentUserId(session?.user?.id ?? null)); }, []);

//   useEffect(() => {
//     setLoading(true);
//     const load = async () => {
//       let data: LeaderboardEntry[] = [];
//       if (category === "overall")       data = await fetchOverallLeaderboard();
//       else if (category === "cinema")   data = await fetchCinemaLeaderboard();
//       else if (category === "anime")    data = await fetchAnimeLeaderboard();
//       else if (category === "gaming")   data = await fetchGamingLeaderboard();
//       else if (category === "tech")     data = await fetchTechLeaderboard();
//       else if (category === "fitness")  data = await fetchFitnessLeaderboard();
      
//       setEntries(data);
//       if (currentUserId) {
//         const idx = data.findIndex(e => e.user_id === currentUserId);
//         setCurrentUserRank(idx >= 0 ? idx + 1 : null);
//       }
//       setLoading(false);
//     };
//     load();
//   }, [category, currentUserId]);

//   const maxScore = entries[0]?.score ?? 1;
//   const topThree = entries.slice(0, 3);
//   const catMeta = CATEGORIES.find((c) => c.key === category)!;

//   return (
//     <div className="h-screen bg-background flex flex-col overflow-hidden">
//       <header className="h-14 border-b border-border flex items-center px-5 gap-4 flex-shrink-0">
//         <button onClick={() => navigate(-1)} className="text-muted-foreground hover:text-foreground transition-colors"><ArrowLeft size={18} /></button>
//         <div className="flex items-center gap-2"><TrendingUp size={16} className="text-primary" /><span className="text-sm font-medium">Leaderboard</span></div>
//         {currentUserRank && <span className="ml-auto text-xs text-muted-foreground">Your rank: <span className="text-foreground font-medium">#{currentUserRank}</span></span>}
//       </header>

//       <div className="flex-1 overflow-y-auto scrollbar-thin scrollbar-thumb-muted">
//         <div className="max-w-2xl mx-auto px-5 py-6 space-y-6">
//           <div className="flex gap-2 flex-wrap">
//             {CATEGORIES.map((c) => (
//               <button key={c.key} onClick={() => setCategory(c.key)} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${category === c.key ? "bg-primary/10 text-primary border border-primary/30" : "text-muted-foreground border border-border hover:border-foreground/20 hover:text-foreground"}`}>
//                 <span className={category === c.key ? c.color : ""}>{c.icon}</span>{c.label}
//               </button>
//             ))}
//           </div>

//           {loading ? (
//             <div className="space-y-3">{Array.from({ length: 8 }).map((_, i) => <div key={i} className="h-16 rounded-xl bg-muted/40 animate-pulse" />)}</div>
//           ) : entries.length === 0 ? (
//             <div className="py-20 text-center text-muted-foreground text-sm">No data yet for this category</div>
//           ) : (
//             <AnimatePresence mode="wait">
//               <motion.div key={category} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.18 }} className="space-y-4">
//                 {topThree.length >= 3 && (
//                   <div className="rounded-2xl border border-border bg-card p-5">
//                     <p className="text-xs font-semibold tracking-wider text-muted-foreground uppercase mb-5">{catMeta.label} Top 3</p>
//                     <div className="flex items-end justify-center gap-4">
//                       <PodiumCard entry={topThree[1]} rank={2} height="h-24" navigate={navigate} />
//                       <PodiumCard entry={topThree[0]} rank={1} height="h-32" navigate={navigate} highlight />
//                       <PodiumCard entry={topThree[2]} rank={3} height="h-20" navigate={navigate} />
//                     </div>
//                   </div>
//                 )}
//                 <div className="rounded-2xl border border-border bg-card divide-y divide-border overflow-hidden">
//                   {entries.map((entry, idx) => {
//                     const isMe = entry.user_id === currentUserId;
//                     const safeName = entry.username || "User";
//                     return (
//                       <motion.div key={entry.user_id} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: idx * 0.03 }} onClick={() => navigate(`/user/${safeName}`)} className={`flex items-center gap-4 px-5 py-3.5 hover:bg-muted/40 cursor-pointer transition-colors ${isMe ? "bg-primary/5" : ""}`}>
//                         <div className="w-8 flex items-center justify-center flex-shrink-0"><RankBadge rank={idx + 1} /></div>
//                         <Avatar url={entry.avatar_url} username={safeName} />
//                         <div className="flex-1 min-w-0">
//                           <div className="flex items-center gap-2"><span className={`text-sm font-medium ${isMe ? "text-primary" : ""}`}>@{safeName}</span>{isMe && <span className="text-xs px-1.5 py-0.5 rounded-full bg-primary/10 text-primary">you</span>}</div>
//                           <BreakdownLine entry={entry} category={category} />
//                         </div>
//                         <div className="flex flex-col items-end gap-1.5 flex-shrink-0"><span className="text-sm font-semibold tabular-nums">{entry.score.toLocaleString()}</span><ScoreBar score={entry.score} max={maxScore} /></div>
//                       </motion.div>
//                     );
//                   })}
//                 </div>
//                 <ScoringNote category={category} />
//               </motion.div>
//             </AnimatePresence>
//           )}
//         </div>
//       </div>
//     </div>
//   );
// };

// const PodiumCard = ({ entry, rank, height, navigate }: any) => {
//   const safeName = entry.username || "User"; 
//   return (
//     <div className="flex flex-col items-center gap-2 cursor-pointer" onClick={() => navigate(`/user/${safeName}`)}>
//       <div className={`relative ${rank === 1 ? "ring-2 ring-yellow-400/60 rounded-full" : ""}`}>
//         <Avatar url={entry.avatar_url} username={safeName} size={rank === 1 ? 56 : 40} />
//       </div>
//       <span className="text-xs text-muted-foreground truncate max-w-[72px]">@{safeName}</span>
//       <div className={`${height} w-20 rounded-t-xl flex flex-col items-center justify-end pb-3 gap-1 ${rank === 1 ? "bg-yellow-400/10 border border-yellow-400/20" : "bg-muted/40 border border-border"}`}>
//         <RankBadge rank={rank} /><span className={`text-xs font-semibold ${rank === 1 ? "text-yellow-400" : "text-muted-foreground"}`}>{entry.score.toLocaleString()}</span>
//       </div>
//     </div>
//   );
// };

// const BreakdownLine = ({ entry, category }: { entry: LeaderboardEntry; category: CategoryKey }) => {
//   const { breakdown } = entry;
//   const parts: string[] = [];
//   if (category === "overall") {
//     if (breakdown.likes) parts.push(`${breakdown.likes} likes`);
//     if (breakdown.clubs) parts.push(`${breakdown.clubs} clubs`);
//   } else if (category === "tech") {
//     if (breakdown.tech) parts.push(`${breakdown.tech} points`);
//   } else if (category === "fitness") {
//     if (breakdown.fitness) parts.push(`${breakdown.fitness} points`);
//   } else {
//     if (breakdown.movies) parts.push(`${breakdown.movies} films`);
//     if (breakdown.anime)  parts.push(`${breakdown.anime} series`);
//     if (breakdown.games)  parts.push(`${breakdown.games} games`);
//   }
//   return <p className="text-xs text-muted-foreground truncate mt-0.5">{parts.join(" · ") || "No activity"}</p>;
// };

// const ScoringNote = ({ category }: { category: CategoryKey }) => {
//   const notes: Record<CategoryKey, string> = {
//     overall:  "AI Calculated Graph Influence Score",
//     cinema:   "Score = total movies reviewed",
//     anime:    "Score = total anime reviewed",
//     gaming:   "Score = total games reviewed",
//     tech:     "Score = GitHub commits + (streak × 5) + (Tech clubs × 15)",
//     fitness:  "Score = Calculated via Strava distance & elevation",
//   };
//   return <p className="text-center text-xs text-muted-foreground/60 pb-2">{notes[category]}</p>;
// };

// export default Leaderboard;