import os
import torch
import torch.nn as nn
from sentence_transformers import SentenceTransformer
from supabase import create_client, Client
from dotenv import load_dotenv


load_dotenv(dotenv_path="apps/api/.env") 

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_KEY")
supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

print("Loading NLP Model (e5-small-v2)...")
device = torch.device("mps" if torch.backends.mps.is_available() else "cpu")
nlp_model = SentenceTransformer('intfloat/e5-small-v2', device=device)

class PostTowerCompressor(nn.Module):
    def __init__(self):
        super().__init__()
        self.compressor = nn.Linear(384, 128)
        
    def forward(self, x):
        return self.compressor(x)

post_tower = PostTowerCompressor().to(device)
post_tower.eval()

def run_rescue_mission():
    print("Fetching all posts from Supabase...")
    response = supabase.table('posts').select('*').execute()
    posts = response.data
    
    if not posts:
        print("No posts found!")
        return

    # Find posts where embedding is null
    broken_posts = [p for p in posts if p.get('embedding') is None]
    
    if not broken_posts:
        print("🎉 All posts have valid embeddings! No rescue needed.")
        return
        
    print(f"🚨 Found {len(broken_posts)} posts missing vectors. Starting rescue...\n")
    
    for post in broken_posts:
        title = post.get('title') or ""
        content = post.get('content') or ""
        combined_text = f"passage: {title} {content}".strip()
        
        if not combined_text:
            continue
            
        raw_vector = nlp_model.encode(combined_text, convert_to_tensor=True, device=device)
        with torch.no_grad():
            shrunk_vector = post_tower(raw_vector)
            
        vector_list = shrunk_vector.tolist()

        supabase.table('posts').update({'embedding': str(vector_list)}).eq('id', post['id']).execute()
        
        print(f" Rescued Post {post['id']} - Vector generated and saved!")
        
    print("\n Rescue mission complete! All historical posts are now AI-ready.")

if __name__ == "__main__":
    run_rescue_mission()