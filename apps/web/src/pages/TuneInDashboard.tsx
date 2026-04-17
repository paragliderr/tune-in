/*.         VERSION 1.      */



// import { useState, useEffect, useCallback, useMemo } from "react";
// import { useNavigate } from "react-router-dom";
// import { motion, AnimatePresence } from "framer-motion";
// import { supabase } from "@/lib/supabase";
// import {
//   ArrowLeft, Sparkles, Link2, Heart, Github, Activity,
//   Trophy, ChevronRight, X, Film, Gamepad2, Dumbbell,
//   Code2, Users, Zap, CheckCircle, Star
// } from "lucide-react";

// // ─── Types ───────────────────────────────────────────────────────────────────

// interface ActivityData {
//   clubs: string[];
//   post_likes: { posts: { title: string; category: string } | null }[];
//   strava: {
//     total_distance_km: number;
//     total_elevation_m: number;
//     total_moving_time_hrs: number;
//     score: number;
//   } | null;
//   github: {
//     username: string;
//     total_commits: number;
//     streak_days: number;
//     score: number;
//   } | null;
//   movie_reviews: any[];
//   game_reviews: any[];
//   hgt_score: number;
// }

// interface SimilarUser {
//   user_id: string;
//   username: string;
//   avatar_url: string | null;
//   score: number;
//   match_pct: number;
//   role: "mentor" | "mentee";
//   shared_clubs: string[];
//   shared_categories: string[];
//   activity: ActivityData;
// }

// interface DashboardData {
//   total_score: number;
//   rank: number | null;
//   total_users: number;
//   top_similar: SimilarUser[];
//   mentors: SimilarUser[];
//   mentees: SimilarUser[];
// }

// interface LeaderboardEntry {
//   rank: number;
//   user_id: string;
//   username: string;
//   avatar_url: string | null;
//   total_score: number;
//   base_score: number;
//   match_count: number;
//   similarity_to_me: number | null;
// }

// // ─── Helpers ──────────────────────────────────────────────────────────────────

// const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";

// async function apiFetch<T>(path: string, token: string): Promise<T | null> {
//   try {
//     const res = await fetch(`${API_URL}${path}`, {
//       headers: { Authorization: `Bearer ${token}` },
//     });
//     if (!res.ok) {
//       console.error(`API ${path} → ${res.status}`, await res.text());
//       return null;
//     }
//     return res.json();
//   } catch (e) {
//     console.error(`API ${path} failed:`, e);
//     return null;
//   }
// }

// // ─── Avatar ───────────────────────────────────────────────────────────────────

// const Avatar = ({ url, username, size = 36 }: { url: string | null; username: string; size?: number }) => {
//   const initials = (username || "??").slice(0, 2).toUpperCase();
//   return url ? (
//     <img src={url} alt={username} style={{ width: size, height: size }}
//       className="rounded-full object-cover flex-shrink-0" />
//   ) : (
//     <div style={{ width: size, height: size }}
//       className="rounded-full bg-muted flex items-center justify-center text-muted-foreground font-medium text-xs flex-shrink-0">
//       {initials}
//     </div>
//   );
// };

// // ─── Match badge ──────────────────────────────────────────────────────────────

// const MatchBadge = ({ pct }: { pct: number }) => {
//   const color =
//     pct >= 70 ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/30" :
//     pct >= 40 ? "bg-blue-500/15 text-blue-400 border-blue-500/30" :
//                 "bg-purple-500/15 text-purple-400 border-purple-500/30";
//   return (
//     <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${color}`}>
//       {pct}% match
//     </span>
//   );
// };

// // ─── Activity path panel ──────────────────────────────────────────────────────

// const ActivityPath = ({
//   user, myClubs, onClose,
// }: {
//   user: SimilarUser;
//   myClubs: string[];
//   onClose?: () => void;
// }) => {
//   const activity = user.activity;
//   const pathItems: { icon: React.ReactNode; label: string; detail: string; highlight: boolean }[] = [];

//   if (activity) {
//     // Clubs
//     activity.clubs?.forEach(c => {
//       pathItems.push({
//         icon: <Users size={13} />,
//         label: c,
//         detail: "club",
//         highlight: user.shared_clubs?.includes(c) || myClubs.includes(c),
//       });
//     });

//     // GitHub
//     if (activity.github) {
//       pathItems.push({
//         icon: <Code2 size={13} />,
//         label: `${activity.github.total_commits} commits`,
//         detail: `${activity.github.streak_days}d streak`,
//         highlight: false,
//       });
//     }

//     // Strava
//     if (activity.strava) {
//       pathItems.push({
//         icon: <Dumbbell size={13} />,
//         label: `${activity.strava.total_distance_km} km`,
//         detail: `${activity.strava.total_moving_time_hrs}h active`,
//         highlight: false,
//       });
//     }

//     // Reviews
//     if (activity.movie_reviews?.length > 0)
//       pathItems.push({ icon: <Film size={13} />, label: `${activity.movie_reviews.length} films`, detail: "reviewed", highlight: false });
//     if (activity.game_reviews?.length > 0)
//       pathItems.push({ icon: <Gamepad2 size={13} />, label: `${activity.game_reviews.length} games`, detail: "reviewed", highlight: false });

//     // Post likes
//     activity.post_likes?.slice(0, 3).forEach(like => {
//       if (like.posts?.title) {
//         pathItems.push({
//           icon: <Heart size={13} />,
//           label: like.posts.title,
//           detail: like.posts.category || "post",
//           highlight: user.shared_categories?.includes((like.posts.category || "").toLowerCase()),
//         });
//       }
//     });
//   }

