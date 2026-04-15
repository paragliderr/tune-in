import sys
sys.path.insert(0, '.')
from db.supabase import get_supabase
s = get_supabase()
res = s.table('profiles').select('id, username, connections').execute()
for r in res.data:
    if r.get('connections') and 'letterboxd' in r['connections']:
        print(f"User {r['username']} | Letterboxd: {r['connections']['letterboxd']}")
