export interface StatCategory {
  id: string;
  leaderCategory: string;
  label: string;
  group: "hitting" | "pitching";
  /** Rate stats need the "qualified" minimum PA/IP filter to avoid small-sample outliers. */
  qualified: boolean;
}

export const STAT_CATEGORIES: StatCategory[] = [
  { id: "hr", leaderCategory: "homeRuns", label: "Home Runs", group: "hitting", qualified: false },
  { id: "hits", leaderCategory: "hits", label: "Hits", group: "hitting", qualified: false },
  { id: "rbi", leaderCategory: "runsBattedIn", label: "RBI", group: "hitting", qualified: false },
  { id: "avg", leaderCategory: "battingAverage", label: "Batting Average", group: "hitting", qualified: true },
  { id: "obp", leaderCategory: "onBasePercentage", label: "On-Base %", group: "hitting", qualified: true },
  { id: "slg", leaderCategory: "sluggingPercentage", label: "Slugging %", group: "hitting", qualified: true },
  { id: "ops", leaderCategory: "onBasePlusSlugging", label: "OPS", group: "hitting", qualified: true },
  { id: "sb", leaderCategory: "stolenBases", label: "Stolen Bases", group: "hitting", qualified: false },
  { id: "era", leaderCategory: "earnedRunAverage", label: "ERA", group: "pitching", qualified: true },
  { id: "wins", leaderCategory: "wins", label: "Wins", group: "pitching", qualified: false },
  { id: "so", leaderCategory: "strikeouts", label: "Strikeouts", group: "pitching", qualified: false },
  { id: "saves", leaderCategory: "saves", label: "Saves", group: "pitching", qualified: false },
  { id: "whip", leaderCategory: "walksAndHitsPerInningPitched", label: "WHIP", group: "pitching", qualified: true },
];
