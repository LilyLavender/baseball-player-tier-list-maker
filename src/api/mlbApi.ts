import type { PoolPlayer, Team } from "../types/mlb";

const BASE_URL = "https://statsapi.mlb.com/api/v1";

async function getJson<T>(path: string): Promise<T> {
  const response = await fetch(`${BASE_URL}${path}`);
  if (!response.ok) {
    throw new Error(`MLB API request failed (${response.status}): ${path}`);
  }
  return response.json() as Promise<T>;
}

interface TeamsResponse {
  teams: Array<{
    id: number;
    name: string;
    teamName: string;
    abbreviation: string;
    locationName: string;
  }>;
}

export async function fetchTeams(season?: number): Promise<Team[]> {
  const seasonParam = season ? `&season=${season}` : "";
  const data = await getJson<TeamsResponse>(`/teams?sportId=1${seasonParam}`);
  return data.teams.map((team) => ({
    id: team.id,
    name: team.name,
    teamName: team.teamName,
    abbreviation: team.abbreviation,
    locationName: team.locationName,
  }));
}

interface RosterResponse {
  roster: Array<{
    person: { id: number; fullName: string };
    position: { abbreviation: string };
  }>;
}

export async function fetchRoster(teamId: number, season: number): Promise<PoolPlayer[]> {
  const data = await getJson<RosterResponse>(
    `/teams/${teamId}/roster?season=${season}&rosterType=fullSeason`,
  );
  return data.roster.map((entry) => ({
    id: entry.person.id,
    fullName: entry.person.fullName,
    positionAbbreviation: entry.position.abbreviation,
    season,
  }));
}

interface StatSplitsResponse {
  stats: Array<{
    splits: Array<{
      player: { id: number; fullName: string };
      stat: Record<string, string | number>;
    }>;
  }>;
}

export async function fetchStatLeaders(
  sortStat: string,
  statKey: string,
  statGroup: "hitting" | "pitching",
  order: "asc" | "desc",
  qualified: boolean,
  statLabel: string,
  season: number,
  limit: number,
): Promise<PoolPlayer[]> {
  const qualifierParam = qualified ? "&playerPool=Qualified" : "";
  const data = await getJson<StatSplitsResponse>(
    `/stats?stats=season&group=${statGroup}&season=${season}&sportId=1&limit=${limit}` +
      `&sortStat=${sortStat}&order=${order}${qualifierParam}`,
  );
  const splits = data.stats[0]?.splits ?? [];
  return splits.map((entry) => ({
    id: entry.player.id,
    fullName: entry.player.fullName,
    statLabel,
    statValue: String(entry.stat[statKey] ?? ""),
    season,
  }));
}
