import sys
sys.path.insert(0, '.')
from app.db.supabase import get_supabase
supabase_client = get_supabase()
res = supabase_client.table('profiles').select('username, connections').execute()
for r in res.data:
    if r.get('connections') and 'letterboxd' in r['connections']:
        print(f"User {r['username']} has letterboxd: {r['connections']['letterboxd']}")
