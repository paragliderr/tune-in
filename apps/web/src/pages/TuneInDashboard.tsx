import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "@/lib/supabase";
import {
  ArrowLeft, Trophy, Github, Activity, Users, Heart, 
  TrendingUp, Sparkles, AlertCircle, Link2, Zap, X, Film, Gamepad2, Code2, Dumbbell
} from "lucide-react";

// ─── Types ─────────────────────────────────────────────

interface HGTPerson {
  user_id: string;
  username: string;
  avatar_url: string | null;
  score: number;
  match_pct: number;
  shared_clubs: string[];
}

interface HGTData {
  total_score: number;
  rank: number;
  total_users: number;
  mentors: HGTPerson[];
  mentees: HGTPerson[];
}

// ─── Dynamic Icon Renderer ─────────────────────────────
const DynamicIcon = ({ name, size = 20 }: { name: string, size?: number }) => {
  switch (name) {
    case 'github': return <Github size={size} />;
    case 'activity': return <Activity size={size} />;
    case 'users': return <Users size={size} />;
    case 'heart': return <Heart size={size} />;
    default: return <Sparkles size={size} />;
  }
};

// ─── Avatar ─────────────────────────────────────────────
const Avatar = ({ url, title, size = 36 }: any) => {
  const initials = (title || "??").replace('@', '').slice(0, 2).toUpperCase();

  return url ? (
    <img src={url} alt={title} style={{ width: size, height: size }} className="rounded-full object-cover shadow-sm ring-2 ring-background" />
  ) : (
    <div style={{ width: size, height: size }} className="rounded-full bg-muted flex items-center justify-center text-muted-foreground font-bold text-xs shadow-sm ring-2 ring-background">
      {initials}
    </div>
  );
};

// ─── SIDE PANEL COMPONENT ──────────────────────────────
const ActivityPanel = ({ person, onClose }: { person: HGTPerson, onClose: () => void }) => {
  const [activity, setActivity] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchActivity = async () => {
      try {
        const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";
        // Assuming your backend route for get_user_activity is set up here
        const res = await fetch(`${API_URL}/api/tune-in/activity/${person.user_id}`);
        if (res.ok) {
          setActivity(await res.json());
        }
      } catch (err) {
        console.error("Failed to fetch user activity", err);
      } finally {
        setLoading(false);
      }
    };
    fetchActivity();
  }, [person.user_id]);

  return (
    <motion.div 
      initial={{ x: "100%" }} animate={{ x: 0 }} exit={{ x: "100%" }} transition={{ type: "spring", damping: 25, stiffness: 200 }}
      className="fixed inset-y-0 right-0 w-full md:w-[420px] bg-card border-l border-border shadow-2xl z-50 flex flex-col"
    >
      {/* Panel Header */}
      <div className="p-6 border-b border-border flex justify-between items-start bg-muted/20">
        <div className="flex gap-4 items-center">
          <Avatar url={person.avatar_url} title={person.username} size={56} />
          <div>
            <h2 className="text-xl font-bold">@{person.username}</h2>
            <div className="flex items-center gap-2 mt-1">
              <span className="bg-primary/10 text-primary text-xs font-bold px-2 py-0.5 rounded-full">
                {person.match_pct}% Match
              </span>
              <span className="text-sm font-semibold text-muted-foreground">Score: {person.score}</span>
            </div>
          </div>
        </div>
        <button onClick={onClose} className="p-2 bg-muted hover:bg-muted/80 rounded-full text-muted-foreground transition-colors">
          <X size={20} />
        </button>
      </div>

      {/* Panel Content */}
      <div className="flex-1 overflow-y-auto p-6 space-y-8 scrollbar-thin scrollbar-thumb-muted">
        {loading ? (
          <div className="flex flex-col items-center justify-center h-40 text-muted-foreground animate-pulse">
            <Sparkles size={24} className="mb-2 opacity-50" />
            <p className="text-sm">Scanning Graph Edges...</p>
          </div>
        ) : activity ? (
          <>
            {/* Clubs Section */}
            <section>
              <h3 className="text-sm font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-2 mb-3">
                <Users size={16} /> Clubs
              </h3>
              <div className="flex flex-wrap gap-2">
                {activity.clubs?.length > 0 ? activity.clubs.map((club: string, i: number) => {
                  const isShared = person.shared_clubs.includes(club.toLowerCase());
                  return (
                    <span key={i} className={`text-xs px-3 py-1.5 rounded-md font-medium border ${isShared ? 'bg-primary/10 border-primary/30 text-primary' : 'bg-muted border-border text-foreground'}`}>
                      {club} {isShared && '✨'}
                    </span>
                  );
                }) : <span className="text-sm text-muted-foreground">No clubs joined.</span>}
              </div>
            </section>

            {/* Media Section */}
            <section className="grid grid-cols-2 gap-4">
               <div>
                  <h3 className="text-sm font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-2 mb-2">
                    <Film size={16} /> Cinema
                  </h3>
                  <p className="text-2xl font-black">{activity.movie_reviews?.length || 0}</p>
                  <p className="text-xs text-muted-foreground">Reviews</p>
               </div>
               <div>
                  <h3 className="text-sm font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-2 mb-2">
                    <Gamepad2 size={16} /> Gaming
                  </h3>
                  <p className="text-2xl font-black">{activity.game_reviews?.length || 0}</p>
                  <p className="text-xs text-muted-foreground">Reviews</p>
               </div>
            </section>

            {/* Dev & Fitness Integrations */}
            <section className="space-y-4">
              <div className="p-4 border border-border rounded-xl bg-card">
                <h3 className="text-sm font-bold flex items-center gap-2 mb-3"><Code2 size={16} className="text-purple-400" /> GitHub Stats</h3>
                {activity.github?.length > 0 ? (
                  <div className="flex justify-between">
                    <div><p className="text-xl font-bold">{activity.github[0].total_commits}</p><p className="text-xs text-muted-foreground">Commits</p></div>
                    <div className="text-right"><p className="text-xl font-bold">{activity.github[0].streak_days} 🔥</p><p className="text-xs text-muted-foreground">Day Streak</p></div>
                  </div>
                ) : <p className="text-sm text-muted-foreground">Not connected</p>}
              </div>

              <div className="p-4 border border-border rounded-xl bg-card">
                <h3 className="text-sm font-bold flex items-center gap-2 mb-3"><Dumbbell size={16} className="text-orange-400" /> Strava Stats</h3>
                {activity.strava?.length > 0 ? (
                  <div className="flex justify-between">
                    <div><p className="text-xl font-bold">{activity.strava[0].total_distance_km}km</p><p className="text-xs text-muted-foreground">Distance</p></div>
                    <div className="text-right"><p className="text-xl font-bold">{activity.strava[0].total_moving_time_hrs}h</p><p className="text-xs text-muted-foreground">Moving Time</p></div>
                  </div>
                ) : <p className="text-sm text-muted-foreground">Not connected</p>}
              </div>
            </section>
          </>
        ) : (
          <p className="text-sm text-muted-foreground text-center">No activity found.</p>
        )}
      </div>
    </motion.div>
  );
};


