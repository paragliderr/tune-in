import type { SupabaseClient } from "@supabase/supabase-js";

function normalizeRow(row: Record<string, unknown>): Record<string, unknown> {
  const r = row as { posts?: Record<string, unknown>; clubs?: Record<string, unknown> };
  if (r.posts && typeof r.posts === "object") {
    return { ...r.posts, _clubs: r.clubs };
  }
  return row;
}

/**
 * Turns API / RPC post rows into the shape expected by PostCard / PostDetailDialog.
 */
export async function mapFeedRowsToPostCards(
  supabase: SupabaseClient,
  rows: Record<string, unknown>[],
): Promise<any[]> {
  if (!rows.length) return [];

  const flat = rows.map(normalizeRow);
  const clubIds = [
    ...new Set(
      flat.map((r) => r.club_id as string | undefined).filter(Boolean) as string[],
    ),
  ];
  const userIds = [
    ...new Set(
      flat.map((r) => r.user_id as string | undefined).filter(Boolean) as string[],
    ),
  ];

  const clubSlugById: Record<string, { name: string; slug: string }> = {};
  if (clubIds.length) {
    const { data: clubs } = await supabase
      .from("clubs")
      .select("id, name, slug")
      .in("id", clubIds);
    clubs?.forEach((c: { id: string; name: string; slug: string }) => {
      clubSlugById[c.id] = { name: c.name, slug: c.slug };
    });
  }

  const usernameById: Record<string, string> = {};
  if (userIds.length) {
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, username")
      .in("id", userIds);
    profiles?.forEach((p: { id: string; username: string | null }) => {
      usernameById[p.id] = p.username || "user";
    });
  }

  return flat.map((p) => {
    const cid = p.club_id as string;
    const uid = p.user_id as string;
    const club = clubSlugById[cid];
    const created = p.created_at as string | undefined;
    return {
      id: p.id,
      user_id: uid,
      clubSlug: club?.slug ?? "",
      clubName: club?.name ?? (p._clubs as { name?: string } | undefined)?.name ?? "Club",
      clubColor: "from-purple-600 to-indigo-700",
      username: usernameById[uid] || "user",
      time: created ? new Date(created).toLocaleString() : "",
      title: p.title,
      content: p.content,
      image: p.image_url,
      likes: (p.like_count as number) ?? 0,
      dislikes: (p.dislike_count as number) ?? 0,
      commentCount: (p.comment_count as number) ?? 0,
    };
  });
}
