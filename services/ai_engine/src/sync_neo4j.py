import os
from supabase import create_client, Client
from neo4j import GraphDatabase
from dotenv import load_dotenv

current_dir = os.path.dirname(os.path.abspath(__file__))
env_path = os.path.join(current_dir, "..", ".env")
load_dotenv(dotenv_path=env_path)

# Error check
neo4j_uri = os.getenv("NEO4J_URI")
if not neo4j_uri:
    raise ValueError("CRITICAL: NEO4J_URI is empty.")

supabase: Client = create_client(os.getenv("SUPABASE_URL"), os.getenv("SUPABASE_SERVICE_KEY"))

neo4j_driver = GraphDatabase.driver(
    neo4j_uri, 
    auth=(os.getenv("NEO4J_USER"), os.getenv("NEO4J_PASSWORD"))
)

def sync_data():
    print(" Starting Supabase with Neo4j Sync...")
    
    # Fetching data from postgres
    users = supabase.table("profiles").select("id").execute().data
    clubs = supabase.table("clubs").select("id").execute().data
    posts = supabase.table("posts").select("id, club_id").execute().data
    likes = supabase.table("post_reactions").select("user_id, post_id").eq("reaction", "like").execute().data
    members = supabase.table("club_members").select("user_id, club_id").execute().data

    with neo4j_driver.session() as session:
        session.run("MATCH (n) DETACH DELETE n")

        print(f"Loading {len(users)} Users, {len(clubs)} Clubs, {len(posts)} Posts...")
        
        # Creating Nodes
        for u in users:
            session.run("CREATE (:User {id: $id})", id=u['id'])
        for c in clubs:
            session.run("CREATE (:Club {id: $id})", id=c['id'])
        for p in posts:
            session.run("CREATE (:Post {id: $id, club_id: $club_id})", id=p['id'], club_id=p['club_id'])

        print(" Building Relationships (Edges)...")
        
        # User -> JOINED -> Club
        for m in members:
            session.run("""
                MATCH (u:User {id: $user_id}), (c:Club {id: $club_id})
                MERGE (u)-[:JOINED]->(c)
            """, user_id=m['user_id'], club_id=m['club_id'])

        # User -> LIKED -> Post
        for l in likes:
            session.run("""
                MATCH (u:User {id: $user_id}), (p:Post {id: $post_id})
                MERGE (u)-[:LIKES]->(p)
            """, user_id=l['user_id'], post_id=l['post_id'])

        # Post -> BELONGS_TO -> Club
        for p in posts:
            if p.get('club_id'):
                session.run("""
                    MATCH (post:Post {id: $post_id}), (club:Club {id: $club_id})
                    MERGE (post)-[:BELONGS_TO]->(club)
                """, post_id=p['id'], club_id=p['club_id'])

    print("Sync Completed ,  Neo4j is now fully loaded.")

if __name__ == "__main__":
    sync_data()
    neo4j_driver.close()