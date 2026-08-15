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

export async function fetchTeams(): Promise<Team[]> {
  const data = await getJson<TeamsResponse>("/teams?sportId=1");
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
  }));
}

interface StatLeadersResponse {
  leagueLeaders: Array<{
    leaders: Array<{
      value: string;
      person: { id: number; fullName: string };
    }>;
  }>;
}

export async function fetchStatLeaders(
  leaderCategory: string,
  statGroup: "hitting" | "pitching",
  qualified: boolean,
  statLabel: string,
  season: number,
  limit: number,
): Promise<PoolPlayer[]> {
  const qualifierParam = qualified ? "&playerPool=Qualified" : "";
  const data = await getJson<StatLeadersResponse>(
    `/stats/leaders?leaderCategories=${leaderCategory}&season=${season}&sportId=1&limit=${limit}` +
      `&statGroup=${statGroup}${qualifierParam}`,
  );
  const leaders = data.leagueLeaders[0]?.leaders ?? [];
  return leaders.map((entry) => ({
    id: entry.person.id,
    fullName: entry.person.fullName,
    statLabel,
    statValue: entry.value,
  }));
}
