import { useState, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ProgressiveBlur } from "@/components/ui/progressive-blur";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "@/lib/supabase";

import HomeNavbar, { type HomeTab } from "@/components/home/HomeNavbar";
import SidebarClubList from "@/components/home/SidebarClubList";
import FeedFilterBar from "@/components/home/FeedFilterBar";
import PostCard from "@/components/home/PostCard";
import PostDetailDialog from "@/components/home/PostDetailDialog";
import MaintenanceScreen from "@/components/home/MaintenanceScreen";
import { InteractiveHoverButton } from "@/components/ui/interactive-hover-button";
import CreatePostDialog from "@/components/home/CreatePostDialog";

const Home = () => {
  const [activeTab, setActiveTab] = useState<HomeTab>("Clubs");
  const [activeClub, setActiveClub] = useState<string | null>(null);
  const { slug } = useParams();
  const navigate = useNavigate();

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

  /* ⭐ auto select first club (TS SAFE) */
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

  /* optimistic */
  const addOptimisticPost = (post: any) => {
    setPosts((prev) => [post, ...prev]);

    if (activeClub) {
      feedCache.current[activeClub] = [
        post,
        ...(feedCache.current[activeClub] || []),
      ];
    }
  };

  /* LOAD POSTS */
  useEffect(() => {
    if (!activeClub) return;

    const load = async () => {
      // always show skeleton briefly on switch
      setLoadingPosts(true);

      if (feedCache.current[activeClub]) {
        setPosts([]); // clear old feed → skeleton visible
        setMembers([]); // skeleton members
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
        feedCache.current[activeClub] = mapped;
        setLoadingPosts(false);
      }, 450);

      const { data: memberRows } = await supabase
        .from("club_members")
        .select("profiles(id, username, avatar_url)")
        .eq("club_id", club.id);

      memberCache.current[activeClub] = memberRows ?? [];
      setMembers(memberRows ?? []);
    };;

    load();
  }, [activeClub]);

  /* realtime (TS SAFE) */
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
          <motion.div className="flex flex-1 overflow-hidden">
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
            <main className="flex-1 overflow-y-auto relative">
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
                    <div className="flex items-center justify-between">
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
                          onOpenDetail={() => setSelectedPost(post)}
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
            <aside className="hidden xl:flex w-72 border-l border-border overflow-y-auto">
              <div className="p-5 space-y-4">
                <p className="text-sm font-semibold">Members</p>

                {loadingPosts &&
                  Array.from({ length: 8 }).map((_, i) => (
                    <SkeletonMember key={i} />
                  ))}

                {!loadingPosts &&
                  members.map((m: any, i) => (
                    <div
                      key={i}
                      className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/40"
                    >
                      <div className="w-9 h-9 rounded-full bg-muted flex items-center justify-center text-xs">
                        {m.profiles?.username?.charAt(0)}
                      </div>
                      <p className="text-sm">{m.profiles?.username}</p>
                    </div>
                  ))}
              </div>
            </aside>
          </motion.div>
        ) : (
          <motion.div className="flex-1 flex">
            <MaintenanceScreen label={activeTab} />
          </motion.div>
        )}
      </AnimatePresence>

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
        onOpenChange={(o) => !o && setSelectedPost(null)}
        post={selectedPost}
      />
    </div>
  );
};

export default Home;
