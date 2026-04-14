import requests
from datetime import datetime, timezone, timedelta


# ─────────────────────────────────────────────
# CONFIGURATION
# ─────────────────────────────────────────────
GITHUB_TOKEN = "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"
GITHUB_USERNAME = None   # leave None to auto-detect from token


# ─────────────────────────────────────────────
# HELPERS
# ─────────────────────────────────────────────
def _headers() -> dict:
    return {
        "Authorization": f"Bearer {GITHUB_TOKEN}",
        "Accept": "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
    }


def _get_username() -> str:
    """Auto-detect GitHub username from the token."""
    response = requests.get("https://api.github.com/user", headers=_headers())
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

def fetch_repos(username: str) -> list:
    """Return all repos the user owns or has contributed to."""
    repos = []
    url   = f"https://api.github.com/user/repos?per_page=100&affiliation=owner,collaborator"

    while url:
        response = requests.get(url, headers=_headers())
        response.raise_for_status()
        repos.extend(response.json())
        url = response.links.get("next", {}).get("url")

    return repos


def fetch_commits(username: str, repos: list, window: str) -> list:
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
            response = requests.get(url, headers=_headers())

            if response.status_code == 409:
                break   # empty repo, skip
            if response.status_code != 200:
                break

            data = response.json()
            if not data:
                break

            for commit in data:
                all_commits.append({
                    "repo":    repo_name,
                    "sha":     commit["sha"],
                    "message": commit["commit"]["message"].split("\n")[0],  # first line only
                    "date":    commit["commit"]["author"]["date"],
                    "url":     commit["html_url"],
                })

            url = response.links.get("next", {}).get("url")

    return all_commits


def fetch_commit_stats(commits: list) -> list:
    """
    Fetch lines added/deleted for each commit.
    Returns commits enriched with 'additions' and 'deletions'.
    Note: makes one API call per commit — batched carefully.
    """
    enriched = []

    for commit in commits:
        url      = f"https://api.github.com/repos/{commit['repo']}/commits/{commit['sha']}"
        response = requests.get(url, headers=_headers())

        if response.status_code != 200:
            commit["additions"] = 0
            commit["deletions"] = 0
        else:
            stats = response.json().get("stats", {})
            commit["additions"] = stats.get("additions", 0)
            commit["deletions"] = stats.get("deletions", 0)

        enriched.append(commit)

    return enriched


def fetch_github_data(window: str = "week", fetch_stats: bool = True) -> dict:
    """
    Main data fetcher. Returns raw GitHub activity for the given window.

    window      : 'today' | 'week' | 'month'
    fetch_stats : if True, fetches line additions/deletions per commit
                  (slower but needed for full leaderboard score)
    """
    print(f"[1/4] Detecting GitHub username ...")
    username = GITHUB_USERNAME or _get_username()
    print(f"      Username: {username}")

    print(f"[2/4] Fetching repos ...")
    repos = fetch_repos(username)
    print(f"      Found {len(repos)} repos.")

    print(f"[3/4] Fetching commits ({window}) ...")
    commits = fetch_commits(username, repos, window)
    print(f"      Found {len(commits)} commits.")

    if fetch_stats and commits:
        print(f"[4/4] Fetching line stats for each commit ...")
        commits = fetch_commit_stats(commits)
    else:
        print(f"[4/4] Skipping line stats.")
        for c in commits:
            c["additions"] = 0
            c["deletions"] = 0

    # build commit date list for streak/consistency calculations
    commit_dates = sorted(set(
        c["date"][:10] for c in commits   # "YYYY-MM-DD"
    ))

    # repos touched
    repos_touched = list(set(c["repo"] for c in commits))

    total_additions = sum(c["additions"] for c in commits)
    total_deletions = sum(c["deletions"] for c in commits)

    return {
        "username":       username,
        "window":         window,
        "fetched_at":     datetime.now(timezone.utc).isoformat(),
        "commits":        commits,
        "commit_dates":   commit_dates,
        "repos_touched":  repos_touched,
        "summary": {
            "total_commits":    len(commits),
            "total_additions":  total_additions,
            "total_deletions":  total_deletions,
            "unique_days":      len(commit_dates),
            "unique_repos":     len(repos_touched),
        }
    }



# SECTION 2 — LEADERBOARD SCORING


# ── Scoring constants (tune these freely) ────
POINTS_PER_COMMIT        = 10
POINTS_PER_LINE_ADDED    = 0.2
POINTS_PER_LINE_DELETED  = 0.1
POINTS_PER_STREAK_DAY    = 20
POINTS_PER_REPO          = 15
CONSISTENCY_BONUS        = 50    # 5+ unique active days in a week window
DAILY_LINE_CAP           = 500  # max line points per day (anti-spam)


