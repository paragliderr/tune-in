"""
Connects to Neo4j to extract the heterogeneous graph structure (Users, Posts, Clubs)
and converts it into a PyTorch Geometric HeteroData object for GNN training.

"""

import os
import torch
from torch_geometric.data import HeteroData
from neo4j import GraphDatabase
from dotenv import load_dotenv

# Resolve explicit path to .env file to prevent loading errors during execution
current_dir = os.path.dirname(os.path.abspath(__file__))
env_path = os.path.join(current_dir, "..", ".env")
load_dotenv(dotenv_path=env_path)

neo4j_uri = os.getenv("NEO4J_URI")
if not neo4j_uri:
    raise ValueError("CRITICAL: NEO4J_URI is empty.")

neo4j_driver = GraphDatabase.driver(
    neo4j_uri, 
    auth=(os.getenv("NEO4J_USER"), os.getenv("NEO4J_PASSWORD"))
)

def fetch_graph_from_neo4j():
    print("Fetching Graph topology from Neo4j...")
    data = HeteroData()

    with neo4j_driver.session() as session:
        users = session.run("MATCH (n:User) RETURN n.id AS id").data()
        posts = session.run("MATCH (n:Post) RETURN n.id AS id").data()
        clubs = session.run("MATCH (n:Club) RETURN n.id AS id").data()

        user_map = {row['id']: i for i, row in enumerate(users)}
        post_map = {row['id']: i for i, row in enumerate(posts)}
        club_map = {row['id']: i for i, row in enumerate(clubs)}

        data['user'].num_nodes = len(user_map)
        data['post'].num_nodes = len(post_map)
        data['club'].num_nodes = len(club_map)

        print(f"Mapped: {len(user_map)} Users, {len(post_map)} Posts, {len(club_map)} Clubs.")

        likes = session.run("MATCH (u:User)-[:LIKES]->(p:Post) RETURN u.id AS uid, p.id AS pid").data()
        likes_src = [user_map[row['uid']] for row in likes if row['uid'] in user_map and row['pid'] in post_map]
        likes_dst = [post_map[row['pid']] for row in likes if row['uid'] in user_map and row['pid'] in post_map]
        
        joined = session.run("MATCH (u:User)-[:JOINED]->(c:Club) RETURN u.id AS uid, c.id AS cid").data()
        joined_src = [user_map[row['uid']] for row in joined if row['uid'] in user_map and row['cid'] in club_map]
        joined_dst = [club_map[row['cid']] for row in joined if row['uid'] in user_map and row['cid'] in club_map]
        
        belongs = session.run("MATCH (p:Post)-[:BELONGS_TO]->(c:Club) RETURN p.id AS pid, c.id AS cid").data()
        belongs_src = [post_map[row['pid']] for row in belongs if row['pid'] in post_map and row['cid'] in club_map]
        belongs_dst = [club_map[row['cid']] for row in belongs if row['pid'] in post_map and row['cid'] in club_map]
        
        data['user', 'likes', 'post'].edge_index = torch.tensor([likes_src, likes_dst], dtype=torch.long)
        data['user', 'joined', 'club'].edge_index = torch.tensor([joined_src, joined_dst], dtype=torch.long)
        data['post', 'belongs_to', 'club'].edge_index = torch.tensor([belongs_src, belongs_dst], dtype=torch.long)

    print("PyTorch HeteroData Graph Built Successfully.")
    return data, user_map, post_map, club_map

if __name__ == "__main__":
    fetch_graph_from_neo4j()
    neo4j_driver.close()