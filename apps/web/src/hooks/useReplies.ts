import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";

export function useReplies(commentId: string, autoLoad = false) {
  const [replies, setReplies] = useState<any[]>([]);
  const [loaded, setLoaded] = useState(false);

  const load = async () => {
    const { data } = await supabase
      .from("comments")
      .select("*, profiles(username, avatar_url)")
      .eq("parent_id", commentId)
      .order("created_at");

    if (data) setReplies(data);
    setLoaded(true);
  };

  useEffect(() => {
    if (autoLoad && !loaded) load();
  }, []);

  const optimistic = (
    text: string,
    username: string,
    avatar: string | null,
    parent: any,
  ) => {
    const fake = {
      id: crypto.randomUUID(),
      content: text,
      post_id: parent.post_id,
      club_id: parent.club_id,
      parent_id: parent.id,
      like_count: 0,
      dislike_count: 0,
      reply_count: 0,
      depth: parent.depth + 1,
      created_at: new Date().toISOString(),
      profiles: { username, avatar_url: avatar },
      __optimistic: true,
    };

    setReplies((r) => [...r, fake]);
  };

  return { replies, load, optimistic, loaded };
}
  