import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import {
  Star,
  Clock,
  Calendar,
  Send,
  ChevronRight,
  ChevronLeft,
  ArrowLeft,
  Play,
  Loader2,
  ExternalLink,
  Trash2,
  XCircle,
  CheckCircle2,
  AlertTriangle,
  Film,
  Tv,
} from "lucide-react";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import {
  tmdb,
  img,
  backdrop,
  formatRuntime,
  type TMDBMovie,
  type TMDBDetail,
  type TMDBReview,
  type TMDBCast,
  type TMDBPersonCredit,
  type TMDBWatchProvider,
  type TMDBWatchProviders,
  type TMDBSeasonDetail,
  type TMDBEpisode,
  type TMDBGenre,
} from "@/lib/tmdb";

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  movie: TMDBMovie | null;
}

interface CustomReview {
  id: string;
  movie_id: number;
  media_type: string;
  user_id: string;
  rating: number;
  content: string;
  created_at: string;
  user: {
    id: string;
    username: string;
    avatar_url: string | null;
  };
}

/* ── Star rating input ── */
const StarRating = ({
  value,
  onChange,
}: {
  value: number;
  onChange: (v: number) => void;
}) => {
  const [hoverValue, setHoverValue] = useState(0);

  return (
    <div
      className="flex items-center gap-1"
      onMouseLeave={() => setHoverValue(0)}
    >
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
            <Star
              className={`w-7 h-7 transition-colors drop-shadow-sm ${
                isActive
                  ? "text-yellow-400 fill-yellow-400"
                  : "text-muted-foreground/30"
              }`}
            />
          </motion.button>
        );
      })}
    </div>
  );
};

/* ── Scrollable Cast Row ── */
const CastRow = ({ cast, onPersonClick }: { cast: TMDBCast[]; onPersonClick: (id: number, name: string) => void }) => {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [canLeft, setCanLeft] = useState(false);
  const [canRight, setCanRight] = useState(false);

  const checkScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    setCanLeft(el.scrollLeft > 4);
    setCanRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 4);
  };

  useEffect(() => {
    checkScroll();
    const el = scrollRef.current;
    if (el) el.addEventListener("scroll", checkScroll, { passive: true });
    return () => el?.removeEventListener("scroll", checkScroll);
  }, [cast]);

  const scroll = (dir: "left" | "right") => {
    scrollRef.current?.scrollBy({ left: dir === "left" ? -400 : 400, behavior: "smooth" });
  };

  if (cast.length === 0) return null;

  return (
    <div className="px-6 py-4 border-b border-border/30 space-y-3 w-full overflow-hidden">
      <h3 className="text-sm font-semibold text-foreground">Cast</h3>
      <div className="relative group w-full">
        {canLeft && (
          <button onClick={() => scroll("left")} className="absolute left-0 top-0 bottom-0 z-10 w-10 bg-gradient-to-r from-card via-card/90 to-transparent flex items-center justify-start opacity-0 group-hover:opacity-100 transition-opacity">
            <ChevronLeft className="w-5 h-5 text-foreground drop-shadow-md" />
          </button>
        )}
        <div ref={scrollRef} className="flex gap-4 overflow-x-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none] px-1 w-full">
          {cast.map((c, i) => (
            <motion.div
              key={c.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.03 }}
              onClick={() => onPersonClick(c.id, c.name)}
              className="flex-shrink-0 w-[100px] text-center cursor-pointer group/cast"
            >
              <div className="w-[100px] h-[100px] rounded-xl overflow-hidden bg-muted/30 border border-border/20 shadow-sm group-hover/cast:border-primary/40 group-hover/cast:shadow-primary/10 transition-all">
                {c.profile_path ? (
                  <img src={img(c.profile_path, "w185")!} alt={c.name} className="w-full h-full object-cover group-hover/cast:scale-105 transition-transform duration-300" loading="lazy" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-lg text-muted-foreground font-bold">{c.name.charAt(0)}</div>
                )}
              </div>
              <p className="text-xs font-semibold text-foreground mt-2 truncate leading-tight group-hover/cast:text-primary transition-colors">{c.name}</p>
              <p className="text-[10px] text-muted-foreground truncate leading-tight mt-0.5">{c.character}</p>
              {c.total_episode_count && (
                <p className="text-[10px] text-muted-foreground/60 mt-0.5">{c.total_episode_count} eps</p>
              )}
            </motion.div>
          ))}
        </div>
        {canRight && (
          <button onClick={() => scroll("right")} className="absolute right-0 top-0 bottom-0 z-10 w-10 bg-gradient-to-l from-card via-card/90 to-transparent flex items-center justify-end opacity-0 group-hover:opacity-100 transition-opacity">
            <ChevronRight className="w-5 h-5 text-foreground drop-shadow-md" />
          </button>
        )}
      </div>
    </div>
  );
};

