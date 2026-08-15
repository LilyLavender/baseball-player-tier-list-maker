import type { PoolPlayer } from "../types/mlb";
import type { TierDefinition } from "../data/tiers";

export type AutoTierScheme = "sf" | "sf-plus-minus";

export type AutoTierStrategy =
  | { kind: "interval"; size: number }
  | { kind: "per-unit" }
  | { kind: "auto-grouping"; scheme: AutoTierScheme }
  | { kind: "thresholds"; thresholds: number[] };

export interface AutoTierResult {
  tiers: TierDefinition[];
  tierPlayers: PoolPlayer[][];
  /** Players whose stat value couldn't be parsed; left for the caller to keep in the pool. */
  leftoverPool: PoolPlayer[];
}

interface ValuedEntry {
  player: PoolPlayer;
  value: number;
}

function parseValue(player: PoolPlayer): number | null {
  if (player.statValue === undefined) return null;
  const value = parseFloat(player.statValue);
  return Number.isFinite(value) ? value : null;
}

/** Best tier (index 0) is green, worst is red, regardless of stat direction. */
function rankColor(index: number, total: number): string {
  if (total <= 1) return "hsl(150, 50%, 35%)";
  const hue = 150 - (index / (total - 1)) * 145;
  return `hsl(${hue.toFixed(0)}, 55%, 38%)`;
}

interface Bucket {
  label: string;
  entries: ValuedEntry[];
}

function bucketByInterval(entries: ValuedEntry[], order: "asc" | "desc", size: number): Bucket[] {
  const safeSize = size > 0 ? size : 1;
  const groups = new Map<number, ValuedEntry[]>();
  for (const entry of entries) {
    const key = Math.floor(entry.value / safeSize);
    (groups.get(key) ?? groups.set(key, []).get(key)!).push(entry);
  }
  const keys = Array.from(groups.keys()).sort((a, b) => (order === "asc" ? a - b : b - a));
  const isWhole = Number.isInteger(safeSize);
  return keys.map((key) => {
    const low = key * safeSize;
    const high = low + safeSize - (isWhole ? 1 : 0);
    const label = isWhole
      ? high !== low
        ? `${low}-${high}`
        : `${low}`
      : `${low.toFixed(1)}-${(low + safeSize).toFixed(1)}`;
    return { label, entries: groups.get(key)! };
  });
}

function bucketByUnit(entries: ValuedEntry[], order: "asc" | "desc"): Bucket[] {
  const groups = new Map<number, ValuedEntry[]>();
  for (const entry of entries) {
    (groups.get(entry.value) ?? groups.set(entry.value, []).get(entry.value)!).push(entry);
  }
  const keys = Array.from(groups.keys()).sort((a, b) => (order === "asc" ? a - b : b - a));
  return keys.map((key) => ({ label: String(key), entries: groups.get(key)! }));
}

const SF_LABELS = ["S", "A", "B", "C", "D", "F"];
const SF_PLUS_MINUS_LABELS = SF_LABELS.flatMap((letter) => [`${letter}+`, letter, `${letter}-`]);

function bucketByAutoGrouping(entries: ValuedEntry[], scheme: AutoTierScheme): Bucket[] {
  const labels = scheme === "sf-plus-minus" ? SF_PLUS_MINUS_LABELS : SF_LABELS;
  const perGroup = Math.ceil(entries.length / labels.length);
  const buckets: Bucket[] = [];
  for (let i = 0; i < labels.length; i++) {
    const slice = entries.slice(i * perGroup, (i + 1) * perGroup);
    if (slice.length > 0) buckets.push({ label: labels[i], entries: slice });
  }
  return buckets;
}

function bucketByThresholds(
  entries: ValuedEntry[],
  order: "asc" | "desc",
  thresholds: number[],
): Bucket[] {
  const desc = order === "desc";
  const sorted = thresholds.filter((t) => Number.isFinite(t)).sort((a, b) => (desc ? b - a : a - b));

  const buckets: Bucket[] = sorted.map((threshold, i) => {
    const prevThreshold = i > 0 ? sorted[i - 1] : undefined;
    const matched = entries.filter((entry) => {
      const meetsFloor = desc ? entry.value >= threshold : entry.value <= threshold;
      const withinPrev =
        prevThreshold === undefined
          ? true
          : desc
            ? entry.value < prevThreshold
            : entry.value > prevThreshold;
      return meetsFloor && withinPrev;
    });
    return { label: desc ? `${threshold}+` : `≤${threshold}`, entries: matched };
  });

  const covered = new Set(buckets.flatMap((b) => b.entries));
  const remainder = entries.filter((e) => !covered.has(e));
  if (remainder.length) buckets.push({ label: "Other", entries: remainder });
  return buckets;
}

export function generateAutoTiers(
  players: PoolPlayer[],
  order: "asc" | "desc",
  strategy: AutoTierStrategy,
): AutoTierResult {
  const entries: ValuedEntry[] = [];
  const leftoverPool: PoolPlayer[] = [];

  for (const player of players) {
    const value = parseValue(player);
    if (value === null) leftoverPool.push(player);
    else entries.push({ player, value });
  }

  entries.sort((a, b) => (order === "asc" ? a.value - b.value : b.value - a.value));

  if (entries.length === 0) {
    return { tiers: [], tierPlayers: [], leftoverPool: players };
  }

  let buckets: Bucket[];
  switch (strategy.kind) {
    case "interval":
      buckets = bucketByInterval(entries, order, strategy.size);
      break;
    case "per-unit":
      buckets = bucketByUnit(entries, order);
      break;
    case "auto-grouping":
      buckets = bucketByAutoGrouping(entries, strategy.scheme);
      break;
    case "thresholds":
      buckets = bucketByThresholds(entries, order, strategy.thresholds);
      break;
  }

  const nonEmpty = buckets.filter((b) => b.entries.length > 0);
  const tiers: TierDefinition[] = nonEmpty.map((bucket, index) => ({
    label: bucket.label,
    color: rankColor(index, nonEmpty.length),
  }));
  const tierPlayers = nonEmpty.map((bucket) => bucket.entries.map((entry) => entry.player));

  return { tiers, tierPlayers, leftoverPool };
}
