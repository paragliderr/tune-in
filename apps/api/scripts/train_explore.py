"""
Trains a LightGCN model on graph data from Neo4j to generate node embeddings
for exploration and recommendation tasks.
"""

import torch
import torch.nn.functional as F
from torch_geometric.nn import LightGCN
from torch_geometric.utils import to_undirected
from build_graph import fetch_graph_from_neo4j

def train_explore_engine():
    print("Loading the PyTorch engine...")
    
    data, user_map, post_map, club_map = fetch_graph_from_neo4j()
    
    homo_data = data.to_homogeneous()
    edge_index = to_undirected(homo_data.edge_index)
    num_nodes = homo_data.num_nodes
    
    print(f"Unified Graph created with {num_nodes} total nodes.")
    
    model = LightGCN(
        num_nodes=num_nodes,
        embedding_dim=64,
        num_layers=2 
    )
    
    optimizer = torch.optim.Adam(model.parameters(), lr=0.01)
    
    print("Training the Network with BPR (Bayesian Personalized Ranking)...")
    model.train()
    
    for epoch in range(1, 21):
        optimizer.zero_grad()
        
        out_embeddings = model.get_embedding(edge_index)
        
        src, pos_dst = edge_index
        # Random negative sampling
        neg_dst = torch.randint(0, num_nodes, (src.size(0),))
        
        pos_out = (out_embeddings[src] * out_embeddings[pos_dst]).sum(dim=-1)
        neg_out = (out_embeddings[src] * out_embeddings[neg_dst]).sum(dim=-1)
        
        loss = -F.logsigmoid(pos_out - neg_out).mean()
        
        loss.backward()
        optimizer.step()
        
        if epoch % 5 == 0 or epoch == 1:
            print(f"Epoch {epoch:02d} | Loss: {loss.item():.4f}")
        
    print("Training Completed.")
    
    model.eval()
    with torch.no_grad():
        final_embeddings = model.get_embedding(edge_index)

    print(f"Shape: {final_embeddings.shape} (Nodes x Dimensions)")
  
    print("\nUploading Explore Vectors to Supabase...")
    import os
    from supabase import create_client
    
    supabase = create_client(os.getenv("SUPABASE_URL"), os.getenv("SUPABASE_SERVICE_KEY"))
    
    reverse_user_map = {v: k for k, v in user_map.items()}
    reverse_post_map = {v: k for k, v in post_map.items()}
    
    user_offset = 0
    post_offset = len(user_map)
    
    #  Upload User Vectors
    for pt_id, uuid in reverse_user_map.items():
        vector = final_embeddings[user_offset + pt_id].tolist()
        supabase.table("profiles").update({"explore_embedding": vector}).eq("id", uuid).execute()
        
    print(f"Successfully uploaded {len(user_map)} User vectors.")
        
    # Upload Post Vectors
    for pt_id, uuid in reverse_post_map.items():
        vector = final_embeddings[post_offset + pt_id].tolist()
        supabase.table("posts").update({"explore_embedding": vector}).eq("id", uuid).execute()
        
    print(f"Successfully uploaded {len(post_map)} Post vectors.")
    print("AI Explore Pipeline Complete.")
    
    return final_embeddings

if __name__ == "__main__":
    train_explore_engine()