def _compute_streak(commit_dates: list) -> int:
    """
    Compute the current consecutive-day streak ending today (or yesterday).
    commit_dates: sorted list of 'YYYY-MM-DD' strings.
    """
    if not commit_dates:
        return 0

    today     = datetime.now(timezone.utc).date()
    streak    = 0
    check_day = today

    date_set = set(commit_dates)

    # allow streak to start from today or yesterday
    if str(today) not in date_set and str(today - timedelta(days=1)) not in date_set:
        return 0

    if str(today) not in date_set:
        check_day = today - timedelta(days=1)

    while str(check_day) in date_set:
        streak    += 1
        check_day -= timedelta(days=1)

    return streak


def _compute_daily_line_points(commits: list) -> float:
    """
    Sum line points per day, capping each day at DAILY_LINE_CAP.
    Prevents inflating score with one massive commit.
    """
    daily = {}
    for commit in commits:
        day = commit["date"][:10]
        pts = (
            commit["additions"] * POINTS_PER_LINE_ADDED
            + commit["deletions"] * POINTS_PER_LINE_DELETED
        )
        daily[day] = daily.get(day, 0) + pts

    return sum(min(pts, DAILY_LINE_CAP) for pts in daily.values())


def compute_score(data: dict) -> dict:
    """
    Compute leaderboard score from raw GitHub data.

    Returns a score breakdown dict with:
      - total_score
      - breakdown of each component
      - rank-ready summary
    """
    commits      = data["commits"]
    commit_dates = data["commit_dates"]
    repos        = data["repos_touched"]
    window       = data["window"]
    summary      = data["summary"]

    # ── individual components ─────────────────
    commit_points     = summary["total_commits"] * POINTS_PER_COMMIT
    line_points       = _compute_daily_line_points(commits)
    streak            = _compute_streak(commit_dates)
    streak_points     = streak * POINTS_PER_STREAK_DAY
    repo_points       = len(repos) * POINTS_PER_REPO

    # consistency bonus: 5+ active days only applies to week/month windows
    consistency_bonus = 0
    if window in ("week", "month") and summary["unique_days"] >= 5:
        consistency_bonus = CONSISTENCY_BONUS

    total_score = (
        commit_points
        + line_points
        + streak_points
        + repo_points
        + consistency_bonus
    )

    return {
        "username":    data["username"],
        "window":      window,
        "total_score": round(total_score, 1),
        "breakdown": {
            "commit_points":     round(commit_points, 1),
            "line_points":       round(line_points, 1),
            "streak_days":       streak,
            "streak_points":     round(streak_points, 1),
            "repo_points":       round(repo_points, 1),
            "consistency_bonus": consistency_bonus,
        },
        "stats": {
            "total_commits":   summary["total_commits"],
            "total_additions": summary["total_additions"],
            "total_deletions": summary["total_deletions"],
            "unique_days":     summary["unique_days"],
            "unique_repos":    summary["unique_repos"],
            "repos_touched":   repos,
        }
    }



# MAIN  –  run both sections

def main(window: str = "week") -> dict:
    """
    Fetch data + compute score for the given window.
    window: 'today' | 'week' | 'month'
    Returns combined dict with raw data + leaderboard score.
    """
    print(f"\n=== GitHub Data Fetch ({window}) ===")
    data  = fetch_github_data(window=window, fetch_stats=True)

    print(f"\n=== Computing Leaderboard Score ===")
    score = compute_score(data)

    print("\n RAW STATS ")
    print(f"  Username       : {data['username']}")
    print(f"  Window         : {window}")
    print(f"  Total Commits  : {data['summary']['total_commits']}")
    print(f"  Lines Added    : {data['summary']['total_additions']}")
    print(f"  Lines Deleted  : {data['summary']['total_deletions']}")
    print(f"  Active Days    : {data['summary']['unique_days']}")
    print(f"  Repos Touched  : {data['summary']['unique_repos']}")

    print("\n-- LEADERBOARD SCORE")
    print(f"  Total Score    : {score['total_score']} pts")
    print(f"  Commits        : {score['breakdown']['commit_points']} pts")
    print(f"  Lines          : {score['breakdown']['line_points']} pts")
    print(f"  Streak         : {score['breakdown']['streak_points']} pts  ({score['breakdown']['streak_days']} days)")
    print(f"  Repos          : {score['breakdown']['repo_points']} pts")
    print(f"  Consistency    : {score['breakdown']['consistency_bonus']} pts")

    return {"data": data, "score": score}


if __name__ == "__main__":
    # change window to 'today', 'week', or 'month'
    main(window="week")