//   return (
//     <div className="rounded-2xl border border-border bg-card overflow-hidden">
//       <div className="flex items-center gap-3 p-4 border-b border-border">
//         <Avatar url={user.avatar_url} username={user.username} size={38} />
//         <div className="flex-1 min-w-0">
//           <div className="flex items-center gap-2">
//             <p className="text-sm font-semibold truncate">@{user.username}</p>
//             {user.match_pct != null && <MatchBadge pct={user.match_pct} />}
//           </div>
//           <p className="text-xs text-muted-foreground mt-0.5">
//             HGT score: <span className="text-primary font-medium">{user.score}</span>
//             {user.role && (
//               <>
//                 {" · "}
//                 <span className={user.role === "mentor" ? "text-emerald-400" : "text-blue-400"}>
//                   {user.role}
//                 </span>
//               </>
//             )}
//           </p>
//         </div>
//         {onClose && (
//           <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors">
//             <X size={16} />
//           </button>
//         )}
//       </div>

//       {(user.shared_clubs?.length > 0 || user.shared_categories?.length > 0) && (
//         <div className="px-4 py-2 bg-primary/5 border-b border-primary/10 flex flex-wrap gap-1.5">
//           <span className="text-xs text-primary/70 font-medium mr-1">Shared:</span>
//           {[...(user.shared_clubs || []), ...(user.shared_categories || [])].map(item => (
//             <span key={item}
//               className="text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20 capitalize">
//               {item}
//             </span>
//           ))}
//         </div>
//       )}

//       <div className="p-4">
//         {pathItems.length === 0 ? (
//           <p className="text-xs text-muted-foreground text-center py-4">No activity data yet.</p>
//         ) : (
//           <div className="relative">
//             <div className="absolute left-[18px] top-2 bottom-2 w-px bg-border" />
//             <div className="space-y-3">
//               {pathItems.map((item, i) => (
//                 <motion.div
//                   key={i}
//                   initial={{ opacity: 0, x: -8 }}
//                   animate={{ opacity: 1, x: 0 }}
//                   transition={{ delay: i * 0.04 }}
//                   className={`flex items-start gap-3 ${item.highlight ? "opacity-100" : "opacity-70"}`}
//                 >
//                   <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 z-10 ${
//                     item.highlight
//                       ? "bg-primary/15 text-primary border border-primary/30"
//                       : "bg-muted text-muted-foreground border border-border"
//                   }`}>
//                     {item.icon}
//                   </div>
//                   <div className="pt-1.5 min-w-0">
//                     <p className={`text-xs font-medium truncate ${item.highlight ? "text-foreground" : "text-muted-foreground"}`}>
//                       {item.label}
//                       {item.highlight && (
//                         <span className="ml-1.5 inline-flex items-center">
//                           <CheckCircle size={10} className="text-emerald-400" />
//                         </span>
//                       )}
//                     </p>
//                     <p className="text-xs text-muted-foreground capitalize">{item.detail}</p>
//                   </div>
//                 </motion.div>
//               ))}
//             </div>
//           </div>
//         )}
//       </div>
//     </div>
//   );
// };

// // ─── Node row ─────────────────────────────────────────────────────────────────

// const NodeRow = ({ icon, label, connected, points }: {
//   icon: React.ReactNode; label: string; connected: boolean; points?: number;
// }) => (
//   <div className={`flex items-center gap-3 p-3 rounded-xl border transition-colors ${
//     connected ? "border-border bg-muted/20" : "border-border/40 bg-muted/10 opacity-55"
//   }`}>
//     <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${
//       connected ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"
//     }`}>{icon}</div>
//     <div className="flex-1 min-w-0">
//       <p className="text-sm font-medium">{label}</p>
//       <p className={`text-xs ${connected ? "text-emerald-400" : "text-muted-foreground"}`}>
//         {connected ? "Connected" : "Not Connected"}
//       </p>
//     </div>
//     {connected && points !== undefined && (
//       <span className="text-sm font-semibold text-primary">+{points}</span>
//     )}
//   </div>
// );

// // ─── Main dashboard ───────────────────────────────────────────────────────────

// const TuneInDashboard = () => {
//   const navigate = useNavigate();

//   const [token, setToken]             = useState<string | null>(null);
//   const [userId, setUserId]           = useState<string | null>(null);
//   const [dashboard, setDashboard]     = useState<DashboardData | null>(null);
//   const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
//   const [loading, setLoading]         = useState(true);

//   // Global active user selector for the Activity Path component
//   const [activeUserId, setActiveUserId] = useState<string | null>(null);

//   // Graph node stats
//   const [clubsCount, setClubsCount] = useState(0);
//   const [likesCount, setLikesCount] = useState(0);
//   const [githubConn, setGithubConn] = useState(false);
//   const [stravaConn, setStravaConn] = useState(false);
//   const [myClubs, setMyClubs]       = useState<string[]>([]);

//   // ── Auth + boot ──────────────────────────────────────────────────────────
//   useEffect(() => {
//     supabase.auth.getSession().then(async ({ data: { session } }) => {
//       if (!session) { navigate("/login"); return; }
//       setToken(session.access_token);
//       setUserId(session.user.id);
//     });
//   }, [navigate]);

//   useEffect(() => {
//     if (!token || !userId) return;
//     loadAll(token, userId);
//   }, [token, userId]);

//   const loadAll = useCallback(async (tok: string, uid: string) => {
//     setLoading(true);
//     await Promise.all([
//       loadDashboard(tok),
//       loadLeaderboard(tok),
//       loadNodes(uid),
//     ]);
//     setLoading(false);
//   }, []);

//   const loadDashboard = async (tok: string) => {
//     const data = await apiFetch<DashboardData>("/api/tune-in/dashboard", tok);
//     if (data) {
//       setDashboard(data);
//       if (data.top_similar && data.top_similar.length > 0) {
//         // Default to the highest similarity user
//         setActiveUserId(data.top_similar[0].user_id);
//       }
//     }
//   };

