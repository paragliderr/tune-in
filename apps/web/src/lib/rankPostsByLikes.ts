import type { SupabaseClient } from "@supabase/supabase-js";

const REACTION_BATCH = 100;

/**
 * Sort posts by actual "like" rows in `post_reactions`, then `like_count`, then recency.
 * Fixes ordering when `posts.like_count` is stale or still zero.
 */
export async function rankPostsByLiveLikes<T extends { id: string; like_count?: number | null; created_at?: string }>(
  supabase: SupabaseClient,
  posts: T[],
): Promise<T[]> {
  if (!posts.length) return [];

  const ids = posts.map((p) => p.id);
  const live: Record<string, number> = {};

  for (let i = 0; i < ids.length; i += REACTION_BATCH) {
    const batch = ids.slice(i, i + REACTION_BATCH);
    const { data } = await supabase
      .from("post_reactions")
      .select("post_id")
      .eq("reaction", "like")
      .in("post_id", batch);

    data?.forEach((row: { post_id: string | null }) => {
      if (!row.post_id) return;
      live[row.post_id] = (live[row.post_id] ?? 0) + 1;
    });
  }

  return [...posts].sort((a, b) => {
    const ca = live[a.id] ?? a.like_count ?? 0;
    const cb = live[b.id] ?? b.like_count ?? 0;
    if (cb !== ca) return cb - ca;
    const ta = new Date(a.created_at ?? 0).getTime();
    const tb = new Date(b.created_at ?? 0).getTime();
    return tb - ta;
  });
}
