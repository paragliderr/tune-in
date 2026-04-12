import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Search, Gamepad2, Star, Loader2, ChevronLeft, ChevronRight, ArrowLeft, Filter, SortAsc, Check } from "lucide-react";
import { igdb, type IGDBGame } from "@/lib/igdb";
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
import GameCard from "./GameCard";
import GameDetailDialog from "./GameDetailDialog";

/* ── Scrollable horizontal row ── */
const HorizontalRow = ({
  title,
  icon,
  games,
  onSelect,
  onTitleClick,
  colorClass,
}: {
  title: string;
  icon?: React.ReactNode;
  games: IGDBGame[];
  onSelect: (g: IGDBGame) => void;
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
  }, [games]);

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
          className="flex gap-4 overflow-x-auto pb-4 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]"
        >
          {games.map((g, i) => (
            <GameCard key={g.id} game={g} index={i} onClick={() => onSelect(g)} />
          ))}
        </div>

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

/* ── Category View ── */
type CategoryDef = {
  key: string;
  title: string;
  icon?: React.ReactNode;
  fetcher: (page: number) => Promise<{ results: IGDBGame[]; total_pages: number }>;
};

const CategoryView = ({
  category,
  onBack,
  onSelect,
}: {
  category: CategoryDef;
  onBack: () => void;
  onSelect: (g: IGDBGame) => void;
}) => {
  const [games, setGames] = useState<IGDBGame[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);

  const loadPage = async (p: number) => {
    setLoading(true);
    try {
      const data = await category.fetcher(p);
      setGames(data.results);
      setTotalPages(data.total_pages);
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
            {games.map((g, i) => (
              <GameCard key={g.id} game={g} index={i} onClick={() => onSelect(g)} />
            ))}
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 pt-4 pb-8">
              <button
                disabled={page <= 1}
                onClick={() => loadPage(page - 1)}
                className="px-3 py-1.5 rounded-lg text-sm border border-border/40 hover:bg-muted/40 disabled:opacity-30 transition-colors"
              >
                Previous
              </button>
              <span className="text-sm text-muted-foreground px-3">
                Page {page} of {totalPages}
              </span>
              <button
                disabled={page >= totalPages}
                onClick={() => loadPage(page + 1)}
                className="px-3 py-1.5 rounded-lg text-sm border border-border/40 hover:bg-muted/40 disabled:opacity-30 transition-colors"
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

/* ── Main GamesTab ── */
const GamesTab = () => {
  const [query, setQuery] = useState("");
  const [searchResults, setSearchResults] = useState<IGDBGame[]>([]);
  const [searching, setSearching] = useState(false);

  const [popular, setPopular] = useState<IGDBGame[]>([]);
  const [topRated, setTopRated] = useState<IGDBGame[]>([]);
  const [anticipated, setAnticipated] = useState<IGDBGame[]>([]);
  const [loading, setLoading] = useState(true);

  const [selectedGameId, setSelectedGameId] = useState<number | null>(null);
  const [activeCategory, setActiveCategory] = useState<CategoryDef | null>(null);
  const [searchPlatformFilter, setSearchPlatformFilter] = useState<string>("All");
  const [searchGenreFilter, setSearchGenreFilter] = useState<string>("All");
  const [searchSort, setSearchSort] = useState<"newest" | "oldest" | "relevance">("relevance");
  const [searchPage, setSearchPage] = useState(1);
  const [rawSearchResults, setRawSearchResults] = useState<IGDBGame[]>([]);
  const [isInitialLoading, setInitialLoading] = useState(false);

  // Listen for game open from CompanyView
  useEffect(() => {
    const handler = (e: any) => {
      const gameId = e.detail?.gameId as number;
      if (gameId) setSelectedGameId(gameId);
    };
    window.addEventListener("openGame", handler);
    return () => window.removeEventListener("openGame", handler);
  }, []);

  useEffect(() => {
    const load = async () => {
      try {
        const [p, tr, ant] = await Promise.all([
          igdb.popular(),
          igdb.topRated(),
          igdb.anticipated(),
        ]);
        setPopular(p);
        setTopRated(tr);
        setAnticipated(ant);
      } catch (e) {
        console.error("IGDB Loading Error:", e);
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
      const results = await igdb.searchDeep(q);
      setRawSearchResults(results);
      setSearchPage(1);
      // Reset filters when a new search query is typed
      setSearchPlatformFilter("All");
      setSearchGenreFilter("All");
      setSearchSort("relevance");
    } catch (e) {
      console.error("Search Error:", e);
      setRawSearchResults([]);
    } finally {
      setSearching(false);
      setInitialLoading(false);
    }
  }, []);

  useEffect(() => {
    const t = setTimeout(() => handleSearch(query), 400);
    return () => clearTimeout(t);
  }, [query]);

  const filteredSortedResults = useMemo(() => {
    let list = rawSearchResults.filter(g => {
      const platOk = searchPlatformFilter === "All" || g.platforms?.some(p => p.name === searchPlatformFilter);
      const genreOk = searchGenreFilter === "All" || g.genres?.some(gn => gn.name === searchGenreFilter);
      return platOk && genreOk;
    });

    if (searchSort !== "relevance") {
      list = [...list].sort((a, b) => {
        const dateA = a.first_release_date || 0;
        const dateB = b.first_release_date || 0;
        return searchSort === "newest" ? dateB - dateA : dateA - dateB;
      });
    }

    return list;
  }, [rawSearchResults, searchPlatformFilter, searchGenreFilter, searchSort]);

  const totalPagesPool = Math.ceil(filteredSortedResults.length / 20);
  const paginatedResults = filteredSortedResults.slice((searchPage - 1) * 20, searchPage * 20);

  const categories: Record<string, CategoryDef> = {
    popular: {
      key: "popular",
      title: "Popular Now",
      fetcher: (p) => igdb.popularPage(p),
    },
    topRated: {
      key: "topRated",
      title: "All-Time Classics",
      fetcher: (p) => igdb.topRatedPage(p),
    },
    anticipated: {
      key: "anticipated",
      title: "Most Anticipated",
      fetcher: (p) => igdb.anticipatedPage(p),
    },
  };

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-primary animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="max-w-6xl mx-auto px-4 md:px-8 py-6 space-y-8">
        {/* Search Bar */}
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
              placeholder="Search for games..."
              className="w-full bg-muted/30 border border-border/40 rounded-2xl pl-11 pr-4 py-3 text-sm text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:border-primary/60 focus:shadow-[0_0_15px_hsl(var(--primary)/0.1)] transition-all"
            />
            {searching && (
              <Loader2 className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-primary animate-spin" />
            )}
          </div>
        </motion.div>

        <AnimatePresence mode="wait">
          {query.trim().length >= 2 ? (
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

                  {/* Platform filter */}
                  {(() => {
                    const platforms = ["All", ...Array.from(new Set(rawSearchResults.flatMap(g => g.platforms?.map(p => p.name) ?? [])))];
                    return platforms.length > 1 ? (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="outline" size="sm" className="h-9 bg-muted/20 border-border/40 text-xs gap-2 hover:bg-muted/40 transition-all rounded-xl">
                            <Filter className="w-3.5 h-3.5 text-muted-foreground" />
                            <span className="text-muted-foreground">Platform:</span>
                            <span className="font-semibold truncate max-w-[80px]">{searchPlatformFilter === "All" ? "Any" : searchPlatformFilter}</span>
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-56 max-h-[300px] overflow-y-auto bg-card/95 backdrop-blur-xl border-border/40 rounded-xl">
                          <DropdownMenuLabel className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold">Filter Platform</DropdownMenuLabel>
                          <DropdownMenuSeparator className="bg-border/40" />
                          <DropdownMenuRadioGroup value={searchPlatformFilter} onValueChange={(v) => { setSearchPlatformFilter(v); setSearchPage(1); }}>
                            {platforms.map(p => (
                              <DropdownMenuRadioItem key={p} value={p} className="text-sm cursor-pointer py-2">
                                {p === "All" ? "All Platforms" : p}
                              </DropdownMenuRadioItem>
                            ))}
                          </DropdownMenuRadioGroup>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    ) : null;
                  })()}

                  {/* Genre filter */}
                  {(() => {
                    const genres = ["All", ...Array.from(new Set(rawSearchResults.flatMap(g => g.genres?.map(gn => gn.name) ?? [])))];
                    return genres.length > 1 ? (
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
                            {genres.map(g => (
                              <DropdownMenuRadioItem key={g} value={g} className="text-sm cursor-pointer py-2">
                                {g === "All" ? "All Genres" : g}
                              </DropdownMenuRadioItem>
                            ))}
                          </DropdownMenuRadioGroup>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    ) : null;
                  })()}
                </div>
              </div>
              {isInitialLoading ? (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                  {Array.from({ length: 10 }).map((_, i) => (
                    <div key={i} className="space-y-3">
                      <Skeleton className="aspect-[3/4] w-full rounded-2xl" />
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
                    <p className="text-sm text-muted-foreground pt-8">No games found with the current filters.</p>
                  ) : (
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                      {paginatedResults.map((g, i) => (
                        <GameCard key={g.id} game={g} index={i} onClick={() => setSelectedGameId(g.id)} />
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
            <CategoryView
              key={activeCategory.key}
              category={activeCategory}
              onBack={() => setActiveCategory(null)}
              onSelect={(g) => setSelectedGameId(g.id)}
            />
          ) : (
            <motion.div
              key="browse"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="space-y-10"
            >
              <HorizontalRow
                title="Popular Now"
                icon={<div className="w-7 h-7 rounded-lg bg-gradient-to-br from-green-600 to-emerald-800 flex items-center justify-center"><Gamepad2 className="w-4 h-4 text-primary-foreground" /></div>}
                games={popular}
                onSelect={(g) => setSelectedGameId(g.id)}
                onTitleClick={() => setActiveCategory(categories.popular)}
              />

              <HorizontalRow
                title="All-Time Classics"
                icon={<div className="w-7 h-7 rounded-lg bg-gradient-to-br from-yellow-600 to-orange-800 flex items-center justify-center"><Star className="w-4 h-4 text-primary-foreground" /></div>}
                games={topRated}
                onSelect={(g) => setSelectedGameId(g.id)}
                onTitleClick={() => setActiveCategory(categories.topRated)}
              />

              <HorizontalRow
                title="Most Anticipated"
                icon={<div className="w-7 h-7 rounded-lg bg-gradient-to-br from-purple-600 to-indigo-800 flex items-center justify-center"><Gamepad2 className="w-4 h-4 text-primary-foreground" /></div>}
                games={anticipated}
                onSelect={(g) => setSelectedGameId(g.id)}
                onTitleClick={() => setActiveCategory(categories.anticipated)}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <GameDetailDialog
        open={!!selectedGameId}
        onOpenChange={(o) => !o && setSelectedGameId(null)}
        gameId={selectedGameId}
      />
    </div>
  );
};

export default GamesTab;
