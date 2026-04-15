import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "@/lib/supabase";
import { 
  ArrowLeft, Trophy, Film, Gamepad2, Github, Music, 
  Dumbbell, TrendingUp, Sparkles, ChevronRight, AlertCircle, Link2
} from "lucide-react";


// Simulates the HGT Graph Response for the current user
async function fetchHGTProfile(userId: string) {
  try {
    const res = await fetch(`/api/tune-in/dashboard?user_id=${userId}`);

    if (!res.ok) throw new Error("API failed");

    const data = await res.json();

    return {
      total_score: data.total_score ?? 0,
      rank: data.rank ?? 0,
      points_to_next_rank: data.points_to_next_rank ?? 0,

      api_connections: data.api_connections ?? [],

      recommendations: data.recommendations ?? []
    };

  } catch (err) {
    console.warn("Fallback triggered:", err);

    // 🧠 FALLBACK MODE (NO API YET)
    return {
      total_score: 0,
      rank: 0,
      points_to_next_rank: 0,

      api_connections: [
        { id: "cinema", name: "Cinema", points: 0, connected: false },
        { id: "games", name: "Games", points: 0, connected: false },
        { id: "music", name: "Spotify", points: 0, connected: false },
        { id: "tech", name: "GitHub", points: 0, connected: false },
        { id: "fitness", name: "Strava", points: 0, connected: false },
      ],

      recommendations: [
        {
          id: "r1",
          title: "Connect your accounts",
          subtitle: "Start earning points instantly 🚀",
          impact: "+100 Pts"
        }
      ]
    };
  }
}
// ─── UI Helpers ────────────────────────────────────────────────────────────

const Avatar = ({ url, title, size = 36 }: { url: string | null; title: string; size?: number }) => {
  const initials = title.replace('@', '').slice(0, 2).toUpperCase() || "??";
  return url ? (
    <img src={url} alt={title} style={{ width: size, height: size }} className="rounded-full object-cover shadow-sm" />
  ) : (
    <div style={{ width: size, height: size }} className="rounded-full bg-muted flex items-center justify-center text-muted-foreground font-bold text-[10px] shadow-sm tracking-wider">
      {initials}
    </div>
  );
};

// ─── Main Component ────────────────────────────────────────────────────────

