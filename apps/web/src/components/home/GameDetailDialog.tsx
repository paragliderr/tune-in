import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import {
  Star,
  Gamepad2,
  Calendar,
  Send,
  ChevronRight,
  ChevronLeft,
  Loader2,
  Trash2,
  XCircle,
  ArrowLeft,
  Building2,
  AlertTriangle,
  CheckCircle2,
} from "lucide-react";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { igdb, gameImg, type IGDBGame, type IGDBReview } from "@/lib/igdb";

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  gameId: number | null;
}

interface CustomReview {
  id: string;
  game_id: number;
  user_id: string;
  rating: number;
  content: string;
  created_at: string;
  user: { id: string; username: string; avatar_url: string | null };
}

/* ── Star rating input ── */
const StarRating = ({ value, onChange }: { value: number; onChange: (v: number) => void }) => {
  const [hoverValue, setHoverValue] = useState(0);
  return (
    <div className="flex items-center gap-1" onMouseLeave={() => setHoverValue(0)}>
      {[1, 2, 3, 4, 5].map((s) => {
        const isActive = s <= (hoverValue || value);
        return (
          <motion.button
            key={s}
            whileHover={{ scale: 1.25 }}
            whileTap={{ scale: 0.8, rotate: -15 }}
            onClick={() => onChange(s)}
            onMouseEnter={() => setHoverValue(s)}
            className="p-0.5 relative outline-none"
          >
            <Star className={`w-7 h-7 transition-colors drop-shadow-sm ${isActive ? "text-yellow-400 fill-yellow-400" : "text-muted-foreground/30"}`} />
          </motion.button>
        );
      })}
    </div>
  );
};

/* ── Screenshot Row ── */
const ScreenshotRow = ({ screens }: { screens: { id: number; url: string }[] }) => {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [canLeft, setCanLeft] = useState(false);
  const [canRight, setCanRight] = useState(false);
  const checkScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    setCanLeft(el.scrollLeft > 4);
    setCanRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 4);
  };
  useEffect(() => { checkScroll(); }, [screens]);
  const scroll = (dir: "left" | "right") => scrollRef.current?.scrollBy({ left: dir === "left" ? -400 : 400, behavior: "smooth" });

  return (
    <div className="px-6 py-4 border-b border-border/30 space-y-3 w-full overflow-hidden" onMouseEnter={checkScroll}>
      <h3 className="text-sm font-semibold text-foreground">Screenshots</h3>
      <div className="relative group w-full">
        {canLeft && (
          <button onClick={() => scroll("left")} className="absolute left-0 top-0 bottom-0 z-10 w-8 bg-gradient-to-r from-card via-card/90 to-transparent flex items-center justify-start opacity-0 group-hover:opacity-100 transition-opacity">
            <ChevronLeft className="w-4 h-4 text-foreground" />
          </button>
        )}
        <div ref={scrollRef} onScroll={checkScroll} className="flex gap-3 overflow-x-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none] w-full">
          {screens.map((s) => (
            <div key={s.id} className="flex-shrink-0 w-64 aspect-video rounded-xl overflow-hidden bg-muted/20 border border-border/30">
              <img src={gameImg(s.url, "t_720p")!} className="w-full h-full object-cover transition-transform hover:scale-110 duration-500" />
            </div>
          ))}
        </div>
        {canRight && (
          <button onClick={() => scroll("right")} className="absolute right-0 top-0 bottom-0 z-10 w-8 bg-gradient-to-l from-card via-card/90 to-transparent flex items-center justify-end opacity-0 group-hover:opacity-100 transition-opacity">
            <ChevronRight className="w-4 h-4 text-foreground" />
          </button>
        )}
      </div>
    </div>
  );
};

