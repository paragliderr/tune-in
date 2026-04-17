import requests
import time
from datetime import datetime, timezone
from typing import Optional, Dict, Any, List

# ── Scoring constants ────────────────────────────────────────────────────────
POINTS_PER_HOUR_PLAYED   = 5.0
POINTS_PER_GAME_OWNED    = 2.0
POINTS_PER_ACHIEVEMENT   = 8.0
POINTS_PER_RECENT_GAME   = 10.0
POINTS_PER_BADGE         = 12.0
POINTS_PER_FRIEND        = 1.0
POINTS_PER_STEAM_LEVEL   = 25.0
VARIETY_BONUS            = 50     # bonus for playing 3+ different games recently
PLAYTIME_CAP_HRS         = 200    # cap per-game contribution to score


class SteamService:
    BASE     = "https://api.steampowered.com"
    STORE    = "https://store.steampowered.com/api"

    def __init__(self, api_key: str, steam_id: str):
        self.api_key  = api_key.strip() if api_key else ""
        self.steam_id = steam_id.strip() if steam_id else ""
        self.session  = requests.Session()
        self.session.headers.update({"User-Agent": "SteamService/1.0"})

    # ── Internal helpers ─────────────────────────────────────────────────────

    def _get(self, url: str, params: Optional[Dict] = None, label: str = "") -> Optional[Any]:
        """GET with rate-limit retry. Returns parsed JSON or None on failure."""
        params = params or {}
        for attempt in range(3):
            try:
                r = self.session.get(url, params=params, timeout=15)
                if r.status_code == 403:
                    print(f"  [private] {label}: profile or game stats are private")
                    return None
                if r.status_code == 429:
                    print(f"  [rate-limit] waiting 5s before retry ({label})")
                    time.sleep(5)
                    continue
                r.raise_for_status()
                return r.json()
            except Exception as e:
                print(f"  [error] {label}: {e}")
                time.sleep(2)
        return None

    def _steam(self, interface: str, method: str, version: str,
               extra: Optional[Dict] = None) -> Optional[Any]:
        """Convenience wrapper for api.steampowered.com endpoints."""
        params = {
            "key":     self.api_key,
            "steamid": self.steam_id,
            "format":  "json",
        }
        if extra:
            params.update(extra)
        url = f"{self.BASE}/{interface}/{method}/{version}/"
        return self._get(url, params, label=f"{interface}/{method}")

    # ── Data fetchers ────────────────────────────────────────────────────────

    def fetch_player_summary(self) -> Dict:
        print("[1] Fetching player summary...")
        res = self._steam("ISteamUser", "GetPlayerSummaries", "v0002",
                          {"steamids": self.steam_id})
        players = res.get("response", {}).get("players", []) if res else []
        return players[0] if players else {}

    def fetch_friends(self) -> List[Dict]:
        print("[2] Fetching friends list...")
        res = self._steam("ISteamUser", "GetFriendList", "v0001",
                          {"relationship": "friend"})
        return res.get("friendslist", {}).get("friends", []) if res else []

    def fetch_bans(self) -> Dict:
        print("[3] Fetching ban info...")
        url = f"{self.BASE}/ISteamUser/GetPlayerBans/v1/"
        res = self._get(url, {"key": self.api_key, "steamids": self.steam_id}, "bans")
        players = res.get("players", []) if res else []
        return players[0] if players else {}

    def fetch_owned_games(self) -> List[Dict]:
        print("[4] Fetching owned games...")
        res = self._steam("IPlayerService", "GetOwnedGames", "v0001", {
            "include_appinfo": 1,
            "include_played_free_games": 1,
        })
        return res.get("response", {}).get("games", []) if res else []

    def fetch_recently_played(self, count: int = 20) -> List[Dict]:
        print("[5] Fetching recently played games...")
        res = self._steam("IPlayerService", "GetRecentlyPlayedGames", "v0001",
                          {"count": count})
        return res.get("response", {}).get("games", []) if res else []

    def fetch_achievements_for_games(self, games: List[Dict],
                                     max_games: int = 20) -> Dict:
        print(f"[6] Fetching achievements for up to {max_games} most-played games...")
        results: Dict[int, Dict] = {}
        top = sorted(games, key=lambda g: g.get("playtime_forever", 0),
                     reverse=True)[:max_games]
        for game in top:
            app_id = game.get("appid")
            name   = game.get("name", str(app_id))
            url    = f"{self.BASE}/ISteamUserStats/GetPlayerAchievements/v0001/"
            res    = self._get(url, {
                "key": self.api_key, "steamid": self.steam_id,
                "appid": app_id, "l": "en",
            }, f"achievements/{app_id}")
            if res and res.get("playerstats", {}).get("achievements"):
                stats    = res["playerstats"]
                achieved = [a for a in stats["achievements"] if a.get("achieved")]
                results[app_id] = {
                    "name":     name,
                    "total":    len(stats["achievements"]),
                    "achieved": len(achieved),
                    "list":     stats["achievements"],
                }
                print(f"    {name}: {len(achieved)}/{len(stats['achievements'])}")
            time.sleep(0.3)
        return results

    def fetch_stats_for_games(self, games: List[Dict],
                              max_games: int = 10) -> Dict:
        print(f"[7] Fetching user stats for up to {max_games} most-played games...")
        results: Dict[int, Dict] = {}
        top = sorted(games, key=lambda g: g.get("playtime_forever", 0),
                     reverse=True)[:max_games]
        for game in top:
            app_id = game.get("appid")
            name   = game.get("name", str(app_id))
            url    = f"{self.BASE}/ISteamUserStats/GetUserStatsForGame/v0002/"
            res    = self._get(url, {
                "key": self.api_key, "steamid": self.steam_id, "appid": app_id,
            }, f"stats/{app_id}")
            if res and res.get("playerstats", {}).get("stats"):
                results[app_id] = {
                    "name":  name,
                    "stats": res["playerstats"]["stats"],
                }
            time.sleep(0.3)
        return results

    def fetch_level(self) -> Optional[int]:
        print("[8] Fetching Steam level...")
        res = self._steam("IPlayerService", "GetSteamLevel", "v1")
        return res.get("response", {}).get("player_level") if res else None

    def fetch_badges(self) -> Dict:
        print("[9] Fetching badges...")
        res = self._steam("IPlayerService", "GetBadges", "v1")
        return res.get("response", {}) if res else {}

    def fetch_store_details(self, games: List[Dict],
                            max_games: int = 10) -> Dict:
        print(f"[10] Fetching store details for up to {max_games} most-played games...")
        results: Dict[int, Dict] = {}
        top = sorted(games, key=lambda g: g.get("playtime_forever", 0),
                     reverse=True)[:max_games]
        for game in top:
            app_id = game.get("appid")
            name   = game.get("name", str(app_id))
            url    = f"{self.STORE}/appdetails"
            res    = self._get(url, {"appids": app_id, "cc": "us", "l": "en"},
                               f"store/{app_id}")
            if res and res.get(str(app_id), {}).get("success"):
                results[app_id] = res[str(app_id)]["data"]
                print(f"    {name}: ok")
            time.sleep(0.5)
        return results

    # ── Main public entry point ──────────────────────────────────────────────

    def get_user_data(self) -> Dict:
        """
        Fetch all available Steam data for the configured user and return a
        structured dict that mirrors the shape of GitHubService.get_user_data().
        """
        profile      = self.fetch_player_summary()
        friends      = self.fetch_friends()
        bans         = self.fetch_bans()
        owned_games  = self.fetch_owned_games()
        recent_games = self.fetch_recently_played()
        achievements = self.fetch_achievements_for_games(owned_games)
        game_stats   = self.fetch_stats_for_games(owned_games)
        level        = self.fetch_level()
        badges       = self.fetch_badges()
        store        = self.fetch_store_details(owned_games)

        summary = self._build_summary(profile, owned_games, recent_games,
                                      achievements, badges, level, friends)
        score   = self.compute_score({
            "owned_games":   owned_games,
            "recent_games":  recent_games,
            "achievements":  achievements,
            "badges":        badges,
            "level":         level,
            "friends":       friends,
        })

        return {
            "steam_id":        self.steam_id,
            "summary":         summary,
            "score":           score,
            "profile":         profile,
            "bans":            bans,
            "friends":         friends,
            "steam_level":     level,
            "badges":          badges,
            "owned_games":     owned_games,
            "recently_played": recent_games,
            "achievements_by_game": achievements,
            "stats_by_game":   game_stats,
            "store_details":   store,
            "fetched_at":      datetime.now(timezone.utc).isoformat(),
        }

    # ── Score computation ────────────────────────────────────────────────────

    def compute_score(self, data: Dict) -> Dict:
        """
        Compute a gamified score from Steam activity, structured exactly like
        GitHubService.compute_score() — returns total + breakdown dict.
        """
        owned_games  = data.get("owned_games", [])
        recent_games = data.get("recent_games", [])
        achievements = data.get("achievements", {})
        badges       = data.get("badges", {})
        level        = data.get("level") or 0
        friends      = data.get("friends", [])

        playtime_points  = self._compute_playtime_points(owned_games)
        ownership_points = len(owned_games) * POINTS_PER_GAME_OWNED
        achievement_pts  = self._compute_achievement_points(achievements)
        recent_points    = len(recent_games) * POINTS_PER_RECENT_GAME
        badge_points     = badges.get("badge_count", 0) * POINTS_PER_BADGE
        level_points     = level * POINTS_PER_STEAM_LEVEL
        friend_points    = min(len(friends), 50) * POINTS_PER_FRIEND  # cap at 50

        variety_bonus = VARIETY_BONUS if len(recent_games) >= 3 else 0

        total = (playtime_points + ownership_points + achievement_pts +
                 recent_points + badge_points + level_points +
                 friend_points + variety_bonus)

        return {
            "total_score": round(total, 1),
            "breakdown": {
                "playtime_points":   round(playtime_points, 1),
                "ownership_points":  round(ownership_points, 1),
                "achievement_points": round(achievement_pts, 1),
                "recent_play_points": round(recent_points, 1),
                "badge_points":      round(badge_points, 1),
                "level_points":      round(level_points, 1),
                "friend_points":     round(friend_points, 1),
                "variety_bonus":     variety_bonus,
            }
        }

    # ── Private helpers ──────────────────────────────────────────────────────

    def _build_summary(self, profile: Dict, owned_games: List[Dict],
                       recent_games: List[Dict], achievements: Dict,
                       badges: Dict, level: Optional[int],
                       friends: List[Dict]) -> Dict:
        total_hrs   = sum(g.get("playtime_forever", 0) for g in owned_games) / 60
        top_5       = sorted(owned_games,
                             key=lambda g: g.get("playtime_forever", 0),
                             reverse=True)[:5]
        total_ach   = sum(v.get("achieved", 0) for v in achievements.values())

        return {
            "display_name":       profile.get("personaname"),
            "profile_url":        profile.get("profileurl"),
            "avatar":             profile.get("avatarfull"),
            "country":            profile.get("loccountrycode"),
            "steam_level":        level,
            "total_games":        len(owned_games),
            "total_playtime_hrs": round(total_hrs, 1),
            "total_badges":       badges.get("badge_count", 0),
            "total_achievements": total_ach,
            "xp":                 badges.get("player_xp", 0),
            "xp_needed":          badges.get("player_xp_needed_to_level_up", 0),
            "friend_count":       len(friends),
            "recent_game_count":  len(recent_games),
            "top_5_games": [
                {
                    "name":         g.get("name"),
                    "appid":        g.get("appid"),
                    "playtime_hrs": round(g.get("playtime_forever", 0) / 60, 1),
                }
                for g in top_5
            ],
        }

    def _compute_playtime_points(self, owned_games: List[Dict]) -> float:
        """Award points per hour played, capped per game to discourage single-game grinding."""
        total = 0.0
        for game in owned_games:
            hrs = game.get("playtime_forever", 0) / 60
            total += min(hrs, PLAYTIME_CAP_HRS) * POINTS_PER_HOUR_PLAYED
        return total

    def _compute_achievement_points(self, achievements: Dict) -> float:
        """Sum up points for every achievement unlocked across all games."""
        total_achieved = sum(v.get("achieved", 0) for v in achievements.values())
        return total_achieved * POINTS_PER_ACHIEVEMENT