/* ── Person Discography View ── */
const PersonView = ({
  personId,
  personName,
  onBack,
  onSelectMovie,
}: {
  personId: number;
  personName: string;
  onBack: () => void;
  onSelectMovie: (m: TMDBMovie) => void;
}) => {
  const [credits, setCredits] = useState<TMDBPersonCredit[]>([]);
  const [loading, setLoading] = useState(true);
  const [typeFilter, setTypeFilter] = useState<"all" | "movie" | "tv">("all");
  const [genreFilter, setGenreFilter] = useState<string>("All");
  const [genres, setGenres] = useState<TMDBGenre[]>([]);

  const gridRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (gridRef.current) gridRef.current.scrollTo({ top: 0, behavior: "smooth" });
  }, [typeFilter, genreFilter]);

  useEffect(() => {
    setLoading(true);
    Promise.all([tmdb.personCredits(personId), tmdb.movieGenres(), tmdb.tvGenres()])
      .then(([data, mg, tg]) => {
        // Filter out duplicate IDs (common in combined credits)
        const uniqueCast = data.cast.filter((c, index, self) => 
          index === self.findIndex((t) => t.id === c.id && t.media_type === c.media_type)
        );
        setCredits(uniqueCast);
        const allGenres = [...mg, ...tg].filter((g, i, a) => a.findIndex(x => x.id === g.id) === i);
        setGenres(allGenres);
      })
      .catch(() => setCredits([]))
      .finally(() => setLoading(false));
  }, [personId]);


  const filtered = credits.filter(m => {
    const typeOk = typeFilter === "all" || m.media_type === typeFilter;
    const genreOk = genreFilter === "All" || (m.genre_ids?.includes(genres.find(g => g.name === genreFilter)?.id ?? -1));
    return typeOk && genreOk;
  });

  const allGenreNames = ["All", ...Array.from(new Set(credits.flatMap(m => m.genre_ids?.map(id => genres.find(g => g.id === id)?.name).filter(Boolean) as string[] || [])))];

  return (
    <motion.div
      key={`person-${personId}`}
      initial={{ opacity: 0, x: 30 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -30 }}
      className="px-6 py-5 space-y-5 w-full"
    >
      <div className="flex items-center gap-3">
        <button onClick={onBack} className="p-1.5 rounded-lg hover:bg-muted/40 transition-colors">
          <ArrowLeft className="w-4 h-4 text-foreground" />
        </button>
        <div>
          <h3 className="text-base font-bold text-foreground">{personName}</h3>
          <p className="text-xs text-muted-foreground">{filtered.length} title{filtered.length !== 1 ? "s" : ""}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-2 flex-wrap items-center">
        {(["all", "movie", "tv"] as const).map(t => (
          <button
            key={t}
            onClick={() => setTypeFilter(t)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              typeFilter === t ? "bg-primary text-primary-foreground shadow-sm" : "bg-muted/40 text-muted-foreground hover:bg-muted/70"
            }`}
          >
            {t === "movie" && <Film className="w-3 h-3" />}
            {t === "tv" && <Tv className="w-3 h-3" />}
            {t === "all" ? "All" : t === "movie" ? "Movies" : "Shows"}
          </button>
        ))}
        <select
          value={genreFilter}
          onChange={e => setGenreFilter(e.target.value)}
          className="premium-select"
        >
          {allGenreNames.map(g => g && <option key={g} value={g}>{g === "All" ? "All Genres" : g}</option>)}
        </select>

      </div>

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 text-primary animate-spin" /></div>
      ) : filtered.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-8">No titles found.</p>
      ) : (
        <div ref={gridRef} className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-3 max-h-[50vh] overflow-y-auto pr-1">

          {filtered.map(m => (
            <motion.div
              key={`${m.id}-${m.media_type}`}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              whileHover={{ scale: 1.04 }}
              onClick={() => onSelectMovie({ ...m, media_type: m.media_type } as any)}
              className="cursor-pointer group"
            >
              <div className="aspect-[2/3] rounded-lg overflow-hidden bg-muted/30 border border-border/20 group-hover:border-primary/40 transition-all">
                {m.poster_path ? (
                  <img src={img(m.poster_path, "w342")!} alt={m.title || m.name} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    {m.media_type === "tv" ? <Tv className="w-5 h-5 text-muted-foreground/40" /> : <Film className="w-5 h-5 text-muted-foreground/40" />}
                  </div>
                )}
              </div>
              <p className="text-[11px] font-medium mt-1 truncate group-hover:text-primary transition-colors">{m.title || m.name}</p>
              <p className="text-[10px] text-muted-foreground">{(m.release_date || m.first_air_date || "").slice(0, 4)}</p>
            </motion.div>
          ))}
        </div>
      )}
    </motion.div>
  );
};

/* ── Where To Watch ── */
const WhereToWatch = ({
  providers,
}: {
  providers: TMDBWatchProviders | null;
}) => {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [canLeft, setCanLeft] = useState(false);
  const [canRight, setCanRight] = useState(false);

  if (!providers) return null;

  const all = [
    ...(providers.flatrate || []),
    ...(providers.rent || []),
    ...(providers.buy || []),
  ];

  const unique = all.filter(
    (p, i, arr) => arr.findIndex((x) => x.provider_id === p.provider_id) === i
  );

  if (unique.length === 0) return null;

  const checkScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    setCanLeft(el.scrollLeft > 4);
    setCanRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 4);
  };

  const scroll = (dir: "left" | "right") => {
    scrollRef.current?.scrollBy({
      left: dir === "left" ? -200 : 200,
      behavior: "smooth",
    });
  };

  return (
    <div
      className="px-6 py-4 border-b border-border/30 space-y-3 w-full overflow-hidden"
      onMouseEnter={checkScroll}
    >
      <h3 className="text-sm font-semibold text-foreground">Where to Watch</h3>
      <div className="relative group w-full">
        {canLeft && (
          <button
            onClick={() => scroll("left")}
            className="absolute left-0 top-0 bottom-0 z-10 w-8 bg-gradient-to-r from-card via-card/90 to-transparent flex items-center justify-start opacity-0 group-hover:opacity-100 transition-opacity"
          >
            <ChevronLeft className="w-4 h-4 text-foreground" />
          </button>
        )}
        <div
          ref={scrollRef}
          onScroll={checkScroll}
          className="flex gap-3 overflow-x-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none] w-full"
        >
          {unique.map((p) => (
            <a
              key={p.provider_id}
              href={providers.link || "#"}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 px-3 py-2 shrink-0 rounded-xl bg-muted/20 border border-border/30 hover:border-primary/40 hover:bg-muted/40 transition-all group/link"
            >
              <img
                src={img(p.logo_path, "w92")!}
                alt={p.provider_name}
                className="w-7 h-7 rounded-lg object-cover shadow-sm"
              />
              <span className="text-xs font-medium text-foreground group-hover/link:text-primary transition-colors whitespace-nowrap">
                {p.provider_name}
              </span>
              <ExternalLink className="w-3 h-3 text-muted-foreground group-hover/link:text-primary transition-colors shrink-0" />
            </a>
          ))}
        </div>
        {canRight && (
          <button
            onClick={() => scroll("right")}
            className="absolute right-0 top-0 bottom-0 z-10 w-8 bg-gradient-to-l from-card via-card/90 to-transparent flex items-center justify-end opacity-0 group-hover:opacity-100 transition-opacity"
          >
            <ChevronRight className="w-4 h-4 text-foreground" />
          </button>
        )}
      </div>
      {providers.link && (
        <a
          href={providers.link}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-[11px] text-muted-foreground/60 hover:text-primary transition-colors mt-1"
        >
          Powered by JustWatch <ExternalLink className="w-2.5 h-2.5" />
        </a>
      )}
    </div>
  );
};

type DialogView =
  | { type: "main" }
  | { type: "allSeasons" }
  | { type: "seasonDetail"; seasonNumber: number }
  | { type: "person"; personId: number; personName: string };

const MovieDetailDialog = ({ open, onOpenChange, movie }: Props) => {
  const navigate = useNavigate();
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [detail, setDetail] = useState<TMDBDetail | null>(null);
  const [reviews, setReviews] = useState<TMDBReview[]>([]);
  const [customReviews, setCustomReviews] = useState<CustomReview[]>([]);
  const [cast, setCast] = useState<TMDBCast[]>([]);
  const [watchProviders, setWatchProviders] =
    useState<TMDBWatchProviders | null>(null);

  const [loading, setLoading] = useState(false);
  const [reviewLoading, setReviewLoading] = useState(false);
  const [userRating, setUserRating] = useState(0);
  const [userReview, setUserReview] = useState("");
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const [reviewToDelete, setReviewToDelete] = useState<string | null>(null);

  const [view, setView] = useState<DialogView>({ type: "main" });
  const [seasonDetail, setSeasonDetail] = useState<TMDBSeasonDetail | null>(
    null
  );
  const [seasonLoading, setSeasonLoading] = useState(false);

  const isTV = movie?.media_type === "tv" || !!movie?.first_air_date;

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => setCurrentUser(user));
  }, []);

  /* Reset scroll on view change */
  useEffect(() => {
    const el = document.getElementById("movie-dialog-content");
    if (el) {
      el.scrollTo({ top: 0, behavior: "smooth" });
    }
  }, [view]);

  /* Reset on movie change */
  useEffect(() => {
    if (!movie || !open) return;
    setLoading(true);
    setDetail(null);
    setReviews([]);
    setCustomReviews([]);
    setCast([]);
    setWatchProviders(null);
    setView({ type: "main" });
    setSeasonDetail(null);
    setUserRating(0);
    setUserReview("");
    setShowCancelConfirm(false);

    const fetchData = async () => {
      try {
        const [d, r, c, wp, crRes] = await Promise.all([
          isTV ? tmdb.tvDetail(movie.id) : tmdb.movieDetail(movie.id),
          isTV ? tmdb.tvReviews(movie.id) : tmdb.movieReviews(movie.id),
          isTV ? tmdb.tvCredits(movie.id) : tmdb.movieCredits(movie.id),
          isTV
            ? tmdb.tvWatchProviders(movie.id)
            : tmdb.movieWatchProviders(movie.id),
          supabase
            .from("movie_reviews")
            .select("*, user:profiles(id, username, avatar_url)")
            .eq("movie_id", movie.id)
            .order("created_at", { ascending: false }),
        ]);
        setDetail(d);
        setReviews(r);
        setCast(c.slice(0, 30));
        setWatchProviders(wp["IN"] || wp["US"] || null);

        if (crRes.data) {
          setCustomReviews(crRes.data as any);
        }
      } catch {
        // fail silently
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [movie, open, isTV]);

  /* Load season detail */
  const loadSeason = async (seasonNumber: number) => {
    if (!movie) return;
    setSeasonLoading(true);
    setSeasonDetail(null);
    setView({ type: "seasonDetail", seasonNumber });
    try {
      const sd = await tmdb.seasonDetail(movie.id, seasonNumber);
      setSeasonDetail(sd);
    } catch {}
    setSeasonLoading(false);
  };

  const handlePostReview = async () => {
    if (!currentUser) {
      toast.error("Please login to post a review");
      return;
    }
    if (!userRating || !userReview.trim()) return;

    setReviewLoading(true);
    try {
      const { data, error } = await supabase
        .from("movie_reviews")
        .insert({
          movie_id: movie!.id,
          media_type: isTV ? "tv" : "movie",
          user_id: currentUser.id,
          rating: userRating,
          content: userReview.trim(),
        })
        .select("*, user:profiles(id, username, avatar_url)")
        .single();

      if (error) throw error;

      setCustomReviews([data as any, ...customReviews]);
      setUserRating(0);
      setUserReview("");
      toast.success("Review posted successfully!");
    } catch (e: any) {
      toast.error(e.message || "Failed to post review");
    } finally {
      setReviewLoading(false);
    }
  };

  const handleDeleteReview = async (id: string) => {
    try {
      const { error } = await supabase
        .from("movie_reviews")
        .delete()
        .eq("id", id);
      if (error) throw error;
      setCustomReviews((prev) => prev.filter((r) => r.id !== id));
      setReviewToDelete(null);
      toast.success("Review removed");
    } catch {
      toast.error("Failed to delete review");
    }
  };

  const handleCancelClick = () => {
    if (userRating > 0 || userReview.trim()) {
      setShowCancelConfirm(true);
    } else {
      setUserRating(0);
      setUserReview("");
    }
  };

  if (!movie) return null;
  const title = movie.title || movie.name || "";
  const year = (movie.release_date || movie.first_air_date || "").slice(0, 4);
  const bg = backdrop(movie.backdrop_path);
  const runtime = formatRuntime(detail?.runtime);

  /* ── All Seasons view ── */
  const renderAllSeasons = () => {
    const seasons = detail?.seasons || [];
    return (
      <div className="px-6 py-5 space-y-4">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setView({ type: "main" })}
            className="p-1.5 rounded-lg hover:bg-muted/40 transition-colors"
          >
            <ArrowLeft className="w-4 h-4 text-foreground" />
          </button>
          <h3 className="text-base font-bold text-foreground">
            All Seasons ({seasons.length})
          </h3>
        </div>
        <div className="space-y-3">
          {seasons.map((s, i) => (
            <motion.div
              key={s.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.04 }}
              onClick={() => loadSeason(s.season_number)}
              className="flex gap-4 p-3 rounded-xl bg-muted/15 border border-border/20 hover:border-primary/30 cursor-pointer transition-all group"
            >
              <div className="w-16 h-24 rounded-lg overflow-hidden shrink-0 bg-muted/30">
                {s.poster_path ? (
                  <img
                    src={img(s.poster_path, "w185")!}
                    alt={s.name}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-xs text-muted-foreground">
                    S{s.season_number}
                  </div>
                )}
              </div>
              <div className="flex-1 min-w-0 py-0.5">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-semibold text-foreground group-hover:text-primary transition-colors">
                    {s.name}
                  </p>
                  {s.vote_average > 0 && (
                    <span className="flex items-center gap-0.5 text-[10px] bg-primary/15 text-primary px-1.5 py-0.5 rounded-full">
                      <Star className="w-2.5 h-2.5 fill-current" />
                      {(s.vote_average * 10).toFixed(0)}%
                    </span>
                  )}
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {s.air_date?.slice(0, 4) || "TBA"} · {s.episode_count}{" "}
                  Episodes
                </p>
                {s.overview && (
                  <p className="text-xs text-foreground/60 mt-1.5 line-clamp-2">
                    {s.overview}
                  </p>
                )}
              </div>
              <ChevronRight className="w-4 h-4 text-muted-foreground self-center shrink-0" />
            </motion.div>
          ))}
        </div>
      </div>
    );
  };

  /* ── Season Detail (episodes) view ── */
  const renderSeasonDetail = () => {
    if (seasonLoading) {
      return (
        <div className="flex justify-center py-16">
          <Loader2 className="w-6 h-6 text-primary animate-spin" />
        </div>
      );
    }
    if (!seasonDetail) return null;

    return (
      <div className="px-6 py-5 space-y-4">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setView({ type: "allSeasons" })}
            className="p-1.5 rounded-lg hover:bg-muted/40 transition-colors"
          >
            <ArrowLeft className="w-4 h-4 text-foreground" />
          </button>
          <div>
            <h3 className="text-base font-bold text-foreground">
              {seasonDetail.name}
            </h3>
            <p className="text-xs text-muted-foreground">
              {seasonDetail.episodes.length} Episodes
              {seasonDetail.air_date
                ? ` · ${seasonDetail.air_date.slice(0, 4)}`
                : ""}
            </p>
          </div>
        </div>

        {seasonDetail.overview && (
          <p className="text-sm text-foreground/70 leading-relaxed">
            {seasonDetail.overview}
          </p>
        )}

        <div className="space-y-2">
          {seasonDetail.episodes.map((ep, i) => (
            <EpisodeCard key={ep.id} episode={ep} index={i} />
          ))}
        </div>
      </div>
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {/* Increased dialog width to max-w-5xl, added overflow constraint */}
      <DialogContent id="movie-dialog-content" className="max-w-5xl w-[95vw] max-h-[92vh] overflow-y-auto overflow-x-hidden bg-card/95 backdrop-blur-xl border-border/50 p-0 gap-0 rounded-2xl shadow-2xl">
        <DialogTitle className="sr-only">{title}</DialogTitle>
        <DialogDescription className="sr-only">
          In-depth details, cast members, seasons, and community reviews for {title}.
        </DialogDescription>


        {/* Backdrop hero */}
        <div className="relative h-64 md:h-80 overflow-hidden rounded-t-2xl w-full">
          {bg ? (
            <img src={bg} alt="" className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full bg-gradient-to-br from-primary/20 to-background" />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-card via-card/50 to-transparent" />

          <div className="absolute bottom-0 left-0 right-0 p-6 flex gap-6 items-end">
            <div className="w-32 md:w-40 xl:w-44 aspect-[2/3] rounded-xl overflow-hidden border-2 border-border/50 shadow-2xl shrink-0 bg-muted/30">
              {img(movie.poster_path, "w342") && (
                <img
                  src={img(movie.poster_path, "w342")!}
                  alt={title}
                  className="w-full h-full object-cover"
                />
              )}
            </div>
            <div className="flex-1 min-w-0 pb-1">
              <p className="text-xs md:text-sm text-muted-foreground uppercase tracking-wider font-semibold">
                {isTV ? "Show" : "Movie"} · {year}
                {runtime ? ` · ${runtime}` : ""}
              </p>
              <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold text-foreground leading-tight mt-1 truncate">
                {title}
              </h2>
              {detail?.genres && (
                <div className="flex flex-wrap gap-2 mt-3">
                  {detail.genres.map((g) => (
                    <span
                      key={g.id}
                      className="text-[11px] md:text-xs px-2.5 py-0.5 rounded-full border border-border/60 text-muted-foreground bg-background/60 shadow-sm"
                    >
                      {g.name}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Score + meta bar */}
        <div className="px-6 py-4 flex flex-wrap items-center gap-6 border-b border-border/30 w-full bg-card/60">
          {movie.vote_average > 0 && (
            <div className="flex items-center gap-2">
              <div className="relative w-12 h-12">
                <svg className="w-12 h-12 -rotate-90" viewBox="0 0 36 36">
                  <circle
                    cx="18"
                    cy="18"
                    r="15.5"
                    fill="none"
                    stroke="hsl(var(--muted))"
                    strokeWidth="2"
                  />
                  <circle
                    cx="18"
                    cy="18"
                    r="15.5"
                    fill="none"
                    stroke="hsl(var(--primary))"
                    strokeWidth="2.5"
                    strokeDasharray={`${movie.vote_average * 9.74} 97.4`}
                    strokeLinecap="round"
                  />
                </svg>
                <span className="absolute inset-0 flex items-center justify-center text-xs font-bold text-foreground">
                  {Math.round(movie.vote_average * 10)}%
                </span>
              </div>
              <div>
                <p className="text-xs font-semibold text-foreground">
                  User Score
                </p>
                <p className="text-[10px] text-muted-foreground">
                  {movie.vote_count.toLocaleString()} votes
                </p>
              </div>
            </div>
          )}
          {detail?.status && (
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Calendar className="w-3.5 h-3.5" /> {detail.status}
            </div>
          )}
          {detail?.number_of_seasons && (
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Clock className="w-3.5 h-3.5" /> {detail.number_of_seasons}{" "}
              Seasons
            </div>
          )}
        </div>

        {/* ── Switchable content area ── */}
        <AnimatePresence mode="wait">
          {view.type === "person" ? (
            <motion.div key={`person-${view.personId}`} initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -30 }} className="w-full">
              <PersonView
                personId={view.personId}
                personName={view.personName}
                onBack={() => setView({ type: "main" })}
                onSelectMovie={(m) => {
                  setView({ type: "main" });
                  // Let parent swap to new movie by firing a custom event
                  window.dispatchEvent(new CustomEvent("openMovie", { detail: { movie: m } }));
                }}
              />
            </motion.div>
          ) : view.type === "allSeasons" ? (
            <motion.div
              key="allSeasons"
              initial={{ opacity: 0, x: 30 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -30 }}
              className="w-full"
            >
              {renderAllSeasons()}
            </motion.div>
          ) : view.type === "seasonDetail" ? (
            <motion.div
              key={`season-${view.seasonNumber}`}
              initial={{ opacity: 0, x: 30 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -30 }}
              className="w-full"
            >
              {renderSeasonDetail()}
            </motion.div>
          ) : (
            <motion.div
              key="main"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="w-full overflow-hidden"
            >
              {/* Overview */}
              <div className="px-6 py-5 space-y-2 border-b border-border/30 w-full">
                {detail?.tagline && (
                  <p className="text-sm italic text-muted-foreground">
                    "{detail.tagline}"
                  </p>
                )}
                <h3 className="text-base font-semibold text-foreground">
                  Overview
                </h3>
                <p className="text-sm md:text-base text-foreground/80 leading-relaxed max-w-4xl">
                  {movie.overview || "No overview available."}
                </p>
              </div>

              {/* Cast */}
              <CastRow cast={cast} onPersonClick={(id, name) => setView({ type: "person", personId: id, personName: name })} />

              {/* Where to Watch */}
              <WhereToWatch providers={watchProviders} />

              {/* Seasons (TV only) */}
              {isTV && detail?.seasons && detail.seasons.length > 0 && (
                <div className="px-6 py-5 space-y-3 border-b border-border/30 w-full">
                  <h3 className="text-sm font-semibold text-foreground">
                    Last Season
                  </h3>
                  {(() => {
                    const last = detail.seasons[detail.seasons.length - 1];
                    return (
                      <div
                        onClick={() => loadSeason(last.season_number)}
                        className="flex gap-4 p-3 rounded-xl bg-muted/15 border border-border/20 hover:border-primary/30 cursor-pointer transition-all group max-w-xl"
                      >
                        <div className="w-20 h-28 rounded-lg overflow-hidden shrink-0 bg-muted/30">
                          {last.poster_path ? (
                            <img
                              src={img(last.poster_path, "w185")!}
                              alt={last.name}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-xs text-muted-foreground">
                              S{last.season_number}
                            </div>
                          )}
                        </div>
                        <div className="flex-1 min-w-0 py-0.5">
                          <p className="text-sm font-semibold text-foreground group-hover:text-primary transition-colors">
                            {last.name}
                          </p>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {last.air_date?.slice(0, 4) || "TBA"} ·{" "}
                            {last.episode_count} Episodes
                          </p>
                          {last.overview && (
                            <p className="text-xs text-foreground/60 mt-2 line-clamp-2">
                              {last.overview}
                            </p>
                          )}
                        </div>
                      </div>
                    );
                  })()}
                  <button
                    onClick={() => setView({ type: "allSeasons" })}
                    className="text-sm font-semibold text-foreground hover:text-primary transition-colors flex items-center gap-1"
                  >
                    View All Seasons
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              )}

              {/* ── WRITE REVIEW ── */}
              <div className="px-6 py-6 border-b border-border/30 w-full bg-card/40">
                {customReviews.find(r => r.user_id === currentUser?.id) ? (
                  (() => {
                    const myReview = customReviews.find(r => r.user_id === currentUser?.id)!;
                    return (
                      <div className="space-y-3">
                        <h3 className="text-base font-semibold text-foreground mb-3 flex items-center gap-2">
                          <CheckCircle2 className="w-4 h-4 text-primary" /> Your Review
                        </h3>
                        <div className="bg-primary/5 border border-primary/20 rounded-xl p-4 space-y-3 max-w-3xl">
                          <div className="flex items-center gap-1">
                            {[1,2,3,4,5].map(s => (
                              <Star key={s} className={`w-5 h-5 ${s <= myReview.rating ? "text-yellow-400 fill-yellow-400" : "text-muted-foreground/30"}`} />
                            ))}
                          </div>
                          <p className="text-sm text-foreground/80 leading-relaxed">{myReview.content}</p>
                          <p className="text-xs text-muted-foreground">{new Date(myReview.created_at).toLocaleDateString()}</p>
                          <AnimatePresence>
                            {reviewToDelete === myReview.id ? (
                              <motion.div
                                initial={{ opacity: 0, height: 0 }}
                                animate={{ opacity: 1, height: "auto" }}
                                exit={{ opacity: 0, height: 0 }}
                                className="bg-destructive/10 border border-destructive/20 rounded-lg px-4 py-3 flex items-start gap-3"
                              >
                                <AlertTriangle className="w-4 h-4 text-destructive mt-0.5 shrink-0" />
                                <div className="flex-1">
                                  <p className="text-sm text-destructive font-medium">Delete this review?</p>
                                  <p className="text-xs text-destructive/70 mt-0.5">This cannot be undone.</p>
                                </div>
                                <div className="flex gap-2 shrink-0">
                                  <button onClick={() => setReviewToDelete(null)} className="px-3 py-1.5 text-xs rounded-md bg-muted hover:bg-muted/80 transition-colors">Cancel</button>
                                  <button onClick={() => handleDeleteReview(myReview.id)} className="px-3 py-1.5 text-xs rounded-md bg-destructive text-destructive-foreground hover:bg-destructive/90 transition-colors font-medium">Delete</button>
                                </div>
                              </motion.div>
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
                      </div>
                    );
                  })()
                ) : (
                  <div className="space-y-4">
                    <h3 className="text-base font-semibold text-foreground">Write a Review</h3>
                    <div className="space-y-4 max-w-3xl">
                      <StarRating value={userRating} onChange={setUserRating} />
                      <div className="flex flex-col gap-3">
                        <textarea
                          value={userReview}
                          onChange={(e) => setUserReview(e.target.value)}
                          placeholder="Share your thoughts with the Tune-In community..."
                          className="w-full bg-muted/30 border border-border/40 rounded-xl px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary/60 transition-colors min-h-[90px] resize-none"
                        />
                        <AnimatePresence>
                          {showCancelConfirm && (
                            <motion.div
                              initial={{ opacity: 0, height: 0 }}
                              animate={{ opacity: 1, height: "auto" }}
                              exit={{ opacity: 0, height: 0 }}
                              className="bg-destructive/10 border border-destructive/20 text-destructive text-sm px-4 py-3 rounded-lg flex items-center justify-between"
                            >
                              <span>Are you sure you want to discard your review?</span>
                              <div className="flex gap-2">
                                <button onClick={() => setShowCancelConfirm(false)} className="px-3 py-1.5 hover:bg-destructive/10 rounded-md transition-colors">Keep editing</button>
                                <button onClick={() => { setUserRating(0); setUserReview(""); setShowCancelConfirm(false); }} className="px-3 py-1.5 bg-destructive text-destructive-foreground rounded-md font-medium hover:bg-destructive/90 transition-colors">Discard</button>
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                        <div className="flex justify-end gap-2">
                          {(userRating > 0 || userReview.length > 0) && (
                            <motion.button
                              whileTap={{ scale: 0.95 }}
                              onClick={handleCancelClick}
                              className="px-4 py-2.5 rounded-xl border border-border/40 text-foreground hover:bg-muted/40 transition-colors text-sm font-medium flex items-center gap-1.5"
                            >
                              <XCircle className="w-4 h-4" /> Cancel
                            </motion.button>
                          )}
                          <motion.button
                            whileTap={{ scale: 0.95 }}
                            onClick={handlePostReview}
                            disabled={!userRating || !userReview.trim() || reviewLoading || showCancelConfirm}
                            className="px-5 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1.5 shadow-md shadow-primary/20"
                          >
                            {reviewLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                            Post Review
                          </motion.button>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* ── REVIEWS (Tune-In Local + TMDB Global) ── */}
              <div className="px-6 py-6 space-y-5 w-full">
                <h3 className="text-base font-semibold text-foreground flex items-center gap-2">
                  Reviews{" "}
                  <span className="text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
                    {customReviews.length + reviews.length}
                  </span>
                </h3>

                {loading && (
                  <div className="flex justify-center py-8">
                    <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                  </div>
                )}
                {!loading && customReviews.length === 0 && reviews.length === 0 && (
                  <p className="text-sm text-muted-foreground py-4 text-center border border-dashed border-border/50 rounded-xl">
                    No reviews yet. Be the first to share your thoughts on Tune-In!
                  </p>
                )}

                <AnimatePresence>
                  {/* TUNE-IN APP REVIEWS (First) */}
                  {customReviews.map((r, i) => (
                    <motion.div
                      key={`custom-${r.id}`}
                      initial={{ opacity: 0, y: 15 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.95 }}
                      transition={{ delay: i * 0.05 }}
                      className="bg-primary/5 border border-primary/20 rounded-xl p-5 space-y-3 relative overflow-hidden"
                    >
                      <div className="absolute top-0 right-0 px-3 py-1 bg-primary/10 text-primary text-[10px] font-bold uppercase rounded-bl-lg">
                        Tune-In 
                      </div>
                      <div className="flex items-center gap-3">
                        <div 
                           onClick={() => {
                             onOpenChange(false);
                             navigate(`/user/${r.user.username}`);
                           }}
                           className="flex items-center gap-3 flex-1 min-w-0 cursor-pointer group/profile"
                        >
                          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary/60 to-accent/60 overflow-hidden flex items-center justify-center text-sm font-bold text-foreground group-hover/profile:ring-2 ring-primary/50 transition-all">
                            {r.user.avatar_url ? (
                              <img src={r.user.avatar_url} className="w-full h-full object-cover" />
                            ) : (
                              r.user.username?.charAt(0).toUpperCase() || "?"
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold text-foreground truncate group-hover/profile:text-primary transition-colors">
                              @{r.user.username}
                            </p>
                            <p className="text-[10px] text-muted-foreground">
                              {new Date(r.created_at).toLocaleDateString()}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <div className="flex items-center gap-0.5 text-xs bg-background/50 px-2 py-1 rounded-md shadow-sm border border-border/30">
                            <Star className="w-3.5 h-3.5 text-yellow-500 fill-yellow-500 drop-shadow-sm" />
                            <span className="text-foreground font-bold">
                              {r.rating}
                            </span>
                            <span className="text-muted-foreground">/5</span>
                          </div>
                          {currentUser?.id === r.user_id && (
                            <AnimatePresence>
                              {reviewToDelete === r.id ? (
                                <motion.div
                                  initial={{ opacity: 0, height: 0 }}
                                  animate={{ opacity: 1, height: "auto" }}
                                  exit={{ opacity: 0, height: 0 }}
                                  className="bg-destructive/10 border border-destructive/20 rounded-lg px-3 py-2 flex items-center gap-2 text-xs"
                                >
                                  <AlertTriangle className="w-3.5 h-3.5 text-destructive shrink-0" />
                                  <span className="text-destructive flex-1">Delete this review?</span>
                                  <button onClick={() => setReviewToDelete(null)} className="px-2 py-1 bg-muted rounded text-muted-foreground hover:bg-muted/80">No</button>
                                  <button onClick={() => handleDeleteReview(r.id)} className="px-2 py-1 bg-destructive text-destructive-foreground rounded font-medium">Yes</button>
                                </motion.div>
                              ) : (
                                <motion.button
                                  initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                                  onClick={() => setReviewToDelete(r.id)}
                                  className="p-1.5 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-md transition-colors"
                                  title="Delete review"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </motion.button>
                              )}
                            </AnimatePresence>
                          )}
                        </div>
                      </div>
                      <p className="text-sm text-foreground/80 leading-relaxed">
                        {r.content}
                      </p>
                    </motion.div>
                  ))}

                  {/* TMDB REVIEWS (Fallback) */}
                  {reviews.map((r, i) => (
                    <motion.div
                      key={`tmdb-${r.id}`}
                      initial={{ opacity: 0, y: 15 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: (customReviews.length + i) * 0.05 }}
                      className="bg-muted/15 border border-border/30 rounded-xl p-5 space-y-3"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-muted to-muted/50 overflow-hidden flex items-center justify-center text-sm font-bold text-muted-foreground">
                          {r.author_details.avatar_path ? (
                            <img 
                              src={r.author_details.avatar_path.startsWith('/') 
                                ? img(r.author_details.avatar_path, "w185")! 
                                : r.author_details.avatar_path.slice(1)} 
                              className="w-full h-full object-cover" 
                              onError={(e) => { e.currentTarget.style.display = 'none'; }}
                            />
                          ) : (
                            r.author.charAt(0).toUpperCase()
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-foreground truncate">
                            @{r.author_details.username || r.author}
                          </p>
                          <p className="text-[10px] text-muted-foreground">
                            {new Date(r.created_at).toLocaleDateString()} · TMDB
                          </p>
                        </div>
                        {r.author_details.rating && (
                          <div className="flex items-center gap-0.5 text-xs bg-background/50 px-2 py-1 rounded-md shadow-sm border border-border/30">
                            <Star className="w-3.5 h-3.5 text-yellow-500 fill-yellow-500" />
                            <span className="text-foreground font-bold">
                              {r.author_details.rating / 2}
                            </span>
                            <span className="text-muted-foreground">/5</span>
                          </div>
                        )}
                      </div>
                      <p className="text-sm text-foreground/75 leading-relaxed overflow-hidden">
                        {/* Trim overly long TMDB reviews */}
                        {r.content.length > 500 
                          ? r.content.slice(0, 500) + "..." 
                          : r.content}
                      </p>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </DialogContent>
    </Dialog>
  );
};

/* ── Episode card ── */
const EpisodeCard = ({
  episode,
  index,
}: {
  episode: TMDBEpisode;
  index: number;
}) => {
  const [expanded, setExpanded] = useState(false);
  const still = img(episode.still_path, "w300");

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.03 }}
      className="rounded-xl bg-muted/15 border border-border/20 overflow-hidden"
    >
      <div className="flex gap-4 p-3">
        <div className="w-28 h-16 rounded-lg overflow-hidden shrink-0 bg-muted/30 relative group">
          {still ? (
            <img
              src={still}
              alt={episode.name}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-xs text-muted-foreground">
              Ep {episode.episode_number}
            </div>
          )}
          <div className="absolute inset-0 flex items-center justify-center bg-background/30 opacity-0 group-hover:opacity-100 transition-opacity">
            <Play className="w-5 h-5 text-foreground" />
          </div>
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-start gap-2">
            <p className="text-sm font-semibold text-foreground">
              {episode.episode_number}. {episode.name}
            </p>
            {episode.vote_average > 0 && (
              <span className="shrink-0 flex items-center gap-0.5 text-[10px] bg-primary/15 text-primary px-1.5 py-0.5 rounded-full mt-0.5">
                <Star className="w-2.5 h-2.5 fill-current" />
                {(episode.vote_average * 10).toFixed(0)}%
              </span>
            )}
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            {episode.air_date || "TBA"}
            {episode.runtime ? ` · ${formatRuntime(episode.runtime)}` : ""}
          </p>
        </div>
      </div>

      {episode.overview && (
        <>
          <div className="px-3 pb-3">
            <p
              className={`text-xs text-foreground/60 leading-relaxed ${!expanded ? "line-clamp-2" : ""}`}
            >
              {episode.overview}
            </p>
          </div>
          {episode.overview.length > 120 && (
            <button
              onClick={() => setExpanded(!expanded)}
              className="w-full py-1.5 text-[11px] text-primary hover:underline text-center border-t border-border/15"
            >
              {expanded ? "Collapse" : "Expand"}
            </button>
          )}
        </>
      )}
    </motion.div>
  );
};

export default MovieDetailDialog;