// ─── MAIN COMPONENT ────────────────────────────────────
export default function TuneInDashboard() {
  const [user, setUser] = useState<any>(null);
  const [hgtData, setHgtData] = useState<HGTData | null>(null);
  const [activeConnections, setActiveConnections] = useState<ApiConnection[]>([]);
  const [selectedPerson, setSelectedPerson] = useState<HGTPerson | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const navigate = useNavigate();

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUser(data?.user));
  }, []);

  useEffect(() => {
    if (!user?.id) return;

    const initData = async () => {
      setLoading(true);
      setError(false);

      try {
        // 1. Fetch Backend Data
        const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";
        const res = await fetch(`${API_URL}/api/tune-in/dashboard?user_id=${user.id}`);
        if (!res.ok) throw new Error("API failed");
        const backendData = await res.json();

        // 2. Resolve Usernames & Avatars for Mentors and Mentees
        const allIds = [...(backendData.mentors || []), ...(backendData.mentees || [])].map((u: any) => u.user_id);
        const { data: profiles } = await supabase.from("profiles").select("id, username, avatar_url").in("id", allIds);
        const profileMap = new Map((profiles || []).map(p => [p.id, p]));

        const enrich = (list: any[]) => list.map(item => ({
          ...item,
          username: profileMap.get(item.user_id)?.username || "User",
          avatar_url: profileMap.get(item.user_id)?.avatar_url || null,
        }));

        setHgtData({
          total_score: backendData.total_score || 0,
          rank: backendData.rank || 0,
          total_users: backendData.total_users || 0,
          mentors: enrich(backendData.mentors || []),
          mentees: enrich(backendData.mentees || []),
        });

        // 3. Rebuild "Active Graph Nodes" by manually checking current user's DB records
        const [{ data: gh }, { data: st }, { count: clubs }] = await Promise.all([
          supabase.from("github_stats").select("id").eq("user_id", user.id),
          supabase.from("strava_stats").select("id").eq("user_id", user.id),
          supabase.from("club_members").select("id", { count: 'exact', head: true }).eq("user_id", user.id)
        ]);

        setActiveConnections([
          { id: "clubs", name: "Clubs Joined", connected: (clubs || 0) > 0, icon: "users", points: (clubs || 0) * 15 },
          { id: "github", name: "GitHub", connected: !!gh?.length, icon: "github" },
          { id: "strava", name: "Strava", connected: !!st?.length, icon: "activity" }
        ]);

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
    <div className="h-screen bg-background flex flex-col overflow-hidden relative">
      
      {/* Side Panel Overlay & Component */}
      <AnimatePresence>
        {selectedPerson && (
          <>
            <motion.div 
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} 
              onClick={() => setSelectedPerson(null)}
              className="fixed inset-0 bg-background/60 backdrop-blur-sm z-40" 
            />
            <ActivityPanel person={selectedPerson} onClose={() => setSelectedPerson(null)} />
          </>
        )}
      </AnimatePresence>

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
            
            {/* LEFT COLUMN */}
            <div className="lg:col-span-1 space-y-6">
              <div className="p-6 border border-border bg-card rounded-2xl shadow-sm">
                <h2 className="text-base font-bold flex items-center gap-2 mb-5">
                  <Link2 size={18} className="text-primary" /> Active Graph Nodes
                </h2>
                <div className="space-y-3">
                  {activeConnections.map((api, i) => (
                    <motion.div 
                      initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.1 }}
                      key={api.id} className="flex items-center gap-4 p-3 rounded-xl bg-muted/40 border border-border/50"
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

            {/* RIGHT COLUMN: Mentors & Mentees */}
            <div className="lg:col-span-2 space-y-6">

              {/* MENTORS */}
              <div className="p-6 border border-border bg-card rounded-2xl shadow-sm">
                <div className="flex justify-between items-end mb-5">
                  <div>
                    <h2 className="text-base font-bold flex items-center gap-2 mb-1">
                      <Sparkles size={18} className="text-primary" /> HGT Mentors
                    </h2>
                    <p className="text-xs text-muted-foreground">Users dominating in your shared interests.</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {hgtData?.mentors.length === 0 ? (
                    <div className="col-span-full py-8 text-center text-sm text-muted-foreground">
                      Graph is still learning. Engage with more clubs to get recommendations.
                    </div>
                  ) : (
                    hgtData?.mentors.map((rec, i) => (
                      <motion.div 
                        initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: i * 0.1 }}
                        key={rec.user_id} onClick={() => setSelectedPerson(rec)}
                        className="group p-4 border border-border rounded-xl hover:bg-muted/30 hover:border-primary/40 cursor-pointer transition-all relative overflow-hidden"
                      >
                        <div className="flex justify-between items-start mb-3">
                          <div className="flex items-center gap-3">
                            <Avatar url={rec.avatar_url} title={rec.username} size={40} />
                            <div>
                              <h3 className="font-bold text-sm">@{rec.username}</h3>
                              <p className="text-xs text-muted-foreground">Score: {rec.score}</p>
                            </div>
                          </div>
                          <div className="shrink-0 bg-primary/10 text-primary text-[10px] uppercase font-bold px-2 py-1 rounded-full">
                            {rec.match_pct}% Match
                          </div>
                        </div>
                      </motion.div>
                    ))
                  )}
                </div>
              </div>

              {/* MENTEES (Replaced Leaderboard) */}
              <div className="p-6 border border-border bg-card rounded-2xl shadow-sm">
                <div className="flex justify-between items-end mb-5">
                  <div>
                    <h2 className="text-base font-bold flex items-center gap-2 mb-1">
                      <Users size={18} className="text-emerald-500" /> HGT Mentees
                    </h2>
                    <p className="text-xs text-muted-foreground">Users in your graph looking to level up.</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {hgtData?.mentees.length === 0 ? (
                    <div className="col-span-full py-8 text-center text-sm text-muted-foreground">
                      No mentees in your immediate graph radius.
                    </div>
                  ) : (
                    hgtData?.mentees.map((rec, i) => (
                      <motion.div 
                        initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: i * 0.1 }}
                        key={rec.user_id} onClick={() => setSelectedPerson(rec)}
                        className="group p-4 border border-border rounded-xl hover:bg-muted/30 hover:border-emerald-500/40 cursor-pointer transition-all relative overflow-hidden"
                      >
                        <div className="flex justify-between items-start mb-3">
                          <div className="flex items-center gap-3">
                            <Avatar url={rec.avatar_url} title={rec.username} size={40} />
                            <div>
                              <h3 className="font-bold text-sm">@{rec.username}</h3>
                              <p className="text-xs text-muted-foreground">Score: {rec.score}</p>
                            </div>
                          </div>
                          <div className="shrink-0 bg-emerald-500/10 text-emerald-500 text-[10px] uppercase font-bold px-2 py-1 rounded-full">
                            {rec.match_pct}% Match
                          </div>
                        </div>
                      </motion.div>
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