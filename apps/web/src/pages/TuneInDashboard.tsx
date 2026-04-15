import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { supabase } from "@/lib/supabase";
import { 
  ArrowLeft, Trophy, Sparkles, ChevronRight, AlertCircle, 
  Link2, Users, Heart 
} from "lucide-react";

// ─── Dynamic Icon Mapper ───────────────────────────────────────────────────
const getIcon = (iconName: string) => {
  switch (iconName) {
    case "users": return <Users size={18} />;
    case "heart": return <Heart size={18} />;
    default: return <Link2 size={18} />;
  }
};

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

  // ✅ 2. Fetch ALL data 
  useEffect(() => {
    if (!user?.id) return;

    const initData = async () => {
      setLoading(true);
      setError(false);

      try {
        // 🔥 1. Fetch HGT Dashboard Data (Current User)
        // Changed to RESTful URL matching the backend
        const hgtRes = await fetch(`/api/tune-in/dashboard/${user.id}`);
        if (!hgtRes.ok) throw new Error("Dashboard API failed");
        const graphData = await hgtRes.json();
        setHgtData(graphData);

        // 🔥 2. Fetch Real Leaderboard
        const lbRes = await fetch("/api/tune-in/leaderboard");
        if (!lbRes.ok) throw new Error("Leaderboard API failed");
        const lbJson = await lbRes.json();
        
        // Extract array from the {"leaderboard": [...]} wrapper
        const lbData = lbJson.leaderboard || [];

        // 🔥 3. Get profile info to attach usernames/avatars
        const { data: profiles } = await supabase
          .from("profiles")
          .select("id, username, avatar_url");

        const profileMap = new Map();
        (profiles || []).forEach((p) => {
          profileMap.set(p.id, p);
        });

        // 🔥 4. Merge backend math + Supabase profiles
        const mergedLeaderboard = lbData.map((entry: any) => {
          const profile = profileMap.get(entry.user_id);
          return {
            user_id: entry.user_id, // Keep ID for navigation
            username: profile?.username || "User",
            avatar_url: profile?.avatar_url,
            score: entry.total_score ?? 0, // Backend sends total_score now
          };
        });

        setLeaderboard(mergedLeaderboard);

      } catch (err) {
        console.error(err);
        setError(true);
      } finally {
        setLoading(false);
      }
    };

    initData();
  }, [user?.id]);

  // ✅ LOADING UI
  if (loading) {
    return <div className="p-6 text-muted-foreground animate-pulse">Loading AI Engine...</div>;
  }

  // ✅ ERROR UI
  if (error) {
    return <div className="p-6 text-red-500">Failed to connect to the Tune-In AI.</div>;
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

                  <div className="text-right">
                    <div className="text-2xl font-black text-primary">
                      {hgtData?.total_score ?? 0}
                    </div>
                    <div className="text-[10px] uppercase font-bold tracking-widest text-muted-foreground">
                      Total Points
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {(hgtData?.api_connections ?? []).map((api: any) => (
                    <div
                      key={api.id}
                      className={`flex items-center justify-between p-3 rounded-xl border ${
                        api.connected
                          ? "bg-background/50 border-border/50"
                          : "bg-red-500/5 border-red-500/20"
                      }`}
                    >
                      <div className="flex items-center gap-3 text-muted-foreground">
                        {/* Render dynamic icon from backend string */}
                        <div className={api.connected ? "text-primary" : "text-muted-foreground"}>
                          {getIcon(api.icon)}
                        </div>
                        <span className="text-sm font-bold text-foreground">{api.name}</span>
                      </div>

                      <div className="text-right">
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
                          <div className="text-[9px] text-red-400 font-bold uppercase tracking-wide flex items-center justify-end gap-1 mt-0.5">
                            <AlertCircle size={10} /> Disconnected
                          </div>
                        )}
                      </div>
                    </div>
                  ))}

                  {(hgtData?.api_connections ?? []).length === 0 && (
                    <div className="text-sm text-muted-foreground col-span-full text-center py-4">
                      Join clubs and like posts to start generating points!
                    </div>
                  )}
                </div>
              </div>

              {/* Actionable Recommendations */}
              <div className="rounded-2xl border border-border bg-card/60 backdrop-blur-sm p-6 shadow-sm">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <Sparkles className="text-primary w-5 h-5" />
                    <h2 className="text-lg font-bold">Network Proximity</h2>
                  </div>
                  {hgtData?.rank > 0 && (
                    <div className="text-xs font-bold px-3 py-1 bg-muted rounded-full">
                      Rank #{hgtData.rank} of {hgtData.total_users || "?"}
                    </div>
                  )}
                </div>
                
                <p className="text-xs text-muted-foreground mb-5">
                  Here are users the AI model flagged as highly similar to your behavioral graph:
                </p>

                <div className="space-y-3">
                  {(hgtData?.recommendations ?? []).length === 0 ? (
                    <div className="text-center text-sm text-muted-foreground py-6 border border-dashed rounded-xl border-border">
                      Not enough data yet. Like more posts to get matched!
                    </div>
                  ) : hgtData.recommendations.map((rec: any) => (
                    <motion.div 
                      key={rec.id} 
                      whileHover={{ scale: 1.01 }} 
                      onClick={() => navigate(rec.actionPath)}
                      className="group cursor-pointer flex items-center justify-between p-4 rounded-xl border border-border bg-background hover:border-primary/50 transition-all shadow-sm"
                    >
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-full bg-primary/10 text-primary flex items-center justify-center">
                          <Users size={18} />
                        </div>
                        <div>
                          <h4 className="text-sm font-bold group-hover:text-primary transition-colors">{rec.title}</h4>
                          <p className="text-xs text-muted-foreground mt-0.5">{rec.subtitle} • {rec.match_score}% Match</p>
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
                  {leaderboard.length === 0 ? (
                    <div className="p-5 text-center text-xs text-muted-foreground">No rankings available yet.</div>
                  ) : leaderboard.map((userObj, idx) => (
                    <div 
                      key={idx} 
                      onClick={() => navigate(`/user/${userObj.user_id}`)} 
                      className="flex items-center gap-3 px-4 py-3 hover:bg-muted/40 cursor-pointer transition-colors"
                    >
                      <div className="w-6 text-center font-black text-muted-foreground text-xs">{idx + 1}</div>
                      <Avatar url={userObj.avatar_url} title={userObj.username} size={32} />
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-bold truncate">@{userObj.username}</div>
                      </div>
                      <div className="text-sm font-black text-primary">
                        {userObj.score}
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