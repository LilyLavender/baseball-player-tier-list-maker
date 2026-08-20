export type ThemeName = "light" | "dark";

const STORAGE_KEY = "mlb-tier-list:theme";
const VALID_THEMES: ThemeName[] = ["light", "dark"];

export function loadThemePref(): ThemeName {
  const stored = localStorage.getItem(STORAGE_KEY);
  return VALID_THEMES.includes(stored as ThemeName) ? (stored as ThemeName) : "light";
}

export function saveThemePref(theme: ThemeName): void {
  localStorage.setItem(STORAGE_KEY, theme);
}

export function applyTheme(theme: ThemeName): void {
  if (theme === "dark") {
    document.documentElement.setAttribute("data-theme", "dark");
  } else {
    document.documentElement.removeAttribute("data-theme");
  }
}
