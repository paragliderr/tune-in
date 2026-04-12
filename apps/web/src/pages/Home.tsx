import { useState, useEffect, useRef } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import { ProgressiveBlur } from "@/components/ui/progressive-blur";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "@/lib/supabase";
import { fetchTrendingFeed } from "@/lib/api";
import { mapFeedRowsToPostCards } from "@/lib/feedMap";
import {
  isTopByLikesFilter,
  minCreatedAtIsoForTopFilter,
  type ClubFeedSortFilter,
} from "@/lib/clubFeed";
import { rankPostsByLiveLikes } from "@/lib/rankPostsByLikes";
import { toast } from "sonner";
import useGlobalPresence from "@/hooks/useGlobalPresence";

import AIHomeFeed from "@/components/AIHomeFeed";

import HomeNavbar, { type HomeTab } from "@/components/home/HomeNavbar";
import SidebarClubList from "@/components/home/SidebarClubList";
import FeedFilterBar from "@/components/home/FeedFilterBar";
import PostCard from "@/components/home/PostCard";
import PostDetailDialog from "@/components/home/PostDetailDialog";
import MaintenanceScreen from "@/components/home/MaintenanceScreen";
import CinemaTab from "@/components/home/CinemaTab";
import GamesTab from "@/components/home/GamesTab";
import { InteractiveHoverButton } from "@/components/ui/interactive-hover-button";
import CreatePostDialog from "@/components/home/CreatePostDialog";
import MemberHoverCard from "@/components/home/MemberHoverCard";