/* ── Company View (discography) ── */
const CompanyView = ({
  company,
  onBack,
  onSelectGame,
}: {
  company: { id: number; name: string };
  onBack: () => void;
  onSelectGame: (id: number) => void;
}) => {
  const [games, setGames] = useState<IGDBGame[]>([]);
  const [loading, setLoading] = useState(true);
  const [platformFilter, setPlatformFilter] = useState<string>("All");
  const [genreFilter, setGenreFilter] = useState<string>("All");

  const gridRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (gridRef.current) gridRef.current.scrollTo({ top: 0, behavior: "smooth" });
  }, [platformFilter, genreFilter]);

  useEffect(() => {
    setLoading(true);
    igdb.companyGames(company.id)
      .then(setGames)
      .catch(() => setGames([]))
      .finally(() => setLoading(false));
  }, [company.id]);

  const platforms = ["All", ...Array.from(new Set(games.flatMap(g => g.platforms?.map(p => p.name) ?? [])))].slice(0, 12);
  const genres = ["All", ...Array.from(new Set(games.flatMap(g => g.genres?.map(g => g.name) ?? [])))].slice(0, 12);

  const filtered = games.filter(g => {
    const platOk = platformFilter === "All" || g.platforms?.some(p => p.name === platformFilter);
    const genreOk = genreFilter === "All" || g.genres?.some(gn => gn.name === genreFilter);
    return platOk && genreOk;
  });


  return (
    <motion.div initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }} className="px-6 py-5 space-y-5">
      <div className="flex items-center gap-3">
        <button onClick={onBack} className="p-1.5 rounded-lg hover:bg-muted/40 transition-colors">
          <ArrowLeft className="w-4 h-4 text-foreground" />
        </button>
        <div>
          <h3 className="text-base font-bold text-foreground">{company.name}</h3>
          <p className="text-xs text-muted-foreground">{filtered.length} game{filtered.length !== 1 ? "s" : ""}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-3 flex-wrap">
        <select value={platformFilter} onChange={e => setPlatformFilter(e.target.value)} className="premium-select">
          {platforms.map(p => <option key={p} value={p}>{p === "All" ? "All Platforms" : p}</option>)}
        </select>
        <select value={genreFilter} onChange={e => setGenreFilter(e.target.value)} className="premium-select">
          {genres.map(g => <option key={g} value={g}>{g === "All" ? "All Genres" : g}</option>)}
        </select>
      </div>


      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 text-primary animate-spin" /></div>
      ) : filtered.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-8">No games found with selected filters.</p>
      ) : (
        <div ref={gridRef} className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-3 max-h-[50vh] overflow-y-auto pr-1">

          {filtered.map((g) => {
            const poster = gameImg(g.cover?.url, "t_cover_big");
            const year = g.first_release_date ? new Date(g.first_release_date * 1000).getFullYear() : "";
            return (
              <motion.div
                key={g.id}
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                whileHover={{ scale: 1.04 }}
                onClick={() => onSelectGame(g.id)}
                className="cursor-pointer group"
              >
                <div className="aspect-[3/4] rounded-lg overflow-hidden bg-muted/30 border border-border/20 group-hover:border-primary/40 transition-all shadow-sm">
                  {poster ? <img src={poster} alt={g.name} className="w-full h-full object-cover" /> : (
                    <div className="w-full h-full flex items-center justify-center"><Gamepad2 className="w-5 h-5 text-muted-foreground/40" /></div>
                  )}
                </div>
                <p className="text-[11px] font-medium mt-1 truncate group-hover:text-primary transition-colors">{g.name}</p>
                {year && <p className="text-[10px] text-muted-foreground">{year}</p>}
              </motion.div>
            );
          })}
        </div>
      )}
    </motion.div>
  );
};

/* ── Delete Confirmation Inline ── */
const DeleteConfirm = ({ onKeep, onConfirm }: { onKeep: () => void; onConfirm: () => void }) => (
  <motion.div
    initial={{ opacity: 0, height: 0 }}
    animate={{ opacity: 1, height: "auto" }}
    exit={{ opacity: 0, height: 0 }}
    className="bg-destructive/10 border border-destructive/20 rounded-lg px-4 py-3 flex items-start gap-3"
  >
    <AlertTriangle className="w-4 h-4 text-destructive mt-0.5 shrink-0" />
    <div className="flex-1">
      <p className="text-sm text-destructive font-medium">Delete this review?</p>
      <p className="text-xs text-destructive/70 mt-0.5">This action cannot be undone.</p>
    </div>
    <div className="flex gap-2 shrink-0">
      <button onClick={onKeep} className="px-3 py-1.5 text-xs rounded-md bg-muted hover:bg-muted/80 transition-colors">Cancel</button>
      <button onClick={onConfirm} className="px-3 py-1.5 text-xs rounded-md bg-destructive text-destructive-foreground hover:bg-destructive/90 transition-colors font-medium">Delete</button>
    </div>
  </motion.div>
);

type DialogView = { type: "main" } | { type: "company"; company: { id: number; name: string } };

