import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

export interface DbComment {
  id: string;
  content: string;
  user_id: string;
  post_id: string;
  club_id: string;
  parent_id: string | null;
  depth: number;
  like_count: number;
  dislike_count: number;
  reply_count: number;
  created_at: string;
  profiles: { username: string; avatar_url: string | null };
  __optimistic?: boolean;
}

export function useComments(postId: string, sort: "Top" | "New") {
  const [comments, setComments] = useState<DbComment[]>([]);
  const [page, setPage] = useState(0);

  const PAGE_SIZE = 10;

  const load = async (reset = false) => {
    const currentPage = reset ? 0 : page;

    let query = supabase
      .from("comments")
      .select("*, profiles(username, avatar_url)")
      .eq("post_id", postId)
      .is("parent_id", null)
      .range(currentPage * PAGE_SIZE, currentPage * PAGE_SIZE + PAGE_SIZE - 1);

    if (sort === "Top") query = query.order("like_count", { ascending: false });
    else query = query.order("created_at", { ascending: false });

    const { data } = await query;

    if (data) {
      setComments((prev) => (reset ? data : [...prev, ...data]));
      setPage(currentPage + 1);
    }
  };

  useEffect(() => {
    setPage(0);
    load(true);
  }, [postId, sort]);

  const addOptimistic = (
    text: string,
    username: string,
    clubId: string,
    avatar: string | null,
  ) => {
    const fake: DbComment = {
      id: crypto.randomUUID(),
      content: text,
      user_id: "me",
      post_id: postId,
      club_id: clubId,
      parent_id: null,
      depth: 0,
      like_count: 0,
      dislike_count: 0,
      reply_count: 0,
      created_at: new Date().toISOString(),
      profiles: { username, avatar_url: avatar },
      __optimistic: true,
    };

    setComments((c) => [fake, ...c]);
  };

  return { comments, load, addOptimistic };
}
