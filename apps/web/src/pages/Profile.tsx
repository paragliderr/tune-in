import { useParams, useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { motion } from "framer-motion";
import { ArrowLeft, Link2 } from "lucide-react";

export default function Profile() {
  const { username } = useParams();
  const navigate = useNavigate();

  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      if (!username) return;

      const { data } = await supabase
        .from("profiles")
        .select("*")
        .eq("username", username)
        .single();

      setProfile(data);
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
        </motion.div>
      </div>
    </div>
  );
}