const GameDetailDialog = ({ open, onOpenChange, gameId }: Props) => {
  const navigate = useNavigate();
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [game, setGame] = useState<IGDBGame | null>(null);
  const [customReviews, setCustomReviews] = useState<CustomReview[]>([]);
  const [igdbReviews, setIgdbReviews] = useState<IGDBReview[]>([]);
  const [loading, setLoading] = useState(false);
  const [reviewLoading, setReviewLoading] = useState(false);
  const [userRating, setUserRating] = useState(0);
  const [userReview, setUserReview] = useState("");
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const [reviewToDelete, setReviewToDelete] = useState<string | null>(null);
  const [view, setView] = useState<DialogView>({ type: "main" });
  const [companyGameId, setCompanyGameId] = useState<number | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => setCurrentUser(user));
  }, []);

  useEffect(() => {
    const el = document.getElementById("game-dialog-content");
    if (el) el.scrollTo({ top: 0, behavior: "smooth" });
  }, [gameId, open, view]);

  useEffect(() => {
    if (!gameId || !open) {
      setView({ type: "main" });
      setCompanyGameId(null);
      return;
    }
    setLoading(true);
    setGame(null);
    setCustomReviews([]);
    setIgdbReviews([]);
    setUserRating(0);
    setUserReview("");
    setView({ type: "main" });

    const fetchData = async () => {
      try {
        const [g, crRes, igdbRevs] = await Promise.all([
          igdb.gameDetail(gameId),
          supabase
            .from("game_reviews")
            .select("*, user:profiles(id, username, avatar_url)")
            .eq("game_id", gameId)
            .order("created_at", { ascending: false }),
          igdb.igdbReviews(gameId),
        ]);
        setGame(g);
        if (crRes.data) setCustomReviews(crRes.data as any);
        setIgdbReviews(igdbRevs);
      } catch {
        toast.error("Failed to load game details");
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [gameId, open]);

  // When navigating to a company's game, load that game's dialog
  useEffect(() => {
    if (companyGameId && companyGameId !== gameId) {
      // Just update the current game view without changing gameId (handled inside)
      setView({ type: "main" });
    }
  }, [companyGameId]);

  const myReview = customReviews.find(r => r.user_id === currentUser?.id);

  const handlePostReview = async () => {
    if (!currentUser) { toast.error("Please login to post a review"); return; }
    if (!userRating || !userReview.trim()) return;
    setReviewLoading(true);
    try {
      const { data, error } = await supabase
        .from("game_reviews")
        .insert({ game_id: gameId!, user_id: currentUser.id, rating: userRating, content: userReview.trim() })
        .select("*, user:profiles(id, username, avatar_url)")
        .single();
      if (error) throw error;
      setCustomReviews([data as any, ...customReviews]);
      setUserRating(0);
      setUserReview("");
      toast.success("Review posted!");
    } catch (e: any) {
      toast.error(e.message || "Failed to post review");
    } finally {
      setReviewLoading(false);
    }
  };

  const handleDeleteReview = async (id: string) => {
    try {
      const { error } = await supabase.from("game_reviews").delete().eq("id", id);
      if (error) throw error;
      setCustomReviews(prev => prev.filter(r => r.id !== id));
      setReviewToDelete(null);
      toast.success("Review deleted");
    } catch {
      toast.error("Failed to delete review");
    }
  };

  const handleCancelClick = () => {
    if (userRating > 0 || userReview.trim()) setShowCancelConfirm(true);
    else { setUserRating(0); setUserReview(""); }
  };

  const bg = game?.screenshots?.[0]?.url ? gameImg(game.screenshots[0].url, "t_1080p") : gameImg(game?.cover?.url, "t_1080p");
  const poster = gameImg(game?.cover?.url, "t_cover_big");
  const year = game?.first_release_date ? new Date(game.first_release_date * 1000).getFullYear().toString() : "";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        id="game-dialog-content"
        className="max-w-5xl w-[95vw] max-h-[92vh] overflow-y-auto overflow-x-hidden bg-card/95 backdrop-blur-xl border-border/50 p-0 gap-0 rounded-2xl shadow-2xl"
      >
        <DialogTitle className="sr-only">{game?.name || "Game Details"}</DialogTitle>
        <DialogDescription className="sr-only">
          Detailed information, developer stats, screenshots, and community reviews for {game?.name || "this game"}.
        </DialogDescription>


        {loading ? (
          <div className="h-[60vh] flex items-center justify-center">
            <Loader2 className="w-10 h-10 text-primary animate-spin" />
          </div>
        ) : !game ? (
          <div className="h-[60vh] flex items-center justify-center text-muted-foreground">Game not found.</div>
        ) : (
          <AnimatePresence mode="wait">
            {/* ── Company discography view ── */}
            {view.type === "company" ? (
              <motion.div key="company" initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -30 }}>
                <CompanyView
                  company={view.company}
                  onBack={() => setView({ type: "main" })}
                  onSelectGame={(id) => {
                    // Close this dialog and let parent open new one, or just re-use by triggering gameId change
                    // We'll signal caller via a workaround: navigate back to main with new gameId
                    setCompanyGameId(id);
                    // Since we can't change prop, communicate via a custom event so GamesTab can respond
                    window.dispatchEvent(new CustomEvent("openGame", { detail: { gameId: id } }));
                    setView({ type: "main" });
                  }}
                />
              </motion.div>
            ) : (
              /* ── Main game view ── */
              <motion.div key="main" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                {/* Hero Backdrop */}
                <div className="relative h-64 md:h-80 overflow-hidden rounded-t-2xl w-full">
                  {bg ? <img src={bg} alt="" className="w-full h-full object-cover" /> : <div className="w-full h-full bg-gradient-to-br from-primary/20 to-background" />}
                  <div className="absolute inset-0 bg-gradient-to-t from-card via-card/50 to-transparent" />
                  <div className="absolute bottom-0 left-0 right-0 p-6 flex gap-6 items-end">
                    <div className="w-32 md:w-40 xl:w-44 aspect-[3/4] rounded-xl overflow-hidden border-2 border-border/50 shadow-2xl shrink-0 bg-muted/30">
                      {poster && <img src={poster} alt={game.name} className="w-full h-full object-cover" />}
                    </div>
                    <div className="flex-1 min-w-0 pb-1">
                      <p className="text-xs md:text-sm text-muted-foreground uppercase tracking-wider font-semibold">Game · {year}</p>
                      <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold text-foreground leading-tight mt-1 truncate">{game.name}</h2>
                      <div className="flex flex-wrap gap-2 mt-3">
                        {game.genres?.map((g) => (
                          <span key={g.id} className="text-[10px] md:text-xs px-2 md:px-3 py-1 rounded-full bg-primary/20 text-primary font-medium border border-primary/20">{g.name}</span>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Content grid */}
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-0">
                  <div className="lg:col-span-8 border-r border-border/30">
                    {/* Stats */}
                    <div className="flex items-center gap-8 px-8 py-5 border-b border-border/30">
                      {game.total_rating && (
                        <div className="flex flex-col">
                          <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-widest">Score</span>
                          <div className="flex items-center gap-1.5">
                            <Star className="w-4 h-4 text-yellow-400 fill-yellow-400" />
                            <span className="text-xl font-bold">{(game.total_rating / 10).toFixed(1)}</span>
                            <span className="text-xs text-muted-foreground mt-1">/10</span>
                          </div>
                        </div>
                      )}
                      {game.platforms && (
                        <div className="flex flex-col">
                          <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-widest">Platforms</span>
                          <div className="flex gap-2 mt-1 flex-wrap">
                            {game.platforms.slice(0, 3).map(p => (
                              <span key={p.id} className="text-[10px] px-1.5 py-0.5 rounded bg-muted/50 text-muted-foreground">{p.name}</span>
                            ))}
                            {game.platforms.length > 3 && <span className="text-[10px] text-muted-foreground">+{game.platforms.length - 3}</span>}
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Overview */}
                    <div className="px-8 py-6 space-y-3 border-b border-border/30">
                      <h3 className="text-base font-semibold text-foreground">Overview</h3>
                      <p className="text-sm text-foreground/80 leading-relaxed font-light">{game.summary || "No overview available."}</p>
                    </div>

                    {/* Screenshots */}
                    {game.screenshots && game.screenshots.length > 0 && <ScreenshotRow screens={game.screenshots} />}

                    {/* Developer / Publisher — clickable */}
                    <div className="px-8 py-5 border-b border-border/30 bg-muted/5">
                      <div className="flex flex-wrap gap-8">
                        {game.involved_companies?.filter(c => c.developer).map(c => (
                          <div key={c.id}>
                            <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-widest">Developer</span>
                            <button
                              onClick={() => c.company.id && setView({ type: "company", company: { id: c.company.id, name: c.company.name } })}
                              className="flex items-center gap-1.5 mt-0.5 text-sm font-medium hover:text-primary transition-colors group/company"
                            >
                              <Building2 className="w-3.5 h-3.5 text-muted-foreground group-hover/company:text-primary transition-colors" />
                              {c.company.name}
                              <ChevronRight className="w-3 h-3 text-muted-foreground/60 group-hover/company:text-primary transition-colors" />
                            </button>
                          </div>
                        ))}
                        {game.involved_companies?.filter(c => c.publisher).map(c => (
                          <div key={`pub-${c.id}`}>
                            <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-widest">Publisher</span>
                            <button
                              onClick={() => c.company.id && setView({ type: "company", company: { id: c.company.id, name: c.company.name } })}
                              className="flex items-center gap-1.5 mt-0.5 text-sm font-medium hover:text-primary transition-colors group/company"
                            >
                              <Building2 className="w-3.5 h-3.5 text-muted-foreground group-hover/company:text-primary transition-colors" />
                              {c.company.name}
                              <ChevronRight className="w-3 h-3 text-muted-foreground/60 group-hover/company:text-primary transition-colors" />
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* ── Review Sidebar ── */}
                  <div className="lg:col-span-4 bg-muted/10">
                    <div className="p-6 space-y-5">
                      {myReview ? (
                        /* Already reviewed state */
                        <div className="bg-primary/5 border border-primary/30 rounded-2xl p-5 space-y-3">
                          <div className="flex items-center gap-2 text-primary">
                            <CheckCircle2 className="w-4 h-4" />
                            <span className="text-sm font-bold">Your Review</span>
                          </div>
                          <div className="flex items-center gap-1">
                            {[1, 2, 3, 4, 5].map(s => (
                              <Star key={s} className={`w-5 h-5 ${s <= myReview.rating ? "text-yellow-400 fill-yellow-400" : "text-muted-foreground/30"}`} />
                            ))}
                          </div>
                          <p className="text-sm text-foreground/80 leading-relaxed">{myReview.content}</p>
                          <p className="text-xs text-muted-foreground">{new Date(myReview.created_at).toLocaleDateString()}</p>
                          <AnimatePresence>
                            {reviewToDelete === myReview.id ? (
                              <DeleteConfirm
                                onKeep={() => setReviewToDelete(null)}
                                onConfirm={() => handleDeleteReview(myReview.id)}
                              />
                            ) : (
                              <motion.button
                                initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                                onClick={() => setReviewToDelete(myReview.id)}
                                className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-destructive transition-colors"
                              >
                                <Trash2 className="w-3.5 h-3.5" /> Delete review
                              </motion.button>
                            )}
                          </AnimatePresence>
                        </div>
                      ) : (
                        /* Write review form */
                        <div className="bg-card/60 border border-border/40 p-5 rounded-2xl shadow-sm space-y-4">
                          <h3 className="text-sm font-bold text-foreground">Post a Review</h3>
                          <StarRating value={userRating} onChange={setUserRating} />
                          <textarea
                            value={userReview}
                            onChange={(e) => setUserReview(e.target.value)}
                            placeholder="Share your experience..."
                            className="w-full bg-muted/40 border border-border/30 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-1 ring-primary/30 resize-none h-24 transition-all"
                          />

                          <AnimatePresence>
                            {showCancelConfirm && (
                              <motion.div
                                initial={{ opacity: 0, height: 0 }}
                                animate={{ opacity: 1, height: "auto" }}
                                exit={{ opacity: 0, height: 0 }}
                                className="bg-destructive/10 border border-destructive/20 text-destructive text-sm px-4 py-3 rounded-lg flex items-center justify-between"
                              >
                                <span className="text-xs">Discard your draft?</span>
                                <div className="flex gap-2">
                                  <button onClick={() => setShowCancelConfirm(false)} className="px-2 py-1 hover:bg-destructive/10 rounded text-xs">Keep</button>
                                  <button onClick={() => { setUserRating(0); setUserReview(""); setShowCancelConfirm(false); }} className="px-2 py-1 bg-destructive text-destructive-foreground rounded text-xs font-medium">Discard</button>
                                </div>
                              </motion.div>
                            )}
                          </AnimatePresence>

                          <div className="flex items-center justify-between">
                            {(userRating > 0 || userReview.length > 0) && (
                              <motion.button
                                initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                                whileTap={{ scale: 0.95 }}
                                onClick={handleCancelClick}
                                className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground underline underline-offset-4"
                              >
                                <XCircle className="w-3.5 h-3.5" /> Discard
                              </motion.button>
                            )}
                            <button
                              onClick={handlePostReview}
                              disabled={reviewLoading || !userRating || !userReview.trim() || showCancelConfirm}
                              className="ml-auto flex items-center gap-2 bg-primary hover:bg-primary/90 text-primary-foreground px-4 py-2 rounded-xl text-sm font-bold shadow-lg shadow-primary/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              {reviewLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                              Post
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* ── Reviews Section ── */}
                <div className="px-8 py-8 space-y-6 border-t border-border/30">
                  <h3 className="text-xl font-bold flex items-center gap-2">
                    Reviews
                    <span className="text-xs px-2 py-0.5 rounded-full bg-primary/20 text-primary">{customReviews.length + igdbReviews.length}</span>
                  </h3>

                  <div className="space-y-4 max-w-4xl">
                    {customReviews.length === 0 && igdbReviews.length === 0 && (
                      <p className="text-sm text-muted-foreground text-center py-10 border border-dashed border-border rounded-2xl">No reviews yet. Be the first on Tune-In!</p>
                    )}

                    {/* Tune-In reviews first — highlighted */}
                    {customReviews.map((r) => (
                      <motion.div
                        key={r.id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="bg-primary/5 border border-primary/20 rounded-2xl p-5 space-y-3 relative overflow-hidden"
                      >
                        <div className="absolute top-0 right-0 px-3 py-1 bg-primary/10 text-primary text-[10px] font-bold uppercase rounded-bl-lg">Tune-In</div>
                        <div className="flex items-center gap-3">
                          <div
                            onClick={() => { onOpenChange(false); navigate(`/user/${r.user.username}`); }}
                            className="flex items-center gap-3 flex-1 min-w-0 cursor-pointer group/profile"
                          >
                            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary/60 to-accent/60 overflow-hidden flex items-center justify-center text-sm font-bold group-hover/profile:ring-2 ring-primary/50 transition-all">
                              {r.user.avatar_url ? <img src={r.user.avatar_url} className="w-full h-full object-cover" /> : r.user.username?.charAt(0).toUpperCase()}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-semibold text-foreground truncate group-hover/profile:text-primary transition-colors">@{r.user.username}</p>
                              <p className="text-[10px] text-muted-foreground">{new Date(r.created_at).toLocaleDateString()}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <div className="flex items-center gap-0.5 text-xs bg-background/50 px-2 py-1 rounded-md shadow-sm border border-border/30">
                              <Star className="w-3.5 h-3.5 text-yellow-500 fill-yellow-500" />
                              <span className="font-bold">{r.rating}</span>
                              <span className="text-muted-foreground">/5</span>
                            </div>
                            {currentUser?.id === r.user_id && (
                              <AnimatePresence>
                                {reviewToDelete === r.id ? (
                                  <DeleteConfirm onKeep={() => setReviewToDelete(null)} onConfirm={() => handleDeleteReview(r.id)} />
                                ) : (
                                  <motion.button
                                    initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                                    onClick={() => setReviewToDelete(r.id)}
                                    className="p-1.5 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-md"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </motion.button>
                                )}
                              </AnimatePresence>
                            )}
                          </div>
                        </div>
                        <p className="text-sm text-foreground/80 leading-relaxed">{r.content}</p>
                      </motion.div>
                    ))}

                    {/* IGDB reviews */}
                    {Array.isArray(igdbReviews) && igdbReviews.map((r, i) => (

                      <motion.div
                        key={`igdb-${r.id}`}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: (customReviews.length + i) * 0.04 }}
                        className="bg-muted/15 border border-border/30 rounded-2xl p-5 space-y-3"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-muted to-muted/50 flex items-center justify-center text-sm font-bold text-muted-foreground">
                            {r.username?.charAt(0)?.toUpperCase() || "?"}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-foreground truncate">{r.username || "IGDB User"}</p>
                            <p className="text-[10px] text-muted-foreground">
                              {r.created_at ? new Date(r.created_at * 1000).toLocaleDateString() : "—"} · IGDB
                            </p>
                          </div>
                          {r.rating && (
                            <div className="flex items-center gap-0.5 text-xs bg-background/50 px-2 py-1 rounded-md shadow-sm border border-border/30">
                              <Star className="w-3.5 h-3.5 text-yellow-500 fill-yellow-500" />
                              <span className="font-bold">{(r.rating / 20).toFixed(1)}</span>
                              <span className="text-muted-foreground">/5</span>
                            </div>
                          )}
                        </div>
                        <p className="text-sm text-foreground/75 leading-relaxed">
                          {r.content?.length > 500 ? r.content.slice(0, 500) + "..." : r.content}
                        </p>
                      </motion.div>
                    ))}
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default GameDetailDialog;
