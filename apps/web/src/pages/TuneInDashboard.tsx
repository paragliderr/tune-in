import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "@/lib/supabase";
import {
  ArrowLeft, Trophy, Github, Activity, Users, Heart, 
  TrendingUp, Sparkles, AlertCircle, Link2, ChevronRight, Zap
} from "lucide-react";

// ─── Types ─────────────────────────────────────────────

interface ApiConnection {
  id: string;
  name: string;
  points?: number;
  connected: boolean;
  icon: string;
}

interface Recommendation {
  id: string;
  title: string;
  subtitle: string;
  impact: string;
  match_score: number;
  match_reason: string;
  actionPath: string;
}

interface HGTData {
  total_score: number;
  rank: number;
  total_users: number;
  api_connections: ApiConnection[];
  recommendations: Recommendation[];
  recent_connections?: any[];
}

// ─── Dynamic Icon Renderer ─────────────────────────────
const DynamicIcon = ({ name, size = 20 }: { name: string, size?: number }) => {
  switch (name) {
    case 'github': return <Github size={size} />;
    case 'activity': return <Activity size={size} />; // Strava
    case 'users': return <Users size={size} />;
    case 'heart': return <Heart size={size} />;
    default: return <Sparkles size={size} />;
  }
};

// ─── HGT FETCH ─────────────────────────────────────────
async function fetchHGTProfile(userId: string): Promise<HGTData> {
  try {
    const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";
    const res = await fetch(`${API_URL}/api/tune-in/dashboard?user_id=${userId}`);
    
    if (!res.ok) throw new Error("API failed");

    const data = await res.json();

    return {
      total_score: data.total_score ?? 0,
      rank: data.rank ?? 0,
      total_users: data.total_users ?? 0,
      api_connections: data.api_connections ?? [],
      recommendations: data.recommendations ?? [],
      recent_connections: data.recent_connections ?? []
    };

  } catch (err) {
    console.warn("Fallback triggered:", err);
    return {
      total_score: 0, rank: 0, total_users: 0,
      api_connections: [], recommendations: [], recent_connections: []
    };
  }
}

// ─── Avatar ─────────────────────────────────────────────
const Avatar = ({ url, title, size = 36 }: any) => {
  const initials = (title || "??").replace('@', '').slice(0, 2).toUpperCase();

  return url ? (
    <img src={url} alt={title}
      style={{ width: size, height: size }}
      className="rounded-full object-cover shadow-sm ring-2 ring-background"
    />
  ) : (
    <div style={{ width: size, height: size }}
      className="rounded-full bg-muted flex items-center justify-center text-muted-foreground font-bold text-xs shadow-sm ring-2 ring-background">
      {initials}
    </div>
  );
};

