const STORAGE_KEY = "mlb-tier-list:autotier-pref";

export interface AutoTierPrefState {
  strategy: "interval" | "per-unit" | "auto-grouping" | "thresholds";
  intervalSize: number;
  showEmptyTiers: boolean;
  thresholds: string;
  scheme: "sf" | "sf-plus-minus" | "custom";
}

const DEFAULT_PREF: AutoTierPrefState = {
  strategy: "interval",
  intervalSize: 10,
  showEmptyTiers: false,
  thresholds: "",
  scheme: "sf",
};

export function loadAutoTierPref(): AutoTierPrefState {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (!stored) return { ...DEFAULT_PREF };
  try {
    return { ...DEFAULT_PREF, ...JSON.parse(stored) };
  } catch {
    return { ...DEFAULT_PREF };
  }
}

export function saveAutoTierPref(pref: AutoTierPrefState): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(pref));
}