export default function TuneInDashboard() {
  const [user, setUser] = useState<any>(null);
  const [hgtData, setHgtData] = useState<any>(null);
  const [leaderboard, setLeaderboard] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const navigate = useNavigate();

  // ✅ 1. Get user
  useEffect(() => {
    const getUser = async () => {
      const { data } = await supabase.auth.getUser();
      setUser(data?.user);
    };
    getUser();
  }, []);

  // ✅ 2. Fetch ALL data (single source of truth)
// ONLY showing corrected critical section (rest unchanged)

useEffect(() => {
  if (!user?.id) return;

  const initData = async () => {
    setLoading(true);
    setError(false);

    try {
      // 🔥 HGT DATA
      const graphData = await fetchHGTProfile(user.id);
      setHgtData(graphData);

      // ❌ OLD LOGIC (COMMENTED CLEANLY)
      /*
      const res = await fetch("/api/tune-in/leaderboard");
      const data = await res.json();

      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, username, avatar_url");

      const profileMap = new Map();
      (profiles || []).forEach((p) => {
        profileMap.set(p.id, p);
      });

      const mergedLeaderboard = data.map((entry: any) => {
        const profile = profileMap.get(entry.user_id);

        return {
          username: profile?.username || "User",
          avatar_url: profile?.avatar_url,
          score: entry.score ?? 0,
        };
      });

      setLeaderboard(
        mergedLeaderboard.sort((a, b) => b.score - a.score)
      );
      */

      // ✅ NEW LOGIC
      const res = await fetch("/api/tune-in/leaderboard");
      const data = await res.json();

      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, username, avatar_url");

      const profileMap = new Map();
(profiles || []).forEach((p) => {
  profileMap.set(String(p.id), p);
});

      const mergedLeaderboard = data.map((entry: any) => {
  const uid = String(entry.user_id || entry.id || "");

  const profile = profileMap.get(uid);

  return {
    user_id: uid,
    username: profile?.username ?? "User",
    avatar_url: profile?.avatar_url ?? null,
    score: entry.score ?? 0,
  };
});

      setLeaderboard(
        mergedLeaderboard
          .filter((u) => u.user_id !== user.id)
          .sort((a, b) => b.score - a.score)
      );

    } catch (err) {
      console.error(err);
      setError(true);
    } finally {
      setLoading(false);
    }
  };

  initData();

}, [user?.id]); // ✅ THIS WAS MISSING
  // ✅ LOADING UI
  if (loading) {
    return <div className="p-6">Loading Tune-In...</div>;
  }

  // ✅ ERROR UI
  if (error) {
    return <div className="p-6 text-red-500">Failed to load Tune-In</div>;
  }
  return (
    <div className="h-screen bg-background flex flex-col overflow-hidden">
      <header className="h-14 border-b border-border flex items-center px-5 gap-4 flex-shrink-0 bg-background/80 backdrop-blur-xl z-20">
        <button onClick={() => navigate(-1)} className="p-1.5 rounded-lg text-muted-foreground hover:bg-muted/50 hover:text-foreground transition-all">
          <ArrowLeft size={18} />
        </button>
        <div className="flex items-center gap-2.5">
          <Sparkles size={16} className="text-primary animate-pulse" />
          <span className="text-sm font-bold tracking-wide">Tune-In Engine</span>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto scrollbar-thin scrollbar-thumb-muted">
        <div className="max-w-6xl mx-auto px-5 py-8">
          
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            
            {/* ── LEFT COL: HGT Profile & Recommendations ── */}
            <div className="lg:col-span-2 space-y-6">
              
              {/* Score Breakdown Panel */}
<div className="rounded-2xl border border-border bg-card/60 backdrop-blur-sm p-6 shadow-sm">
  <div className="flex items-center justify-between mb-6">
    <div>
      <h2 className="text-xl font-bold">Your Multi-Domain Graph</h2>
      <p className="text-xs text-muted-foreground mt-1">
        API Connections & Point Generators
      </p>
    </div>

    {/* ✅ SAFE TOTAL SCORE */}
    <div className="text-right">
      <div className="text-2xl font-black text-primary">
        {hgtData?.total_score ?? 0}
      </div>
      <div className="text-[10px] uppercase font-bold tracking-widest text-muted-foreground">
        Total Points
      </div>
    </div>
  </div>

  {/* ✅ LOADING STATE */}
  {loading ? (
    <div className="animate-pulse space-y-3">
      <div className="h-10 bg-muted/40 rounded-xl" />
      <div className="h-10 bg-muted/40 rounded-xl" />
    </div>
  ) : (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">

      {/* ✅ SAFE MAP (IMPORTANT FIX) */}
      {(hgtData?.api_connections ?? []).map((api: any) => (
        <div
          key={api.id}
          className={`flex items-center justify-between p-3 rounded-xl border ${
            api.connected
              ? "bg-background/50 border-border/50"
              : "bg-red-500/5 border-red-500/20"
          }`}
        >
          <div className="flex items-center gap-3">
            <span className={api.color}>{api.icon}</span>
            <span className="text-sm font-bold">{api.name}</span>
          </div>

          <div className="text-right">
            {/* ✅ SAFE POINTS */}
            <span
              className={`text-sm font-black ${
                api.connected ? "text-foreground" : "text-red-400"
              }`}
            >
              {api.points ?? 0}
            </span>

            {api.connected ? (
              <div className="text-[9px] text-emerald-500 font-bold uppercase tracking-wide">
                Connected
              </div>
            ) : (
              <div className="text-[9px] text-red-400 font-bold uppercase tracking-wide flex items-center gap-1">
                <AlertCircle size={10} /> Disconnected
              </div>
            )}
          </div>
        </div>
      ))}

      {/* ✅ FALLBACK IF EMPTY */}
      {(hgtData?.api_connections ?? []).length === 0 && (
        <div className="text-sm text-muted-foreground col-span-full text-center py-4">
          No connections yet — connect your accounts to start earning points 🚀
        </div>
      )}
    </div>
  )}
</div>

              {/* Actionable Recommendations */}
              <div className="rounded-2xl border border-border bg-card/60 backdrop-blur-sm p-6 shadow-sm">
                <div className="flex items-center gap-2 mb-4">
                  <TrendingUp className="text-primary w-5 h-5" />
                  <h2 className="text-lg font-bold">How to get ahead</h2>
                </div>
                <p className="text-xs text-muted-foreground mb-5">
                  You need <strong className="text-foreground">{hgtData?.points_to_next_rank || 0} pts</strong> to surpass Rank #{Math.max(1, (hgtData?.rank || 2) - 1)}. Here is what the HGT model recommends based on your habits:
                </p>

                <div className="space-y-3">
                  {!loading && hgtData?.recommendations.map((rec: any) => (
                    <motion.div 
                      key={rec.id} whileHover={{ scale: 1.01 }} onClick={() => navigate(rec.actionPath)}
                      className="group cursor-pointer flex items-center justify-between p-4 rounded-xl border border-border bg-background hover:border-primary/50 transition-all shadow-sm"
                    >
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-full bg-primary/10 text-primary flex items-center justify-center">
                          {rec.icon}
                        </div>
                        <div>
                          <h4 className="text-sm font-bold group-hover:text-primary transition-colors">{rec.title}</h4>
                          <p className="text-xs text-muted-foreground mt-0.5">{rec.subtitle}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="px-2 py-1 bg-emerald-500/10 text-emerald-500 text-[10px] font-black uppercase tracking-wider rounded-md border border-emerald-500/20">
                          {rec.impact}
                        </span>
                        <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" />
                      </div>
                    </motion.div>
                  ))}
                </div>
              </div>
            </div>

            {/* ── RIGHT COL: Global Leaderboard ── */}
            <div className="lg:col-span-1">
              <div className="rounded-2xl border border-border bg-card/60 backdrop-blur-xl overflow-hidden shadow-sm">
                <div className="px-5 py-4 border-b border-border bg-gradient-to-br from-primary/10 to-transparent">
                  <div className="flex items-center gap-2 font-bold">
                    <Trophy size={16} className="text-yellow-500" />
                    <span>Global Rankings</span>
                  </div>
                </div>

                <div className="divide-y divide-border/50">
                  {loading ? (
                    <div className="p-5 text-center text-xs text-muted-foreground animate-pulse">Loading Graph Rankings...</div>
                  ) : leaderboard.map((user, idx) => (
                    <div key={idx} onClick={() => navigate(`/user/${user.username}`)} className="flex items-center gap-3 px-4 py-3 hover:bg-muted/40 cursor-pointer transition-colors">
                      <div className="w-6 text-center font-black text-muted-foreground text-xs">{idx + 1}</div>
                      <Avatar url={user.avatar_url} title={user.username} size={32} />
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-bold truncate">@{user.username}</div>
                      </div>
                      <div className="text-sm font-black text-primary">
  {user.score ?? 0}
</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

          </div>
        </div>
      </div>
    </div>
  );
}