//   const loadLeaderboard = async (tok: string) => {
//     const data = await apiFetch<LeaderboardEntry[]>("/api/tune-in/leaderboard?top_k=50", tok);
//     if (data) setLeaderboard(data);
//   };

//   const loadNodes = async (uid: string) => {
//     const [
//       { count: cCount, data: clubData },
//       { count: lCount },
//       { data: gh },
//       { data: st },
//     ] = await Promise.all([
//       supabase.from("club_members").select("clubs(name)", { count: "exact" }).eq("user_id", uid),
//       supabase.from("post_reactions").select("id", { count: "exact", head: true }).eq("user_id", uid).eq("reaction", "like"),
//       supabase.from("github_stats").select("user_id").eq("user_id", uid),
//       supabase.from("strava_stats").select("user_id").eq("user_id", uid),
//     ]);
//     setClubsCount(cCount ?? 0);
//     setLikesCount(lCount ?? 0);
//     setGithubConn((gh?.length ?? 0) > 0);
//     setStravaConn((st?.length ?? 0) > 0);

//     const names = (clubData || [])
//       .map((r: any) => r.clubs?.name?.toLowerCase())
//       .filter(Boolean) as string[];
//     setMyClubs(names);
//   };

//   // Build a unified list of users so we can find their data if clicked anywhere
//   const allKnownUsers = useMemo(() => {
//     if (!dashboard) return [];
//     return [
//       ...(dashboard.top_similar || []), 
//       ...(dashboard.mentors || []), 
//       ...(dashboard.mentees || [])
//     ];
//   }, [dashboard]);

//   const activeUser = useMemo(() => {
//     return allKnownUsers.find(u => u.user_id === activeUserId) || dashboard?.top_similar?.[0] || null;
//   }, [activeUserId, allKnownUsers, dashboard]);

//   const handleUserClick = (targetUserId: string, fallbackUsername: string) => {
//     const knownUser = allKnownUsers.find(u => u.user_id === targetUserId);
//     if (knownUser) {
//       setActiveUserId(knownUser.user_id);
//       document.getElementById("activity-path-section")?.scrollIntoView({ behavior: "smooth" });
//     } else {
//       // If they aren't in the dashboard payload, we fallback to profile since we lack their activity JSON.
//       navigate(`/user/${fallbackUsername}`);
//     }
//   };

//   if (loading) {
//     return (
//       <div className="h-screen bg-background flex items-center justify-center">
//         <div className="space-y-3 w-full max-w-lg px-5">
//           {[...Array(5)].map((_, i) => (
//             <div key={i} className="h-16 rounded-2xl bg-muted/40 animate-pulse" style={{ animationDelay: `${i * 80}ms` }} />
//           ))}
//         </div>
//       </div>
//     );
//   }

//   // Find the top 3 strictly above current user
//   const myLeaderboardRank = leaderboard.find(e => e.user_id === userId)?.rank ?? null;
//   const aboveMe = myLeaderboardRank
//     ? leaderboard.filter(e => e.rank < myLeaderboardRank && e.user_id !== userId)
//         .sort((a, b) => b.rank - a.rank)
//         .slice(0, 3)
//         .reverse()
//     : leaderboard.filter(e => e.user_id !== userId).slice(0, 3);

//   // Fallback Score Calculation if Backend is returning 0 but nodes are connected
//   const localCalculatedScore = (clubsCount * 15) + (likesCount * 2) + (githubConn ? 10 : 0) + (stravaConn ? 10 : 0);
//   const displayScore = dashboard?.total_score && dashboard.total_score > 0 
//     ? dashboard.total_score 
//     : localCalculatedScore;

//   return (
//     <div className="h-screen bg-background flex flex-col overflow-hidden">
//       <header className="h-14 border-b border-border flex items-center px-5 gap-4 flex-shrink-0">
//         <button onClick={() => navigate(-1)} className="text-muted-foreground hover:text-foreground transition-colors">
//           <ArrowLeft size={18} />
//         </button>
//         <div className="flex items-center gap-2">
//           <Sparkles size={16} className="text-primary" />
//           <span className="text-sm font-medium">Tune-In Engine</span>
//         </div>
//       </header>

//       <div className="flex-1 overflow-y-auto scrollbar-thin scrollbar-thumb-muted">
//         <div className="max-w-2xl mx-auto px-5 py-6 space-y-5">

//           {/* ── Hero ───────────────────────────────────────────────────── */}
//           <div className="rounded-2xl border border-border bg-gradient-to-br from-primary/5 via-transparent to-transparent p-6">
//             <p className="text-xs font-semibold tracking-wider text-primary uppercase mb-1">
//               Total Influence Score
//             </p>
//             <p className="text-5xl font-bold tabular-nums">
//               {displayScore}
//             </p>
//             <div className="mt-4 flex items-center justify-between">
//               <p className="text-xs text-muted-foreground">
//                 {dashboard
//                   ? `#${dashboard.rank ?? "—"} of ${dashboard.total_users} users`
//                   : "Loading…"}
//               </p>
//               <span className="text-xs text-muted-foreground">Global Graph Rank</span>
//             </div>
//             {dashboard?.rank && (
//               <p className="text-right text-4xl font-bold text-muted-foreground/30 mt-1">
//                 #{dashboard.rank}
//               </p>
//             )}
//           </div>

//           <div className="grid grid-cols-1 md:grid-cols-2 gap-5">

//             {/* ── Active Graph Nodes ───────────────────────────────────── */}
//             <div className="rounded-2xl border border-border bg-card p-5 space-y-3">
//               <div className="flex items-center gap-2 mb-1">
//                 <Link2 size={15} className="text-primary" />
//                 <p className="text-sm font-semibold">Active Graph Nodes</p>
//               </div>
//               <NodeRow icon={<Users size={15} />} label="Clubs Joined" connected={clubsCount > 0} points={clubsCount * 15} />
//               <NodeRow icon={<Heart size={15} />} label="Posts Liked" connected={likesCount > 0} points={likesCount * 2} />
//               <NodeRow icon={<Github size={15} />} label="GitHub" connected={githubConn} />
//               <NodeRow icon={<Activity size={15} />} label="Strava" connected={stravaConn} />
//             </div>

