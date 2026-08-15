import type { PoolPlayer } from "../types/mlb";
import type { ActiveQuery } from "./activeQuery";
import type { TierDefinition } from "../data/tiers";

const LISTS_KEY = "mlb-tier-list:saved";
const LAST_OPENED_KEY = "mlb-tier-list:last-opened";

export interface SavedList {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  query: ActiveQuery | null;
  tiers: TierDefinition[];
  players: PoolPlayer[];
  poolPlayerIds: number[];
  tierPlayerIds: number[][];
}

function readAll(): SavedList[] {
  const raw = localStorage.getItem(LISTS_KEY);
  if (!raw) return [];
  try {
    return JSON.parse(raw) as SavedList[];
  } catch {
    return [];
  }
}

function writeAll(lists: SavedList[]): void {
  localStorage.setItem(LISTS_KEY, JSON.stringify(lists));
}

export function getAllSavedLists(): SavedList[] {
  return readAll().sort((a, b) => b.updatedAt - a.updatedAt);
}

export function getSavedList(id: string): SavedList | undefined {
  return readAll().find((list) => list.id === id);
}

export interface SaveListInput {
  id: string | null;
  title: string;
  query: ActiveQuery | null;
  tiers: TierDefinition[];
  players: PoolPlayer[];
  poolPlayerIds: number[];
  tierPlayerIds: number[][];
}

export function upsertSavedList(input: SaveListInput): SavedList {
  const lists = readAll();
  const now = Date.now();

  if (input.id) {
    const existing = lists.find((list) => list.id === input.id);
    if (existing) {
      existing.title = input.title;
      existing.query = input.query;
      existing.tiers = input.tiers;
      existing.players = input.players;
      existing.poolPlayerIds = input.poolPlayerIds;
      existing.tierPlayerIds = input.tierPlayerIds;
      existing.updatedAt = now;
      writeAll(lists);
      return existing;
    }
  }

  const created: SavedList = {
    id: crypto.randomUUID(),
    title: input.title,
    createdAt: now,
    updatedAt: now,
    query: input.query,
    tiers: input.tiers,
    players: input.players,
    poolPlayerIds: input.poolPlayerIds,
    tierPlayerIds: input.tierPlayerIds,
  };
  lists.push(created);
  writeAll(lists);
  return created;
}

export function renameSavedList(id: string, title: string): void {
  const lists = readAll();
  const list = lists.find((l) => l.id === id);
  if (list) {
    list.title = title;
    list.updatedAt = Date.now();
    writeAll(lists);
  }
}

export function duplicateSavedList(id: string): SavedList | undefined {
  const lists = readAll();
  const source = lists.find((l) => l.id === id);
  if (!source) return undefined;

  const now = Date.now();
  const copy: SavedList = {
    ...source,
    id: crypto.randomUUID(),
    title: `${source.title} (copy)`,
    createdAt: now,
    updatedAt: now,
  };
  lists.push(copy);
  writeAll(lists);
  return copy;
}

export function deleteSavedList(id: string): void {
  writeAll(readAll().filter((l) => l.id !== id));
  if (getLastOpenedId() === id) {
    setLastOpenedId(null);
  }
}

export function getLastOpenedId(): string | null {
  return localStorage.getItem(LAST_OPENED_KEY);
}

export function setLastOpenedId(id: string | null): void {
  if (id) {
    localStorage.setItem(LAST_OPENED_KEY, id);
  } else {
    localStorage.removeItem(LAST_OPENED_KEY);
  }
}