const Home = () => {
  // AI Feed
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  useEffect(() => {
    const fetchUser = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        setCurrentUserId(session.user.id);
      } else {
        // Fallback for testing 
        setCurrentUserId("00261715-f8ee-41c9-b334-706177aba732"); 
      }
    };
    fetchUser();
  }, []);
  //--END--
  const { onlineUserIds } = useGlobalPresence();  

  const prevOnlineRef = useRef<Set<string>>(new Set());
  const justChangedRef = useRef<Set<string>>(new Set());
  const consumedAnimRef = useRef<Set<string>>(new Set());

  const location = useLocation();
  const isCinemaRoute = location.pathname === "/cinema";
  const isGamesRoute = location.pathname === "/games";

  const [activeTab, setActiveTab] = useState<HomeTab>(
    isCinemaRoute ? "Cinema" : isGamesRoute ? "Games" : "Clubs"
  );
  const [activeClub, setActiveClub] = useState<string | null>(null);
  const [globalSearchQuery, setGlobalSearchQuery] = useState("");
  const { slug, postId } = useParams();
  const navigate = useNavigate();

  const handleTabChange = (tab: HomeTab) => {
    setActiveTab(tab);
    if (tab === "Cinema") {
      navigate("/cinema");
    } else if (tab === "Games") {
      navigate("/games");
    } else if (tab === "Clubs") {
      navigate("/home");
    }
  };

  const [hoveredMember, setHoveredMember] = useState<any>(null);
  const [hoverRect, setHoverRect] = useState<DOMRect | null>(null);
  const hoverTimer = useRef<any>(null);

  const [selectedPost, setSelectedPost] = useState<any | null>(null);
  const [posts, setPosts] = useState<any[]>([]);
  const [loadingPosts, setLoadingPosts] = useState(false);
  const [members, setMembers] = useState<any[]>([]);
  const [createOpen, setCreateOpen] = useState(false);
  const [feedFilter, setFeedFilter] = useState("Trending");
  const [feedNonce, setFeedNonce] = useState(0);

  const feedCache = useRef<Record<string, any[]>>({});
  const memberCache = useRef<Record<string, any[]>>({});
  const [initialLoaded, setInitialLoaded] = useState(false);

  /* url sync */
  useEffect(() => {
    if (slug) setActiveClub(slug);
  }, [slug]);

  useEffect(() => {
    const prev = prevOnlineRef.current;
    const now = onlineUserIds;

    const changed = new Set<string>();

    now.forEach((id) => {
      if (!prev.has(id)) changed.add(id);
    });

    prev.forEach((id) => {
      if (!now.has(id)) changed.add(id);
    });

    justChangedRef.current = changed;
    prevOnlineRef.current = new Set(now);
  }, [onlineUserIds]);

  /* mark initial load done (no auto-club-select — reddit style) */
  useEffect(() => {
    setInitialLoaded(true);
  }, []);

  /* LOAD MEMBERS (current club) */
  useEffect(() => {
    if (!activeClub) {
      setMembers([]);
      return;
    }

    const loadMembers = async () => {
      const { data: club } = await supabase
        .from("clubs")
        .select("id")
        .eq("slug", activeClub)
        .single();

      if (!club) {
        setMembers([]);
        return;
      }

      const { data: memberRows } = await supabase
        .from("club_members")
        .select("user_id")
        .eq("club_id", club.id);

      const memberIds = memberRows?.map((m) => m.user_id) ?? [];
      let memberProfiles: any[] = [];

      if (memberIds.length > 0) {
        const { data } = await supabase
          .from("profiles")
          .select("id, username, avatar_url, bio")
          .in("id", memberIds);

        memberProfiles = data ?? [];
      }

      memberCache.current[activeClub] = memberProfiles;
      setMembers(memberProfiles);
    };

    loadMembers();
  }, [activeClub]);

  /* LOAD POSTS: Trending = in-house ML API; Top * = likes in window; New = newest first */
  useEffect(() => {
    let cancelled = false;
    let finishTimer: ReturnType<typeof setTimeout> | undefined;

    const finish = (cacheKey: string, mapped: any[]) => {
      finishTimer = setTimeout(() => {
        if (cancelled) return;
        setPosts(mapped);
        if (postId) {
          const found = mapped.find((p) => p.id === postId);
          if (found) setSelectedPost(found);
        }
        feedCache.current[cacheKey] = mapped;
        setLoadingPosts(false);
      }, 450);
    };

    const mapClubRows = (
      postRows: any[] | null | undefined,
      clubName: string,
      clubSlug: string,
      usernameMap: Record<string, string | undefined>,
    ) =>
      (postRows ?? []).map((p) => ({
        id: p.id,
        clubSlug,
        clubName,
        clubColor: "from-purple-600 to-indigo-700",
        username: usernameMap[p.user_id] || "user",
        time: new Date(p.created_at).toLocaleString(),
        title: p.title,
        content: p.content,
        image: p.image_url,
        likes: p.like_count,
        dislikes: p.dislike_count,
        commentCount: p.comment_count,
      }));

    const loadTrending = async () => {
      setLoadingPosts(true);

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        setPosts([]);
        setLoadingPosts(false);
        return;
      }

      const cacheKey = activeClub
        ? `__trending__::${activeClub}`
        : `__trending_home__::${user.id}`;

      // Helper: Supabase-only fallback (sorted by likes)
      const loadFallbackTrending = async () => {
        let query = supabase
          .from("posts")
          .select("*")
          .order("like_count", { ascending: false })
          .order("created_at", { ascending: false })
          .limit(30);

        if (activeClub) {
          // Club-scoped trending
          const { data: club } = await supabase
            .from("clubs")
            .select("id")
            .eq("slug", activeClub)
            .single();

          if (club) {
            query = query.eq("club_id", club.id);
          }
        } else {
          // Home trending: scope to user's clubs
          const { data: memberships } = await supabase
            .from("club_members")
            .select("club_id")
            .eq("user_id", user.id);

          const clubIds = memberships?.map((m) => m.club_id) ?? [];
          if (!clubIds.length) {
            finish(cacheKey, []);
            return;
          }
          query = query.in("club_id", clubIds);
        }

        const { data: postRows } = await query;
        const mapped = await mapFeedRowsToPostCards(supabase, postRows ?? []);
        finish(cacheKey, mapped);
      };

      if (activeClub) {
        // Club-scoped trending: use direct DB sort (fast + reliable)
        await loadFallbackTrending();
      } else {
        // Home page: try ML personalization, fall back to DB sort
        try {
          const result = await fetchTrendingFeed(user.id, 30);
          const raw = (result.feed ?? []) as Record<string, unknown>[];
          if (!raw.length && result.message) {
            toast.message(result.message);
          }
          if (raw.length) {
            const mapped = await mapFeedRowsToPostCards(supabase, raw);
            finish(cacheKey, mapped);
          } else {
            await loadFallbackTrending();
          }
        } catch (e) {
          console.error("ML trending failed, using fallback:", e);
          try {
            await loadFallbackTrending();
          } catch {
            setPosts([]);
            setLoadingPosts(false);
          }
        }
      }
    };

    const loadClubFeed = async () => {
      if (!activeClub) return;

      setLoadingPosts(true);

      const cacheKey = `${activeClub}::${feedFilter}`;

      const { data: club } = await supabase
        .from("clubs")
        .select("id, name")
        .eq("slug", activeClub)
        .single();

      if (!club) {
        setPosts([]);
        setLoadingPosts(false);
        return;
      }

      let query = supabase.from("posts").select("*").eq("club_id", club.id);

      if (feedFilter === "New") {
        query = query.order("created_at", { ascending: false }).limit(50);
      } else if (isTopByLikesFilter(feedFilter)) {
        const since = minCreatedAtIsoForTopFilter(feedFilter as ClubFeedSortFilter);
        if (since) {
          query = query.gte("created_at", since).limit(1000);
        } else {
          query = query
            .order("like_count", { ascending: false, nullsFirst: false })
            .order("created_at", { ascending: false })
            .limit(500);
        }
      } else {
        query = query.order("created_at", { ascending: false }).limit(50);
      }

      const { data: rawRows, error } = await query;

      if (error) {
        console.error(error);
        toast.error(error.message);
        setPosts([]);
        setLoadingPosts(false);
        return;
      }

      let postRows = rawRows ?? [];
      if (isTopByLikesFilter(feedFilter)) {
        const ranked = await rankPostsByLiveLikes(supabase, postRows);
        postRows = ranked.slice(0, 50);
      }

      const userIds = postRows.map((p) => p.user_id);

      const { data: profileRows } = await supabase
        .from("profiles")
        .select("id, username")
        .in("id", userIds);

      const usernameMap: Record<string, string | undefined> = {};
      profileRows?.forEach((p) => {
        usernameMap[p.id] = p.username ?? undefined;
      });

      const mapped = mapClubRows(postRows, club.name, activeClub, usernameMap);
      finish(cacheKey, mapped);
    };

    if (!activeClub) {
      // Home page: always load trending across all clubs
      loadTrending();
    } else if (feedFilter === "Trending") {
      loadTrending();
    } else {
      loadClubFeed();
    }

    return () => {
      cancelled = true;
      if (finishTimer) clearTimeout(finishTimer);
    };
  }, [activeClub, feedFilter, postId, feedNonce]);

  /* realtime posts */
  useEffect(() => {
    const channel = supabase.channel("realtime-posts");

    channel.on(
      "postgres_changes",
      { event: "INSERT", schema: "public", table: "posts" },
      () => {
        feedCache.current = {};
        setFeedNonce((n) => n + 1);
      },
    );

    channel.subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [activeClub]);

  /* PRESENCE SORTING */
  const onlineMembers = members
    .filter((m) => onlineUserIds.has(m.id))
    .sort((a, b) => a.username.localeCompare(b.username));

  const offlineMembers = members
    .filter((m) => !onlineUserIds.has(m.id))
    .sort((a, b) => a.username.localeCompare(b.username));

  const MemberRow = ({ m, online }: any) => {
    const changed = justChangedRef.current.has(m.id);
    const shouldAnimate = changed && !consumedAnimRef.current.has(m.id);

    if (shouldAnimate) consumedAnimRef.current.add(m.id);

    return (
      <motion.div
        layout="position"
        initial={false}
        animate={
          shouldAnimate
            ? { opacity: [0, 1], x: [-14, 0], scale: [0.96, 1] }
            : { opacity: 1, x: 0, scale: 1 }
        }
        transition={{ type: "spring", stiffness: 260, damping: 22 }}
        onMouseEnter={(e) => {
          const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
          clearTimeout(hoverTimer.current);
          hoverTimer.current = setTimeout(() => {
            setHoverRect(rect);
            setHoveredMember(m);
          }, 180);
        }}
        onMouseLeave={() => {
          clearTimeout(hoverTimer.current);
          setHoveredMember(null);
        }}
        onClick={() => navigate(`/user/${m.username}`)}
        className="flex items-center gap-3 px-3 py-2 rounded-md hover:bg-muted/60 cursor-pointer"
      >
        <div className="relative">
          <img
            src={m.avatar_url}
            className="w-9 h-9 rounded-full object-cover"
          />
          <AnimatePresence>
            {online && (
              <motion.span
                key="online-dot"
                initial={shouldAnimate ? { scale: 0 } : false}
                animate={
                  shouldAnimate
                    ? { scale: [0, 1.25, 1], opacity: [0.6, 1] }
                    : { scale: 1 }
                }
                exit={{ scale: 0 }}
                transition={{ type: "spring", stiffness: 400, damping: 18 }}
                className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-green-500 ring-2 ring-background shadow-[0_0_8px_rgba(34,197,94,0.9)]"
              />
            )}
          </AnimatePresence>
        </div>
        <p className="text-sm transition-colors hover:text-primary">
          {m.username}
        </p>
      </motion.div>
    );
  };

  const SkeletonPost = () => (
    <div className="rounded-xl border border-border p-5 space-y-3 animate-pulse">
      <div className="h-4 bg-muted rounded w-1/3" />
      <div className="h-4 bg-muted rounded w-2/3" />
      <div className="h-40 bg-muted rounded" />
    </div>
  );

  const SkeletonMember = () => (
    <div className="flex items-center gap-3 animate-pulse">
      <div className="w-9 h-9 rounded-full bg-muted" />
      <div className="h-3 bg-muted rounded w-20" />
    </div>
  );

  return (
    <div className="h-screen bg-background flex flex-col overflow-hidden">
      <HomeNavbar activeTab={activeTab} onTabChange={handleTabChange} />

      <AnimatePresence mode="wait">
        {activeTab === "Clubs" ? (
          <motion.div className="flex flex-1 overflow-hidden h-[calc(100vh-64px)]">

            {/* LEFT */}
            <aside className="hidden md:flex w-72 lg:w-80 border-r border-border overflow-y-auto">
              <div className="p-4">
                <SidebarClubList
                  activeClub={activeClub}
                  onSelectClub={(clubSlug) => {
                    setActiveClub(clubSlug);
                    setFeedFilter("Trending");
                    navigate(`/c/${clubSlug}`);
                  }}
                  onGoHome={() => {
                    setActiveClub(null);
                    setFeedFilter("Trending");
                    navigate("/home");
                  }}
                  searchQuery={globalSearchQuery}
                  onSearchQueryChange={setGlobalSearchQuery}
                />
              </div>
            </aside>

            {/* CENTER */}
            <main className="flex-1 h-full overflow-y-auto relative scrollbar-thin scrollbar-thumb-muted">
              <div className="max-w-3xl mx-auto px-8 py-6 space-y-7 pb-40">

                {/* Header: filter bar inside club, trending header on home */}
                <div className="flex items-center justify-between gap-4 flex-wrap">
                  {activeClub ? (
                    <FeedFilterBar
                      active={feedFilter}
                      onChange={setFeedFilter}
                    />
                  ) : (
                    <div className="flex items-center justify-between gap-4 flex-wrap">
                    {activeClub && (
                      <FeedFilterBar
                        active={feedFilter}
                        onChange={setFeedFilter}
                      />
                    )}
                    {activeClub && (
                      <InteractiveHoverButton
                        onClick={() => setCreateOpen(true)}
                        className="border-primary text-primary"
                      >
                        Create
                      </InteractiveHoverButton>
                    )}
                  </div>
                  )}
                  {activeClub && (
                    <InteractiveHoverButton
                      onClick={() => setCreateOpen(true)}
                      className="border-primary text-primary"
                    >
                      Create
                    </InteractiveHoverButton>
                  )}
                </div>

                {/* Skeleton loader */}
                {loadingPosts &&
                  Array.from({ length: 5 }).map((_, i) => (
                    <SkeletonPost key={i} />
                  ))}

                {/* Empty state */}
                {!loadingPosts && posts.length === 0 && initialLoaded && activeClub && (
                  <div className="flex items-center justify-center py-20">
                    <div className="text-center space-y-3">
                      <div className="text-2xl font-semibold">No posts yet</div>
                      <p className="text-muted-foreground">
                        Be the first to post in this club!
                      </p>
                    </div>
                  </div>
                )}

                {/* --- SMART FEED ROUTER --- */}
                {globalSearchQuery ? (
                  // Search mode: filter posts from the normal feed
                  !loadingPosts &&
                  posts
                    .filter((p) =>
                      (p.title || "").toLowerCase().includes(globalSearchQuery.toLowerCase()) ||
                      (p.content || "").toLowerCase().includes(globalSearchQuery.toLowerCase())
                    )
                    .map((post) => (
                      <PostCard
                        key={post.id}
                        {...post}
                        onOpenDetail={() => setSelectedPost(post)}
                      />
                    ))
                ) : !activeClub && currentUserId ? (
                  // Home page: show AI-powered personalized feed
                  <AIHomeFeed
                    currentUserId={currentUserId}
                    onOpenDetail={(post) => setSelectedPost(post)}
                  />
                ) : (
                  // Inside a club: show normal post list
                  !loadingPosts &&
                  posts.map((post) => (
                    <PostCard
                      key={post.id}
                      {...post}
                      onOpenDetail={() => setSelectedPost(post)}
                    />
                  ))
                )}

              </div> {/* closes max-w-3xl */}

              <div className="sticky bottom-0 pointer-events-none">
                <ProgressiveBlur height="70px" position="bottom" />
              </div>
            </main>

            {/* RIGHT — only show members panel when inside a club */}
            {activeClub && (
              <aside className="hidden xl:flex w-80 min-w-[320px] border-l border-border h-full flex-col bg-muted/20">
                <div className="px-5 py-4 border-b border-border backdrop-blur-xl sticky top-0 bg-background/80 z-10">
                  <p className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">
                    Members — {members.length}
                  </p>
                </div>

                <div className="flex-1 overflow-y-auto px-3 py-4 space-y-3 scrollbar-thin scrollbar-thumb-muted">
                  {loadingPosts &&
                    Array.from({ length: 8 }).map((_, i) => (
                      <SkeletonMember key={i} />
                    ))}

                  {!loadingPosts && (
                    <>
                      <div>
                        <p className="text-[11px] px-2 mb-2 text-muted-foreground uppercase tracking-wider font-semibold">
                          Online — {onlineMembers.length}
                        </p>
                        {onlineMembers.map((m) => (
                          <MemberRow key={m.id} m={m} online />
                        ))}
                      </div>

                      <div className="pt-3">
                        <p className="text-[11px] px-2 mb-2 text-muted-foreground uppercase tracking-wider font-semibold">
                          Offline — {offlineMembers.length}
                        </p>
                        {offlineMembers.map((m) => (
                          <MemberRow key={m.id} m={m} />
                        ))}
                      </div>
                    </>
                  )}
                </div>
              </aside>
            )}

          </motion.div>
        ) : activeTab === "Cinema" ? (
          <motion.div
            key="cinema"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="flex-1 flex overflow-hidden"
          >
            <CinemaTab />
          </motion.div>
        ) : activeTab === "Games" ? (
          <motion.div
            key="games"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="flex-1 flex overflow-hidden"
          >
            <GamesTab />
          </motion.div>
        ) : (
          <motion.div className="flex-1 flex">
            <MaintenanceScreen label={activeTab} />
          </motion.div>
        )}
      </AnimatePresence>

      <MemberHoverCard
        open={!!hoveredMember}
        anchorRect={hoverRect}
        member={hoveredMember}
      />

      <CreatePostDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        clubSlug={activeClub}
        onCreated={() => {
          feedCache.current = {};
          setFeedNonce((n) => n + 1);
        }}
      />

      <PostDetailDialog
        open={!!selectedPost}
        onOpenChange={(o) => {
          if (!o) {
            setSelectedPost(null);
          }
        }}
        post={selectedPost}
        onReactionChange={() => {
          window.dispatchEvent(new Event("reactionUpdated"));
        }}
      />
    </div>
  );
};

export default Home;