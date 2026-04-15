import sys
sys.path.insert(0, '.')
from db.supabase import get_supabase
s = get_supabase()
res = s.table('movie_reviews').select('id, user_id, rating, content').execute()
for r in res.data:
    if 'speedcubers' in r['content'].lower() or 'fucked up' in r['content'].lower():
        print(r)
