const TMDB_BASE = "https://api.themoviedb.org/3";
const TMDB_IMG = "https://image.tmdb.org/t/p";

// TMDB API key — this is a publishable read-only key
const API_KEY = import.meta.env.VITE_TMDB_API_KEY || "cf05dca0aade29184be916d382203d15";

function url(path: string, params: Record<string, string> = {}) {
  const u = new URL(`${TMDB_BASE}${path}`);
  u.searchParams.set("api_key", API_KEY);
  Object.entries(params).forEach(([k, v]) => u.searchParams.set(k, v));
  return u.toString();
}

export const img = (path: string | null, size = "w500") =>
  path ? `${TMDB_IMG}/${size}${path}` : null;

export const backdrop = (path: string | null) => img(path, "w1280");

/** Format runtime like "2h 32min" */
export const formatRuntime = (minutes?: number) => {
  if (!minutes) return "";
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m}min`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}min`;
};

export interface TMDBMovie {
  id: number;
  title?: string;
  name?: string;
  poster_path: string | null;
  backdrop_path: string | null;
  overview: string;
  vote_average: number;
  vote_count: number;
  release_date?: string;
  first_air_date?: string;
  media_type?: string;
  genre_ids: number[];
}

export interface TMDBReview {
  id: string;
  author: string;
  author_details: {
    username: string;
    avatar_path: string | null;
    rating: number | null;
  };
  content: string;
  created_at: string;
}

export interface TMDBDetail extends TMDBMovie {
  genres: { id: number; name: string }[];
  runtime?: number;
  number_of_seasons?: number;
  number_of_episodes?: number;
  status: string;
  tagline?: string;
  seasons?: TMDBSeason[];
  created_by?: { name: string }[];
  networks?: { id: number; name: string; logo_path: string | null }[];
  production_companies?: { id: number; name: string; logo_path: string | null }[];
}

export interface TMDBSeason {
  id: number;
  name: string;
  overview: string;
  poster_path: string | null;
  season_number: number;
  episode_count: number;
  air_date: string | null;
  vote_average: number;
}

export interface TMDBSeasonDetail {
  id: number;
  name: string;
  overview: string;
  poster_path: string | null;
  season_number: number;
  air_date: string | null;
  episodes: TMDBEpisode[];
}

export interface TMDBEpisode {
  id: number;
  name: string;
  overview: string;
  episode_number: number;
  season_number: number;
  air_date: string | null;
  runtime: number | null;
  still_path: string | null;
  vote_average: number;
  vote_count: number;
}

export interface TMDBCast {
  id: number;
  name: string;
  character: string;
  profile_path: string | null;
  order: number;
  known_for_department: string;
  total_episode_count?: number;
}

export interface TMDBWatchProvider {
  provider_id: number;
  provider_name: string;
  logo_path: string;
  display_priority: number;
}

export interface TMDBWatchProviders {
  link?: string;
  flatrate?: TMDBWatchProvider[];
  rent?: TMDBWatchProvider[];
  buy?: TMDBWatchProvider[];
}

async function get<T>(path: string, params: Record<string, string> = {}): Promise<T> {
  const res = await fetch(url(path, params));
  if (!res.ok) throw new Error(`TMDB ${res.status}`);
  return res.json();
}