//             {/* ── HGT Mentors ──────────────────────────────────────────── */}
//             <div className="rounded-2xl border border-border bg-card p-5 space-y-3">
//               <div className="flex items-center gap-2 mb-1">
//                 <Sparkles size={15} className="text-primary" />
//                 <div>
//                   <p className="text-sm font-semibold">HGT Mentors</p>
//                   <p className="text-xs text-muted-foreground">Higher score, similar interests.</p>
//                 </div>
//               </div>
//               {dashboard?.mentors && dashboard.mentors.length > 0 ? (
//                 dashboard.mentors.slice(0, 3).map(user => (
//                   <motion.div
//                     key={user.user_id}
//                     initial={{ opacity: 0, y: 4 }}
//                     animate={{ opacity: 1, y: 0 }}
//                     onClick={() => handleUserClick(user.user_id, user.username)}
//                     className="flex items-center gap-3 p-3 rounded-xl border border-border bg-muted/20 hover:bg-muted/40 cursor-pointer transition-colors"
//                   >
//                     <Avatar url={user.avatar_url} username={user.username} size={32} />
//                     <div className="flex-1 min-w-0">
//                       <p className="text-xs font-medium truncate">@{user.username}</p>
//                       <MatchBadge pct={user.match_pct} />
//                     </div>
//                     <span className="text-xs font-semibold tabular-nums text-muted-foreground">{user.score}</span>
//                   </motion.div>
//                 ))
//               ) : (
//                 <p className="text-sm text-muted-foreground text-center py-6">
//                   {clubsCount === 0 ? "Join clubs to get mentor recommendations." : "No mentors yet — keep engaging!"}
//                 </p>
//               )}
//             </div>

//             {/* ── Top Similar Users + Activity Path ─────────────────────── */}
//             <div id="activity-path-section" className="md:col-span-2 space-y-4 pt-2">
//               <div className="flex items-center gap-2">
//                 <Zap size={14} className="text-primary flex-shrink-0" />
//                 <p className="text-sm font-semibold">Top 3 Similar Users</p>
//                 <p className="text-xs text-muted-foreground ml-1">— click to see their path</p>
//               </div>

//               {dashboard?.top_similar && dashboard.top_similar.length > 0 ? (
//                 <div className="flex gap-2 flex-wrap">
//                   {dashboard.top_similar.slice(0,3).map((user) => (
//                     <button
//                       key={user.user_id}
//                       onClick={() => setActiveUserId(user.user_id)}
//                       className={`flex items-center gap-2 px-3 py-2 rounded-xl border text-xs font-medium transition-colors ${
//                         activeUserId === user.user_id
//                           ? "bg-primary/10 border-primary/30 text-primary"
//                           : "bg-muted/20 border-border text-muted-foreground hover:text-foreground"
//                       }`}
//                     >
//                       <Avatar url={user.avatar_url} username={user.username} size={20} />
//                       @{user.username}
//                       <MatchBadge pct={user.match_pct} />
//                     </button>
//                   ))}
//                 </div>
//               ) : (
//                 <p className="text-sm text-muted-foreground">Calculating similarity matrix...</p>
//               )}

//               <AnimatePresence mode="wait">
//                 {activeUser && (
//                   <motion.div
//                     key={activeUser.user_id}
//                     initial={{ opacity: 0, y: 8 }}
//                     animate={{ opacity: 1, y: 0 }}
//                     exit={{ opacity: 0, y: -8 }}
//                     transition={{ duration: 0.18 }}
//                   >
//                     <ActivityPath user={activeUser} myClubs={myClubs} />
//                   </motion.div>
//                 )}
//               </AnimatePresence>
//             </div>

//             {/* ── HGT Mentees ──────────────────────────────────────────── */}
//             <div className="rounded-2xl border border-border bg-card p-5 space-y-3 md:col-span-2">
//               <div className="flex items-center gap-2 mb-1">
//                 <Users size={15} className="text-emerald-400" />
//                 <div>
//                   <p className="text-sm font-semibold">HGT Mentees</p>
//                   <p className="text-xs text-muted-foreground">Similar interests, looking to level up.</p>
//                 </div>
//               </div>
//               {dashboard?.mentees && dashboard.mentees.length > 0 ? (
//                 <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
//                   {dashboard.mentees.slice(0, 4).map(user => (
//                     <motion.div
//                       key={user.user_id}
//                       initial={{ opacity: 0, y: 4 }}
//                       animate={{ opacity: 1, y: 0 }}
//                       onClick={() => handleUserClick(user.user_id, user.username)}
//                       className="flex items-center gap-3 p-3 rounded-xl border border-border bg-muted/20 hover:bg-muted/40 cursor-pointer transition-colors"
//                     >
//                       <Avatar url={user.avatar_url} username={user.username} size={32} />
//                       <div className="flex-1 min-w-0">
//                         <p className="text-xs font-medium truncate">@{user.username}</p>
//                         <MatchBadge pct={user.match_pct} />
//                       </div>
//                       <span className="text-xs font-semibold tabular-nums text-muted-foreground">{user.score}</span>
//                     </motion.div>
//                   ))}
//                 </div>
//               ) : (
//                 <p className="text-sm text-muted-foreground text-center py-6">
//                   No mentees in your immediate graph radius.
//                 </p>
//               )}
//             </div>

