import sys
sys.path.insert(0, '.')
from services.letterboxd_service import LetterboxdService

username = 'ayush2'
try:
    svc = LetterboxdService(username)
    reviews = svc.get_reviews()
    print(f"Total reviews for {username}: {len(reviews)}")
    for r in reviews[:5]:
        print(f"  tmdb_id={r.get('tmdb_id')} | rating={r.get('rating')} | title={r.get('title')}")
except Exception as e:
    print(f"Error fetching {username}: {e}")
