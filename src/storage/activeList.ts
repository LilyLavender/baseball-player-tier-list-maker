import type { PoolPlayer } from "../types/mlb";

const STORAGE_KEY = "mlb-tier-list:active";

export type ActiveQuery =
  | { kind: "team"; teamId: number; season: number }
  | { kind: "stat"; statCategoryId: string; season: number; limit: number };

export interface ActiveListState {
  query: ActiveQuery | null;
  players: PoolPlayer[];
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
