import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import {
  ArrowLeft,
  MessageSquare,
  Link2,
  Film,
  Gamepad2,
  FileText,
  Trophy,
  Github,
  Music,
  Instagram,
  Linkedin,
  ExternalLink,
  Search,
  Camera,
  Edit2,
  Check,
  X,
  Loader2
} from "lucide-react";

// Components from your old file
import PostCard from "@/components/home/PostCard";
import PostDetailDialog from "@/components/home/PostDetailDialog";
import MovieDetailDialog from "@/components/home/MovieDetailDialog";
import GameDetailDialog from "@/components/home/GameDetailDialog";
import { mapFeedRowsToPostCards } from "@/lib/feedMap";
import { tmdb, img, type TMDBMovie } from "@/lib/tmdb";
import { igdb, gameImg, type IGDBGame } from "@/lib/igdb";

// ─── Connection config ─────────────────────────────────────────────────────
const CONNECTION_META: Record<
  string,
  { label: string; icon: React.ReactNode; color: string; placeholder: string }
> = {
  spotify: { label: "Spotify", icon: <Music size={15} />, color: "#1db954", placeholder: "Spotify Profile URL" },
  github: { label: "GitHub", icon: <Github size={15} />, color: "#aaa", placeholder: "GitHub Username" },
  instagram: { label: "Instagram", icon: <Instagram size={15} />, color: "#e1306c", placeholder: "Instagram Username" },
  linkedin: { label: "LinkedIn", icon: <Linkedin size={15} />, color: "#0a66c2", placeholder: "LinkedIn URL" },
  steam: { label: "Steam", icon: <Gamepad2 size={15} />, color: "#66c0f4", placeholder: "Steam ID / URL" },
  leetcode: { label: "LeetCode", icon: <FileText size={15} />, color: "#ffa116", placeholder: "LeetCode Username" },
  codolio: { label: "Codolio", icon: <Link2 size={15} />, color: "#a78bfa", placeholder: "Codolio URL" },
  strava: { label: "Strava", icon: <Trophy size={15} />, color: "#fc4c02", placeholder: "Strava Profile ID" },
  letterboxd: { label: "Letterboxd", icon: <Film size={15} />, color: "#00c030", placeholder: "Letterboxd Username" },
};

// ─── UI Helpers ────────────────────────────────────────────────────────────
const Avatar = ({ url, username, size = 80 }: { url: string | null; username: string; size?: number }) => {
  const initials = username?.slice(0, 2).toUpperCase() || "??";
  return url ? (
    <img
      src={url}
      alt={username}
      style={{ width: size, height: size }}
      className="rounded-full object-cover ring-4 ring-background shadow-xl"
    />
  ) : (
    <div
      style={{ width: size, height: size }}
      className="rounded-full bg-muted flex items-center justify-center text-muted-foreground font-medium ring-4 ring-background shadow-xl"
    >
      <span style={{ fontSize: size * 0.3 }}>{initials}</span>
    </div>
  );
};

const Stars = ({ rating }: { rating: number }) => (
  <div className="flex gap-0.5">
    {[1, 2, 3, 4, 5].map((i) => (
      <span key={i} className={`text-[10px] sm:text-xs ${i <= rating ? "text-yellow-400 drop-shadow-sm" : "text-muted-foreground/30"}`}>
        ★
      </span>
    ))}
  </div>
);

const Empty = ({ label, icon: Icon }: { label: string, icon: any }) => (
  <div className="py-16 text-center text-muted-foreground text-sm flex flex-col items-center gap-3 bg-muted/10 rounded-2xl border border-dashed border-border/60">
    <Icon className="w-10 h-10 text-muted-foreground/40" />
    {label}
  </div>
);

