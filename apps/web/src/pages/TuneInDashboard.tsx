import { useState, useEffect, useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "@/lib/supabase";
import {
  ArrowLeft, Sparkles, Heart, Github, Activity,
  Trophy, ChevronRight, Film, Gamepad2, Dumbbell,
  Code2, Users, Target, Star, Zap, TrendingUp,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

interface ActivityData {
  clubs: string[];
  post_likes: { posts: { title: string; category: string } | null }[];
  strava: { total_distance_km: number; total_elevation_m: number; total_moving_time_hrs: number; score: number } | null;
  github: { username: string; total_commits: number; streak_days: number; score: number } | null;
  movie_reviews: { title?: string; rating?: number }[];
  game_reviews:  { title?: string; rating?: number }[];
  hgt_score: number;
}

interface SimilarUser {
  user_id: string; username: string; avatar_url: string | null;
  score: number; match_pct: number; role: "mentor" | "mentee";
  shared_clubs: string[]; shared_categories: string[];
  activity?: ActivityData;
}

interface DashboardData {
  total_score: number; rank: number | null; total_users: number;
  top_similar: SimilarUser[]; mentors: SimilarUser[]; mentees: SimilarUser[];
}

interface LBEntry {
  rank: number; user_id: string; username: string; avatar_url: string | null;
  total_score: number; base_score: number; match_count: number;
  similarity_to_me: number | null; is_current_user: boolean;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const API = import.meta.env.VITE_API_URL || "http://localhost:8000";

async function apiFetch<T>(path: string, token: string): Promise<T | null> {
  try {
    const res = await fetch(`${API}${path}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) { console.error(`${path} → ${res.status}`); return null; }
    return res.json();
  } catch (e) { console.error(path, e); return null; }
}

// ─── Small components ─────────────────────────────────────────────────────────

const Avatar = ({ url, name, size = 36 }: { url: string | null; name: string; size?: number }) => {
  const init = (name || "?").slice(0, 2).toUpperCase();
  return url ? (
    <img src={url} alt={name} style={{ width: size, height: size }}
      className="rounded-full object-cover flex-shrink-0 ring-1 ring-white/10" />
  ) : (
    <div 
      className="rounded-full flex-shrink-0 ring-1 ring-white/10 flex items-center justify-center text-xs font-bold"
      style={{ width: size, height: size, background: "linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)", color: "#fff" }}>
      {init}
    </div>
  );
};

const Pill = ({ children, glow }: { children: React.ReactNode; glow?: boolean }) => (
  <span className={`inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-widest px-2.5 py-1 rounded-full border ${
    glow
      ? "bg-violet-500/20 text-violet-300 border-violet-500/40"
      : "bg-white/5 text-white/50 border-white/10"
  }`}>{children}</span>
);

const MatchRing = ({ pct }: { pct: number }) => {
  const c = pct >= 70 ? "#34d399" : pct >= 40 ? "#60a5fa" : "#a78bfa";
  const r = 16, circ = 2 * Math.PI * r;
  const dash = (pct / 100) * circ;
  return (
    <svg width="40" height="40" viewBox="0 0 40 40" className="flex-shrink-0">
      <circle cx="20" cy="20" r={r} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="3" />
      <circle cx="20" cy="20" r={r} fill="none" stroke={c} strokeWidth="3"
        strokeDasharray={`${dash} ${circ}`} strokeLinecap="round"
        transform="rotate(-90 20 20)" />
      <text x="20" y="24" textAnchor="middle" fontSize="9" fontWeight="700" fill={c}>{pct}%</text>
    </svg>
  );
};

// ─── Path card (main left panel content) ─────────────────────────────────────

const PathCard = ({ user, myClubs }: { user: SimilarUser; myClubs: string[] }) => {
  const a = user.activity;

  const sections: { icon: React.ReactNode; label: string; sub: string; shared: boolean }[] = [];

  if (a?.github) {
    sections.push({
      icon: <Code2 size={14} />,
      label: `${a.github.total_commits} commits`,
      sub: `${a.github.streak_days}-day streak`,
      shared: false,
    });
  }
  if (a?.strava) {
    sections.push({
      icon: <Dumbbell size={14} />,
      label: `${a.strava.total_distance_km} km`,
      sub: `${a.strava.total_moving_time_hrs}h moving`,
      shared: false,
    });
  }
  a?.clubs?.forEach(c => {
    sections.push({
      icon: <Users size={14} />,
      label: c,
      sub: "club",
      shared: user.shared_clubs.includes(c) || myClubs.includes(c),
    });
  });
  a?.movie_reviews?.slice(0, 3).forEach(m => {
    if (m.title) sections.push({
      icon: <Film size={14} />,
      label: m.title,
      sub: m.rating ? `${m.rating}/10` : "reviewed",
      shared: false,
    });
  });
  a?.game_reviews?.slice(0, 3).forEach(g => {
    if (g.title) sections.push({
      icon: <Gamepad2 size={14} />,
      label: g.title,
      sub: g.rating ? `${g.rating}/10` : "reviewed",
      shared: false,
    });
  });
  a?.post_likes?.slice(0, 3).forEach(like => {
    if (like.posts?.title) sections.push({
      icon: <Heart size={14} />,
      label: like.posts.title,
      sub: like.posts.category || "liked",
      shared: user.shared_categories.includes((like.posts.category || "").toLowerCase()),
    });
  });

  const isEmpty = sections.length === 0;

  return (
    <div className="rounded-2xl border border-white/8 bg-gradient-to-b from-white/5 to-transparent overflow-hidden">
      {/* Header */}
      <div className="px-6 py-5 border-b border-white/8 flex items-center gap-4">
        <div className="relative">
          <Avatar url={user.avatar_url} name={user.username} size={52} />
          <div className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full border-2 border-background flex items-center justify-center"
            style={{ background: user.role === "mentor" ? "#34d399" : "#60a5fa" }}>
            {user.role === "mentor"
              ? <Sparkles size={9} className="text-white" />
              : <TrendingUp size={9} className="text-white" />}
          </div>
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-base font-black tracking-tight truncate">@{user.username}</p>
          <div className="flex items-center gap-2 mt-1 flex-wrap">
            <Pill glow>{user.match_pct}% match</Pill>
            <Pill><Trophy size={9} /> {user.score} pts</Pill>
            <Pill>{user.role}</Pill>
          </div>
        </div>
        <MatchRing pct={user.match_pct} />
      </div>

      {/* Shared interests bar */}
      {(user.shared_clubs.length > 0 || user.shared_categories.length > 0) && (
        <div className="px-6 py-3 border-b border-white/5 bg-violet-500/5 flex flex-wrap gap-1.5 items-center">
          <Zap size={11} className="text-violet-400 flex-shrink-0" />
          <span className="text-[10px] text-violet-400 font-bold uppercase tracking-widest mr-1">Shared</span>
          {[...user.shared_clubs, ...user.shared_categories].map(item => (
            <span key={item}
              className="text-[10px] px-2 py-0.5 rounded-md bg-violet-500/15 text-violet-300 border border-violet-500/25 capitalize font-semibold">
              {item}
            </span>
          ))}
        </div>
      )}

      {/* Activity path */}
      <div className="px-6 py-5">
        {isEmpty ? (
          <div className="text-center py-8 text-white/30 text-sm">
            No activity data available yet.
          </div>
        ) : (
          <div className="relative space-y-0">
            {/* Vertical line */}
            <div className="absolute left-[19px] top-5 bottom-5 w-px bg-gradient-to-b from-white/15 via-white/8 to-transparent" />
            {sections.map((s, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.04 }}
                className={`flex items-start gap-4 py-3 ${i > 0 ? "border-t border-white/4" : ""}`}
              >
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 z-10 transition-all ${
                  s.shared
                    ? "bg-violet-500/20 text-violet-300 ring-1 ring-violet-500/40"
                    : "bg-white/5 text-white/40"
                }`}>
                  {s.icon}
                </div>
                <div className="pt-1 min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className={`text-sm font-semibold truncate ${s.shared ? "text-white" : "text-white/60"}`}>
                      {s.label}
                    </p>
                    {s.shared && (
                      <span className="text-[9px] font-black uppercase tracking-widest text-violet-400 bg-violet-500/10 px-1.5 py-0.5 rounded-full border border-violet-500/20 flex-shrink-0">
                        shared
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-white/30 capitalize mt-0.5">{s.sub}</p>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

// ─── Match button (right panel - Typed for SimilarUser) ─────────────────────────

const MatchBtn = ({
  user, active, onClick,
}: { user: SimilarUser; active: boolean; onClick: () => void }) => (
  <motion.button
    initial={{ opacity: 0, x: 12 }}
    animate={{ opacity: 1, x: 0 }}
    whileHover={{ scale: 1.01 }}
    whileTap={{ scale: 0.98 }}
    onClick={onClick}
    className={`w-full text-left flex items-center gap-3 p-4 rounded-2xl border transition-all ${
      active
        ? "bg-violet-500/10 border-violet-500/40 shadow-lg shadow-violet-500/5"
        : "bg-white/3 border-white/8 hover:border-white/15 hover:bg-white/5"
    }`}
  >
    <div className="relative flex-shrink-0">
      <Avatar url={user.avatar_url} name={user.username} size={42} />
    </div>
    <div className="flex-1 min-w-0">
      <p className="text-sm font-bold truncate">@{user.username}</p>
      <div className="flex items-center gap-2 mt-0.5">
        <span className="text-xs text-white/40">{user.score} pts</span>
        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
          user.match_pct >= 60
            ? "text-emerald-400 bg-emerald-500/10"
            : "text-blue-400 bg-blue-500/10"
        }`}>
          {user.match_pct}% match
        </span>
      </div>
    </div>
    {active && <ChevronRight size={14} className="text-violet-400 flex-shrink-0" />}
  </motion.button>
);

// ─── Main ─────────────────────────────────────────────────────────────────────

export default function TuneInDashboard() {
  const navigate = useNavigate();

  const [token, setToken]         = useState<string | null>(null);
  const [userId, setUserId]       = useState<string | null>(null);
  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [leaderboard, setLeaderboard] = useState<LBEntry[]>([]);
  const [loading, setLoading]     = useState(true);
  const [activeTargetId, setActiveTargetId] = useState<string | null>(null);

  // Local node stats
  const [clubsCount, setClubsCount] = useState(0);
  const [likesCount, setLikesCount] = useState(0);
  const [githubConn, setGithubConn] = useState(false);
  const [stravaConn, setStravaConn] = useState(false);
  const [myClubs, setMyClubs]       = useState<string[]>([]);

  // ── Auth ────────────────────────────────────────────────────────────────
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) { navigate("/login"); return; }
      setToken(session.access_token);
      setUserId(session.user.id);
    });
  }, [navigate]);

  useEffect(() => {
    if (!token || !userId) return;
    boot(token, userId);
  }, [token, userId]);

  const boot = useCallback(async (tok: string, uid: string) => {
    setLoading(true);
    await Promise.all([
      apiFetch<DashboardData>("/api/tune-in/dashboard", tok).then(d => d && setDashboard(d)),
      apiFetch<LBEntry[]>("/api/tune-in/leaderboard?top_k=50", tok).then(d => d && setLeaderboard(d)),
      (async () => {
        const [
          { count: cc, data: cd },
          { count: lc },
          { data: gh },
          { data: st },
        ] = await Promise.all([
          supabase.from("club_members").select("clubs(name)", { count: "exact" }).eq("user_id", uid),
          supabase.from("post_reactions").select("id", { count: "exact", head: true }).eq("user_id", uid).eq("reaction", "like"),
          supabase.from("github_stats").select("user_id").eq("user_id", uid),
          supabase.from("strava_stats").select("user_id").eq("user_id", uid),
        ]);
        setClubsCount(cc ?? 0);
        setLikesCount(lc ?? 0);
        setGithubConn((gh?.length ?? 0) > 0);
        setStravaConn((st?.length ?? 0) > 0);
        setMyClubs((cd || []).map((r: any) => r.clubs?.name?.toLowerCase()).filter(Boolean));
      })(),
    ]);
    setLoading(false);
  }, []);

  // ── Derived: my rank + top matches ────────────────────────────────────
  const myEntry = useMemo(
    () => leaderboard.find(e => e.is_current_user || e.user_id === userId),
    [leaderboard, userId]
  );
  const myRank = myEntry?.rank ?? null;

  // Replace targetsAhead with the top_similar from the Python Backend
  const topMatches = useMemo(() => {
    if (!dashboard?.top_similar) return [];
    return dashboard.top_similar;
  }, [dashboard]);

  // Default: auto-select top closest match for the center tab
  useEffect(() => {
    if (topMatches.length > 0 && !activeTargetId) {
      setActiveTargetId(topMatches[0].user_id);
    }
  }, [topMatches, activeTargetId]);

  // Resolve the full SimilarUser for the path view
  const activeUser = useMemo((): SimilarUser | null => {
    if (!activeTargetId) return null;
    const fromDash = [
      ...(dashboard?.top_similar ?? []),
      ...(dashboard?.mentors ?? []),
      ...(dashboard?.mentees ?? []),
    ].find(u => u.user_id === activeTargetId);
    if (fromDash) return fromDash;
    
    // Fallback: build minimal SimilarUser from leaderboard entry
    const lb = leaderboard.find(e => e.user_id === activeTargetId);
    if (!lb) return null;
    return {
      user_id: lb.user_id, username: lb.username, avatar_url: lb.avatar_url,
      score: lb.total_score, match_pct: lb.similarity_to_me ?? 0,
      role: "mentor", shared_clubs: [], shared_categories: [],
      activity: undefined,
    };
  }, [activeTargetId, dashboard, leaderboard]);

  // Score display — prefer backend, fallback to local calculation
  const localScore = (clubsCount * 15) + (likesCount * 2) +
    (githubConn ? 10 : 0) + (stravaConn ? 10 : 0);
  const displayScore = (dashboard?.total_score ?? 0) > 0 ? dashboard!.total_score : localScore;
  const displayRank  = dashboard?.rank ?? myRank;
  const totalUsers   = dashboard?.total_users ?? leaderboard.length;

  if (loading) {
    return (
      <div className="h-screen bg-[#080808] flex items-center justify-center">
        <div className="space-y-4 w-full max-w-xl px-6">
          <div className="h-40 rounded-3xl bg-white/3 animate-pulse" />
          <div className="grid grid-cols-2 gap-4">
            <div className="h-72 rounded-3xl bg-white/3 animate-pulse" />
            <div className="h-72 rounded-3xl bg-white/3 animate-pulse" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen bg-[#080808] text-white flex flex-col overflow-hidden"
      style={{ fontFamily: "'DM Sans', sans-serif" }}>

      {/* Header */}
      <header className="h-14 border-b border-white/6 flex items-center px-5 gap-3 flex-shrink-0 bg-[#080808]/80 backdrop-blur-md z-10">
        <button onClick={() => navigate(-1)}
          className="w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center text-white/50 hover:text-white transition-all">
          <ArrowLeft size={15} />
        </button>
        <div className="w-7 h-7 rounded-lg bg-violet-500/20 flex items-center justify-center">
          <Sparkles size={14} className="text-violet-400" />
        </div>
        <span className="text-sm font-black tracking-tight">Tune-In Engine</span>
      </header>

      <div className="flex-1 overflow-y-auto" style={{ scrollbarWidth: "none" }}>
        <div className="max-w-5xl mx-auto px-5 py-6 space-y-5">

          {/* ── Hero row ──────────────────────────────────────────────── */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">

            {/* Score card */}
            <div className="md:col-span-2 rounded-3xl border border-white/8 p-7 relative overflow-hidden"
              style={{ background: "linear-gradient(135deg, rgba(109,40,217,0.12) 0%, rgba(8,8,8,0) 60%)" }}>
              {/* glow blob */}
              <div className="absolute top-0 left-0 w-56 h-56 rounded-full blur-3xl opacity-20 pointer-events-none"
                style={{ background: "radial-gradient(circle, #7c3aed, transparent 70%)", transform: "translate(-30%, -30%)" }} />
              <p className="text-[10px] font-black tracking-[0.2em] text-violet-400 uppercase mb-2">Total Influence Score</p>
              <div className="flex items-end gap-5">
                <p className="text-7xl font-black tabular-nums leading-none"
                  style={{ background: "linear-gradient(135deg, #fff 0%, rgba(255,255,255,0.6) 100%)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
                  {displayScore}
                </p>
                {displayRank && (
                  <div className="mb-2">
                    <p className="text-xs text-white/30 mb-0.5">Global Graph Rank</p>
                    <p className="text-2xl font-black text-white/70">
                      #{displayRank}
                      <span className="text-sm text-white/25 font-normal"> / {totalUsers}</span>
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Active nodes card */}
            <div className="rounded-3xl border border-white/8 bg-white/3 p-5 flex flex-col justify-center gap-4">
              <p className="text-[10px] font-black tracking-[0.18em] text-white/30 uppercase text-center">Active Nodes</p>
              <div className="grid grid-cols-2 gap-3">
                {[
                  { icon: <Users size={16} />, label: "Clubs", active: clubsCount > 0, pts: clubsCount * 15 },
                  { icon: <Heart size={16} />, label: "Liked", active: likesCount > 0, pts: likesCount * 2 },
                  { icon: <Code2 size={16} />, label: "GitHub", active: githubConn, pts: githubConn ? 10 : 0 },
                  { icon: <Activity size={16} />, label: "Strava", active: stravaConn, pts: stravaConn ? 10 : 0 },
                ].map(node => (
                  <div key={node.label}
                    className={`rounded-xl p-3 flex flex-col items-center gap-1.5 border transition-all ${
                      node.active
                        ? "border-violet-500/30 bg-violet-500/10 text-violet-300"
                        : "border-white/5 bg-white/3 text-white/20"
                    }`}>
                    {node.icon}
                    <span className="text-[10px] font-bold">{node.label}</span>
                    {node.active && node.pts > 0 && (
                      <span className="text-[9px] font-black text-violet-400">+{node.pts}</span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* ── Main section: Path + Targets ──────────────────────────── */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

            {/* Left: Path configuration (2 cols) */}
            <div className="lg:col-span-2 space-y-4">
              <div className="flex items-center gap-2">
                <Target size={16} className="text-violet-400" />
                <h2 className="text-sm font-black tracking-widest uppercase text-white/70">Path Configuration</h2>
                <span className="text-xs text-white/25 ml-1">· analyse your closest match</span>
              </div>

              <AnimatePresence mode="wait">
                {activeUser ? (
                  <motion.div
                    key={activeUser.user_id}
                    initial={{ opacity: 0, y: 8, scale: 0.99 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -8, scale: 0.99 }}
                    transition={{ duration: 0.18 }}
                  >
                    <PathCard user={activeUser} myClubs={myClubs} />
                  </motion.div>
                ) : (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="h-64 rounded-2xl border border-dashed border-white/8 flex flex-col items-center justify-center gap-3 text-white/25"
                  >
                    <Star size={28} strokeWidth={1.5} />
                    <p className="text-sm font-medium">
                      {topMatches.length === 0
                        ? "You lead your immediate graph. Keep going."
                        : "Select a match from the right panel."}
                    </p>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Right: Closest Matches (1 col) */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-[10px] font-black tracking-[0.18em] text-white/30 uppercase">Closest Matches</p>
                <button onClick={() => navigate("/leaderboard")}
                  className="text-[10px] text-violet-400 hover:text-violet-300 font-bold uppercase tracking-widest flex items-center gap-1 transition-colors">
                  All <ChevronRight size={10} />
                </button>
              </div>

              {topMatches.length === 0 ? (
                <div className="rounded-2xl border border-white/6 bg-white/3 p-5 text-center text-white/25 text-sm">
                  {myRank === 1 
                    ? "You lead the graph. No close matches yet." 
                    : "No similar users found."}
                </div>
              ) : (
                <div className="space-y-2">
                  {topMatches.map(user => (
                    <MatchBtn
                      key={user.user_id}
                      user={user}
                      active={activeTargetId === user.user_id}
                      onClick={() => setActiveTargetId(user.user_id)}
                    />
                  ))}
                </div>
              )}

              {/* Mini leaderboard: top 5 always visible */}
              <div className="mt-4">
                <p className="text-[10px] font-black tracking-[0.18em] text-white/30 uppercase mb-2">Top Graph Influencers</p>
                <div className="rounded-2xl border border-white/8 bg-white/3 overflow-hidden divide-y divide-white/5">
                  {leaderboard.slice(0, 5).map((e, i) => {
                    const isMe = e.is_current_user || e.user_id === userId;
                    return (
                      <div key={e.user_id}
                        onClick={() => navigate(`/user/${e.username}`)}
                        className={`flex items-center gap-3 px-4 py-3 cursor-pointer transition-colors hover:bg-white/5 ${isMe ? "bg-violet-500/5" : ""}`}>
                        <span className="text-sm w-5 text-center font-black text-white/25">
                          {i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : `${i + 1}`}
                        </span>
                        <Avatar url={e.avatar_url} name={e.username} size={28} />
                        <span className={`text-xs font-semibold flex-1 truncate ${isMe ? "text-violet-300" : "text-white/70"}`}>
                          @{e.username} {isMe && <span className="text-[9px] text-violet-400/60">(you)</span>}
                        </span>
                        <span className="text-xs font-bold tabular-nums text-white/50">{e.total_score}</span>
                      </div>
                    );
                  })}
                  {myEntry && !leaderboard.slice(0, 5).some(e => e.is_current_user || e.user_id === userId) && (
                    <>
                      <div className="px-4 py-1 text-center text-[10px] text-white/15">· · ·</div>
                      <div className="flex items-center gap-3 px-4 py-3 bg-violet-500/5">
                        <span className="text-xs w-5 text-center font-black text-violet-400">#{myEntry.rank}</span>
                        <Avatar url={myEntry.avatar_url} name={myEntry.username} size={28} />
                        <span className="text-xs font-semibold flex-1 truncate text-violet-300">
                          @{myEntry.username} <span className="text-[9px] text-violet-400/60">(you)</span>
                        </span>
                        <span className="text-xs font-bold tabular-nums text-white/50">{myEntry.total_score}</span>
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}