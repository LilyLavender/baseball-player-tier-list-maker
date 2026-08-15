export interface StatCategory {
  id: string;
  leaderCategory: string;
  label: string;
  group: "hitting" | "pitching";
  /** Rate stats need the "qualified" minimum PA/IP filter to avoid small-sample outliers. */
  qualified: boolean;
}

export const STAT_CATEGORIES: StatCategory[] = [
  // Hitting
  { id: "hr", leaderCategory: "homeRuns", label: "Home Runs", group: "hitting", qualified: false },
  { id: "hits", leaderCategory: "hits", label: "Hits", group: "hitting", qualified: false },
  { id: "doubles", leaderCategory: "doubles", label: "Doubles", group: "hitting", qualified: false },
  { id: "triples", leaderCategory: "triples", label: "Triples", group: "hitting", qualified: false },
  { id: "total-bases", leaderCategory: "totalBases", label: "Total Bases", group: "hitting", qualified: false },
  { id: "rbi", leaderCategory: "runsBattedIn", label: "RBI", group: "hitting", qualified: false },
  { id: "runs", leaderCategory: "runs", label: "Runs Scored", group: "hitting", qualified: false },
  { id: "avg", leaderCategory: "battingAverage", label: "Batting Average", group: "hitting", qualified: true },
  { id: "obp", leaderCategory: "onBasePercentage", label: "On-Base %", group: "hitting", qualified: true },
  { id: "slg", leaderCategory: "sluggingPercentage", label: "Slugging %", group: "hitting", qualified: true },
  { id: "ops", leaderCategory: "onBasePlusSlugging", label: "OPS", group: "hitting", qualified: true },
  { id: "sb", leaderCategory: "stolenBases", label: "Stolen Bases", group: "hitting", qualified: false },
  { id: "cs", leaderCategory: "caughtStealing", label: "Caught Stealing", group: "hitting", qualified: false },
  { id: "bb-hit", leaderCategory: "baseOnBalls", label: "Walks", group: "hitting", qualified: false },
  { id: "so-hit", leaderCategory: "strikeouts", label: "Strikeouts (Batting)", group: "hitting", qualified: false },
  { id: "sf", leaderCategory: "sacrificeFlies", label: "Sacrifice Flies", group: "hitting", qualified: false },
  { id: "gidp", leaderCategory: "groundIntoDoublePlay", label: "Grounded Into Double Play", group: "hitting", qualified: false },
  { id: "games-hit", leaderCategory: "gamesPlayed", label: "Games Played", group: "hitting", qualified: false },

  // Pitching
  { id: "era", leaderCategory: "earnedRunAverage", label: "ERA", group: "pitching", qualified: true },
  { id: "wins", leaderCategory: "wins", label: "Wins", group: "pitching", qualified: false },
  { id: "losses", leaderCategory: "losses", label: "Losses", group: "pitching", qualified: false },
  { id: "so-pitch", leaderCategory: "strikeouts", label: "Strikeouts", group: "pitching", qualified: false },
  { id: "saves", leaderCategory: "saves", label: "Saves", group: "pitching", qualified: false },
  { id: "holds", leaderCategory: "holds", label: "Holds", group: "pitching", qualified: false },
  { id: "blown-saves", leaderCategory: "blownSaves", label: "Blown Saves", group: "pitching", qualified: false },
  { id: "whip", leaderCategory: "walksAndHitsPerInningPitched", label: "WHIP", group: "pitching", qualified: true },
  { id: "bb-pitch", leaderCategory: "baseOnBalls", label: "Walks Allowed", group: "pitching", qualified: false },
  { id: "ip", leaderCategory: "inningsPitched", label: "Innings Pitched", group: "pitching", qualified: false },
  { id: "games-pitch", leaderCategory: "gamesPlayed", label: "Games Played", group: "pitching", qualified: false },
  { id: "games-started", leaderCategory: "gamesStarted", label: "Games Started", group: "pitching", qualified: false },
  { id: "complete-games", leaderCategory: "completeGames", label: "Complete Games", group: "pitching", qualified: false },
  { id: "shutouts", leaderCategory: "shutouts", label: "Shutouts", group: "pitching", qualified: false },
  { id: "hbp", leaderCategory: "hitBatsmen", label: "Hit Batsmen", group: "pitching", qualified: false },
];
