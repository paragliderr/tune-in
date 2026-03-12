import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import HomeNavbar, { type HomeTab } from "@/components/home/HomeNavbar";
import SidebarClubList from "@/components/home/SidebarClubList";
import FeedFilterBar from "@/components/home/FeedFilterBar";
import PostCard from "@/components/home/PostCard";
import PostDetailDialog from "@/components/home/PostDetailDialog";
import MaintenanceScreen from "@/components/home/MaintenanceScreen";

const MOCK_POSTS = [
  {
    id: "1",
    clubName: "Indie Films",
    clubColor: "from-purple-600 to-indigo-700",
    username: "cinephile42",
    time: "2h ago",
    title: "Just watched 'Everything Everywhere' for the third time",
    content:
      "Every time I rewatch it I catch something new. The editing in the tax office scenes is absolutely masterful. Anyone else obsessed with the bagel metaphor?",
    likes: 142,
    dislikes: 3,
    commentCount: 28,
    hasImage: false,
  },
  {
    id: "2",
    clubName: "Lo-Fi Beats",
    clubColor: "from-pink-600 to-purple-700",
    username: "beatmaker",
    time: "4h ago",
    title: "New beat tape dropped — 45 minutes of rain vibes 🌧️",
    content:
      "Spent the last month sampling old jazz records and layering them with field recordings from my trip to Kyoto. Would love feedback from the community.",
    likes: 89,
    dislikes: 1,
    commentCount: 15,
    hasImage: true,
  },
  {
    id: "3",
    clubName: "Retro Gaming",
    clubColor: "from-violet-600 to-blue-700",
    username: "pixelnostalgia",
    time: "6h ago",
    title: "Found my old Game Boy Color at my parents' house",
    content:
      "Still had Pokémon Crystal in it with my save from 2001. All my Pokémon are still there. I'm not crying, you're crying.",
    likes: 312,
    dislikes: 2,
    commentCount: 67,
    hasImage: true,
  },
  {
    id: "4",
    clubName: "Tech Talks",
    clubColor: "from-blue-600 to-violet-700",
    username: "devnull",
    time: "8h ago",
    title: "Hot take: Tailwind is the best thing to happen to CSS",
    content:
      "Fight me. After years of writing BEM and dealing with specificity wars, utility-first just makes sense. The DX improvement is real.",
    likes: 56,
    dislikes: 23,
    commentCount: 94,
    hasImage: false,
  },
];

const Home = () => {
  const [activeTab, setActiveTab] = useState<HomeTab>("Clubs");
  const [activeClub, setActiveClub] = useState<string | null>(null);
  const [activeFilter, setActiveFilter] = useState("Trending");
  const [selectedPost, setSelectedPost] = useState<
    (typeof MOCK_POSTS)[number] | null
  >(null);

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <HomeNavbar activeTab={activeTab} onTabChange={setActiveTab} />

      <AnimatePresence mode="wait">
        {activeTab === "Clubs" ? (
          <motion.div
            key="clubs"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="flex-1 flex"
          >
            {/* Sidebar */}
            <aside className="hidden md:flex w-72 lg:w-80 border-r border-border p-4 flex-col shrink-0 h-[calc(100vh-57px)] sticky top-[57px]">
              <SidebarClubList
                activeClub={activeClub}
                onSelectClub={setActiveClub}
              />
            </aside>

            {/* Feed */}
            <main className="flex-1 max-w-3xl mx-auto px-4 py-6 space-y-5">
              <FeedFilterBar active={activeFilter} onChange={setActiveFilter} />
              {MOCK_POSTS.map((post, i) => (
                <motion.div
                  key={post.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.08 }}
                >
                  <PostCard
                    {...post}
                    onOpenDetail={() => setSelectedPost(post)}
                  />
                </motion.div>
              ))}
            </main>
          </motion.div>
        ) : (
          <motion.div
            key={activeTab}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="flex-1 flex"
          >
            <MaintenanceScreen label={activeTab} />
          </motion.div>
        )}
      </AnimatePresence>

      <PostDetailDialog
        open={!!selectedPost}
        onOpenChange={(open) => !open && setSelectedPost(null)}
        post={selectedPost}
      />
    </div>
  );
};

export default Home;
