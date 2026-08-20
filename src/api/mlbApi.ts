import { classifyPosition } from "../data/positions";
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
    division?: { name: string };
    league?: { name: string };
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
    divisionName: team.division?.name,
    leagueName: team.league?.name,
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
    positionType: classifyPosition(entry.position.abbreviation),
    season,
    teamId,
  }));
}

interface PeopleSearchResponse {
  people: Array<{ id: number; fullName: string }>;
}

export async function searchPlayers(query: string): Promise<PoolPlayer[]> {
  const trimmed = query.trim();
  if (trimmed.length < 2) return [];

  const data = await getJson<PeopleSearchResponse>(`/people/search?names=${encodeURIComponent(trimmed)}`);
  return data.people.map((person) => ({
    id: person.id,
    fullName: person.fullName,
  }));
}

export async function fetchAllTeamsRoster(season: number): Promise<PoolPlayer[]> {
  const teams = await fetchTeams(season);
  const rosters = await Promise.all(teams.map((team) => fetchRoster(team.id, season)));

  const byId = new Map<number, PoolPlayer>();
  for (const roster of rosters) {
    for (const player of roster) {
      if (!byId.has(player.id)) byId.set(player.id, player);
    }
  }
  return Array.from(byId.values());
}

interface StatSplitsResponse {
  stats: Array<{
    splits: Array<{
      player: { id: number; fullName: string };
      team?: { id: number; name: string };
      position?: { abbreviation: string };
      stat: Record<string, string | number>;
    }>;
  }>;
}

export interface StatLeadersQuery {
  sortStat: string;
  statKey: string;
  statGroup: "hitting" | "pitching";
  order: "asc" | "desc";
  statLabel: string;
  /** Single-season query when set; omit for a career-aggregate query. */
  season?: number;
  limit: number;
  /** Use MLB's official qualified-player minimum (PA/IP threshold). */
  qualified: boolean;
  /** Only include players whose sort-stat value is at least this. */
  minValue?: number;
  /** Secondary field to filter on, e.g. inningsPitched or plateAppearances. */
  qualifierKey?: string;
  minQualifierValue?: number;
}

/**
 * When filtering by a minimum, fetch a much larger batch first so the limit doesn't truncate
 * qualifiers before filtering. The API caps results at 1000 regardless of what's requested, so
 * that's the effective ceiling.
 */
const FILTERED_FETCH_SIZE = 1000;

export async function fetchStatLeaders(query: StatLeadersQuery): Promise<PoolPlayer[]> {
  const qualifierParam = query.qualified ? "&playerPool=Qualified" : "";
  const statsType = query.season !== undefined ? "season" : "career";
  const seasonParam = query.season !== undefined ? `&season=${query.season}` : "";
  const hasMinFilter = query.minValue !== undefined || query.minQualifierValue !== undefined;
  const fetchLimit = hasMinFilter ? Math.max(query.limit, FILTERED_FETCH_SIZE) : query.limit;

  const data = await getJson<StatSplitsResponse>(
    `/stats?stats=${statsType}&group=${query.statGroup}${seasonParam}&sportId=1&limit=${fetchLimit}` +
      `&sortStat=${query.sortStat}&order=${query.order}${qualifierParam}`,
  );
  let splits = data.stats[0]?.splits ?? [];

  if (query.minValue !== undefined) {
    const min = query.minValue;
    splits = splits.filter((entry) => parseFloat(String(entry.stat[query.statKey])) >= min);
  }
  if (query.qualifierKey && query.minQualifierValue !== undefined) {
    const key = query.qualifierKey;
    const min = query.minQualifierValue;
    splits = splits.filter((entry) => parseFloat(String(entry.stat[key])) >= min);
  }

  splits = splits.slice(0, query.limit);

  return splits.map((entry) => ({
    id: entry.player.id,
    fullName: entry.player.fullName,
    positionAbbreviation: entry.position?.abbreviation,
    positionType: classifyPosition(entry.position?.abbreviation),
    statLabel: query.statLabel,
    statValue: String(entry.stat[query.statKey] ?? ""),
    season: query.season,
    teamId: entry.team?.id,
  }));
}

/**
 * Fetches season stat values for every player on one team, for the pool's on-demand stat-threshold
 * filter (works on players regardless of how they entered the pool, not just stat-leader queries).
 */
export async function fetchTeamSeasonStats(
  teamId: number,
  season: number,
  group: "hitting" | "pitching",
  qualified = false,
): Promise<Map<number, Record<string, string | number>>> {
  const qualifierParam = qualified ? "&playerPool=Qualified" : "";
  const data = await getJson<StatSplitsResponse>(
    `/stats?stats=season&group=${group}&season=${season}&sportId=1&teamId=${teamId}&limit=100` +
      `&sortStat=gamesPlayed&order=desc${qualifierParam}`,
  );
  const splits = data.stats[0]?.splits ?? [];
  const byPlayerId = new Map<number, Record<string, string | number>>();
  for (const entry of splits) {
    byPlayerId.set(entry.player.id, entry.stat);
  }
  return byPlayerId;
}

interface PeopleResponse {
  people: Array<{ id: number; birthCountry?: string }>;
}

const PEOPLE_LOOKUP_CHUNK_SIZE = 100;

/** Fetches birth country for a batch of players, for the pool's country-of-birth filter. */
export async function fetchBirthCountries(playerIds: number[]): Promise<Map<number, string>> {
  const result = new Map<number, string>();
  const uniqueIds = Array.from(new Set(playerIds));

  for (let i = 0; i < uniqueIds.length; i += PEOPLE_LOOKUP_CHUNK_SIZE) {
    const chunk = uniqueIds.slice(i, i + PEOPLE_LOOKUP_CHUNK_SIZE);
    const data = await getJson<PeopleResponse>(`/people?personIds=${chunk.join(",")}`);
    for (const person of data.people) {
      if (person.birthCountry) result.set(person.id, person.birthCountry);
    }
  }
  return result;
}

export interface ActivePlayerBirthCountries {
  byPlayerId: Map<number, string>;
  countries: string[];
}

/**
 * Fetches birth country for every currently active MLB player in one request, to pre-fill the
 * pool's country-of-birth filter without waiting on a per-player lookup.
 */
export async function fetchActivePlayerBirthCountries(season: number): Promise<ActivePlayerBirthCountries> {
  const data = await getJson<PeopleResponse>(`/sports/1/players?season=${season}`);
  const byPlayerId = new Map<number, string>();
  const countrySet = new Set<string>();
  for (const person of data.people) {
    if (!person.birthCountry) continue;
    byPlayerId.set(person.id, person.birthCountry);
    countrySet.add(person.birthCountry);
  }
  return { byPlayerId, countries: Array.from(countrySet).sort() };
}
