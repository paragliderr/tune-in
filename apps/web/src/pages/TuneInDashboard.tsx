import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { supabase } from "@/lib/supabase";
import {
  ArrowLeft, Trophy, Film, Gamepad2, Github, Music,
  Dumbbell, TrendingUp, Sparkles, ChevronRight, AlertCircle, Link2
} from "lucide-react";


// 🔥 HGT FETCH
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
      recommendations: data.recommendations ?? [],

      // ✅ NEW: real users from HGT
      recent_connections: data.recent_connections ?? []
    };

  } catch (err) {
    console.warn("Fallback triggered:", err);

    return {
      total_score: 0,
      rank: 0,
      points_to_next_rank: 0,

      api_connections: [],
      recommendations: [],

      // ✅ EMPTY fallback
      recent_connections: []
    };
  }
}


// ─── Avatar ─────────────────────────────────────────────
const Avatar = ({ url, title, size = 36 }: any) => {
  const initials = title.replace('@', '').slice(0, 2).toUpperCase() || "??";

  return url ? (
    <img src={url} alt={title}
      style={{ width: size, height: size }}
      className="rounded-full object-cover shadow-sm"
    />
  ) : (
    <div style={{ width: size, height: size }}
      className="rounded-full bg-muted flex items-center justify-center text-muted-foreground font-bold text-[10px] shadow-sm">
      {initials}
    </div>
  );
};


// ─── MAIN ─────────────────────────────────────────────
export default function TuneInDashboard() {
  const [user, setUser] = useState<any>(null);
  const [hgtData, setHgtData] = useState<any>(null);
  const [leaderboard, setLeaderboard] = useState<any[]>([]);
  const [recentConnections, setRecentConnections] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const navigate = useNavigate();


  // ✅ GET USER
  useEffect(() => {
    const getUser = async () => {
      const { data } = await supabase.auth.getUser();
      setUser(data?.user);
    };
    getUser();
  }, []);


  // ✅ FETCH EVERYTHING
  useEffect(() => {
    if (!user?.id) return;

    const initData = async () => {
      setLoading(true);
      setError(false);

      try {
        // 🔥 HGT
        const graphData = await fetchHGTProfile(user.id);
        setHgtData(graphData);

        // ✅ NEW
        setRecentConnections(graphData.recent_connections || []);

        // 🔥 LEADERBOARD
        const res = await fetch("/api/tune-in/leaderboard");
const json = await res.json();
const data = Array.isArray(json) ? json : (json?.items ?? json?.leaderboard ?? []);

        const { data: profiles } = await supabase
          .from("profiles")
          .select("id, username, avatar_url");

        const profileMap = new Map();
        (profiles || []).forEach((p) => {
          profileMap.set(String(p.id), p);
        });

        const merged = data.map((entry: any) => {
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
          merged
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
  }, [user?.id]);


  if (loading) return <div className="p-6">Loading Tune-In...</div>;
  if (error) return <div className="p-6 text-red-500">Failed to load Tune-In</div>;


  return (
    <div className="h-screen bg-background flex flex-col overflow-hidden">

      {/* HEADER */}
      <header className="h-14 border-b flex items-center px-5 gap-4">
        <button onClick={() => navigate(-1)}>
          <ArrowLeft size={18} />
        </button>
        <div className="flex items-center gap-2.5">
          <Sparkles size={16} className="text-primary animate-pulse" />
          <span className="text-sm font-bold">Tune-In Engine</span>
        </div>
      </header>


      <div className="flex-1 overflow-y-auto">
        <div className="max-w-6xl mx-auto px-5 py-8">

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

            {/* LEFT */}
            <div className="lg:col-span-2 space-y-6">

              {/* CONNECTIONS */}
              <div className="p-6 border rounded-2xl">
                <h2 className="text-xl font-bold mb-4">Your Graph</h2>

                {(hgtData?.api_connections ?? []).map((api: any) => (
                  <div key={api.id} className="flex justify-between py-2">
                    <span>{api.name}</span>
                    <span>{api.points ?? 0}</span>
                  </div>
                ))}
              </div>

              {/* RECOMMENDATIONS */}
              <div className="p-6 border rounded-2xl">
                <h2 className="text-lg font-bold mb-4">Recommendations</h2>

                {hgtData?.recommendations.map((rec: any) => (
                  <motion.div key={rec.id}
                    className="p-3 border rounded-xl mb-2 cursor-pointer"
                    onClick={() => navigate(rec.actionPath)}>
                    {rec.title}
                  </motion.div>
                ))}
              </div>
            </div>


            {/* RIGHT */}
            <div className="space-y-6">

              {/* LEADERBOARD */}
              <div className="border rounded-2xl">
                <div className="p-4 border-b font-bold flex gap-2">
                  <Trophy size={16} /> Rankings
                </div>

                {leaderboard.map((u, i) => (
                  <div key={i}
                    className="flex items-center gap-3 p-3 cursor-pointer"
                    onClick={() => navigate(`/user/${u.username}`)}>

                    <div>{i + 1}</div>
                    <Avatar url={u.avatar_url} title={u.username} size={32} />
                    <div className="flex-1">@{u.username}</div>
                    <div>{u.score}</div>
                  </div>
                ))}
              </div>


              {/* ✅ REAL HGT CONNECTIONS */}
              <div className="border rounded-2xl">
                <div className="p-4 border-b font-bold flex gap-2">
                  <Link2 size={16} /> Recent Connections
                </div>

                {recentConnections.length === 0 ? (
                  <div className="p-4 text-sm text-muted-foreground text-center">
                    No recent activity yet
                  </div>
                ) : (
                  recentConnections.map((u: any, i: number) => (
                    <div key={i}
                      className="flex items-center gap-3 p-3 cursor-pointer"
                      onClick={() => navigate(`/user/${u.username}`)}>

                      <Avatar url={u.avatar_url} title={u.username} size={32} />

                      <div className="flex-1">
                        <div className="text-sm font-bold">@{u.username}</div>
                        <div className="text-xs text-muted-foreground">
                          Linked {u.connection}
                        </div>
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
  );
}