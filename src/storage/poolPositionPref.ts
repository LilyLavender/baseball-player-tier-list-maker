export type PoolPosition = "auto" | "rail" | "drawer";

const STORAGE_KEY = "mlb-tier-list:pool-position";
const VALID_POSITIONS: PoolPosition[] = ["auto", "rail", "drawer"];

export function loadPoolPositionPref(): PoolPosition {
  const stored = localStorage.getItem(STORAGE_KEY);
  return VALID_POSITIONS.includes(stored as PoolPosition) ? (stored as PoolPosition) : "auto";
}

export function savePoolPositionPref(position: PoolPosition): void {
  localStorage.setItem(STORAGE_KEY, position);
}
