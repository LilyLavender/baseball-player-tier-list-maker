export interface Team {
  id: number;
  name: string;
  teamName: string;
  abbreviation: string;
  locationName: string;
}

export interface RosterPlayer {
  id: number;
  fullName: string;
  jerseyNumber: string;
  positionName: string;
  positionAbbreviation: string;
}

export function headshotUrl(playerId: number): string {
  return `https://img.mlbstatic.com/mlb-photos/image/upload/w_180,q_100/v1/people/${playerId}/headshot/67/current`;
}
