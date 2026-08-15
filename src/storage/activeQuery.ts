export type ActiveQuery =
  | { kind: "team"; teamId: number; season: number }
  | { kind: "stat"; statCategoryId: string; season: number; limit: number };