// ─── Main component ────────────────────────────────────────────────────────
export default function UserProfile() {
  const { username } = useParams<{ username: string }>();
  const navigate = useNavigate();

  // Core Profile State
  const [profile, setProfile] = useState<any>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [isOwnProfile, setIsOwnProfile] = useState(false);
  const [loading, setLoading] = useState(true);

  // Edit States
  const [isEditingBio, setIsEditingBio] = useState(false);
  const [editBioText, setEditBioText] = useState("");
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  
  const [isEditingConnections, setIsEditingConnections] = useState(false);
  const [editConnections, setEditConnections] = useState<Record<string, string>>({});
  const [savingConnections, setSavingConnections] = useState(false);

  // Social Stats State
  const [postCount, setPostCount] = useState(0);
  const [userRank, setUserRank] = useState<number | null>(null);
  const [userScore, setUserScore] = useState<number | null>(null);

  // Tabs & Data State
  const [activeTab, setActiveTab] = useState<"posts" | "cinema" | "games">("posts");
  const [tabLoading, setTabLoading] = useState(false);
  
  const [posts, setPosts] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  
  const [movieReviews, setMovieReviews] = useState<any[]>([]);
  const [gameReviews, setGameReviews] = useState<any[]>([]);

  // Modals/Dialogs State
  const [selectedPost, setSelectedPost] = useState<any>(null);
  const [selectedMovie, setSelectedMovie] = useState<TMDBMovie | null>(null);
  const [selectedGameId, setSelectedGameId] = useState<number | null>(null);

  // ── Load profile & relationships ──────────────────────────────────────────
  useEffect(() => {
    const load = async () => {
      if (!username) return;
      setLoading(true);
      
      const { data: { session } } = await supabase.auth.getSession();
      const uid = session?.user?.id ?? null;
      setCurrentUserId(uid);

      const { data: prof, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("username", username)
        .single();

      if (error || !prof) {
        toast.error("User not found");
        navigate("/home");
        return;
      }

      setProfile(prof);
      setIsOwnProfile(uid === prof.id);

      // Fetch post count
      const { count: pc } = await supabase
        .from("posts")
        .select("*", { count: "exact", head: true })
        .eq("user_id", prof.id);

      setPostCount(pc ?? 0);
      setLoading(false);
    };

    load();
  }, [username, navigate]);

  // ── Fetch Global Rank ───────────────────────────────────────────────────
  useEffect(() => {
    if (!profile) return;
    const fetchRank = async () => {
      const [{ data: profiles }, { data: movieCounts }, { data: gameCounts }, { data: postCounts }] =
        await Promise.all([
          supabase.from("profiles").select("id"),
          supabase.from("movie_reviews").select("user_id"),
          supabase.from("game_reviews").select("user_id"),
          supabase.from("posts").select("user_id"),
        ]);

      const tally = (arr: any[]) => {
        const map: Record<string, number> = {};
        arr?.forEach((r) => { if (r.user_id) map[r.user_id] = (map[r.user_id] ?? 0) + 1; });
        return map;
      };

      const movies = tally(movieCounts);
      const games = tally(gameCounts);
      const posts = tally(postCounts);

      const scores = (profiles ?? []).map((p) => ({
        id: p.id,
        score: (movies[p.id] ?? 0) * 3 + (games[p.id] ?? 0) * 3 + (posts[p.id] ?? 0) * 1,
      })).sort((a, b) => b.score - a.score);

      const rankIdx = scores.findIndex(s => s.id === profile.id);
      if (rankIdx !== -1) {
        setUserRank(rankIdx + 1);
        setUserScore(scores[rankIdx].score);
      }
    };
    fetchRank();
  }, [profile]);

  // ── Load Tab Content (with APIs) ──────────────────────────────────────────
  useEffect(() => {
    if (!profile) return;
    const loadTab = async () => {
      setTabLoading(true);

      if (activeTab === "posts") {
        const { data } = await supabase
          .from("posts")
          .select("*")
          .eq("user_id", profile.id)
          .order("created_at", { ascending: false })
          .limit(30);

        if (data) {
          const mapped = await mapFeedRowsToPostCards(supabase, data);
          setPosts(mapped);
        }
      } 
      else if (activeTab === "cinema") {
        const { data } = await supabase
          .from("movie_reviews")
          .select("*")
          .eq("user_id", profile.id)
          .order("created_at", { ascending: false })
          .limit(30);

        if (data && data.length > 0) {
          const enriched = await Promise.all(
            data.map(async (rev) => {
              try {
                const tmdbData = rev.media_type === "tv" 
                  ? await tmdb.tvDetail(rev.movie_id) 
                  : await tmdb.movieDetail(rev.movie_id);
                return { ...rev, tmdb: tmdbData };
              } catch {
                return rev;
              }
            })
          );
          setMovieReviews(enriched.filter((r) => r.tmdb));
        } else {
          setMovieReviews([]);
        }
      } 
      else if (activeTab === "games") {
        const { data } = await supabase
          .from("game_reviews")
          .select("*")
          .eq("user_id", profile.id)
          .order("created_at", { ascending: false })
          .limit(30);

        if (data && data.length > 0) {
          const enriched = await Promise.all(
            data.map(async (rev) => {
              try {
                const gameData = await igdb.gameDetail(rev.game_id);
                return { ...rev, game: gameData };
              } catch {
                return rev;
              }
            })
          );
          setGameReviews(enriched.filter((r) => r.game));
        } else {
          setGameReviews([]);
        }
      }

      setTabLoading(false);
    };

    loadTab();
  }, [activeTab, profile]);

  // ── Action: Handle Bio Save ───────────────────────────────────────────────
  const handleSaveBio = async () => {
    try {
      const { error } = await supabase.from('profiles').update({ bio: editBioText }).eq('id', profile.id);
      if (error) throw error;
      setProfile({ ...profile, bio: editBioText });
      setIsEditingBio(false);
      toast.success("Bio updated successfully!");
    } catch (err: any) {
      toast.error(err.message || "Failed to update bio");
    }
  };

  // ── Action: Handle Connections Save ───────────────────────────────────────
  const handleSaveConnections = async () => {
    setSavingConnections(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ connections: editConnections })
        .eq('id', profile.id);

      if (error) throw error;
      setProfile({ ...profile, connections: editConnections });
      setIsEditingConnections(false);
      toast.success("Connections linked successfully!");
    } catch (err: any) {
      toast.error(err.message || "Failed to update connections.");
    } finally {
      setSavingConnections(false);
    }
  };

  // ── Action: Handle Avatar Upload ──────────────────────────────────────────
  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !profile) return;
    
    setUploadingAvatar(true);
    try {
      const fileExt = file.name.split('.').pop();
      const filePath = `${profile.id}-${Math.random()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage.from('avatars').upload(filePath, file);

      if (uploadError) {
        throw new Error("Ensure you have a public storage bucket named 'avatars' created in Supabase.");
      }

      const { data } = supabase.storage.from('avatars').getPublicUrl(filePath);

      const { error: updateError } = await supabase.from('profiles').update({ avatar_url: data.publicUrl }).eq('id', profile.id);
      if (updateError) throw updateError;

      setProfile({ ...profile, avatar_url: data.publicUrl });
      toast.success("Profile picture updated!");
    } catch (err: any) {
      toast.error(err.message || "Error uploading avatar.");
    } finally {
      setUploadingAvatar(false);
    }
  };


  if (loading) {
    return (
      <div className="h-screen bg-background flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!profile) return null;

  const connections = (profile.connections as Record<string, string>) ?? {};
  const tabs = [
    { key: "posts", label: "Posts", icon: <FileText size={14} /> },
    { key: "cinema", label: "Cinema", icon: <Film size={14} /> },
    { key: "games", label: "Games", icon: <Gamepad2 size={14} /> },
  ] as const;

  return (
    <div className="h-screen bg-background flex flex-col overflow-hidden pb-16 md:pb-0">
      {/* ── Top Header ── */}
      <header className="h-14 border-b border-border flex items-center px-5 gap-4 flex-shrink-0 bg-background/80 backdrop-blur-xl z-10">
        <button onClick={() => navigate(-1)} className="text-muted-foreground hover:text-foreground transition-colors p-1">
          <ArrowLeft size={18} />
        </button>
        <span className="text-sm font-semibold truncate">@{profile.username}</span>
        <div className="ml-auto flex gap-2">
          {!isOwnProfile && currentUserId && (
            <button
              onClick={() => navigate(`/messages/${profile.username}`)}
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm border border-border text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-all"
            >
              <MessageSquare size={14} />
              <span className="hidden sm:inline">Message</span>
            </button>
          )}
          {isOwnProfile && (
            <button
              onClick={() => navigate("/settings/profile")}
              className="px-4 py-1.5 rounded-lg text-sm border border-border text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-all"
            >
              Settings
            </button>
          )}
        </div>
      </header>

      {/* ── Scrollable Content ── */}
      <div className="flex-1 overflow-y-auto scrollbar-none">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-6 sm:py-10 space-y-8">
          
          {/* Hero Card */}
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="rounded-2xl border border-border bg-card/40 backdrop-blur-sm p-6 sm:p-8 space-y-6 shadow-sm">
            <div className="flex flex-col sm:flex-row items-center sm:items-start gap-6">
              
              {/* Interactive Avatar */}
              <div className="relative group shrink-0 cursor-pointer">
                <Avatar url={profile.avatar_url} username={profile.username} size={96} />
                {isOwnProfile && (
                  <label className="absolute inset-0 bg-black/50 rounded-full flex flex-col items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer backdrop-blur-sm">
                    {uploadingAvatar ? (
                      <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <Camera className="w-6 h-6 text-white" />
                    )}
                    <input 
                      type="file" 
                      accept="image/*" 
                      className="hidden" 
                      onChange={handleAvatarUpload} 
                      disabled={uploadingAvatar} 
                    />
                  </label>
                )}
              </div>

              {/* User Info & Bio */}
              <div className="flex-1 text-center sm:text-left min-w-0 w-full">
                <div className="flex flex-col sm:flex-row items-center justify-center sm:justify-start gap-3 mb-2">
                  <h1 className="text-2xl font-bold tracking-tight">@{profile.username}</h1>
                  {userRank && (
                    <span className="px-2.5 py-1 rounded-full bg-yellow-500/10 text-yellow-500 text-xs font-bold border border-yellow-500/20 flex items-center gap-1 shadow-sm">
                      <Trophy className="w-3.5 h-3.5" /> Rank #{userRank}
                    </span>
                  )}
                </div>
                
                {/* Editable Bio Section */}
                <div className="mt-2 max-w-md mx-auto sm:mx-0 group">
                  {isEditingBio ? (
                    <div className="space-y-2">
                      <textarea
                        value={editBioText}
                        onChange={(e) => setEditBioText(e.target.value)}
                        placeholder="Write something about yourself..."
                        className="w-full bg-muted/30 border border-primary/50 rounded-xl p-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 resize-none h-24"
                      />
                      <div className="flex gap-2 justify-end sm:justify-start">
                        <button onClick={handleSaveBio} className="flex items-center gap-1 px-3 py-1.5 bg-primary text-primary-foreground rounded-lg text-xs font-medium hover:bg-primary/90 transition-all">
                          <Check size={14} /> Save
                        </button>
                        <button onClick={() => setIsEditingBio(false)} className="flex items-center gap-1 px-3 py-1.5 border border-border rounded-lg text-xs font-medium hover:bg-muted transition-all">
                          <X size={14} /> Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-start justify-center sm:justify-start gap-2 relative">
                      <p className="text-sm text-muted-foreground leading-relaxed">
                        {profile.bio || "This user hasn't added a bio yet."}
                      </p>
                      {isOwnProfile && (
                        <button 
                          onClick={() => { setEditBioText(profile.bio || ""); setIsEditingBio(true); }}
                          className="opacity-0 group-hover:opacity-100 p-1 text-muted-foreground hover:text-primary transition-all rounded-md shrink-0 sm:absolute sm:-right-8"
                          title="Edit Bio"
                        >
                          <Edit2 size={14} />
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Stats Row */}
            <div className="flex gap-6 sm:gap-8 pt-4 border-t border-border justify-center sm:justify-start">
              <div className="text-center sm:text-left">
                <div className="text-xl font-bold">{postCount}</div>
                <div className="text-xs text-muted-foreground mt-0.5">Posts</div>
              </div>
              {userScore !== null && (
                <div className="text-center sm:text-left">
                  <div className="text-xl font-bold">{userScore}</div>
                  <div className="text-xs text-muted-foreground mt-0.5">Total Score</div>
                </div>
              )}
            </div>
          </motion.div>

          {/* Connections System */}
          <div className="space-y-4">
            <div className="flex items-center justify-between px-1">
              <p className="text-xs font-bold tracking-wider text-muted-foreground uppercase">
                Connections
              </p>
              {isOwnProfile && !isEditingConnections && (
                <button 
                  onClick={() => { setEditConnections(profile.connections || {}); setIsEditingConnections(true); }} 
                  className="text-xs flex items-center gap-1.5 font-medium text-muted-foreground hover:text-foreground transition-colors bg-muted/40 px-2.5 py-1 rounded-md"
                >
                  <Edit2 size={12} /> Edit Links
                </button>
              )}
              {isOwnProfile && isEditingConnections && (
                <div className="flex items-center gap-2">
                  <button onClick={() => setIsEditingConnections(false)} className="text-xs font-medium text-muted-foreground hover:text-foreground px-2 py-1 transition-colors">
                    Cancel
                  </button>
                  <button onClick={handleSaveConnections} disabled={savingConnections} className="text-xs flex items-center gap-1.5 bg-primary text-primary-foreground font-medium px-3 py-1.5 rounded-md hover:bg-primary/90 transition-all shadow-sm">
                    {savingConnections ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />} Save
                  </button>
                </div>
              )}
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
              {Object.keys(CONNECTION_META).map((key) => {
                const meta = CONNECTION_META[key];
                const url = isEditingConnections ? (editConnections[key] || "") : (connections[key] || "");
                const isLinked = !!url;

                if (isEditingConnections) {
                  return (
                    <div key={key} className="flex flex-col gap-1.5 p-3 rounded-xl border border-border/50 bg-card/40 shadow-sm">
                      <div className="flex items-center gap-2 text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
                        <span style={{ color: meta.color }}>{meta.icon}</span> {meta.label}
                      </div>
                      <input
                        type="text"
                        placeholder={meta.placeholder}
                        value={url}
                        onChange={(e) => setEditConnections({ ...editConnections, [key]: e.target.value })}
                        className="w-full bg-background border border-border rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:border-primary/50 transition-colors"
                      />
                    </div>
                  );
                }

                return (
                  <div
                    key={key}
                    onClick={() => {
                      // Only redirect if there is a URL and it looks like a valid link.
                      if (isLinked && url.includes('.')) {
                        const finalUrl = url.startsWith('http') ? url : `https://${url}`;
                        window.open(finalUrl, "_blank", "noopener,noreferrer");
                      }
                    }}
                    className={`flex items-center gap-3 px-4 py-3 rounded-xl border transition-all ${
                      isLinked
                        ? "border-border bg-card shadow-sm hover:border-foreground/30 cursor-pointer hover:shadow-md group"
                        : "border-border/30 bg-muted/5 opacity-50"
                    }`}
                  >
                    <span 
                      className={`transition-colors duration-300 ${isLinked ? "group-hover:scale-110" : ""}`}
                      style={{ color: isLinked ? meta.color : "inherit" }}
                    >
                      {meta.icon}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-semibold truncate">{meta.label}</div>
                      <div className={`text-[10px] mt-0.5 ${isLinked ? "text-emerald-500 font-medium" : "text-muted-foreground"}`}>
                        {isLinked ? (url.includes('.') ? "Connected" : `@${url}`) : "Not linked"}
                      </div>
                    </div>
                    {isLinked && url.includes('.') && <ExternalLink size={12} className="text-muted-foreground/40 group-hover:text-muted-foreground transition-colors flex-shrink-0" />}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Tabs Menu */}
          <div className="space-y-6 pt-6">
            <div className="flex gap-1 border-b border-border overflow-x-auto scrollbar-none">
              {tabs.map((t) => (
                <button
                  key={t.key}
                  onClick={() => setActiveTab(t.key)}
                  className={`flex items-center gap-2 px-5 py-3 text-sm font-semibold border-b-2 transition-all whitespace-nowrap ${
                    activeTab === t.key
                      ? "border-primary text-foreground"
                      : "border-transparent text-muted-foreground hover:text-foreground hover:bg-muted/30 rounded-t-lg"
                  }`}
                >
                  {t.icon}
                  {t.label}
                </button>
              ))}
            </div>

            {/* Posts Search UI */}
            {activeTab === "posts" && (
              <div className="relative">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground w-4 h-4" />
                <input
                  type="text"
                  placeholder="Search posts…"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-card border border-border rounded-xl pl-10 pr-4 py-3 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all shadow-sm"
                />
              </div>
            )}

            {/* Tab Contents */}
            <AnimatePresence mode="wait">
              <motion.div
                key={activeTab}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.2 }}
                className="space-y-4"
              >
                {/* Loading Skeleton */}
                {tabLoading && (
                  <div className="grid gap-4">
                    {[1, 2, 3].map((i) => (
                      <div key={i} className="h-28 rounded-2xl bg-muted/40 animate-pulse border border-border/50" />
                    ))}
                  </div>
                )}

                {/* Posts Content */}
                {!tabLoading && activeTab === "posts" && (
                  posts.length === 0 ? (
                    <Empty label="No posts found." icon={FileText} />
                  ) : (
                    <div className="flex flex-col gap-4">
                      {posts
                        .filter((p) =>
                          (p.title || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
                          (p.content || "").toLowerCase().includes(searchQuery.toLowerCase())
                        )
                        .map((post) => (
                          <PostCard
                            key={post.id}
                            {...post}
                            onOpenDetail={() => setSelectedPost(post)}
                          />
                        ))}
                    </div>
                  )
                )}

                {/* Cinema Content */}
                {!tabLoading && activeTab === "cinema" && (
                  movieReviews.length === 0 ? (
                    <Empty label="No movie reviews yet." icon={Film} />
                  ) : (
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                      {movieReviews.map((rev, i) => {
                        const movie = rev.tmdb;
                        if (!movie) return null;
                        const title = movie.title || movie.name;
                        const poster = img(movie.poster_path, "w185");

                        return (
                          <motion.div
                            key={rev.id}
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            transition={{ delay: i * 0.05 }}
                            onClick={() => setSelectedMovie({ ...movie, media_type: rev.media_type } as any)}
                            className="rounded-xl border border-border bg-card overflow-hidden hover:border-primary/40 cursor-pointer transition-all shadow-sm group flex flex-col h-full"
                          >
                            <div className="w-full aspect-[2/3] bg-muted relative overflow-hidden">
                              {poster ? (
                                <img src={poster} alt={title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                              ) : (
                                <div className="w-full h-full flex items-center justify-center text-xs text-muted-foreground uppercase">No Image</div>
                              )}
                            </div>
                            <div className="p-3 flex-1 flex flex-col justify-between space-y-2">
                              <div>
                                <p className="text-sm font-bold line-clamp-1 group-hover:text-primary transition-colors">{title}</p>
                                <div className="mt-1">
                                  <Stars rating={rev.rating} />
                                </div>
                              </div>
                              {rev.content && (
                                <p className="text-[11px] text-muted-foreground line-clamp-2 leading-relaxed">
                                  "{rev.content}"
                                </p>
                              )}
                            </div>
                          </motion.div>
                        );
                      })}
                    </div>
                  )
                )}

                {/* Games Content */}
                {!tabLoading && activeTab === "games" && (
                  gameReviews.length === 0 ? (
                    <Empty label="No game reviews yet." icon={Gamepad2} />
                  ) : (
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                      {gameReviews.map((rev, i) => {
                        const game = rev.game;
                        if (!game) return null;
                        const poster = gameImg(game.cover?.url, "t_cover_big");

                        return (
                          <motion.div
                            key={rev.id}
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            transition={{ delay: i * 0.05 }}
                            onClick={() => setSelectedGameId(game.id)}
                            className="rounded-xl border border-border bg-card overflow-hidden hover:border-primary/40 cursor-pointer transition-all shadow-sm group flex flex-col h-full"
                          >
                            <div className="w-full aspect-[3/4] bg-muted relative overflow-hidden">
                              {poster ? (
                                <img src={poster} alt={game.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                              ) : (
                                <div className="w-full h-full flex items-center justify-center text-xs text-muted-foreground uppercase">No Image</div>
                              )}
                            </div>
                            <div className="p-3 flex-1 flex flex-col justify-between space-y-2">
                              <div>
                                <p className="text-sm font-bold line-clamp-1 group-hover:text-primary transition-colors">{game.name}</p>
                                <div className="mt-1">
                                  <Stars rating={rev.rating} />
                                </div>
                              </div>
                              {rev.content && (
                                <p className="text-[11px] text-muted-foreground line-clamp-2 leading-relaxed">
                                  "{rev.content}"
                                </p>
                              )}
                            </div>
                          </motion.div>
                        );
                      })}
                    </div>
                  )
                )}
              </motion.div>
            </AnimatePresence>
          </div>
        </div>
      </div>

      <PostDetailDialog
        post={selectedPost}
        open={!!selectedPost && activeTab === "posts"}
        onOpenChange={(o) => {
          if (!o) setSelectedPost(null);
        }}
      />
      
      <MovieDetailDialog
        movie={selectedMovie}
        open={!!selectedMovie && activeTab === "cinema"}
        onOpenChange={(o) => {
          if (!o) setSelectedMovie(null);
        }}
      />

      <GameDetailDialog
        gameId={selectedGameId}
        open={!!selectedGameId && activeTab === "games"}
        onOpenChange={(o) => {
          if (!o) setSelectedGameId(null);
        }}
      />
    </div>
  );
}