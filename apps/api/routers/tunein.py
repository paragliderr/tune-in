from fastapi import APIRouter
import sys
import os

BASE_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "../../../"))
sys.path.append(os.path.join(BASE_DIR, "services"))

router = APIRouter()


@router.get("/tune-in/dashboard")
async def dashboard(user_id: str):
    # FIX: lazy import — only pulled in when this route is actually called,
    # so a missing torch_geometric won't crash the server on startup.
    try:
        from ai_engine.scoring_service import compute_user_score
        score = await compute_user_score(user_id)
        return {
            "total_score": score,
            "api_connections": [],
            "rank": 0,
        }
    except Exception as e:
        print("Dashboard error:", e)
        return {
            "total_score": 0,
            "api_connections": [],
            "rank": 0,
        }


@router.get("/tune-in/leaderboard")
async def leaderboard():
    # FIX: lazy import for the same reason — Neo4jGraphBuilder pulls in
    # torch_geometric transitively through scoring_service/graph_builder.
    try:
        from ai_engine.graph_builder import Neo4jGraphBuilder
        from ai_engine.scoring_service import compute_user_score

        builder = Neo4jGraphBuilder(
            uri=os.getenv("NEO4J_URI"),
            user=os.getenv("NEO4J_USER"),
            password=os.getenv("NEO4J_PASSWORD"),
        )
        await builder.connect()

        result = await builder.build()

        # Handle both (graph, builder) tuple and plain graph returns
        if isinstance(result, tuple):
            graph_obj, builder = result
        else:
            graph_obj = result

        print("USER MAP:", getattr(builder, "user_id_map", None))

        if not hasattr(builder, "user_id_map"):
            print("Builder missing user_id_map ❌")
            return []

        results = []
        for neo4j_id, idx in builder.user_id_map.items():
            try:
                supabase_id = (
                    builder.user_supabase_map.get(neo4j_id)
                    if hasattr(builder, "user_supabase_map")
                    else neo4j_id
                )
                score = await compute_user_score(supabase_id)
                results.append({"user_id": supabase_id, "score": score})
            except Exception as e:
                print(f"Error scoring {neo4j_id}:", e)
                continue

        results.sort(key=lambda x: x["score"], reverse=True)
        return results[:50]

    except Exception as e:
        print("Leaderboard error:", e)
        return []