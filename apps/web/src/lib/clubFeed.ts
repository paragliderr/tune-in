/** Club-scoped feed tabs (excludes Trending, which uses the ML API). */
export type ClubFeedSortFilter =
  | "New"
  | "Top Week"
  | "Top Month"
  | "Top Year"
  | "All Time";

const TOP_BY_LIKES: Set<string> = new Set([
  "Top Week",
  "Top Month",
  "Top Year",
  "All Time",
]);

export function isTopByLikesFilter(filter: string): boolean {
  return TOP_BY_LIKES.has(filter);
}

/** Earliest `created_at` to include for time-window top lists; omit for All Time. */
export function minCreatedAtIsoForTopFilter(
  filter: ClubFeedSortFilter,
): string | undefined {
  const d = new Date();
  switch (filter) {
    case "Top Week":
      d.setUTCDate(d.getUTCDate() - 7);
      return d.toISOString();
    case "Top Month":
      d.setUTCDate(d.getUTCDate() - 30);
      return d.toISOString();
    case "Top Year":
      d.setUTCFullYear(d.getUTCFullYear() - 1);
      return d.toISOString();
    case "All Time":
    case "New":
    default:
      return undefined;
  }
}
