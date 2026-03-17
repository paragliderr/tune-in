import { useState, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ProgressiveBlur } from "@/components/ui/progressive-blur";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "@/lib/supabase";
import useGlobalPresence from "@/hooks/useGlobalPresence";

import HomeNavbar, { type HomeTab } from "@/components/home/HomeNavbar";
import SidebarClubList from "@/components/home/SidebarClubList";
import FeedFilterBar from "@/components/home/FeedFilterBar";
import PostCard from "@/components/home/PostCard";
import PostDetailDialog from "@/components/home/PostDetailDialog";
import MaintenanceScreen from "@/components/home/MaintenanceScreen";
import { InteractiveHoverButton } from "@/components/ui/interactive-hover-button";
import CreatePostDialog from "@/components/home/CreatePostDialog";
import MemberHoverCard from "@/components/home/MemberHoverCard";

const Home = () => {
  const { onlineUserIds } = useGlobalPresence();   // ⭐ PRESENCE

  const [activeTab, setActiveTab] = useState<HomeTab>("Clubs");
  const [activeClub, setActiveClub] = useState<string | null>(null);
  const { slug, postId } = useParams();
  const navigate = useNavigate();

  const [hoveredMember, setHoveredMember] = useState<any>(null);
  const [hoverRect, setHoverRect] = useState<DOMRect | null>(null);
  const hoverTimer = useRef<any>(null);

  const [selectedPost, setSelectedPost] = useState<any | null>(null);
  const [posts, setPosts] = useState<any[]>([]);
  const [loadingPosts, setLoadingPosts] = useState(false);
  const [members, setMembers] = useState<any[]>([]);
  const [createOpen, setCreateOpen] = useState(false);
  const [currentUsername, setCurrentUsername] = useState<string>("user");

  const feedCache = useRef<Record<string, any[]>>({});
  const memberCache = useRef<Record<string, any[]>>({});
  const [initialClubChecked, setInitialClubChecked] = useState(false);

  /* url sync */
  useEffect(() => {
    if (slug) setActiveClub(slug);
  }, [slug]);

  /* auto select first club */
  useEffect(() => {
    const pickFirstClub = async () => {
      if (slug) return;

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) return;

      const { data } = await supabase
        .from("club_members")
        .select("clubs!inner(slug)")
        .eq("user_id", user.id)
        .limit(1);

      const first: any = data?.[0];

      if (first?.clubs?.slug) {
        setActiveClub(first.clubs.slug);
        navigate(`/c/${first.clubs.slug}`, { replace: true });
      }

      setInitialClubChecked(true);
    };

    pickFirstClub();
  }, []);

  /* username */
  useEffect(() => {
    const loadUser = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) return;

      const { data } = await supabase
        .from("profiles")
        .select("username")
        .eq("id", user.id)
        .single();

      if (data?.username) setCurrentUsername(data.username);
    };

    loadUser();
  }, []);

  const addOptimisticPost = (post: any) => {
    setPosts((prev) => [post, ...prev]);

    if (activeClub) {
      feedCache.current[activeClub] = [
        post,
        ...(feedCache.current[activeClub] || []),
      ];
    }
  };

  /* LOAD POSTS + MEMBERS */
  useEffect(() => {
    if (!activeClub) return;

    const load = async () => {
      setLoadingPosts(true);

      if (feedCache.current[activeClub]) {
        setPosts([]);
        setMembers([]);
      }

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

      const { data: postRows } = await supabase
        .from("posts")
        .select("*")
        .eq("club_id", club.id)
        .order("created_at", { ascending: false })
        .limit(50);

      const userIds = postRows?.map((p) => p.user_id) ?? [];

      const { data: profileRows } = await supabase
        .from("profiles")
        .select("id, username")
        .in("id", userIds);

      const usernameMap: any = {};
      profileRows?.forEach((p) => (usernameMap[p.id] = p.username));

      const mapped =
        postRows?.map((p) => ({
          id: p.id,
          clubName: club.name,
          clubColor: "from-purple-600 to-indigo-700",
          username: usernameMap[p.user_id] || "user",
          time: new Date(p.created_at).toLocaleString(),
          title: p.title,
          content: p.content,
          image: p.image_url,
          likes: p.like_count,
          dislikes: p.dislike_count,
          commentCount: p.comment_count,
        })) ?? [];

      setTimeout(() => {
        setPosts(mapped);
        if (postId) {
          const found = mapped.find((p) => p.id === postId);
          if (found) setSelectedPost(found);
        }

        feedCache.current[activeClub] = mapped;
        setLoadingPosts(false);
      }, 450);

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

    load();
  }, [activeClub]);

  /* realtime posts */
  useEffect(() => {
    const channel = supabase.channel("realtime-posts");

    channel.on(
      "postgres_changes",
      { event: "INSERT", schema: "public", table: "posts" },
      () => {
        if (!activeClub) return;
        delete feedCache.current[activeClub];
        setActiveClub((c) => (c ? c + "" : c));
      },
    );

    channel.subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [activeClub]);

  /* ⭐ PRESENCE SORTING */
  const onlineMembers = members
    .filter((m) => onlineUserIds.has(m.id))
    .sort((a, b) => a.username.localeCompare(b.username));

  const offlineMembers = members
    .filter((m) => !onlineUserIds.has(m.id))
    .sort((a, b) => a.username.localeCompare(b.username));

  const MemberRow = ({ m, online }: any) => (
    <motion.div
      initial={{ opacity: 0, y: 8, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.25, ease: "easeOut" }}
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
      className="flex items-center gap-3 px-3 py-2 rounded-md hover:bg-muted/60 cursor-pointer group"
    >
      <div className="relative">
        <img
          src={m.avatar_url}
          className="w-9 h-9 rounded-full object-cover"
        />
        {online && (
          <span className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-green-500 ring-2 ring-background" />
        )}
      </div>

      <p className="text-sm group-hover:text-primary transition-colors">
        {m.username}
      </p>
    </motion.div>
  );

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
      <HomeNavbar activeTab={activeTab} onTabChange={setActiveTab} />

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
                    navigate(`/c/${clubSlug}`);
                  }}
                />
              </div>
            </aside>

            {/* CENTER */}
            <main className="flex-1 h-full overflow-y-auto relative scrollbar-thin scrollbar-thumb-muted">
              {!activeClub && initialClubChecked && (
                <div className="h-full flex items-center justify-center">
                  <div className="text-center space-y-3">
                    <div className="text-2xl font-semibold">
                      Join a club to start exploring
                    </div>
                    <p className="text-muted-foreground">
                      Your feed will appear here.
                    </p>
                  </div>
                </div>
              )}

              {activeClub && (
                <>
                  <div className="max-w-3xl mx-auto px-8 py-6 space-y-7 pb-40">
                    <div className="flex items-center justify-between gap-4 flex-wrap">
                      <FeedFilterBar active="New" onChange={() => {}} />
                      <InteractiveHoverButton
                        onClick={() => setCreateOpen(true)}
                        className="border-primary text-primary"
                      >
                        Create
                      </InteractiveHoverButton>
                    </div>

                    {loadingPosts &&
                      Array.from({ length: 5 }).map((_, i) => (
                        <SkeletonPost key={i} />
                      ))}

                    {!loadingPosts &&
                      posts.map((post) => (
                        <PostCard
                          key={post.id}
                          {...post}
                          onOpenDetail={() => {
                            navigate(`/c/${activeClub}/${post.id}`);
                            setSelectedPost(post);
                          }}
                        />
                      ))}
                  </div>

                  <div className="sticky bottom-0 pointer-events-none">
                    <ProgressiveBlur height="140px" position="bottom" />
                  </div>
                </>
              )}
            </main>

            {/* RIGHT */}
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
        onCreated={() => setActiveClub((s) => (s ? s + "" : s))}
        onOptimisticPost={(p) =>
          addOptimisticPost({ ...p, username: currentUsername })
        }
      />

      <PostDetailDialog
        open={!!selectedPost}
        onOpenChange={(o) => {
          if (!o) {
            setSelectedPost(null);
            navigate(`/c/${activeClub}`);
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