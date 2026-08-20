const STORAGE_KEY = "mlb-tier-list:show-stat-badges";

export function loadStatBadgePref(): boolean {
  const stored = localStorage.getItem(STORAGE_KEY);
  return stored === null ? true : stored === "true";
}

export function saveStatBadgePref(show: boolean): void {
  localStorage.setItem(STORAGE_KEY, String(show));
}

export function applyStatBadgePref(show: boolean): void {
  document.documentElement.classList.toggle("hide-stat-badges", !show);
}