// ─── MAIN COMPONENT ────────────────────────────────────
export default function TuneInDashboard() {
  const [user, setUser] = useState<any>(null);
  const [hgtData, setHgtData] = useState<HGTData | null>(null);
  const [leaderboard, setLeaderboard] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const navigate = useNavigate();

  // ✅ GET USER
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUser(data?.user));
  }, []);

  // ✅ FETCH EVERYTHING
  useEffect(() => {
    if (!user?.id) return;

    const initData = async () => {
      setLoading(true);
      setError(false);

      try {
        // 🔥 1. Fetch HGT Graph Data
        const graphData = await fetchHGTProfile(user.id);
        setHgtData(graphData);

        // 🔥 2. Fetch Global Leaderboard Data
        const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";
        const res = await fetch(`${API_URL}/api/tune-in/leaderboard?top_k=10`);
        const json = await res.json();
        const data = Array.isArray(json) ? json : (json?.items ?? json?.leaderboard ?? []);

        // 3. Resolve Usernames & Avatars
        const { data: profiles } = await supabase.from("profiles").select("id, username, avatar_url");
        const profileMap = new Map();
        (profiles || []).forEach((p) => profileMap.set(String(p.id), p));

        const merged = data.map((entry: any) => {
          const uid = String(entry.user_id || entry.id || "");
          const profile = profileMap.get(uid);
          return {
            user_id: uid,
            username: profile?.username ?? "User",
            avatar_url: profile?.avatar_url ?? null,
            score: entry.total_score ?? entry.score ?? 0, // Using total_score from new backend
          };
        });

        setLeaderboard(
          merged.filter((u) => u.user_id !== user.id).sort((a, b) => b.score - a.score)
        );

      } catch (err) {
        console.error(err);
        setError(true);
      } finally {
        setLoading(false);
      }
    };

    initData();
  }, [user?.id]);


  if (loading) {
    return (
      <div className="h-screen flex flex-col items-center justify-center space-y-4 bg-background">
        <Sparkles className="w-8 h-8 text-primary animate-pulse" />
        <p className="text-muted-foreground font-medium animate-pulse">Computing Graph Embeddings...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="h-screen flex flex-col items-center justify-center space-y-4 bg-background">
        <AlertCircle className="w-8 h-8 text-red-500" />
        <p className="text-red-500 font-medium">Failed to establish Neural connection.</p>
        <button onClick={() => window.location.reload()} className="text-primary hover:underline">Retry</button>
      </div>
    );
  }

  return (
    <div className="h-screen bg-background flex flex-col overflow-hidden">
      {/* HEADER */}
      <header className="h-14 border-b border-border flex items-center px-5 gap-4 shrink-0 bg-background/80 backdrop-blur-md z-10">
        <button onClick={() => navigate(-1)} className="text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft size={18} />
        </button>
        <div className="flex items-center gap-2.5">
          <Sparkles size={16} className="text-primary" />
          <span className="text-sm font-bold tracking-wide">Tune-In Engine</span>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto scrollbar-thin scrollbar-thumb-muted">
        <div className="max-w-6xl mx-auto px-5 py-8">
          
          {/* HERO STATS */}
          <motion.div 
            initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
            className="mb-8 rounded-3xl bg-gradient-to-br from-primary/20 via-primary/5 to-background border border-primary/20 p-8 flex flex-col md:flex-row items-start md:items-center justify-between gap-6 relative overflow-hidden"
          >
            <div className="absolute top-0 right-0 -mt-10 -mr-10 opacity-10 pointer-events-none">
              <Zap size={200} />
            </div>
            <div>
              <h1 className="text-sm font-semibold text-primary tracking-wider uppercase mb-1">Total Influence Score</h1>
              <p className="text-5xl font-black text-foreground">{hgtData?.total_score.toLocaleString()}</p>
            </div>
            <div className="md:text-right">
              <p className="text-sm text-muted-foreground mb-1">Global Graph Rank</p>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-bold">#{hgtData?.rank}</span>
                <span className="text-muted-foreground font-medium">/ {hgtData?.total_users}</span>
              </div>
            </div>
          </motion.div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            
            {/* LEFT COLUMN: Connections & Graph Data */}
            <div className="lg:col-span-1 space-y-6">
              
              {/* API CONNECTIONS */}
              <div className="p-6 border border-border bg-card rounded-2xl shadow-sm">
                <h2 className="text-base font-bold flex items-center gap-2 mb-5">
                  <Link2 size={18} className="text-primary" /> 
                  Active Graph Nodes
                </h2>
                
                <div className="space-y-3">
                  {hgtData?.api_connections.map((api, i) => (
                    <motion.div 
                      initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.1 }}
                      key={api.id} 
                      className="flex items-center gap-4 p-3 rounded-xl bg-muted/40 border border-border/50"
                    >
                      <div className={`p-2 rounded-lg ${api.connected ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'}`}>
                        <DynamicIcon name={api.icon} size={20} />
                      </div>
                      <div className="flex-1">
                        <p className="text-sm font-bold">{api.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {api.connected ? <span className="text-green-500 font-medium">Connected</span> : "Not Connected"}
                        </p>
                      </div>
                      {api.connected && api.points !== undefined && (
                         <div className="text-sm font-bold text-primary">+{api.points}</div>
                      )}
                    </motion.div>
                  ))}
                </div>
              </div>
            </div>

            {/* RIGHT COLUMN: AI Recommendations & Leaderboard */}
            <div className="lg:col-span-2 space-y-6">

              {/* MENTOR RECOMMENDATIONS */}
              <div className="p-6 border border-border bg-card rounded-2xl shadow-sm">
                <div className="flex justify-between items-end mb-5">
                  <div>
                    <h2 className="text-base font-bold flex items-center gap-2 mb-1">
                      <Sparkles size={18} className="text-primary" /> 
                      HGT Mentors
                    </h2>
                    <p className="text-xs text-muted-foreground">Users dominating in your shared interests.</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {hgtData?.recommendations.length === 0 ? (
                    <div className="col-span-full py-8 text-center text-sm text-muted-foreground">
                      Graph is still learning. Engage with more clubs to get recommendations.
                    </div>
                  ) : (
                    hgtData?.recommendations.map((rec, i) => (
                      <motion.div 
                        initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: i * 0.1 }}
                        key={rec.id}
                        onClick={() => navigate(rec.actionPath)}
                        className="group p-4 border border-border rounded-xl hover:bg-muted/30 hover:border-primary/40 cursor-pointer transition-all relative overflow-hidden"
                      >
                        <div className="flex justify-between items-start mb-3">
                          <div className="pr-4">
                            <h3 className="font-bold text-sm truncate">{rec.title}</h3>
                            <p className="text-xs text-muted-foreground line-clamp-1 mt-0.5">{rec.subtitle}</p>
                          </div>
                          <div className="shrink-0 bg-primary/10 text-primary text-[10px] uppercase font-bold px-2 py-1 rounded-full">
                            {rec.match_score}% Match
                          </div>
                        </div>
                        <div className="flex items-center justify-between mt-auto pt-3 border-t border-border/50">
                          <span className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                            <TrendingUp size={12} /> {rec.match_reason}
                          </span>
                          <span className="text-xs font-bold bg-muted px-2 py-1 rounded-md">{rec.impact}</span>
                        </div>
                      </motion.div>
                    ))
                  )}
                </div>
              </div>

              {/* GLOBAL LEADERBOARD PREVIEW */}
              <div className="border border-border bg-card rounded-2xl overflow-hidden shadow-sm">
                <div className="p-4 border-b border-border font-bold flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Trophy size={16} className="text-yellow-500" /> Top Graph Influencers
                  </div>
                  <button onClick={() => navigate("/leaderboard")} className="text-xs text-muted-foreground hover:text-primary flex items-center">
                    View All <ChevronRight size={14} />
                  </button>
                </div>

                <div className="divide-y divide-border">
                  {leaderboard.length === 0 ? (
                     <div className="p-6 text-sm text-muted-foreground text-center">Loading rankings...</div>
                  ) : (
                    leaderboard.slice(0, 5).map((u, i) => (
                      <div key={u.user_id}
                        className="flex items-center gap-4 p-3.5 hover:bg-muted/40 cursor-pointer transition-colors"
                        onClick={() => navigate(`/user/${u.username}`)}>
                        
                        <div className="w-6 text-center text-sm font-bold text-muted-foreground">{i + 1}</div>
                        <Avatar url={u.avatar_url} title={u.username} size={36} />
                        <div className="flex-1">
                          <div className="text-sm font-bold">@{u.username}</div>
                        </div>
                        <div className="text-sm font-bold tabular-nums">
                          {u.score.toLocaleString()}
                        </div>
                      </div>
                    ))
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