//             {/* ── Leaderboard preview ───────────────────────────────────── */}
//             <div className="rounded-2xl border border-border bg-card p-5 md:col-span-2">
//               <div className="flex items-center justify-between mb-4">
//                 <div className="flex items-center gap-2">
//                   <Trophy size={15} className="text-yellow-400" />
//                   <div>
//                     <p className="text-sm font-semibold">Top Influencers Near You</p>
//                     <p className="text-xs text-muted-foreground">
//                       Top 3 above you · Similarity shown
//                     </p>
//                   </div>
//                 </div>
//                 <button
//                   onClick={() => navigate("/leaderboard")}
//                   className="text-xs text-primary hover:underline flex items-center gap-1"
//                 >
//                   View All <ChevronRight size={12} />
//                 </button>
//               </div>

//               {leaderboard.length === 0 ? (
//                 <p className="text-sm text-muted-foreground text-center py-6">Loading rankings…</p>
//               ) : (
//                 <div className="space-y-2">
//                   {aboveMe.map((entry, idx) => (
//                     <motion.div
//                       key={entry.user_id}
//                       initial={{ opacity: 0, x: -6 }}
//                       animate={{ opacity: 1, x: 0 }}
//                       transition={{ delay: idx * 0.06 }}
//                       onClick={() => handleUserClick(entry.user_id, entry.username)}
//                       className="flex items-center gap-3 p-3 rounded-xl cursor-pointer transition-colors hover:bg-muted/40 border border-transparent hover:border-border/50"
//                     >
//                       <span className="text-sm text-muted-foreground w-6 text-center font-medium">
//                         {entry.rank === 1 ? "🥇" : entry.rank === 2 ? "🥈" : entry.rank === 3 ? "🥉" : `${entry.rank}`}
//                       </span>
//                       <Avatar url={entry.avatar_url} username={entry.username} size={32} />
//                       <div className="flex-1 min-w-0">
//                         <p className="text-sm font-medium truncate">@{entry.username}</p>
//                         {entry.similarity_to_me != null && (
//                           <MatchBadge pct={entry.similarity_to_me} />
//                         )}
//                       </div>
//                       <div className="text-right flex-shrink-0">
//                         <p className="text-sm font-semibold tabular-nums">{entry.total_score}</p>
//                         <p className="text-xs text-muted-foreground">score</p>
//                       </div>
//                     </motion.div>
//                   ))}

//                   {myLeaderboardRank && (
//                     <div className="flex items-center gap-3 p-3 rounded-xl bg-primary/5 border border-primary/20">
//                       <span className="text-sm w-6 text-center text-primary font-semibold">
//                         #{myLeaderboardRank}
//                       </span>
//                       <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center">
//                         <Star size={13} className="text-primary" />
//                       </div>
//                       <div className="flex-1 min-w-0">
//                         <p className="text-sm font-medium text-primary">You</p>
//                         <p className="text-xs text-muted-foreground">your position</p>
//                       </div>
//                       <div className="text-right">
//                         <p className="text-sm font-semibold tabular-nums text-primary">
//                           {displayScore}
//                         </p>
//                         <p className="text-xs text-muted-foreground">score</p>
//                       </div>
//                     </div>
//                   )}
//                 </div>
//               )}
//             </div>

//           </div>
//         </div>
//       </div>
//     </div>
//   );
// };

// export default TuneInDashboard;



/* 
           VERSION - 2     */



