import type { ActiveQuery } from "../storage/activeQuery";
import type { Team } from "../types/mlb";
import { STAT_CATEGORIES } from "../data/statCategories";

export function describeQuery(query: ActiveQuery | null, teams: Team[]): string {
  if (!query) return "Untitled list";

  if (query.kind === "team") {
    if (query.teamId === "all") return `All Teams ${query.season}`;
    const team = teams.find((t) => t.id === query.teamId);
    return `${team?.name ?? "Team"} ${query.season}`;
  }

  const stat = STAT_CATEGORIES.find((s) => s.id === query.statCategoryId);
  const scopeLabel = query.scope === "career" ? "Career" : String(query.season);
  return `${scopeLabel} ${stat?.label ?? "Stat"} Leaders`;
}
