/**
 * Preset tier colors: a full sweep around the hue wheel at a fixed saturation and lightness, so
 * every swatch reads as equally vivid and only the hue changes.
 */
export const TIER_COLOR_PALETTE: string[] = [
  "#b81e1e",
  "#b86b1e",
  "#b8b81e",
  "#6bb81e",
  "#1eb81e",
  "#1eb86b",
  "#1eb8b8",
  "#1e6bb8",
  "#1e1eb8",
  "#6b1eb8",
  "#b81eb8",
  "#b81e6b",
];

/** Saturation/lightness shared by every preset swatch above, so any hue can be matched against it. */
export const TIER_COLOR_SATURATION = 72;
export const TIER_COLOR_LIGHTNESS = 42;

export function tierHueColor(hue: number): string {
  return `hsl(${((hue % 360) + 360) % 360}, ${TIER_COLOR_SATURATION}%, ${TIER_COLOR_LIGHTNESS}%)`;
}
