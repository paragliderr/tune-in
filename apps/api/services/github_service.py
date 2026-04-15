import requests
from datetime import datetime, timezone, timedelta
from typing import Optional, Dict, Any, List

# ── Scoring constants ────
POINTS_PER_COMMIT        = 10
POINTS_PER_LINE_ADDED    = 0.2
POINTS_PER_LINE_DELETED  = 0.1
POINTS_PER_STREAK_DAY    = 20
POINTS_PER_REPO          = 15
CONSISTENCY_BONUS        = 50    
DAILY_LINE_CAP           = 500  

class GitHubService:
    def __init__(self, token: str):
        self.token = token.strip() if token else ""
        self.headers = {
            "Authorization": f"Bearer {self.token}",
            "Accept": "application/vnd.github+json",
            "X-GitHub-Api-Version": "2022-11-28",
        }

    def _get_username(self) -> str:
        url = "https://api.github.com/user"
        response = requests.get(url, headers=self.headers)
        if response.status_code != 200:
            print(f"[GITHUB_SERVICE] Auth failed ({response.status_code}): {response.text}")
            response.raise_for_status()
        return response.json()["login"]

    def _since_until(self, window: str):
        now = datetime.now(timezone.utc)
        until = now.isoformat()

        if window == "today":
            since = now.replace(hour=0, minute=0, second=0, microsecond=0).isoformat()
        elif window == "week":
            since = (now - timedelta(days=7)).isoformat()
        elif window == "month":
            since = (now - timedelta(days=30)).isoformat()
        elif window == "overall":
            since = (now - timedelta(days=365)).isoformat()
        else:
            raise ValueError(f"Invalid window '{window}'")

        return since, until

    def fetch_repos(self) -> list:
        repos = []
        url = "https://api.github.com/user/repos?per_page=100&affiliation=owner,collaborator"
        print(f"[DEBUG] Fetching repos from: {url}")
        while url:
            response = requests.get(url, headers=self.headers)
            response.raise_for_status()
            data = response.json()
            repos.extend(data)
            url = response.links.get("next", {}).get("url")
        print(f"[DEBUG] Found {len(repos)} total repos")
        return repos

    def fetch_commits(self, username: str, repos: list, window: str) -> list:
        since, until = self._since_until(window)
        print(f"[DEBUG] Fetching commits for @{username} between {since} and {until}")
        all_commits = []
        for repo in repos:
            repo_name = repo["full_name"]
            url = f"https://api.github.com/repos/{repo_name}/commits?author={username}&since={since}&until={until}&per_page=100"
            
            repo_commits = 0
            while url:
                response = requests.get(url, headers=self.headers)
                if response.status_code == 409: break
                if response.status_code != 200: break
                    
                data = response.json()
                if not data: break
                for commit in data:
                    all_commits.append({
                        "repo": repo_name,
                        "sha": commit["sha"],
                        "date": commit["commit"]["author"]["date"],
                    })
                    repo_commits += 1
                
                # Cap overall fetch to avoid timing out background tasks
                if window == "overall" and repo_commits >= 100: break
                url = response.links.get("next", {}).get("url")
            
            if repo_commits > 0:
                print(f"  - {repo_name}: {repo_commits} commits found")
        
        print(f"[DEBUG] Total commits across all repos ({window}): {len(all_commits)}")
        return all_commits

    def fetch_commit_stats(self, commits: list) -> list:
        # Deep scan stats (additions/deletions) for a limited number of commits
        # Only do this for the focused weekly window
        print(f"[DEBUG] Deep scanning {len(commits)} commits for line stats...")
        for i, commit in enumerate(commits):
            # Capping deep scan to first 50 commits to avoid rate limits
            if i >= 50:
                commit["additions"] = 0
                commit["deletions"] = 0
                continue

            url = f"https://api.github.com/repos/{commit['repo']}/commits/{commit['sha']}"
            response = requests.get(url, headers=self.headers)
            if response.status_code == 200:
                stats = response.json().get("stats", {})
                commit["additions"] = stats.get("additions", 0)
                commit["deletions"] = stats.get("deletions", 0)
            else:
                commit["additions"] = 0
                commit["deletions"] = 0
        return commits

    def get_user_data(self, window: str = "week") -> dict:
        username = self._get_username()
        repos = self.fetch_repos()
        commits = self.fetch_commits(username, repos, window)
        
        # Only fetch deep stats for non-overall windows to save time
        if window != "overall":
            commits = self.fetch_commit_stats(commits)
        else:
            # For overall, just set defaults to avoid errors
            for c in commits:
                c["additions"] = 0
                c["deletions"] = 0

        commit_dates = sorted(set(c["date"][:10] for c in commits))
        repos_touched = list(set(c["repo"] for c in commits))

        summary = {
            "total_commits": len(commits),
            "total_additions": sum(c["additions"] for c in commits),
            "total_deletions": sum(c["deletions"] for c in commits),
            "unique_days": len(commit_dates),
            "unique_repos": len(repos_touched),
        }

        score_breakdown = self.compute_score({
            "commits": commits,
            "commit_dates": commit_dates,
            "repos_touched": repos_touched,
            "window": window,
            "summary": summary
        })

        return {
            "username": username,
            "window": window,
            "summary": summary,
            "score": score_breakdown,
            "commits": commits,
            "repos_touched": repos_touched,
            "commit_dates": commit_dates,
            "fetched_at": datetime.now(timezone.utc).isoformat()
        }

    def compute_score(self, data: dict) -> dict:
        summary = data["summary"]
        commit_points = summary["total_commits"] * POINTS_PER_COMMIT
        line_points = self._compute_daily_line_points(data["commits"])
        streak_days = self._compute_streak(data["commit_dates"])
        streak_points = streak_days * POINTS_PER_STREAK_DAY
        repo_points = len(data["repos_touched"]) * POINTS_PER_REPO
        
        bonus = CONSISTENCY_BONUS if data["window"] in ("week", "month") and summary["unique_days"] >= 5 else 0
        total = commit_points + line_points + streak_points + repo_points + bonus

        return {
            "total_score": round(total, 1),
            "streak_days": streak_days,
            "breakdown": {
                "commit_points": round(commit_points, 1),
                "line_points": round(line_points, 1),
                "streak_points": round(streak_points, 1),
                "repo_points": round(repo_points, 1),
                "consistency_bonus": bonus,
            }
        }

    def _compute_streak(self, commit_dates: list) -> int:
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

    def _compute_daily_line_points(self, commits: list) -> float:
        daily = {}
        for c in commits:
            day = c["date"][:10]
            pts = (c["additions"] * POINTS_PER_LINE_ADDED + c["deletions"] * POINTS_PER_LINE_DELETED)
            daily[day] = daily.get(day, 0) + pts
        return sum(min(pts, DAILY_LINE_CAP) for pts in daily.values())
