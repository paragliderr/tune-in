import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Search, Film, Loader2, ChevronLeft, ChevronRight, ArrowLeft, Tv, Filter, SortAsc, LayoutGrid } from "lucide-react";
import { tmdb, OTT_PROVIDERS, type TMDBMovie, type TMDBGenre } from "@/lib/tmdb";
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuRadioGroup, 
  DropdownMenuRadioItem, 
  DropdownMenuTrigger,
  DropdownMenuLabel,
  DropdownMenuSeparator
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import MovieCard from "./MovieCard";
import MovieDetailDialog from "./MovieDetailDialog";

/* ── Scrollable horizontal row with arrows ── */
const HorizontalRow = ({
  title,
  icon,
  movies,
  onSelect,
  onTitleClick,
  colorClass,
}: {
  title: string;
  icon?: React.ReactNode;
  movies: TMDBMovie[];
  onSelect: (m: TMDBMovie) => void;
  onTitleClick?: () => void;
  colorClass?: string;
}) => {
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
  }, [movies]);

  const scroll = (dir: "left" | "right") => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollBy({ left: dir === "left" ? -400 : 400, behavior: "smooth" });
  };

  return (
    <motion.section
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-3"
    >
      <div className="flex items-center gap-2 px-1">
        {icon && icon}
        <h2
          onClick={onTitleClick}
          className={`text-lg font-bold text-foreground tracking-wide ${onTitleClick ? "cursor-pointer hover:text-primary transition-colors" : ""}`}
        >
          {title}
        </h2>
        {onTitleClick && (
          <ChevronRight className="w-4 h-4 text-muted-foreground" />
        )}
      </div>

      <div className="relative group">
        {/* Left arrow */}
        {canLeft && (
          <button
            onClick={() => scroll("left")}
            className="absolute left-0 top-0 bottom-8 z-10 w-10 bg-gradient-to-r from-background via-background/80 to-transparent flex items-center justify-start pl-1 opacity-0 group-hover:opacity-100 transition-opacity"
          >
            <ChevronLeft className="w-6 h-6 text-foreground" />
          </button>
        )}

        <div
          ref={scrollRef}
          className="flex gap-4 overflow-x-auto pb-2 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]"
        >
          {movies.map((m, i) => (
            <MovieCard key={m.id} movie={m} index={i} onClick={() => onSelect(m)} />
          ))}
        </div>

        {/* Right arrow */}
        {canRight && (
          <button
            onClick={() => scroll("right")}
            className="absolute right-0 top-0 bottom-8 z-10 w-10 bg-gradient-to-l from-background via-background/80 to-transparent flex items-center justify-end pr-1 opacity-0 group-hover:opacity-100 transition-opacity"
          >
            <ChevronRight className="w-6 h-6 text-foreground" />
          </button>
        )}
      </div>
    </motion.section>
  );
};

/* ── Category listing view ── */
type CategoryDef = {
  key: string;
  title: string;
  icon?: React.ReactNode;
  colorClass?: string;
  fetcher: (page: number) => Promise<{ results: TMDBMovie[]; total_pages: number }>;
};

const CategoryView = ({
  category,
  onBack,
  onSelect,
}: {
  category: CategoryDef;
  onBack: () => void;
  onSelect: (m: TMDBMovie) => void;
}) => {
  const [movies, setMovies] = useState<TMDBMovie[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);

  const loadPage = async (p: number) => {
    setLoading(true);
    try {
      const data = await category.fetcher(p);
      setMovies(data.results);
      setTotalPages(Math.min(data.total_pages, 20));
      setPage(p);
    } catch {}
    setLoading(false);
  };

  useEffect(() => {
    loadPage(1);
  }, [category.key]);

  return (
    <motion.div
      initial={{ opacity: 0, x: 40 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -40 }}
      className="space-y-6"
    >
      <div className="flex items-center gap-3">
        <button
          onClick={onBack}
          className="p-2 rounded-xl hover:bg-muted/40 transition-colors"
        >
          <ArrowLeft className="w-5 h-5 text-foreground" />
        </button>
        <h2 className="text-xl font-bold text-foreground">{category.title}</h2>
      </div>

      {loading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="w-7 h-7 text-primary animate-spin" />
        </div>
      ) : (
        <>
          <div className="flex flex-wrap gap-4">
            {movies.map((m, i) => (
              <MovieCard key={m.id} movie={m} index={i} onClick={() => onSelect(m)} />
            ))}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 pt-4 pb-8">
              <button
                disabled={page <= 1}
                onClick={() => loadPage(page - 1)}
                className="px-3 py-1.5 rounded-lg text-sm border border-border/40 hover:bg-muted/40 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              >
                Previous
              </button>
              <span className="text-sm text-muted-foreground px-3">
                Page {page} of {totalPages}
              </span>
              <button
                disabled={page >= totalPages}
                onClick={() => loadPage(page + 1)}
                className="px-3 py-1.5 rounded-lg text-sm border border-border/40 hover:bg-muted/40 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              >
                Next
              </button>
            </div>
          )}
        </>
      )}
    </motion.div>
  );
};

