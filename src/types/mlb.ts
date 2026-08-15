export interface Team {
  id: number;
  name: string;
  teamName: string;
  abbreviation: string;
  locationName: string;
}

export interface PoolPlayer {
  id: number;
  fullName: string;
  positionAbbreviation?: string;
  statLabel?: string;
  statValue?: string;
}

export function headshotUrl(playerId: number): string {
  return `https://img.mlbstatic.com/mlb-photos/image/upload/w_180,q_100/v1/people/${playerId}/headshot/67/current`;
}

export function teamLogoUrl(teamId: number): string {
  return `https://www.mlbstatic.com/team-logos/${teamId}.svg`;
}
