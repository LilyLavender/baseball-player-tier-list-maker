import type { RosterPlayer } from "../types/mlb";

const STORAGE_KEY = "mlb-tier-list:active";

export interface ActiveListState {
  query: { teamId: number; season: number } | null;
  players: RosterPlayer[];
  poolPlayerIds: number[];
  tierPlayerIds: number[][];
}

export function saveActiveList(state: ActiveListState): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

export function loadActiveList(): ActiveListState | null {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return null;

  try {
    return JSON.parse(raw) as ActiveListState;
  } catch {
    return null;
  }
}