/* ── Main CinemaTab ── */
const CinemaTab = () => {
  const [query, setQuery] = useState("");
  const [searchResults, setSearchResults] = useState<TMDBMovie[]>([]);
  const [searching, setSearching] = useState(false);

  const [trending, setTrending] = useState<TMDBMovie[]>([]);
  const [topMovies, setTopMovies] = useState<TMDBMovie[]>([]);
  const [topTV, setTopTV] = useState<TMDBMovie[]>([]);
  const [ottData, setOttData] = useState<Record<number, TMDBMovie[]>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [selectedMovie, setSelectedMovie] = useState<TMDBMovie | null>(null);
  const [activeCategory, setActiveCategory] = useState<CategoryDef | null>(null);
  const [searchTypeFilter, setSearchTypeFilter] = useState<"all" | "movie" | "tv">("all");
  const [searchGenreFilter, setSearchGenreFilter] = useState<string>("All");
  const [searchSort, setSearchSort] = useState<"newest" | "oldest" | "relevance">("relevance");
  const [searchPage, setSearchPage] = useState(1);
  const [rawSearchResults, setRawSearchResults] = useState<TMDBMovie[]>([]);
  const [isInitialLoading, setInitialLoading] = useState(false);
  const [genres, setGenres] = useState<TMDBGenre[]>([]);
  const [letterboxdUsername, setLetterboxdUsername] = useState<string | undefined>();

  // Fetch logged in user's letterboxd connection to show in the global movie detail dialog
  useEffect(() => {
    const fetchConnections = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        const { data } = await supabase.from("profiles").select("connections").eq("id", session.user.id).single();
        if (data?.connections?.letterboxd) {
          setLetterboxdUsername(data.connections.letterboxd);
        }
      }
    };
    fetchConnections();
  }, []);

  // Listen for movie open events from PersonView
  useEffect(() => {
    const handler = (e: any) => {
      const movie = e.detail?.movie as TMDBMovie;
      if (movie) setSelectedMovie(movie);
    };
    window.addEventListener("openMovie", handler);
    return () => window.removeEventListener("openMovie", handler);
  }, []);

  useEffect(() => {
    const load = async () => {
      try {
        const [t, tm, tt, ...otts] = await Promise.all([
          tmdb.trending(),
          tmdb.topRatedMovies(),
          tmdb.topRatedTV(),
          ...OTT_PROVIDERS.map((p) => tmdb.discoverByProvider(p.id, "movie")),
        ]);
        setTrending(t.slice(0, 15));
        setTopMovies(tm.slice(0, 15));
        setTopTV(tt.slice(0, 15));
        const od: Record<number, TMDBMovie[]> = {};
        OTT_PROVIDERS.forEach((p, i) => {
          od[p.id] = otts[i].slice(0, 15);
        });
        setOttData(od);
      } catch (e) {
        setError("Could not load movies. Please check your TMDB API key.");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const handleSearch = useCallback(async (q: string) => {
    if (q.trim().length < 2) {
      setRawSearchResults([]);
      setSearching(false);
      return;
    }
    
    setSearching(true);
    setInitialLoading(true);
    try {
      const [{ results }, mg, tg] = await Promise.all([
        tmdb.searchDeep(q),
        genres.length === 0 ? tmdb.movieGenres() : Promise.resolve(genres),
        genres.length === 0 ? tmdb.tvGenres() : Promise.resolve([] as TMDBGenre[]),
      ]);
      
      setRawSearchResults(results);
      setSearchPage(1);
      
      // Reset filters for new search query
      setSearchTypeFilter("all");
      setSearchGenreFilter("All");
      setSearchSort("relevance");

      if (genres.length === 0) {
        const all = [...mg, ...tg].filter((g, i, a) => a.findIndex(x => x.id === g.id) === i);
        setGenres(all);
      }
    } catch (e) {
      console.error("Search Error:", e);
      setRawSearchResults([]);
    } finally {
      setSearching(false);
      setInitialLoading(false);
    }
  }, [genres]);

  useEffect(() => {
    const t = setTimeout(() => handleSearch(query), 400);
    return () => clearTimeout(t);
  }, [query]);

  const filteredSortedResults = useMemo(() => {
    let list = rawSearchResults.filter(m => {
      const typeOk = searchTypeFilter === "all" || m.media_type === searchTypeFilter;
      const genre = genres.find(g => g.name === searchGenreFilter);
      const genreOk = searchGenreFilter === "All" || (genre && m.genre_ids?.includes(genre.id));
      return typeOk && genreOk;
    });

    if (searchSort !== "relevance") {
      list = [...list].sort((a, b) => {
        const dateA = a.release_date || a.first_air_date || "";
        const dateB = b.release_date || b.first_air_date || "";
        return searchSort === "newest" ? dateB.localeCompare(dateA) : dateA.localeCompare(dateB);
      });
    }

    return list;
  }, [rawSearchResults, searchTypeFilter, searchGenreFilter, searchSort, genres]);

  const totalPagesPool = Math.ceil(filteredSortedResults.length / 20);
  const paginatedResults = filteredSortedResults.slice((searchPage - 1) * 20, searchPage * 20);

  /* Category definitions — each maps to a paginated fetcher */
  const categories: Record<string, CategoryDef> = {
    trending: {
      key: "trending",
      title: "🔥 Talk of the Town",
      fetcher: (p) => tmdb.trendingPage(p),
    },
    topMovies: {
      key: "topMovies",
      title: "Top Rated Movies",
      icon: <Film className="w-4 h-4 text-primary-foreground" />,
      colorClass: "from-primary to-purple-800",
      fetcher: (p) => tmdb.topRatedMoviesPage(p),
    },
    topTV: {
      key: "topTV",
      title: "Most Watched Shows",
      icon: <Film className="w-4 h-4 text-primary-foreground" />,
      colorClass: "from-indigo-600 to-blue-800",
      fetcher: (p) => tmdb.topRatedTVPage(p),
    },
    ...Object.fromEntries(
      OTT_PROVIDERS.map((p) => [
        `ott_${p.id}`,
        {
          key: `ott_${p.id}`,
          title: `Popular on ${p.name}`,
          colorClass: p.color,
          icon: <span className="text-[10px] font-bold text-primary-foreground">{p.name.charAt(0)}</span>,
          fetcher: (page: number) => tmdb.discoverByProviderPage(p.id, "movie", page),
        },
      ])
    ),
  };

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-primary animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex-1 flex items-center justify-center text-center px-6">
        <div className="space-y-2">
          <Film className="w-10 h-10 text-muted-foreground mx-auto" />
          <p className="text-muted-foreground text-sm">{error}</p>
          <p className="text-xs text-muted-foreground/60">
            Add your TMDB key as VITE_TMDB_API_KEY in environment variables.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="max-w-6xl mx-auto px-4 md:px-8 py-6 space-y-8">
        {/* Search bar */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-xl mx-auto"
        >
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search movies, shows..."
              className="w-full bg-muted/30 border border-border/40 rounded-2xl pl-11 pr-4 py-3 text-sm text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:border-primary/60 focus:shadow-[0_0_15px_hsl(var(--primary)/0.1)] transition-all"
            />
            {searching && (
              <Loader2 className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-primary animate-spin" />
            )}
          </div>
        </motion.div>

        <AnimatePresence mode="wait">
          {query.trim().length >= 2 ? (
            /* ── Search results ── */
            <motion.div
              key="search"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="space-y-5"
            >
              <div className="flex flex-col sm:flex-row sm:items-center gap-3 justify-between">
                <div className="flex items-center gap-2">
                  <h2 className="text-lg font-bold text-foreground">Search Results</h2>
                  {filteredSortedResults.length > 0 && (
                    <span className="px-2 py-0.5 rounded-full bg-primary/10 text-primary text-[10px] font-bold border border-primary/20">
                      {filteredSortedResults.length}
                    </span>
                  )}
                </div>
                <div className="flex gap-2 flex-wrap items-center">
                  {/* Sort filter */}
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="outline" size="sm" className="h-9 bg-muted/20 border-border/40 text-xs gap-2 hover:bg-muted/40 transition-all rounded-xl">
                        <SortAsc className="w-3.5 h-3.5 text-muted-foreground" />
                        <span className="text-muted-foreground">Sort:</span>
                        <span className="font-semibold uppercase text-[10px] tracking-wider">{searchSort}</span>
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-48 bg-card/95 backdrop-blur-xl border-border/40 rounded-xl">
                      <DropdownMenuLabel className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold">Sort Options</DropdownMenuLabel>
                      <DropdownMenuSeparator className="bg-border/40" />
                      <DropdownMenuRadioGroup value={searchSort} onValueChange={(v) => { setSearchSort(v as any); setSearchPage(1); }}>
                        <DropdownMenuRadioItem value="relevance" className="text-sm cursor-pointer capitalize py-2">Relevance</DropdownMenuRadioItem>
                        <DropdownMenuRadioItem value="newest" className="text-sm cursor-pointer capitalize py-2">Newest First</DropdownMenuRadioItem>
                        <DropdownMenuRadioItem value="oldest" className="text-sm cursor-pointer capitalize py-2">Oldest First</DropdownMenuRadioItem>
                      </DropdownMenuRadioGroup>
                    </DropdownMenuContent>
                  </DropdownMenu>

                  {/* Type filter */}
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="outline" size="sm" className="h-9 bg-muted/20 border-border/40 text-xs gap-2 hover:bg-muted/40 transition-all rounded-xl">
                        <LayoutGrid className="w-3.5 h-3.5 text-muted-foreground" />
                        <span className="text-muted-foreground">Type:</span>
                        <span className="font-semibold capitalize">{searchTypeFilter}</span>
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-48 bg-card/95 backdrop-blur-xl border-border/40 rounded-xl">
                      <DropdownMenuLabel className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold">Content Type</DropdownMenuLabel>
                      <DropdownMenuSeparator className="bg-border/40" />
                      <DropdownMenuRadioGroup value={searchTypeFilter} onValueChange={(v) => { setSearchTypeFilter(v as any); setSearchPage(1); }}>
                        <DropdownMenuRadioItem value="all" className="text-sm cursor-pointer py-2">All Content</DropdownMenuRadioItem>
                        <DropdownMenuRadioItem value="movie" className="text-sm cursor-pointer py-2">Movies Only</DropdownMenuRadioItem>
                        <DropdownMenuRadioItem value="tv" className="text-sm cursor-pointer py-2">TV Shows Only</DropdownMenuRadioItem>
                      </DropdownMenuRadioGroup>
                    </DropdownMenuContent>
                  </DropdownMenu>

                  {/* Genre filter */}
                  {genres.length > 0 && (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="outline" size="sm" className="h-9 bg-muted/20 border-border/40 text-xs gap-2 hover:bg-muted/40 transition-all rounded-xl">
                          <Filter className="w-3.5 h-3.5 text-muted-foreground" />
                          <span className="text-muted-foreground">Genre:</span>
                          <span className="font-semibold truncate max-w-[80px]">{searchGenreFilter === "All" ? "Any" : searchGenreFilter}</span>
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-56 max-h-[300px] overflow-y-auto bg-card/95 backdrop-blur-xl border-border/40 rounded-xl">
                        <DropdownMenuLabel className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold">Filter Genre</DropdownMenuLabel>
                        <DropdownMenuSeparator className="bg-border/40" />
                        <DropdownMenuRadioGroup value={searchGenreFilter} onValueChange={(v) => { setSearchGenreFilter(v); setSearchPage(1); }}>
                          <DropdownMenuRadioItem value="All" className="text-sm cursor-pointer py-2">All Genres</DropdownMenuRadioItem>
                          {genres.map(g => (
                            <DropdownMenuRadioItem key={g.id} value={g.name} className="text-sm cursor-pointer py-2">
                              {g.name}
                            </DropdownMenuRadioItem>
                          ))}
                        </DropdownMenuRadioGroup>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}
                </div>
              </div>
              {isInitialLoading ? (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                  {Array.from({ length: 10 }).map((_, i) => (
                    <div key={i} className="space-y-3">
                      <Skeleton className="aspect-[2/3] w-full rounded-2xl" />
                      <div className="space-y-1">
                        <Skeleton className="h-4 w-3/4" />
                        <Skeleton className="h-3 w-1/2" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <>
                  {paginatedResults.length === 0 && !searching ? (
                    <p className="text-sm text-muted-foreground pt-8">No results found with the current filters.</p>
                  ) : (
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                      {paginatedResults.map((m, i) => (
                        <MovieCard key={m.id} movie={m} index={i} onClick={() => setSelectedMovie(m)} />
                      ))}
                    </div>
                  )}

                  {/* Pagination Buttons */}
                  {totalPagesPool > 1 && (
                    <div className="flex items-center justify-center gap-3 pt-12 pb-12">
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={searchPage <= 1}
                        onClick={() => { setSearchPage(searchPage - 1); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
                        className="bg-muted/20 border-border/40 hover:bg-muted/40 rounded-xl px-4"
                      >
                        <ChevronLeft className="w-4 h-4 mr-2" />
                        Previous
                      </Button>
                      <span className="text-sm text-muted-foreground font-medium">
                        Page {searchPage} of {totalPagesPool}
                      </span>
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={searchPage >= totalPagesPool}
                        onClick={() => { setSearchPage(searchPage + 1); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
                        className="bg-muted/20 border-border/40 hover:bg-muted/40 rounded-xl px-4"
                      >
                        Next
                        <ChevronRight className="w-4 h-4 ml-2" />
                      </Button>
                    </div>
                  )}
                </>
              )}
            </motion.div>
          ) : activeCategory ? (
            /* ── Category listing ── */
            <CategoryView
              key={activeCategory.key}
              category={activeCategory}
              onBack={() => setActiveCategory(null)}
              onSelect={setSelectedMovie}
            />
          ) : (
            /* ── Browse rows ── */
            <motion.div
              key="browse"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="space-y-10"
            >
              <HorizontalRow
                title="🔥 Talk of the Town"
                movies={trending}
                onSelect={setSelectedMovie}
                onTitleClick={() => setActiveCategory(categories.trending)}
              />

              <HorizontalRow
                title="Top Rated Movies"
                icon={<div className="w-7 h-7 rounded-lg bg-gradient-to-br from-primary to-purple-800 flex items-center justify-center"><Film className="w-4 h-4 text-primary-foreground" /></div>}
                movies={topMovies}
                onSelect={setSelectedMovie}
                onTitleClick={() => setActiveCategory(categories.topMovies)}
              />

              <HorizontalRow
                title="Most Watched Shows"
                icon={<div className="w-7 h-7 rounded-lg bg-gradient-to-br from-indigo-600 to-blue-800 flex items-center justify-center"><Film className="w-4 h-4 text-primary-foreground" /></div>}
                movies={topTV}
                onSelect={setSelectedMovie}
                onTitleClick={() => setActiveCategory(categories.topTV)}
              />

              {OTT_PROVIDERS.map((p) => (
                <HorizontalRow
                  key={p.id}
                  title={`Popular on ${p.name}`}
                  colorClass={p.color}
                  icon={<img src={p.logo} alt={p.name} className="w-7 h-7 rounded-lg object-cover" />}
                  movies={ottData[p.id] || []}
                  onSelect={setSelectedMovie}
                  onTitleClick={() => setActiveCategory(categories[`ott_${p.id}`])}
                />
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <MovieDetailDialog
        open={!!selectedMovie}
        onOpenChange={(o) => !o && setSelectedMovie(null)}
        movie={selectedMovie}
        letterboxdUsername={letterboxdUsername}
      />
    </div>
  );
};

export default CinemaTab;
