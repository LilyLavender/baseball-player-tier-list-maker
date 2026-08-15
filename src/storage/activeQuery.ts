export type ActiveQuery =
  | { kind: "team"; teamId: number | "all"; season: number }
  | { kind: "stat"; statCategoryId: string; scope: "season" | "career"; season?: number; limit: number };
