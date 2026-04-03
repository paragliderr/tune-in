import torch
import torch.nn as nn
from sentence_transformers import SentenceTransformer

print("Warming up Alignment Engine (e5-small-v2)...")
device = torch.device("mps" if torch.backends.mps.is_available() else "cpu")
nlp_model = SentenceTransformer('intfloat/e5-small-v2', device=device)

# The Shrinking Layer (384 -> 128)
class PostTowerCompressor(nn.Module):
    def __init__(self):
        super().__init__()
        self.compressor = nn.Linear(384, 128)
        
    def forward(self, x):
        return self.compressor(x)

post_tower = PostTowerCompressor().to(device)
post_tower.eval()

def generate_post_embedding(title: str, content: str) -> list[float]:
    """
    Takes raw post text, runs it through the NLP model, shrinks it to 128-d,
    and returns to Supabase for pgvector search.
    """
    combined_text = f"passage: {title} {content}".strip()

    raw_vector = nlp_model.encode(combined_text, convert_to_tensor=True, device=device)
    
    # 2. Compressing to 128-dimension
    with torch.no_grad():
        shrunk_vector = post_tower(raw_vector)
        
    return shrunk_vector.tolist()

def build_session_vector(post_vectors: list[list[float]]) -> list[float]:
    """
    Takes a list of 128D post vectors (from the user's recently liked posts) 
    and averages them into a single 'Mood Vector'.
    """
    if not post_vectors:
        # for new user return neutral zero vector
        return [0.0] * 128 
     
    tensor_vectors = torch.tensor(post_vectors)
    
    # Calculate the average across the 0th dimension (averaging all columns)
    mean_vector = torch.mean(tensor_vectors, dim=0)
    
    return mean_vector.tolist()