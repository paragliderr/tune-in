/**
 * API base: VITE_API_URL if set; in dev uses Vite proxy `/api` → backend (avoids CORS / NetworkError).
 */
function apiUrl(path: string): string {
  const p = path.startsWith("/") ? path : `/${path}`;
  const env = import.meta.env.VITE_API_URL?.replace(/\/$/, "");
  if (env) return `${env}${p}`;
  if (import.meta.env.DEV) return `/api${p}`;
  return `/api${p}`;
}

/** Read body once; never mix .json() and .text() on the same Response. */
async function readBodyText(res: Response): Promise<string> {
  try {
    return await res.text();
  } catch (e) {
    throw e instanceof Error ? e : new Error(String(e));
  }
}

function parseErrorDetail(text: string, statusText: string): string {
  const trimmed = text.trim();
  if (!trimmed) return statusText;
  try {
    const j = JSON.parse(trimmed) as { detail?: unknown };
    if (j?.detail != null) {
      return typeof j.detail === "string" ? j.detail : JSON.stringify(j.detail);
    }
  } catch {
    /* not JSON */
  }
  return trimmed || statusText;
}

export function getApiBaseUrl(): string {
  const env = import.meta.env.VITE_API_URL?.replace(/\/$/, "");
  if (env) return env;
  if (import.meta.env.DEV) return "/api";
  return "/api";
}

export async function createPostViaApi(payload: {
  title: string;
  content: string;
  club_id: string;
  user_id: string;
  image_url?: string | null;
}): Promise<{ status: string; post_id: string; message?: string }> {
  const res = await fetch(apiUrl("/posts/"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const text = await readBodyText(res);
  if (!res.ok) {
    throw new Error(parseErrorDetail(text, res.statusText) || "Create post failed");
  }
  if (!text.trim()) {
    throw new Error("Empty response from server");
  }
  return JSON.parse(text) as { status: string; post_id: string; message?: string };
}

/** In-house two-tower / personalized feed (used for Trending). */
export async function fetchTrendingFeed(
  userId: string,
  limit = 30,
): Promise<{
  status: string;
  feed: Record<string, unknown>[];
  message?: string;
}> {
  const res = await fetch(apiUrl(`/api/v1/feed/${userId}`), {
    method: "GET",
    headers: { "Content-Type": "application/json" },
  });
  const text = await readBodyText(res);
  if (!res.ok) {
    throw new Error(parseErrorDetail(text, res.statusText) || "Feed request failed");
  }
  if (!text.trim()) {
    return { status: "success", feed: [] };
  }
  return JSON.parse(text) as {
    status: string;
    feed: Record<string, unknown>[];
    message?: string;
  };
}

/** @deprecated use fetchTrendingFeed */
export const fetchPersonalizedFeed = fetchTrendingFeed;

export async function trackFeedLike(userId: string, postId: string): Promise<void> {
  try {
    await fetch(apiUrl("/feed/track-like"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ user_id: userId, post_id: postId }),
    });
  } catch (e) {
    console.warn("trackFeedLike", e);
  }
}
