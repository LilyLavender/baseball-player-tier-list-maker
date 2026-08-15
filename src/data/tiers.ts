export interface TierDefinition {
  label: string;
  color: string;
}

export const DEFAULT_TIERS: TierDefinition[] = [
  { label: "S", color: "#b03a2e" },
  { label: "A", color: "#c08552" },
  { label: "B", color: "#1b4332" },
  { label: "C", color: "#2f6f4e" },
  { label: "D", color: "#4a5568" },
  { label: "F", color: "#14213d" },
];
