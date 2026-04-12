import { useParams, useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { motion } from "framer-motion";
import { ArrowLeft, Link2, Search, Gamepad2, Film, Star, FileText } from "lucide-react";
import PostCard from "@/components/home/PostCard";
import PostDetailDialog from "@/components/home/PostDetailDialog";
import MovieDetailDialog from "@/components/home/MovieDetailDialog";

import { mapFeedRowsToPostCards } from "@/lib/feedMap";
import { tmdb, img, type TMDBMovie } from "@/lib/tmdb";
import { igdb, gameImg, type IGDBGame } from "@/lib/igdb";
import GameDetailDialog from "@/components/home/GameDetailDialog";

export default function Profile() {
  const { username } = useParams();
  const navigate = useNavigate();

  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  
  // Tabs
  const [activeTab, setActiveTab] = useState<"posts" | "cinema" | "games">("posts");

  // Post State
  const [posts, setPosts] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedPost, setSelectedPost] = useState<any>(null);

  // Cinema State
  const [cinemaReviews, setCinemaReviews] = useState<any[]>([]);
  const [cinemaLoading, setCinemaLoading] = useState(false);
  const [cinemaFetched, setCinemaFetched] = useState(false);
  const [selectedMovie, setSelectedMovie] = useState<TMDBMovie | null>(null);

  // Games State
  const [gameReviews, setGameReviews] = useState<any[]>([]);
  const [gamesLoading, setGamesLoading] = useState(false);
  const [gamesFetched, setGamesFetched] = useState(false);
  const [selectedGameId, setSelectedGameId] = useState<number | null>(null);

  // Load Profile and Posts (Init)
  useEffect(() => {
    const load = async () => {
      if (!username) return;
      setLoading(true);

      const { data } = await supabase
        .from("profiles")
        .select("*")
        .eq("username", username)
        .single();

      if (data) {
        setProfile(data);

        // Fetch user posts
        const { data: userPosts } = await supabase
          .from("posts")
          .select("*")
          .eq("user_id", data.id)
          .order("created_at", { ascending: false });

        if (userPosts) {
          const mapped = await mapFeedRowsToPostCards(supabase, userPosts);
          setPosts(mapped);
        } else {
          setPosts([]);
        }
      }
      setLoading(false);
    };

    load();
  }, [username]);

  // Load Cinema Reviews dynamically when tab is selected
  useEffect(() => {
    if (activeTab === "cinema" && !cinemaFetched && profile) {
      const fetchCinema = async () => {
        setCinemaLoading(true);
        try {
          const { data } = await supabase
            .from("movie_reviews")
            .select("*")
            .eq("user_id", profile.id)
            .order("created_at", { ascending: false })
            .limit(20);

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
            // Filter out any without valid tmdb records
            setCinemaReviews(enriched.filter(r => r.tmdb));
          }
          setCinemaFetched(true);
        } catch (error) {
          console.error("Failed to load cinema reviews", error);
        } finally {
          setCinemaLoading(false);
        }
      };
      fetchCinema();
    }
  }, [activeTab, profile, cinemaFetched]);

  // Load Game Reviews
  useEffect(() => {
    if (activeTab === "games" && !gamesFetched && profile) {
      const fetchGames = async () => {
        setGamesLoading(true);
        try {
          const { data } = await supabase
            .from("game_reviews")
            .select("*")
            .eq("user_id", profile.id)
            .order("created_at", { ascending: false })
            .limit(20);

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
            setGameReviews(enriched.filter(r => r.game));
          }
          setGamesFetched(true);
        } catch (error) {
          console.error("Failed to load game reviews", error);
        } finally {
          setGamesLoading(false);
        }
      };
      fetchGames();
    }
  }, [activeTab, profile, gamesFetched]);

  if (loading)
    return (
      <div className="h-screen flex items-center justify-center text-muted-foreground">
        Loading profile…
      </div>
    );

  if (!profile)
    return (
      <div className="h-screen flex items-center justify-center">
        User not found
      </div>
    );

  return (
    <div className="min-h-screen bg-background text-foreground pb-20">
      {/* HEADER */}
      <div className="border-b border-border sticky top-0 bg-background/80 backdrop-blur-xl z-20">
        <div className="max-w-4xl mx-auto px-6 py-4 flex items-center gap-4">
          <button
            onClick={() => navigate(-1)}
            className="p-2 rounded-lg hover:bg-muted transition"
          >
            <ArrowLeft size={18} />
          </button>
          <h1 className="font-semibold text-lg">@{profile.username}</h1>
        </div>
      </div>

      {/* CONTENT */}
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-10">
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-3xl border border-border bg-card/60 backdrop-blur-xl p-6 sm:p-10"
        >
          {/* Avatar Area */}
          <div className="flex flex-col items-center text-center">
            <img
              src={profile.avatar_url || "https://api.dicebear.com/7.x/notionists/svg?seed=" + profile.username}
              className="w-32 h-32 rounded-full object-cover border border-border shadow-xl"
            />
            <h2 className="mt-5 text-2xl font-bold">@{profile.username}</h2>
            <p className="mt-3 text-muted-foreground max-w-md">
              {profile.bio || "No bio yet."}
            </p>
          </div>

          {/* Connections Component Placeholder */}
          <div className="mt-12">
            <h3 className="font-semibold mb-5 text-lg">Connections</h3>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              {[
                "Spotify",
                "Steam",
                "Instagram",
                "LinkedIn",
                "LeetCode",
                "Codolio",
              ].map((c, i) => (
                <motion.div
                  key={c}
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: i * 0.07 }}
                  className="rounded-xl border border-border bg-background/40 backdrop-blur-xl p-4 flex items-center gap-3 hover:bg-muted/40 cursor-pointer transition"
                >
                  <Link2 size={16} />
                  {c}
                </motion.div>
              ))}
            </div>
          </div>

          <div className="mt-14">
            {/* TABS MENU */}
            <div className="flex items-center gap-2 mb-8 border-b border-border/40 pb-4 overflow-x-auto [&::-webkit-scrollbar]:hidden">
              {(["posts", "cinema", "games"] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => setActiveTab(t)}
                  className={`px-5 py-2.5 rounded-xl text-sm font-semibold capitalize transition-all whitespace-nowrap ${
                    activeTab === t 
                      ? "bg-primary text-primary-foreground shadow-md shadow-primary/20" 
                      : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    {t === "posts" && <FileText className="w-4 h-4" />}
                    {t === "cinema" && <Film className="w-4 h-4" />}
                    {t === "games" && <Gamepad2 className="w-4 h-4" />}
                    {t}
                  </div>
                </button>
              ))}
            </div>

            {/* TAB CONTENT: POSTS */}
            {activeTab === "posts" && (
              <motion.div
                 initial={{ opacity: 0, y: 10 }}
                 animate={{ opacity: 1, y: 0 }}
              >
                <div className="relative mb-6">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground w-5 h-5" />
                  <input
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search posts..."
                    className="w-full bg-background/50 border border-border rounded-full py-3 pl-12 pr-6 focus:outline-none focus:border-primary/50 transition-colors"
                  />
                </div>

                <div className="flex flex-col gap-4">
                  {posts
                    .filter(
                      (p) =>
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
                  {posts.length === 0 && (
                    <div className="text-center text-muted-foreground py-10 bg-muted/20 border border-dashed border-border rounded-2xl">
                      No posts found.
                    </div>
                  )}
                </div>
              </motion.div>
            )}

            {/* TAB CONTENT: CINEMA */}
            {activeTab === "cinema" && (
              <motion.div
                 initial={{ opacity: 0, y: 10 }}
                 animate={{ opacity: 1, y: 0 }}
              >
                <div className="flex flex-col gap-5">
                  {cinemaLoading ? (
                     <div className="text-center text-muted-foreground py-12 flex flex-col items-center gap-3">
                        <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                        Loading reviews...
                     </div>
                  ) : cinemaReviews.length === 0 ? (
                     <div className="text-center text-muted-foreground py-12 bg-muted/20 border border-dashed border-border rounded-2xl flex flex-col items-center gap-3">
                        <Film className="w-10 h-10 text-muted-foreground/40" />
                        No cinema reviews found.
                     </div>
                  ) : (
                     cinemaReviews.map((rev, i) => {
                       const { tmdb: movie } = rev;
                       const year = (movie.release_date || movie.first_air_date || "").slice(0, 4);
                       const title = movie.title || movie.name;
                       const poster = img(movie.poster_path, "w185");
                       const reviewDate = new Date(rev.created_at).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
                       
                       return (
                          <motion.div
                             key={rev.id}
                             initial={{ opacity: 0, y: 15 }}
                             animate={{ opacity: 1, y: 0 }}
                             transition={{ delay: i * 0.05 }}
                             onClick={() => setSelectedMovie({ ...movie, media_type: rev.media_type } as any)}
                             className="flex gap-4 sm:gap-5 p-4 rounded-2xl bg-muted/10 border border-border/50 hover:border-primary/40 hover:bg-muted/30 cursor-pointer transition-all shadow-sm group"
                          >
                             {/* Thumbnail */}
                             <div className="w-20 sm:w-28 h-32 sm:h-40 shrink-0 rounded-xl overflow-hidden shadow-sm bg-muted/40 relative">
                               {poster ? (
                                  <img src={poster} alt={title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                               ) : (
                                  <div className="w-full h-full flex items-center justify-center text-[10px] text-muted-foreground uppercase text-center p-2">No Image</div>
                               )}
                             </div>
                             
                             {/* Content */}
                             <div className="flex-1 min-w-0 py-1 flex flex-col">
                               <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2 sm:gap-4">
                                 <div>
                                   <h4 className="text-base sm:text-lg font-bold text-foreground group-hover:text-primary transition-colors line-clamp-1">{title}</h4>
                                   <p className="text-[11px] sm:text-xs text-muted-foreground mt-0.5">
                                      {rev.media_type === "tv" ? "Show" : "Movie"} • {year} • {reviewDate}
                                   </p>
                                 </div>
                                 
                                 {/* Star Rating exclusively (No badges) */}
                                 <div className="flex items-center gap-0.5 bg-background/80 px-2 py-1 rounded-md border border-border/40 shadow-sm shrink-0 w-fit mt-1 sm:mt-0">
                                    {[...Array(5)].map((_, si) => (
                                      <Star key={si} className={`w-3.5 h-3.5 sm:w-4 sm:h-4 ${si < rev.rating ? "text-yellow-500 fill-yellow-500 drop-shadow-sm" : "text-muted-foreground/30"}`} />
                                    ))}
                                 </div>
                               </div>
                               
                               {/* Review Text */}
                               <p className="mt-3 text-xs sm:text-sm text-foreground/80 leading-relaxed line-clamp-3 sm:line-clamp-4">
                                 {rev.content}
                               </p>
                             </div>
                          </motion.div>
                       );
                     })
                  )}
                </div>
              </motion.div>
            )}

            {/* TAB CONTENT: GAMES */}
            {activeTab === "games" && (
              <motion.div
                 initial={{ opacity: 0, y: 10 }}
                 animate={{ opacity: 1, y: 0 }}
              >
                <div className="flex flex-col gap-5">
                  {gamesLoading ? (
                     <div className="text-center text-muted-foreground py-12 flex flex-col items-center gap-3">
                        <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                        Loading game reviews...
                     </div>
                  ) : gameReviews.length === 0 ? (
                     <div className="text-center text-muted-foreground py-12 bg-muted/20 border border-dashed border-border rounded-2xl flex flex-col items-center gap-3">
                        <Gamepad2 className="w-10 h-10 text-muted-foreground/40" />
                        No game reviews found.
                     </div>
                  ) : (
                     gameReviews.map((rev, i) => {
                       const { game } = rev;
                       const year = game.first_release_date 
                        ? new Date(game.first_release_date * 1000).getFullYear().toString() 
                        : "";
                       const name = game.name;
                       const poster = gameImg(game.cover?.url, "t_cover_big");
                       const reviewDate = new Date(rev.created_at).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
                       
                       return (
                          <motion.div
                             key={rev.id}
                             initial={{ opacity: 0, y: 15 }}
                             animate={{ opacity: 1, y: 0 }}
                             transition={{ delay: i * 0.05 }}
                             onClick={() => setSelectedGameId(game.id)}
                             className="flex gap-4 sm:gap-5 p-4 rounded-2xl bg-muted/10 border border-border/50 hover:border-primary/40 hover:bg-muted/30 cursor-pointer transition-all shadow-sm group"
                          >
                             {/* Thumbnail */}
                             <div className="w-20 sm:w-28 h-28 sm:h-36 shrink-0 rounded-xl overflow-hidden shadow-sm bg-muted/40 relative">
                               {poster ? (
                                  <img src={poster} alt={name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                               ) : (
                                  <div className="w-full h-full flex items-center justify-center text-[10px] text-muted-foreground uppercase text-center p-2">No Image</div>
                               )}
                             </div>
                             
                             {/* Content */}
                             <div className="flex-1 min-w-0 py-1 flex flex-col">
                               <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2 sm:gap-4">
                                 <div>
                                   <h4 className="text-base sm:text-lg font-bold text-foreground group-hover:text-primary transition-colors line-clamp-1">{name}</h4>
                                   <p className="text-[11px] sm:text-xs text-muted-foreground mt-0.5">
                                      Game • {year} • {reviewDate}
                                   </p>
                                 </div>
                                 
                                 <div className="flex items-center gap-0.5 bg-background/80 px-2 py-1 rounded-md border border-border/40 shadow-sm shrink-0 w-fit mt-1 sm:mt-0">
                                    {[...Array(5)].map((_, si) => (
                                      <Star key={si} className={`w-3.5 h-3.5 sm:w-4 sm:h-4 ${si < rev.rating ? "text-yellow-500 fill-yellow-500 drop-shadow-sm" : "text-muted-foreground/30"}`} />
                                    ))}
                                 </div>
                               </div>
                               
                               <p className="mt-3 text-xs sm:text-sm text-foreground/80 leading-relaxed line-clamp-3 sm:line-clamp-4">
                                 {rev.content}
                               </p>
                             </div>
                          </motion.div>
                       );
                     })
                  )}
                </div>
              </motion.div>
            )}
          </div>
        </motion.div>
      </div>

      <PostDetailDialog
        post={selectedPost}
        open={!!selectedPost && activeTab === "posts"}
        onOpenChange={(o) => {
          if (!o) setSelectedPost(null);
        }}
      />
      
      {/* Reusing MovieDetailDialog - It cleanly unmounts when no selectedMovie */}
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
