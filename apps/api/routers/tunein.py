import os
import sys
from fastapi import APIRouter, HTTPException

# Keep path setup
BASE_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "../../../"))
sys.path.append(os.path.join(BASE_DIR, "services"))

router = APIRouter()

# =========================
# OPTIONAL OPTIMIZED SERVICE (NEW LOGIC)
# =========================
hgt_scorer = None

try:
    from ai_engine.scoring_service import ScoringService

    hgt_scorer = ScoringService(
        neo4j_uri=os.getenv("NEO4J_URI", "bolt://localhost:7687"),
        neo4j_user=os.getenv("NEO4J_USER", "neo4j"),
        neo4j_password=os.getenv("NEO4J_PASSWORD", "password")
    )
    print("[OK] HGT ScoringService initialized")

except Exception as e:
    print("[WARN] Falling back to lazy scoring:", e)


# =========================
# DASHBOARD
# =========================
@router.get("/tune-in/dashboard/{user_id}")
async def dashboard(user_id: str):
    try:
        # ✅ NEW FAST PATH
        if hgt_scorer:
            return await hgt_scorer.get_user_dashboard(user_uuid=user_id)

        # ✅ OLD FALLBACK (lazy import)
        from ai_engine.scoring_service import compute_user_score

        score = await compute_user_score(user_id)

        return {
            "total_score": score,
            "api_connections": [],
            "rank": 0,
            "recommendations": []
        }

    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))

    except Exception as e:
        print("Dashboard error:", e)
        return {
            "total_score": 0,
            "api_connections": [],
            "rank": 0,
            "recommendations": []
        }


# =========================
# LEADERBOARD
# =========================
@router.get("/tune-in/leaderboard")
async def leaderboard():
    try:
        # ✅ NEW FAST PATH
        if hgt_scorer:
            leaderboard_data = await hgt_scorer.get_leaderboard(top_k=20)
            return {"leaderboard": leaderboard_data}

        # ✅ OLD FALLBACK (lazy graph build)
        from ai_engine.graph_builder import Neo4jGraphBuilder
        from ai_engine.scoring_service import compute_user_score

        builder = Neo4jGraphBuilder(
            uri=os.getenv("NEO4J_URI"),
            user=os.getenv("NEO4J_USER"),
            password=os.getenv("NEO4J_PASSWORD"),
        )

        await builder.connect()
        result = await builder.build()

        if isinstance(result, tuple):
            graph_obj, builder = result
        else:
            graph_obj = result

        if not hasattr(builder, "user_id_map"):
            return {"leaderboard": []}

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
        return {"leaderboard": results[:50]}

    except Exception as e:
        print("Leaderboard error:", e)
        return {"leaderboard": []}