import feedparser
from bs4 import BeautifulSoup
from datetime import datetime, timezone


def _clean_html(html: str) -> str:
    """Strip HTML tags and return plain text."""
    return BeautifulSoup(html, "html.parser").get_text(separator=" ").strip()


class LetterboxdService:
    def __init__(self, username: str):
        self.username = username.strip().lower()

    def _extract_tmdb_id(self, entry) -> int | None:
        """
        Robustly extract the TMDB movie ID from a feedparser entry.
        Letterboxd RSS uses <tmdb:movieId> which feedparser maps to 'tmdb_movieid'.
        We try multiple strategies to handle any feedparser version differences.
        """
        # Strategy 1: standard feedparser key (confirmed working)
        raw = entry.get("tmdb_movieid")

        # Strategy 2: attribute access (some feedparser versions)
        if not raw and hasattr(entry, "tmdb_movieid"):
            raw = entry.tmdb_movieid

        # Strategy 3: alternate namespace mapping
        if not raw:
            raw = entry.get("letterboxd_tmdbid") or entry.get("tmdb_id")

        if raw:
            try:
                return int(raw)
            except (ValueError, TypeError):
                pass
        return None

    def get_reviews(self) -> list[dict]:
        """
        Fetches ALL diary entries from the public Letterboxd RSS feed.
        Returns a list of dicts with:
          - tmdb_id  : int (TMDB movie ID to match against movie.id in the frontend)
          - title    : str
          - year     : str | None
          - rating   : float | None  (0.5–5.0 in 0.5 steps, NOT rounded)
          - review   : str (cleaned plain text)
          - date     : str (ISO-8601)
          - letterboxd_url : str
        """
        url = f"https://letterboxd.com/{self.username}/rss/"
        feed = feedparser.parse(url)

        if feed.get("bozo") and not feed.entries:
            raise ValueError(f"Could not parse Letterboxd feed for @{self.username}")

        reviews = []
        for entry in feed.entries:
            # Only film diary entries have a film title
            film_title = entry.get("letterboxd_filmtitle")
            if not film_title:
                continue

            # ── TMDB ID ────────────────────────────────────────────────────────
            tmdb_id = self._extract_tmdb_id(entry)

            # ── Rating (preserve 0.5 precision) ───────────────────────────────
            rating: float | None = None
            raw_rating = entry.get("letterboxd_memberrating")
            if raw_rating:
                try:
                    rating = float(raw_rating)
                except (ValueError, TypeError):
                    pass

            # ── Review text (strip HTML) ───────────────────────────────────────
            # Letterboxd puts the review inside the <description> HTML block.
            # feedparser maps <description> → entry.summary
            review_text = ""
            raw_html = entry.get("summary") or entry.get("description", "")
            if raw_html:
                review_text = _clean_html(raw_html)

            # ── Date ───────────────────────────────────────────────────────────
            date_str = ""
            if entry.get("published_parsed"):
                try:
                    dt = datetime(*entry.published_parsed[:6], tzinfo=timezone.utc)
                    date_str = dt.isoformat()
                except Exception:
                    date_str = entry.get("published", "")
            else:
                date_str = entry.get("published", "")

            reviews.append({
                "title": film_title,
                "year":  entry.get("letterboxd_filmyear"),
                "tmdb_id": tmdb_id,           # int or None — matched against movie.id in frontend
                "rating": rating,             # 0.5–5.0, None if not rated
                "review": review_text,
                "date": date_str,
                "letterboxd_url": entry.get("link", ""),
            })

        return reviews