export const tmdb = {
  trending: () =>
    get<{ results: TMDBMovie[] }>("/trending/all/week").then((r) => r.results),

  trendingPage: (page = 1) =>
    get<{ results: TMDBMovie[]; total_pages: number }>("/trending/all/week", { page: String(page) }),

  popularMovies: () =>
    get<{ results: TMDBMovie[] }>("/movie/popular").then((r) => r.results),

  popularTV: () =>
    get<{ results: TMDBMovie[] }>("/tv/popular").then((r) => r.results),

  topRatedMovies: () =>
    get<{ results: TMDBMovie[] }>("/movie/top_rated").then((r) => r.results),

  topRatedMoviesPage: (page = 1) =>
    get<{ results: TMDBMovie[]; total_pages: number }>("/movie/top_rated", { page: String(page) }),

  topRatedTV: () =>
    get<{ results: TMDBMovie[] }>("/tv/top_rated").then((r) => r.results),

  topRatedTVPage: (page = 1) =>
    get<{ results: TMDBMovie[]; total_pages: number }>("/tv/top_rated", { page: String(page) }),

  search: (query: string) =>
    get<{ results: TMDBMovie[] }>("/search/multi", { query }).then((r) =>
      r.results.filter((m) => m.media_type === "movie" || m.media_type === "tv")
    ),

  movieDetail: (id: number) => get<TMDBDetail>(`/movie/${id}`),
  tvDetail: (id: number) => get<TMDBDetail>(`/tv/${id}`),

  movieReviews: (id: number) =>
    get<{ results: TMDBReview[] }>(`/movie/${id}/reviews`).then((r) => r.results),
  tvReviews: (id: number) =>
    get<{ results: TMDBReview[] }>(`/tv/${id}/reviews`).then((r) => r.results),

  // Cast (credits)
  movieCredits: (id: number) =>
    get<{ cast: TMDBCast[] }>(`/movie/${id}/credits`).then((r) => r.cast),
  tvCredits: (id: number) =>
    get<{ cast: TMDBCast[] }>(`/tv/${id}/aggregate_credits`).then((r) => r.cast),

  // Watch providers
  movieWatchProviders: (id: number) =>
    get<{ results: Record<string, TMDBWatchProviders> }>(`/movie/${id}/watch/providers`).then((r) => r.results),
  tvWatchProviders: (id: number) =>
    get<{ results: Record<string, TMDBWatchProviders> }>(`/tv/${id}/watch/providers`).then((r) => r.results),

  // Season + episode detail
  seasonDetail: (tvId: number, seasonNumber: number) =>
    get<TMDBSeasonDetail>(`/tv/${tvId}/season/${seasonNumber}`),

  // OTT discover
  discoverByProvider: (providerId: number, type: "movie" | "tv" = "movie") =>
    get<{ results: TMDBMovie[] }>(`/discover/${type}`, {
      with_watch_providers: String(providerId),
      watch_region: "US",
      sort_by: "popularity.desc",
    }).then((r) => r.results),

  discoverByProviderPage: (providerId: number, type: "movie" | "tv" = "movie", page = 1) =>
    get<{ results: TMDBMovie[]; total_pages: number }>(`/discover/${type}`, {
      with_watch_providers: String(providerId),
      watch_region: "US",
      sort_by: "popularity.desc",
      page: String(page),
    }),
};

export const OTT_PROVIDERS = [
  {
    id: 8,
    name: "Netflix",
    color: "from-red-700 to-red-900",
    logo: "https://image.tmdb.org/t/p/original/pbpMk2JmcoNnQwx5JGpXngfoWtp.jpg",
    url: "https://www.netflix.com",
  },
  {
    id: 9,
    name: "Amazon Prime",
    color: "from-blue-600 to-blue-900",
    logo: "https://image.tmdb.org/t/p/original/emthp39XA2YScoYL1p0sdbAH2WA.jpg",
    url: "https://www.primevideo.com",
  },
  {
    id: 337,
    name: "Disney+",
    color: "from-blue-500 to-indigo-800",
    logo: "https://image.tmdb.org/t/p/original/7rwgEs15tFwyR9NPQ5vpzxTj19Q.jpg",
    url: "https://www.disneyplus.com",
  },
  {
    id: 283,
    name: "Crunchyroll",
    color: "from-orange-500 to-orange-800",
    logo: "https://image.tmdb.org/t/p/original/8Gt1iClBlzTeQs8WQm8UrCoIxnQ.jpg",
    url: "https://www.crunchyroll.com",
  },
] as const;
