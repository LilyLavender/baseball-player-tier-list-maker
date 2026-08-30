export interface TierDefinition {
  label: string;
  color: string;
}

/** Goes the long way around the hue wheel from red to blue (through orange/yellow/green/cyan). */
export const DEFAULT_TIERS: TierDefinition[] = [
  { label: "S", color: "#b81e1e" },
  { label: "A", color: "#b8991e" },
  { label: "B", color: "#5cb81e" },
  { label: "C", color: "#1eb85c" },
  { label: "D", color: "#1e99b8" },
  { label: "F", color: "#1e1eb8" },
];

export function cloneDefaultTiers(): TierDefinition[] {
  return DEFAULT_TIERS.map((tier) => ({ ...tier }));
}
