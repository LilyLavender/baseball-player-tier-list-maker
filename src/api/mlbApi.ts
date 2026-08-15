import type { RosterPlayer, Team } from "../types/mlb";

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
    jerseyNumber: string;
    position: { name: string; abbreviation: string };
  }>;
}

export async function fetchRoster(
  teamId: number,
  season: number,
): Promise<RosterPlayer[]> {
  const data = await getJson<RosterResponse>(
    `/teams/${teamId}/roster?season=${season}&rosterType=fullSeason`,
  );
  return data.roster.map((entry) => ({
    id: entry.person.id,
    fullName: entry.person.fullName,
    jerseyNumber: entry.jerseyNumber,
    positionName: entry.position.name,
    positionAbbreviation: entry.position.abbreviation,
  }));
}