import { useState, useEffect, useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "@/lib/supabase";
import {
  ArrowLeft, Sparkles, Link2, Heart, Github, Activity,
  Trophy, ChevronRight, X, Film, Gamepad2, Dumbbell,
  Code2, Users, Zap, CheckCircle, Star, Target, Compass
} from "lucide-react";

// ─── Types ───────────────────────────────────────────────────────────────────

interface ActivityData {
  clubs: string[];
  post_likes: { posts: { title: string; category: string } | null }[];
  strava: {
    total_distance_km: number;
    total_elevation_m: number;
    total_moving_time_hrs: number;
    score: number;
  } | null;
  github: {
    username: string;
    total_commits: number;
    streak_days: number;
    score: number;
  } | null;
  movie_reviews: any[];
  game_reviews: any[];
  hgt_score: number;
}

interface SimilarUser {
  user_id: string;
  username: string;
  avatar_url: string | null;
  score: number;
  match_pct: number;
  role: "mentor" | "mentee";
  shared_clubs: string[];
  shared_categories: string[];
  activity: ActivityData;
}

interface DashboardData {
  total_score: number;
  rank: number | null;
  total_users: number;
  top_similar: SimilarUser[];
  mentors: SimilarUser[];
  mentees: SimilarUser[];
}

interface LeaderboardEntry {
  rank: number;
  user_id: string;
  username: string;
  avatar_url: string | null;
  total_score: number;
  base_score: number;
  match_count: number;
  similarity_to_me: number | null;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";

async function apiFetch<T>(path: string, token: string): Promise<T | null> {
  try {
    const res = await fetch(`${API_URL}${path}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) {
      console.error(`API ${path} → ${res.status}`);
      return null;
    }
    return res.json();
  } catch (e) {
    console.error(`API ${path} failed:`, e);
    return null;
  }
}

// ─── Avatar ───────────────────────────────────────────────────────────────────

const Avatar = ({ url, username, size = 36 }: { url: string | null; username: string; size?: number }) => {
  const initials = (username || "??").slice(0, 2).toUpperCase();
  return url ? (
    <img src={url} alt={username} style={{ width: size, height: size }}
      className="rounded-full object-cover flex-shrink-0 border border-border/50 shadow-sm" />
  ) : (
    <div style={{ width: size, height: size }}
      className="rounded-full bg-gradient-to-br from-muted to-muted/50 flex items-center justify-center text-muted-foreground font-medium text-xs flex-shrink-0 border border-border/50 shadow-sm">
      {initials}
    </div>
  );
};

// ─── Match badge ──────────────────────────────────────────────────────────────

const MatchBadge = ({ pct }: { pct: number }) => {
  const color =
    pct >= 70 ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/30" :
    pct >= 40 ? "bg-blue-500/15 text-blue-400 border-blue-500/30" :
                "bg-purple-500/15 text-purple-400 border-purple-500/30";
  return (
    <span className={`text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full border font-bold ${color}`}>
      {pct}% Match
    </span>
  );
};

// ─── Activity path panel ──────────────────────────────────────────────────────

const ActivityPath = ({
  user, myClubs, onClose,
}: {
  user: SimilarUser;
  myClubs: string[];
  onClose?: () => void;
}) => {
  const activity = user.activity;
  const pathItems: { icon: React.ReactNode; label: string; detail: string; highlight: boolean }[] = [];

  let hasData = false;

  if (activity) {
    // Clubs
    if (activity.clubs?.length > 0) hasData = true;
    activity.clubs?.forEach(c => {
      pathItems.push({
        icon: <Users size={13} />,
        label: c,
        detail: "club",
        highlight: user.shared_clubs?.includes(c) || myClubs.includes(c),
      });
    });

    // GitHub
    if (activity.github) {
      hasData = true;
      pathItems.push({
        icon: <Code2 size={13} />,
        label: `${activity.github.total_commits} commits`,
        detail: `${activity.github.streak_days}d streak`,
        highlight: false,
      });
    }

    // Strava
    if (activity.strava) {
      hasData = true;
      pathItems.push({
        icon: <Dumbbell size={13} />,
        label: `${activity.strava.total_distance_km} km`,
        detail: `${activity.strava.total_moving_time_hrs}h active`,
        highlight: false,
      });
    }

    // Post likes
    if (activity.post_likes?.length > 0) hasData = true;
    activity.post_likes?.slice(0, 3).forEach(like => {
      if (like.posts?.title) {
        pathItems.push({
          icon: <Heart size={13} />,
          label: like.posts.title,
          detail: like.posts.category || "post",
          highlight: user.shared_categories?.includes((like.posts.category || "").toLowerCase()),
        });
      }
    });
  }

  return (
    <div className="rounded-2xl border border-border bg-card/80 backdrop-blur-sm overflow-hidden shadow-xl shadow-black/5">
      <div className="flex items-center gap-4 p-5 border-b border-border/50 bg-gradient-to-r from-card to-muted/20">
        <div className="relative">
          <Avatar url={user.avatar_url} username={user.username} size={48} />
          {user.role === "mentor" && (
            <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-emerald-500 rounded-full border-2 border-card flex items-center justify-center">
              <Sparkles size={10} className="text-white" />
            </div>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <p className="text-base font-bold truncate tracking-tight">@{user.username}</p>
            {user.match_pct != null && <MatchBadge pct={user.match_pct} />}
          </div>
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <Trophy size={12} className="text-yellow-500" /> 
              Score: <span className="text-foreground font-semibold">{user.score}</span>
            </span>
          </div>
        </div>
        {onClose && (
          <button onClick={onClose} className="w-8 h-8 rounded-full bg-muted/50 flex items-center justify-center text-muted-foreground hover:bg-muted hover:text-foreground transition-colors">
            <X size={16} />
          </button>
        )}
      </div>

      {(user.shared_clubs?.length > 0 || user.shared_categories?.length > 0) && (
        <div className="px-5 py-3 bg-primary/5 border-b border-primary/10 flex flex-wrap gap-2 items-center">
          <span className="text-xs text-primary/70 font-semibold tracking-wide uppercase mr-1">Shared Nodes:</span>
          {[...(user.shared_clubs || []), ...(user.shared_categories || [])].map(item => (
            <span key={item}
              className="text-xs px-2.5 py-1 rounded-md bg-primary/10 text-primary border border-primary/20 capitalize font-medium">
              {item}
            </span>
          ))}
        </div>
      )}

      <div className="p-5">
        {!hasData ? (
          <div className="text-center py-8 px-4 rounded-xl border border-dashed border-border/60 bg-muted/10">
            <Compass size={24} className="mx-auto mb-3 text-muted-foreground/50" />
            <p className="text-sm font-medium text-foreground mb-1">Path Data Unavailable</p>
            <p className="text-xs text-muted-foreground">Graph traversal complete, but detailed node data is restricted or not yet mapped.</p>
          </div>
        ) : (
          <div className="relative">
            <div className="absolute left-[18px] top-4 bottom-4 w-px bg-gradient-to-b from-border via-border to-transparent" />
            <div className="space-y-4">
              {pathItems.map((item, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.05, ease: "easeOut" }}
                  className={`flex items-start gap-4 ${item.highlight ? "opacity-100" : "opacity-60 hover:opacity-100 transition-opacity"}`}
                >
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 z-10 transition-colors ${
                    item.highlight
                      ? "bg-primary/15 text-primary border border-primary/30 shadow-[0_0_15px_rgba(var(--primary),0.15)]"
                      : "bg-muted text-muted-foreground border border-border"
                  }`}>
                    {item.icon}
                  </div>
                  <div className="pt-2 min-w-0">
                    <p className={`text-sm font-semibold truncate ${item.highlight ? "text-foreground" : "text-muted-foreground"}`}>
                      {item.label}
                      {item.highlight && (
                        <span className="ml-2 inline-flex items-center align-middle">
                          <CheckCircle size={12} className="text-emerald-500" />
                        </span>
                      )}
                    </p>
                    <p className="text-xs text-muted-foreground capitalize mt-0.5">{item.detail}</p>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

// ─── Main dashboard ───────────────────────────────────────────────────────────

const TuneInDashboard = () => {
  const navigate = useNavigate();

  const [token, setToken]             = useState<string | null>(null);
  const [userId, setUserId]           = useState<string | null>(null);
  const [dashboard, setDashboard]     = useState<DashboardData | null>(null);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading]         = useState(true);

  const [activeUserId, setActiveUserId] = useState<string | null>(null);

  // Graph node stats
  const [clubsCount, setClubsCount] = useState(0);
  const [likesCount, setLikesCount] = useState(0);
  const [githubConn, setGithubConn] = useState(false);
  const [stravaConn, setStravaConn] = useState(false);
  const [myClubs, setMyClubs]       = useState<string[]>([]);

  // ── Auth + boot ──────────────────────────────────────────────────────────
  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session) { navigate("/login"); return; }
      setToken(session.access_token);
      setUserId(session.user.id);
    });
  }, [navigate]);

  useEffect(() => {
    if (!token || !userId) return;
    loadAll(token, userId);
  }, [token, userId]);

  const loadAll = useCallback(async (tok: string, uid: string) => {
    setLoading(true);
    await Promise.all([
      loadDashboard(tok),
      loadLeaderboard(tok),
      loadNodes(uid),
    ]);
    setLoading(false);
  }, []);

  const loadDashboard = async (tok: string) => {
    const data = await apiFetch<DashboardData>("/api/tune-in/dashboard", tok);
    if (data) setDashboard(data);
  };

  const loadLeaderboard = async (tok: string) => {
    const data = await apiFetch<LeaderboardEntry[]>("/api/tune-in/leaderboard?top_k=50", tok);
    if (data) setLeaderboard(data);
  };

  const loadNodes = async (uid: string) => {
    const [
      { count: cCount, data: clubData },
      { count: lCount },
      { data: gh },
      { data: st },
    ] = await Promise.all([
      supabase.from("club_members").select("clubs(name)", { count: "exact" }).eq("user_id", uid),
      supabase.from("post_reactions").select("id", { count: "exact", head: true }).eq("user_id", uid).eq("reaction", "like"),
      supabase.from("github_stats").select("user_id").eq("user_id", uid),
      supabase.from("strava_stats").select("user_id").eq("user_id", uid),
    ]);
    setClubsCount(cCount ?? 0);
    setLikesCount(lCount ?? 0);
    setGithubConn((gh?.length ?? 0) > 0);
    setStravaConn((st?.length ?? 0) > 0);

    const names = (clubData || [])
      .map((r: any) => r.clubs?.name?.toLowerCase())
      .filter(Boolean) as string[];
    setMyClubs(names);
  };

  // ── Target Derivation Logic ───────────────────────────────────────────────
  
  const myLeaderboardRank = useMemo(() => {
    return leaderboard.find(e => e.user_id === userId)?.rank ?? Infinity;
  }, [leaderboard, userId]);

  // The core request: Top 3 Similar users who are HIGHER in the leaderboard
  const top3TargetsAhead = useMemo(() => {
    if (!leaderboard.length) return [];
    return leaderboard
      .filter(e => e.rank < myLeaderboardRank && e.user_id !== userId)
      .sort((a, b) => (b.similarity_to_me || 0) - (a.similarity_to_me || 0))
      .slice(0, 3);
  }, [leaderboard, myLeaderboardRank, userId]);

  // Set the default active user to the #1 target ahead of you
  useEffect(() => {
    if (top3TargetsAhead.length > 0 && !activeUserId) {
      setActiveUserId(top3TargetsAhead[0].user_id);
    }
  }, [top3TargetsAhead, activeUserId]);

  const allKnownUsers = useMemo(() => {
    if (!dashboard) return [];
    return [
      ...(dashboard.top_similar || []), 
      ...(dashboard.mentors || []), 
      ...(dashboard.mentees || [])
    ];
  }, [dashboard]);

  // Synthesize the user object for the ActivityPath component
  const activeDetailedUser = useMemo(() => {
    if (!activeUserId) return null;
    
    // Check if we have their full activity payload
    const known = allKnownUsers.find(u => u.user_id === activeUserId);
    if (known) return known;

    // If they are in the leaderboard but we lack their deep json graph data, mock the structure 
    // so the UI renders gracefully with the empty state instead of crashing.
    const rankEntry = leaderboard.find(u => u.user_id === activeUserId);
    if (rankEntry) {
      return {
        user_id: rankEntry.user_id,
        username: rankEntry.username,
        avatar_url: rankEntry.avatar_url,
        score: rankEntry.total_score,
        match_pct: rankEntry.similarity_to_me || 0,
        role: "mentor" as const,
        shared_clubs: [],
        shared_categories: [],
        activity: null as any
      };
    }
    return null;
  }, [activeUserId, allKnownUsers, leaderboard]);

  const handleUserClick = (targetUserId: string, fallbackUsername: string) => {
    // If they are in our targets panel, select them for the path view
    if (top3TargetsAhead.some(u => u.user_id === targetUserId) || allKnownUsers.some(u => u.user_id === targetUserId)) {
      setActiveUserId(targetUserId);
      document.getElementById("target-arena")?.scrollIntoView({ behavior: "smooth", block: "start" });
    } else {
      navigate(`/user/${fallbackUsername}`);
    }
  };

  if (loading) {
    return (
      <div className="h-screen bg-background flex items-center justify-center">
        <div className="space-y-4 w-full max-w-lg px-5">
          <div className="h-32 rounded-3xl bg-muted/40 animate-pulse" />
          <div className="grid grid-cols-2 gap-4">
            <div className="h-64 rounded-3xl bg-muted/30 animate-pulse" />
            <div className="h-64 rounded-3xl bg-muted/30 animate-pulse" />
          </div>
        </div>
      </div>
    );
  }

  const localCalculatedScore = (clubsCount * 15) + (likesCount * 2) + (githubConn ? 10 : 0) + (stravaConn ? 10 : 0);
  const displayScore = dashboard?.total_score && dashboard.total_score > 0 ? dashboard.total_score : localCalculatedScore;
  const displayRank = dashboard?.rank && dashboard.rank < Infinity ? dashboard.rank : myLeaderboardRank;

  return (
    <div className="h-screen bg-background flex flex-col overflow-hidden font-sans">
      <header className="h-16 border-b border-border/60 bg-background/80 backdrop-blur-md flex items-center px-6 gap-4 flex-shrink-0 z-10">
        <button onClick={() => navigate(-1)} className="w-8 h-8 flex items-center justify-center rounded-full bg-muted/50 hover:bg-muted text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft size={16} />
        </button>
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
            <Sparkles size={16} className="text-primary" />
          </div>
          <span className="text-sm font-bold tracking-tight">Tune-In Engine</span>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto scrollbar-thin scrollbar-thumb-muted pb-20">
        <div className="max-w-5xl mx-auto px-5 py-6 space-y-6">

          {/* ── Top Hero: Score Overview ─────────────────────────────────── */}
          <div className="flex flex-col md:flex-row gap-5">
            <div className="flex-1 rounded-3xl border border-border/50 bg-gradient-to-br from-primary/10 via-background to-background p-8 relative overflow-hidden shadow-sm">
              <div className="absolute top-0 right-0 w-64 h-64 bg-primary/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 pointer-events-none" />
              <p className="text-xs font-bold tracking-widest text-primary uppercase mb-2">Total Influence</p>
              <div className="flex items-end gap-4">
                <p className="text-6xl font-black tabular-nums tracking-tighter">{displayScore}</p>
                {displayRank !== Infinity && (
                  <p className="text-xl font-semibold text-muted-foreground mb-1.5 flex items-center gap-1">
                    <Trophy size={18} className="text-yellow-500/80" /> #{displayRank}
                  </p>
                )}
              </div>
            </div>

            <div className="md:w-72 rounded-3xl border border-border/50 bg-card p-5 flex flex-col justify-center">
               <p className="text-xs font-bold tracking-widest text-muted-foreground uppercase mb-4 text-center">Active Nodes</p>
               <div className="flex justify-between px-2">
                 <div className="text-center">
                   <div className={`w-12 h-12 mx-auto rounded-full flex items-center justify-center mb-2 ${clubsCount > 0 ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground"}`}><Users size={20} /></div>
                   <p className="text-xs font-medium">Clubs</p>
                 </div>
                 <div className="text-center">
                   <div className={`w-12 h-12 mx-auto rounded-full flex items-center justify-center mb-2 ${githubConn ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground"}`}><Code2 size={20} /></div>
                   <p className="text-xs font-medium">GitHub</p>
                 </div>
                 <div className="text-center">
                   <div className={`w-12 h-12 mx-auto rounded-full flex items-center justify-center mb-2 ${stravaConn ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground"}`}><Activity size={20} /></div>
                   <p className="text-xs font-medium">Strava</p>
                 </div>
               </div>
            </div>
          </div>

          {/* ── Main Arena: Target Layout ────────────────────────────────── */}
          <div id="target-arena" className="grid grid-cols-1 lg:grid-cols-3 gap-6 pt-4">
            
            {/* Left: Main Activity Path (Col Span 2) */}
            <div className="lg:col-span-2 space-y-4">
              <div className="flex items-center gap-2">
                <Target size={18} className="text-primary" />
                <h2 className="text-lg font-bold tracking-tight">Path Configuration</h2>
                <p className="text-sm text-muted-foreground ml-2">Analyze your next targets</p>
              </div>

              <AnimatePresence mode="wait">
                {activeDetailedUser ? (
                  <motion.div
                    key={activeDetailedUser.user_id}
                    initial={{ opacity: 0, y: 10, scale: 0.98 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -10, scale: 0.98 }}
                    transition={{ duration: 0.2 }}
                  >
                    <ActivityPath user={activeDetailedUser} myClubs={myClubs} />
                  </motion.div>
                ) : (
                  <div className="h-64 rounded-2xl border border-dashed border-border flex items-center justify-center bg-muted/5 text-muted-foreground text-sm">
                    {top3TargetsAhead.length === 0 
                      ? "You are at the top of your immediate graph. Keep growing!"
                      : "Select a target from the panel to view their path."}
                  </div>
                )}
              </AnimatePresence>
            </div>

            {/* Right: Target Selection Panel */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-bold tracking-widest uppercase text-muted-foreground">Targets Ahead</h2>
              </div>
              
              <div className="space-y-3">
                {top3TargetsAhead.length === 0 ? (
                  <div className="p-4 rounded-xl border border-border bg-card/50 text-center text-sm text-muted-foreground">
                    No higher-ranked targets found.
                  </div>
                ) : (
                  top3TargetsAhead.map((user, idx) => {
                    const isActive = activeUserId === user.user_id;
                    return (
                      <motion.button
                        key={user.user_id}
                        initial={{ opacity: 0, x: 10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: idx * 0.1 }}
                        onClick={() => setActiveUserId(user.user_id)}
                        className={`w-full text-left flex items-center gap-3 p-3.5 rounded-2xl border transition-all duration-200 ${
                          isActive 
                            ? "bg-primary/5 border-primary/40 shadow-sm" 
                            : "bg-card border-border/50 hover:border-border hover:bg-muted/30"
                        }`}
                      >
                        <div className="relative">
                          <Avatar url={user.avatar_url} username={user.username} size={40} />
                          <div className="absolute -top-2 -left-2 w-6 h-6 rounded-full bg-background border border-border flex items-center justify-center text-[10px] font-bold">
                            #{user.rank}
                          </div>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className={`text-sm font-bold truncate ${isActive ? "text-foreground" : ""}`}>
                            @{user.username}
                          </p>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className="text-xs font-medium text-muted-foreground">{user.total_score} pts</span>
                            {user.similarity_to_me != null && <MatchBadge pct={user.similarity_to_me} />}
                          </div>
                        </div>
                        {isActive && <ChevronRight size={16} className="text-primary flex-shrink-0" />}
                      </motion.button>
                    );
                  })
                )}
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
};

export default TuneInDashboard;