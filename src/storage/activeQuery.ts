export type ActiveQuery =
  | { kind: "team"; teamId: number | "all"; season: number }
  | { kind: "stat"; statCategoryId: string; season: number; limit: number };
