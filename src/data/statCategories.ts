export interface StatCategory {
  id: string;
  /** Param sent to the MLB Stats API's sortStat. */
  sortStat: string;
  /** Key of the value within the API response's per-player `stat` object. */
  statKey: string;
  label: string;
  group: "hitting" | "pitching";
  order: "asc" | "desc";
  /** Rate stats need the "qualified" minimum PA/IP filter to avoid small-sample outliers. */
  qualified: boolean;
}

export interface Qualifier {
  key: string;
  label: string;
}

export function qualifierFor(group: "hitting" | "pitching"): Qualifier {
  return group === "pitching"
    ? { key: "inningsPitched", label: "Innings Pitched" }
    : { key: "plateAppearances", label: "Plate Appearances" };
}

export const STAT_CATEGORIES: StatCategory[] = [
  // Hitting
  { id: "hr", sortStat: "homeRuns", statKey: "homeRuns", label: "Home Runs", group: "hitting", order: "desc", qualified: false },
  { id: "hits", sortStat: "hits", statKey: "hits", label: "Hits", group: "hitting", order: "desc", qualified: false },
  { id: "doubles", sortStat: "doubles", statKey: "doubles", label: "Doubles", group: "hitting", order: "desc", qualified: false },
  { id: "triples", sortStat: "triples", statKey: "triples", label: "Triples", group: "hitting", order: "desc", qualified: false },
  { id: "total-bases", sortStat: "totalBases", statKey: "totalBases", label: "Total Bases", group: "hitting", order: "desc", qualified: false },
  { id: "rbi", sortStat: "rbi", statKey: "rbi", label: "RBI", group: "hitting", order: "desc", qualified: false },
  { id: "runs", sortStat: "runs", statKey: "runs", label: "Runs Scored", group: "hitting", order: "desc", qualified: false },
  { id: "avg", sortStat: "battingAverage", statKey: "avg", label: "Batting Average", group: "hitting", order: "desc", qualified: true },
  { id: "obp", sortStat: "onBasePercentage", statKey: "obp", label: "On-Base %", group: "hitting", order: "desc", qualified: true },
  { id: "slg", sortStat: "sluggingPercentage", statKey: "slg", label: "Slugging %", group: "hitting", order: "desc", qualified: true },
  { id: "ops", sortStat: "onBasePlusSlugging", statKey: "ops", label: "OPS", group: "hitting", order: "desc", qualified: true },
  { id: "sb", sortStat: "stolenBases", statKey: "stolenBases", label: "Stolen Bases", group: "hitting", order: "desc", qualified: false },
  { id: "cs", sortStat: "caughtStealing", statKey: "caughtStealing", label: "Caught Stealing", group: "hitting", order: "desc", qualified: false },
  { id: "bb-hit", sortStat: "baseOnBalls", statKey: "baseOnBalls", label: "Walks", group: "hitting", order: "desc", qualified: false },
  { id: "so-hit", sortStat: "strikeouts", statKey: "strikeOuts", label: "Strikeouts (Batting)", group: "hitting", order: "desc", qualified: false },
  { id: "sf", sortStat: "sacrificeFlies", statKey: "sacFlies", label: "Sacrifice Flies", group: "hitting", order: "desc", qualified: false },
  { id: "gidp", sortStat: "groundIntoDoublePlay", statKey: "groundIntoDoublePlay", label: "Grounded Into Double Play", group: "hitting", order: "desc", qualified: false },
  { id: "games-hit", sortStat: "gamesPlayed", statKey: "gamesPlayed", label: "Games Played", group: "hitting", order: "desc", qualified: false },

  // Pitching
  { id: "era", sortStat: "earnedRunAverage", statKey: "era", label: "ERA", group: "pitching", order: "asc", qualified: true },
  { id: "wins", sortStat: "wins", statKey: "wins", label: "Wins", group: "pitching", order: "desc", qualified: false },
  { id: "losses", sortStat: "losses", statKey: "losses", label: "Losses", group: "pitching", order: "desc", qualified: false },
  { id: "so-pitch", sortStat: "strikeouts", statKey: "strikeOuts", label: "Strikeouts", group: "pitching", order: "desc", qualified: false },
  { id: "saves", sortStat: "saves", statKey: "saves", label: "Saves", group: "pitching", order: "desc", qualified: false },
  { id: "holds", sortStat: "holds", statKey: "holds", label: "Holds", group: "pitching", order: "desc", qualified: false },
  { id: "blown-saves", sortStat: "blownSaves", statKey: "blownSaves", label: "Blown Saves", group: "pitching", order: "desc", qualified: false },
  { id: "whip", sortStat: "walksAndHitsPerInningPitched", statKey: "whip", label: "WHIP", group: "pitching", order: "asc", qualified: true },
  { id: "bb-pitch", sortStat: "baseOnBalls", statKey: "baseOnBalls", label: "Walks Allowed", group: "pitching", order: "desc", qualified: false },
  { id: "ip", sortStat: "inningsPitched", statKey: "inningsPitched", label: "Innings Pitched", group: "pitching", order: "desc", qualified: false },
  { id: "games-pitch", sortStat: "gamesPlayed", statKey: "gamesPlayed", label: "Games Played", group: "pitching", order: "desc", qualified: false },
  { id: "games-started", sortStat: "gamesStarted", statKey: "gamesStarted", label: "Games Started", group: "pitching", order: "desc", qualified: false },
  { id: "complete-games", sortStat: "completeGames", statKey: "completeGames", label: "Complete Games", group: "pitching", order: "desc", qualified: false },
  { id: "shutouts", sortStat: "shutouts", statKey: "shutouts", label: "Shutouts", group: "pitching", order: "desc", qualified: false },
  { id: "hbp", sortStat: "hitBatsmen", statKey: "hitBatsmen", label: "Hit Batsmen", group: "pitching", order: "desc", qualified: false },
];
