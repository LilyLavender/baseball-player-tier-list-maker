import type { PositionType } from "../types/mlb";

export function classifyPosition(positionAbbreviation: string | undefined): PositionType | undefined {
  if (!positionAbbreviation) return undefined;
  return positionAbbreviation === "P" ? "pitcher" : "hitter";
}
