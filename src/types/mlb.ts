export interface Team {
  id: number;
  name: string;
  teamName: string;
  abbreviation: string;
  locationName: string;
  divisionName?: string;
  leagueName?: string;
}

export type PositionType = "hitter" | "pitcher";

export interface PoolPlayer {
  id: number;
  fullName: string;
  positionAbbreviation?: string;
  positionType?: PositionType;
  statLabel?: string;
  statValue?: string;
  /** Season this player was pulled in for, used to try a period-accurate portrait. */
  season?: number;
  teamId?: number;
  teamAbbreviation?: string;
  /** Fetched on demand for the pool's country-of-birth filter, not present on initial load. */
  birthCountry?: string;
}

/**
 * MLB's photo host sometimes has a portrait for a specific season (e.g. the team/uniform a
 * player wore that year); pass `season` to try that first. Not every season has a stored photo,
 * so callers should fall back to the "current" portrait (season omitted) on a failed load.
 */
export function headshotUrl(playerId: number, season?: number): string {
  const variant = season ?? "current";
  return `https://img.mlbstatic.com/mlb-photos/image/upload/w_180,q_100/v1/people/${playerId}/headshot/67/${variant}`;
}

export function teamLogoUrl(teamId: number): string {
  return `https://www.mlbstatic.com/team-logos/${teamId}.svg`;
}
