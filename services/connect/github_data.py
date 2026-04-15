import requests
import os
from datetime import datetime, timezone, timedelta
from dotenv import load_dotenv
from supabase import create_client, Client

# Load environment variables
load_dotenv()

# ─────────────────────────────────────────────
# CONFIGURATION
# ─────────────────────────────────────────────
# Set these in your .env file
GITHUB_TOKEN = os.getenv("GITHUB_TOKEN", "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")
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_SERVICE_KEY = os.getenv("SUPABASE_SERVICE_KEY")

def get_supabase() -> Client:
    if not SUPABASE_URL or not SUPABASE_SERVICE_KEY:
        raise Exception("Missing SUPABASE_URL or SUPABASE_SERVICE_KEY in .env")
    return create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)

# ─────────────────────────────────────────────
# HELPERS
# ─────────────────────────────────────────────
def _headers(token: str) -> dict:
    return {
        "Authorization": f"Bearer {token}",
        "Accept": "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
    }


def _get_username(token: str) -> str:
    """Auto-detect GitHub username from the token."""
    response = requests.get("https://api.github.com/user", headers=_headers(token))
    response.raise_for_status()
    return response.json()["login"]


def _since_until(window: str):
    """
    Returns (since, until) ISO strings for the given window.
    window: 'today' | 'week' | 'month'
    """
    now   = datetime.now(timezone.utc)
    until = now.isoformat()

    if window == "today":
        since = now.replace(hour=0, minute=0, second=0, microsecond=0).isoformat()
    elif window == "week":
        since = (now - timedelta(days=7)).isoformat()
    elif window == "month":
        since = (now - timedelta(days=30)).isoformat()
    else:
        raise ValueError(f"Invalid window '{window}'. Use: today | week | month")

    return since, until


# ═════════════════════════════════════════════
# SECTION 1 — DATA FETCHING
# ═════════════════════════════════════════════

def fetch_repos(token: str) -> list:
    """Return all repos the user owns or has contributed to."""
    repos = []
    url   = f"https://api.github.com/user/repos?per_page=100&affiliation=owner,collaborator"

    while url:
        response = requests.get(url, headers=_headers(token))
        response.raise_for_status()
        repos.extend(response.json())
        url = response.links.get("next", {}).get("url")

    return repos


def fetch_commits(token: str, username: str, repos: list, window: str) -> list:
    """Return all commits by the user across all repos in the given window."""
    since, until = _since_until(window)
    all_commits  = []

    for repo in repos:
        repo_name = repo["full_name"]
        url = (
            f"https://api.github.com/repos/{repo_name}/commits"
            f"?author={username}&since={since}&until={until}&per_page=100"
        )

        while url:
            response = requests.get(url, headers=_headers(token))

            # 409 Conflict: repository is empty
            if response.status_code == 409:
                break
            if response.status_code != 200:
                break

            data = response.json()
            if not data:
                break

            for commit in data:
                all_commits.append({
                    "repo":    repo_name,
                    "sha":     commit["sha"],
                    "message": commit["commit"]["message"].split("\n")[0],
                    "date":    commit["commit"]["author"]["date"],
                    "url":     commit["html_url"],
                })

            url = response.links.get("next", {}).get("url")

    return all_commits


def fetch_commit_stats(token: str, commits: list) -> list:
    """
    Fetch lines added/deleted for each commit.
    """
    for commit in commits:
        url      = f"https://api.github.com/repos/{commit['repo']}/commits/{commit['sha']}"
        response = requests.get(url, headers=_headers(token))

        if response.status_code != 200:
            commit["additions"] = 0
            commit["deletions"] = 0
        else:
            stats = response.json().get("stats", {})
            commit["additions"] = stats.get("additions", 0)
            commit["deletions"] = stats.get("deletions", 0)

    return commits


