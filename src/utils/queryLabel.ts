import type { ActiveQuery } from "../storage/activeQuery";
import type { Team } from "../types/mlb";
import { STAT_CATEGORIES } from "../data/statCategories";

export function describeQuery(query: ActiveQuery | null, teams: Team[]): string {
  if (!query) return "Untitled list";

  if (query.kind === "team") {
    const team = teams.find((t) => t.id === query.teamId);
    return `${team?.name ?? "Team"} ${query.season}`;
  }

  const stat = STAT_CATEGORIES.find((s) => s.id === query.statCategoryId);
  return `${query.season} ${stat?.label ?? "Stat"} Leaders`;
}
