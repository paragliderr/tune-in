import { useParams, useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { motion } from "framer-motion";
import { ArrowLeft, Link2, Search } from "lucide-react";
import PostCard from "@/components/home/PostCard";
import PostDetailDialog from "@/components/home/PostDetailDialog";

import { mapFeedRowsToPostCards } from "@/lib/feedMap";

export default function Profile() {
  const { username } = useParams();
  const navigate = useNavigate();

  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [posts, setPosts] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedPost, setSelectedPost] = useState<any>(null);

  useEffect(() => {
    const load = async () => {
      if (!username) return;

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
          console.log("Supabase raw userPosts:", userPosts.length, userPosts);
          const mapped = await mapFeedRowsToPostCards(supabase, userPosts);
          console.log("Mapped posts:", mapped.length, mapped);
          setPosts(mapped);
        } else {
          setPosts([]);
        }
      }
      setLoading(false);
    };

    load();
  }, [username]);

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
    <div className="min-h-screen bg-background text-foreground">
      {/* HEADER */}
      <div className="border-b border-border sticky top-0 bg-background/80 backdrop-blur-xl z-10">
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
      <div className="max-w-4xl mx-auto px-6 py-10">
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-3xl border border-border bg-card/60 backdrop-blur-xl p-10"
        >
          {/* avatar */}
          <div className="flex flex-col items-center text-center">
            <img
              src={profile.avatar_url}
              className="w-32 h-32 rounded-full object-cover border border-border shadow-xl"
            />

            <h2 className="mt-5 text-2xl font-bold">@{profile.username}</h2>

            <p className="mt-3 text-muted-foreground max-w-md">
              {profile.bio || "No bio yet."}
            </p>
          </div>

          {/* CONNECTION MOCKUP */}
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
                  className="rounded-xl border border-border bg-background/40 backdrop-blur-xl p-5 flex items-center gap-3 hover:bg-muted/40 cursor-pointer transition"
                >
                  <Link2 size={16} />
                  {c}
                </motion.div>
              ))}
            </div>
          </div>

          {/* USER POSTS */}
          <div className="mt-12">
            <h3 className="font-semibold mb-5 text-lg">Posts</h3>
            
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
                <div className="text-center text-muted-foreground py-8">
                  No posts found. (Debug: profileId={profile && profile.id}, userPostsCount={posts.length})
                </div>
              )}
            </div>
          </div>
        </motion.div>
      </div>

      <PostDetailDialog
        post={selectedPost}
        open={!!selectedPost}
        onOpenChange={(o) => {
          if (!o) setSelectedPost(null);
        }}
      />
    </div>
  );
}
