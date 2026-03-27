import os
import torch
import torch.nn as nn
from sentence_transformers import SentenceTransformer
from supabase import create_client, Client
from dotenv import load_dotenv

load_dotenv()

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_KEY")

supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

print("Loading NLP Model (e5-small-v2)...")
nlp_model = SentenceTransformer('intfloat/e5-small-v2')

# 4. Shrinking Layer (384 -> 128)
class PostTowerCompressor(nn.Module):
    def __init__(self):
        super().__init__()
        self.compressor = nn.Linear(384, 128)
        
    def forward(self, x):
        return self.compressor(x)

post_tower = PostTowerCompressor()
#only for mac purpose:-
device = torch.device("mps" if torch.backends.mps.is_available() else "cpu")
post_tower.to(device)
# end
post_tower.eval()

def process_and_upload():
    print("Fetching posts from Supabase...")
    # Fetch all posts from  table
    response = supabase.table('posts').select('*').execute()
    posts = response.data
    
    if not posts:
        print("Troubleshoot! DB empty or cant fetch")
        return

    print(f"Found {len(posts)} posts. Uploading the embeddings ...\n")
    
    for post in posts:
        title = post.get('title') or ""
        content = post.get('content') or ""
        combined_text = f"{title} {content}".strip()
        if not combined_text:
            continue
        text = "passage: " + combined_text
        raw_vector = nlp_model.encode(text, convert_to_tensor=True)
        with torch.no_grad():
            shrunk_vector = post_tower(raw_vector)
        vector_list = shrunk_vector.tolist()
        supabase.table('posts').update({'embedding': vector_list}).eq('id', post['id']).execute()
        
        print(f" Updated Post {post['id']} with 128-d vector.")
        
    print("\nUploaded the embedding")

if __name__ == "__main__":
    process_and_upload()