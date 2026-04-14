import feedparser
import re
from fastapi import APIRouter
from bs4 import BeautifulSoup

router = APIRouter()

def clean_html(html):
    soup = BeautifulSoup(html, "html.parser")
    return soup.get_text(separator=" ").strip()

@router.get("/letterboxd/{username}")
def get_letterboxd_reviews(username: str):
    url = f"https://letterboxd.com/{username}/rss/"
    
    feed = feedparser.parse(url)
    
    reviews = []

    for entry in feed.entries:
        # Extract TMDB ID
        tmdb_id = None
        if "tmdb_movieid" in entry:
            tmdb_id = int(entry.tmdb_movieid)

        # Clean HTML properly
        clean_text = clean_html(entry.description)

        reviews.append({
            "title": entry.get("letterboxd_filmtitle"),
            "year": entry.get("letterboxd_filmyear"),
            "tmdb_id": tmdb_id,
            "rating": entry.get("letterboxd_memberrating"),
            "review": clean_text,
            "date": entry.get("published"),
            "source": "letterboxd"
        })

    return reviews