def fetch_github_data(token: str, window: str = "week", fetch_stats: bool = True) -> dict:
    """
    Main data fetcher.
    """
    username = _get_username(token)
    repos = fetch_repos(token)
    commits = fetch_commits(token, username, repos, window)

    if fetch_stats and commits:
        commits = fetch_commit_stats(token, commits)
    else:
        for c in commits:
            c["additions"] = 0
            c["deletions"] = 0

    commit_dates = sorted(set(c["date"][:10] for c in commits))
    repos_touched = list(set(c["repo"] for c in commits))

    return {
        "username":       username,
        "window":         window,
        "fetched_at":     datetime.now(timezone.utc).isoformat(),
        "commits":        commits,
        "commit_dates":   commit_dates,
        "repos_touched":  repos_touched,
        "summary": {
            "total_commits":    len(commits),
            "total_additions":  sum(c["additions"] for c in commits),
            "total_deletions":  sum(c["deletions"] for c in commits),
            "unique_days":      len(commit_dates),
            "unique_repos":     len(repos_touched),
        }
    }


# SECTION 2 — LEADERBOARD SCORING
POINTS_PER_COMMIT        = 10
POINTS_PER_LINE_ADDED    = 0.2
POINTS_PER_LINE_DELETED  = 0.1
POINTS_PER_STREAK_DAY    = 20
POINTS_PER_REPO          = 15
CONSISTENCY_BONUS        = 50
DAILY_LINE_CAP           = 500

def _compute_streak(commit_dates: list) -> int:
    if not commit_dates: return 0
    today = datetime.now(timezone.utc).date()
    date_set = set(commit_dates)
    if str(today) not in date_set and str(today - timedelta(days=1)) not in date_set: return 0
    check_day = today if str(today) in date_set else today - timedelta(days=1)
    streak = 0
    while str(check_day) in date_set:
        streak += 1
        check_day -= timedelta(days=1)
    return streak

def _compute_daily_line_points(commits: list) -> float:
    daily = {}
    for c in commits:
        day = c["date"][:10]
        pts = (c["additions"] * POINTS_PER_LINE_ADDED + c["deletions"] * POINTS_PER_LINE_DELETED)
        daily[day] = daily.get(day, 0) + pts
    return sum(min(pts, DAILY_LINE_CAP) for pts in daily.values())

def compute_score(data: dict) -> dict:
    summary = data["summary"]
    commit_pts = summary["total_commits"] * POINTS_PER_COMMIT
    line_pts   = _compute_daily_line_points(data["commits"])
    streak_days = _compute_streak(data["commit_dates"])
    streak_pts  = streak_days * POINTS_PER_STREAK_DAY
    repo_pts    = len(data["repos_touched"]) * POINTS_PER_REPO
    
    bonus = CONSISTENCY_BONUS if data["window"] in ("week", "month") and summary["unique_days"] >= 5 else 0
    total = commit_pts + line_pts + streak_pts + repo_pts + bonus

    return {
        "username":    data["username"],
        "total_score": round(total, 1),
        "streak_days": streak_days,
        "breakdown": {
            "commit_points": round(commit_pts, 1),
            "line_points": round(line_pts, 1),
            "streak_points": round(streak_pts, 1),
            "repo_points": round(repo_pts, 1),
            "consistency_bonus": bonus,
        }
    }

def store_to_supabase(user_id: str, data: dict, score: dict):
    """
    Upsert data to supabase 'github_stats' table.
    """
    supabase = get_supabase()
    stats_entry = {
        "user_id": user_id,
        "username": data["username"],
        "total_commits": data["summary"]["total_commits"],
        "total_additions": data["summary"]["total_additions"],
        "total_deletions": data["summary"]["total_deletions"],
        "score": score["total_score"],
        "streak_days": score["streak_days"],
        "updated_at": data["fetched_at"]
    }
    supabase.table("github_stats").upsert(stats_entry, on_conflict="user_id").execute()
    print(f"[OK] Stored stats for {data['username']} in Supabase.")

def main(user_id: str = None, token: str = GITHUB_TOKEN, window: str = "week"):
    print(f"\n=== GitHub Data Sync ({window}) ===")
    data = fetch_github_data(token, window=window)
    score = compute_score(data)
    
    print(f"User: {data['username']} | Score: {score['total_score']}")
    
    if user_id:
        store_to_supabase(user_id, data, score)
    else:
        print("[!] No user_id provided, skipping storage.")

if __name__ == "__main__":
    import sys
    # Example: python github_data.py <user_id> <token>
    uid = sys.argv[1] if len(sys.argv) > 1 else None
    tok = sys.argv[2] if len(sys.argv) > 2 else GITHUB_TOKEN
    main(user_id=uid, token=tok)
