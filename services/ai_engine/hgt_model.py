"""
TuneIn HGT Model
================
Heterogeneous Graph Transformer built for your exact Neo4j schema:

Node types  : User, Post, Club
Edge types  : User-LIKES-Post, User-JOINED-Club, Post-BELONGS_TO-Club

The model learns cross-domain attention:
  - How a User's LIKES pattern relates to their JOINED clubs
  - Which Posts create community signals inside a Club
  - User-to-User similarity via shared clubs & liked posts
"""

import torch
import torch.nn.functional as F
from torch_geometric.nn import HGTConv, Linear


# ── Node feature dims coming from Neo4j property encoders ──────────────────
NODE_FEATURE_DIMS = {
    "user":  384,   # E5-small-v2 embedding of bio + username
    "post":  384,   # E5-small-v2 embedding of caption/content
    "club":  384,   # E5-small-v2 embedding of club name + description
}


class TuneInHGT(torch.nn.Module):
    """
    Two-output HGT:
      1. embeddings  → dense vectors for cosine-similarity recommendations
      2. scores      → scalar influence score per node (leaderboard)

    Architecture
    ────────────
    Input Projection  →  HGTConv × num_layers  →  embed_head  (recommendations)
                                               →  score_head  (leaderboard)
    """

    def __init__(
        self,
        hidden_channels: int = 128,
        out_channels: int = 64,
        num_heads: int = 4,
        num_layers: int = 2,
        metadata: tuple = None,          # passed from HeteroData.metadata()
    ):
        super().__init__()

        self.hidden_channels = hidden_channels

        # ── 1. Input projection: map each node type to hidden_channels ──────
        # Linear(-1, ...) = lazy init, infers input dim on first forward pass
        self.input_proj = torch.nn.ModuleDict({
            "user": Linear(-1, hidden_channels),
            "post": Linear(-1, hidden_channels),
            "club": Linear(-1, hidden_channels),
        })

        # ── 2. HGT Convolution layers ────────────────────────────────────────
        # HGTConv handles ALL your edge types simultaneously via type-specific
        # multi-head attention matrices (W_Q, W_K, W_V per relation type).
        self.convs = torch.nn.ModuleList([
            HGTConv(
                in_channels=hidden_channels,
                out_channels=hidden_channels,
                metadata=metadata,          # tells HGT about all node/edge types
                heads=num_heads,
                group="mean",               # aggregate multi-head outputs by mean
            )
            for _ in range(num_layers)
        ])

        # ── 3. Output heads (User nodes only) ────────────────────────────────
        # Head A – Recommendation embeddings (used with cosine similarity)
        self.embed_head = Linear(hidden_channels, out_channels)

        # Head B – Leaderboard influence score (scalar per user)
        self.score_head = torch.nn.Sequential(
            Linear(hidden_channels, 32),
            torch.nn.ReLU(),
            Linear(32, 1),
        )

        # Head C – Post quality score (for feed ranking)
        self.post_score_head = Linear(hidden_channels, 1)

    # ────────────────────────────────────────────────────────────────────────
    def forward(self, x_dict: dict, edge_index_dict: dict) -> dict:
        """
        Args
        ────
        x_dict          : {node_type: Tensor[num_nodes, feature_dim]}
        edge_index_dict : {(src, rel, dst): Tensor[2, num_edges]}

        Returns
        ───────
        dict with keys:
            user_embeddings   Tensor[num_users, out_channels]
            user_scores       Tensor[num_users]
            post_scores       Tensor[num_posts]
        """

        # ── Project each node type to shared hidden space ────────────────────
        h = {}
        for node_type, proj in self.input_proj.items():
            if node_type in x_dict:
                h[node_type] = proj(x_dict[node_type]).relu_()

        # ── Message passing through HGT layers ───────────────────────────────
        # Each HGTConv layer:
        #   For every edge (u)-[r]->(v):
        #     K = W_K^r  * h[src]     (key from source)
        #     Q = W_Q^r  * h[dst]     (query from dest)
        #     V = W_V^r  * h[src]     (value from source)
        #     attn = softmax(K·Q / sqrt(d))
        #     msg  = attn * V
        #   h_new[dst] = mean over all incoming edge types
        for conv in self.convs:
            h = conv(h, edge_index_dict)
            # Apply layer norm + residual per node type
            for node_type in h:
                h[node_type] = F.layer_norm(h[node_type], [self.hidden_channels])

        # ── Extract outputs ───────────────────────────────────────────────────
        user_h = h.get("user", x_dict.get("user"))
        post_h = h.get("post", x_dict.get("post"))

        user_embeddings = self.embed_head(user_h)
        user_scores     = self.score_head(user_h).squeeze(-1)
        post_scores     = self.post_score_head(post_h).squeeze(-1)

        return {
            "user_embeddings": user_embeddings,   # [N_users, out_channels]
            "user_scores":     user_scores,        # [N_users]
            "post_scores":     post_scores,        # [N_posts]
        }