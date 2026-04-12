/**
 * IGDB API Library
 * Communicates with the FastAPI backend proxy to fetch game data.
 */

export interface IGDBGame {
  id: number;
  name: string;
  summary?: string;
  cover?: { id: number; url: string; };
  first_release_date?: number;
  total_rating?: number;
  genres?: { id: number; name: string }[];
  platforms?: { id: number; name: string }[];
  screenshots?: { id: number; url: string }[];
  involved_companies?: {
    id: number;
    company: { id: number; name: string };
    developer: boolean;
    publisher: boolean;
  }[];
}

export interface IGDBReview {
  id: number;
  username: string;
  content: string;
  rating: number; // 1-100
  created_at: number; // unix timestamp
  platform?: { id: number; name: string };
}

export interface IGDBGenre {
  id: number;
  name: string;
}

export interface IGDBPlatform {
  id: number;
  name: string;
}

const PROXY_URL = "/api/v1/igdb";

async function fetchIGDB(endpoint: string, query: string): Promise<any> {
  const resp = await fetch(PROXY_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ endpoint, query }),
  });
  if (!resp.ok) {
    const err = await resp.json().catch(() => ({ detail: "Unknown error" }));
    throw new Error(err.detail || "IGDB Proxy Error");
  }
  return resp.json();
}

/** 
 * Convert IGDB's weird // images to https: and allow size changes 
 * sizes: t_cover_small, t_thumb, t_cover_big, t_720p, t_1080p
 */
export const gameImg = (url?: string, size = "t_cover_big") => {
  if (!url) return null;
  return url.replace("//images.igdb.com/igdb/image/upload/t_thumb/", `https://images.igdb.com/igdb/image/upload/${size}/`);
};

export const igdb = {
  search: async (q: string): Promise<IGDBGame[]> => {
    const query = `
      search "${q}";
      fields name,cover.url,summary,first_release_date,total_rating,genres.name,platforms.name;
      limit 20;
    `;
    return fetchIGDB("games", query);
  },

  searchPage: async (q: string, page = 1, sort: "newest" | "oldest" | "relevance" = "relevance"): Promise<{ results: IGDBGame[]; total_pages: number }> => {
    const limit = 20;
    const offset = (page - 1) * limit;
    const sortField = sort === "newest" ? "desc" : "asc";
    const query = `
      search "${q}";
      fields name,cover.url,summary,first_release_date,total_rating,genres.name,platforms.name;
      limit ${limit};
      offset ${offset};
      ${sort !== "relevance" ? `sort first_release_date ${sortField};` : ""}
    `;
    const results = await fetchIGDB("games", query);
    return { results, total_pages: 10 }; // Default 10 pages for search, can refine with count
  },

  searchDeep: async (q: string): Promise<IGDBGame[]> => {
    const query = `
      search "${q}";
      fields name,cover.url,summary,first_release_date,total_rating,genres.name,platforms.name;
      limit 100;
    `;
    return fetchIGDB("games", query);
  },

  searchCount: async (q: string): Promise<number> => {
    const query = `search "${q}";`;
    const res = await fetchIGDB("games/count", query);
    return res.count || 0;
  },

  popular: async (): Promise<IGDBGame[]> => {
    const query = `
      fields name,cover.url,summary,first_release_date,total_rating,genres.name,platforms.name;
      sort popularity desc;
      where cover != null & first_release_date < ${Math.floor(Date.now() / 1000)};
      limit 20;
    `;
    return fetchIGDB("games", query);
  },

  topRated: async (): Promise<IGDBGame[]> => {
    const query = `
      fields name,cover.url,summary,first_release_date,total_rating,genres.name,platforms.name;
      sort total_rating desc;
      where cover != null & total_rating_count > 50 & first_release_date < ${Math.floor(Date.now() / 1000)};
      limit 20;
    `;
    return fetchIGDB("games", query);
  },

  anticipated: async (): Promise<IGDBGame[]> => {
    const query = `
      fields name,cover.url,summary,first_release_date,total_rating,genres.name,platforms.name;
      sort hypes desc;
      where cover != null & first_release_date > ${Math.floor(Date.now() / 1000)};
      limit 20;
    `;
    return fetchIGDB("games", query);
  },

  companyGames: async (companyId: number): Promise<IGDBGame[]> => {
    // Get games developed or published by this company
    const query = `
      fields name,cover.url,summary,first_release_date,total_rating,genres.name,platforms.name;
      where involved_companies.company = ${companyId};
      sort first_release_date desc;
      limit 40;
    `;
    return fetchIGDB("games", query);
  },

  gameDetail: async (id: number): Promise<IGDBGame> => {
    const query = `
      fields name,cover.url,summary,first_release_date,total_rating,genres.name,platforms.name,screenshots.url,involved_companies.company.id,involved_companies.company.name,involved_companies.developer,involved_companies.publisher,websites.url,websites.category;
      where id = ${id};
    `;
    const results = await fetchIGDB("games", query);
    return results[0];
  },

  // IGDB aggregated reviews (from game_reviews endpoint)
  igdbReviews: async (gameId: number): Promise<IGDBReview[]> => {
    const query = `
      fields username,content,rating,created_at,platform.name;
      where game = ${gameId};
      limit 10;
    `;
    try {
      const res = await fetchIGDB("game_reviews", query);
      return Array.isArray(res) ? res : [];
    } catch {
      return [];
    }
  },


  // All genres for filter
  genres: async (): Promise<IGDBGenre[]> => {
    const query = `fields name; limit 30;`;
    return fetchIGDB("genres", query);
  },

  // Popular platforms for filter
  platforms: async (): Promise<IGDBPlatform[]> => {
    const query = `
      fields name;
      where category = 1;
      limit 20;
    `;
    return fetchIGDB("platforms", query);
  },

  // Paginated versions for CategoryView
  popularPage: async (page: number): Promise<{ results: IGDBGame[]; total_pages: number }> => {
    const limit = 20;
    const offset = (page - 1) * limit;
    const query = `
      fields name,cover.url,summary,first_release_date,total_rating,genres.name,platforms.name;
      sort popularity desc;
      where cover != null & first_release_date < ${Math.floor(Date.now() / 1000)};
      limit ${limit};
      offset ${offset};
    `;
    const results = await fetchIGDB("games", query);
    return { results, total_pages: 10 }; // IGDB doesn't easily give total count without a separate call
  },

  topRatedPage: async (page: number): Promise<{ results: IGDBGame[]; total_pages: number }> => {
    const limit = 20;
    const offset = (page - 1) * limit;
    const query = `
      fields name,cover.url,summary,first_release_date,total_rating,genres.name,platforms.name;
      sort total_rating desc;
      where cover != null & total_rating_count > 50 & first_release_date < ${Math.floor(Date.now() / 1000)};
      limit ${limit};
      offset ${offset};
    `;
    const results = await fetchIGDB("games", query);
    return { results, total_pages: 10 };
  },

  anticipatedPage: async (page: number): Promise<{ results: IGDBGame[]; total_pages: number }> => {
    const limit = 20;
    const offset = (page - 1) * limit;
    const query = `
      fields name,cover.url,summary,first_release_date,total_rating,genres.name,platforms.name;
      sort hypes desc;
      where cover != null & first_release_date > ${Math.floor(Date.now() / 1000)};
      limit ${limit};
      offset ${offset};
    `;
    const results = await fetchIGDB("games", query);
    return { results, total_pages: 10 };
  }
};
