from fastapi import APIRouter
import sys
import os

BASE_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "../../../"))
sys.path.append(os.path.join(BASE_DIR, "services"))

from ai_engine.scoring_service import compute_user_score

router = APIRouter()

@router.get("/tune-in/dashboard")
async def dashboard(user_id: str):
    try:
        score = await compute_user_score(user_id)

        return {
            "total_score": score,
            "api_connections": [],
            "rank": 0,
        }

    except Exception as e:
        print("HGT error:", e)
        return {
            "total_score": 0,
            "api_connections": [],
            "rank": 0,
        }
@router.get("/tune-in/leaderboard")
@router.get("/tune-in/leaderboard")
async def leaderboard():
    try:
        from ai_engine.graph_builder import Neo4jGraphBuilder
        from ai_engine.scoring_service import compute_user_score
        import os

        # 🔥 INIT BUILDER
        builder = Neo4jGraphBuilder(
            uri=os.getenv("NEO4J_URI"),
            user=os.getenv("NEO4J_USER"),
            password=os.getenv("NEO4J_PASSWORD"),
        )

        await builder.connect()

        # 🔥 IMPORTANT: DO NOT OVERWRITE BUILDER
        result = await builder.build()

        # 🔥 HANDLE ALL CASES
        if isinstance(result, tuple):
            graph_obj, builder_obj = result
            builder = builder_obj   # use correct builder
        else:
            graph_obj = result      # builder remains same

        # 🔥 DEBUG (optional)
        print("USER MAP:", getattr(builder, "user_id_map", None))

        results = []

        # 🔥 SAFETY CHECK
        if not hasattr(builder, "user_id_map"):
            print("Builder missing user_id_map ❌")
            return []

        # 🔥 LOOP USERS
        for neo4j_id, idx in builder.user_id_map.items():
            try:
                supabase_id = (
                    builder.user_supabase_map.get(neo4j_id)
                    if hasattr(builder, "user_supabase_map")
                    else neo4j_id
                )

                score = await compute_user_score(supabase_id)

                results.append({
                    "user_id": supabase_id,
                    "score": score
                })

            except Exception as e:
                print(f"Error scoring {neo4j_id}:", e)
                continue

        # 🔥 SORT
        results.sort(key=lambda x: x["score"], reverse=True)

        return results[:50]

    except Exception as e:
        print("Leaderboard error:", e)
        return []