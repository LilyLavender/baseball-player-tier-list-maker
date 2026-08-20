import type { PoolPlayer } from "../types/mlb";
import type { TierDefinition } from "../data/tiers";

export type AutoTierScheme = "sf" | "sf-plus-minus" | "custom";

export type AutoTierStrategy =
  | { kind: "interval"; size: number }
  | { kind: "per-unit"; showEmptyTiers?: boolean }
  | { kind: "auto-grouping"; scheme: AutoTierScheme; customTiers?: TierDefinition[] }
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
  color?: string;
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

function bucketByUnit(entries: ValuedEntry[], order: "asc" | "desc", showEmptyTiers: boolean): Bucket[] {
  const groups = new Map<number, ValuedEntry[]>();
  for (const entry of entries) {
    (groups.get(entry.value) ?? groups.set(entry.value, []).get(entry.value)!).push(entry);
  }
  const presentKeys = Array.from(groups.keys());
  const allIntegers = presentKeys.every((k) => Number.isInteger(k));

  let keys: number[];
  if (showEmptyTiers && allIntegers && presentKeys.length > 0) {
    const min = Math.min(...presentKeys);
    const max = Math.max(...presentKeys);
    const ascending: number[] = [];
    for (let v = min; v <= max; v++) ascending.push(v);
    keys = order === "asc" ? ascending : ascending.slice().reverse();
  } else {
    keys = presentKeys.sort((a, b) => (order === "asc" ? a - b : b - a));
  }
  return keys.map((key) => ({ label: String(key), entries: groups.get(key) ?? [] }));
}

const SF_LABELS = ["S", "A", "B", "C", "D", "F"];
const SF_PLUS_MINUS_LABELS = SF_LABELS.flatMap((letter) => [`${letter}+`, letter, `${letter}-`]);

/**
 * Exact 1D k-means (equivalent to Jenks natural breaks): partitions `entries` into up to
 * `maxGroups` contiguous runs that minimize within-group variance, instead of forcing equal
 * population per group. `entries` must already be sorted (either direction is fine, since
 * variance doesn't care about direction as long as it's monotonic).
 */
function naturalBreaks(entries: ValuedEntry[], maxGroups: number): ValuedEntry[][] {
  const n = entries.length;
  const distinctCount = new Set(entries.map((e) => e.value)).size;
  const k = Math.max(1, Math.min(maxGroups, distinctCount));
  if (k >= n) return entries.map((entry) => [entry]);

  const prefixSum = new Array(n + 1).fill(0);
  const prefixSumSq = new Array(n + 1).fill(0);
  for (let i = 0; i < n; i++) {
    prefixSum[i + 1] = prefixSum[i] + entries[i].value;
    prefixSumSq[i + 1] = prefixSumSq[i] + entries[i].value * entries[i].value;
  }
  function variance(i: number, j: number): number {
    const count = j - i + 1;
    const sum = prefixSum[j + 1] - prefixSum[i];
    const sumSq = prefixSumSq[j + 1] - prefixSumSq[i];
    return sumSq - (sum * sum) / count;
  }

  const dp: number[][] = Array.from({ length: k + 1 }, () => new Array(n).fill(Infinity));
  const split: number[][] = Array.from({ length: k + 1 }, () => new Array(n).fill(0));

  for (let j = 0; j < n; j++) {
    dp[1][j] = variance(0, j);
  }

  for (let c = 2; c <= k; c++) {
    for (let j = c - 1; j < n; j++) {
      let best = Infinity;
      let bestI = c - 1;
      for (let i = c - 1; i <= j; i++) {
        const cost = dp[c - 1][i - 1] + variance(i, j);
        if (cost < best) {
          best = cost;
          bestI = i;
        }
      }
      dp[c][j] = best;
      split[c][j] = bestI;
    }
  }

  const groups: ValuedEntry[][] = [];
  let end = n - 1;
  for (let c = k; c >= 1; c--) {
    const start = c === 1 ? 0 : split[c][end];
    groups.unshift(entries.slice(start, end + 1));
    end = start - 1;
  }
  return groups;
}

function bucketByAutoGrouping(
  entries: ValuedEntry[],
  scheme: AutoTierScheme,
  customTiers?: TierDefinition[],
): Bucket[] {
  if (scheme === "custom" && customTiers && customTiers.length > 0) {
    const groups = naturalBreaks(entries, customTiers.length);
    return groups.map((group, index) => ({
      label: customTiers[index].label,
      color: customTiers[index].color,
      entries: group,
    }));
  }
  const labels = scheme === "sf-plus-minus" ? SF_PLUS_MINUS_LABELS : SF_LABELS;
  const groups = naturalBreaks(entries, labels.length);
  return groups.map((group, index) => ({ label: labels[index], entries: group }));
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
      buckets = bucketByUnit(entries, order, strategy.showEmptyTiers === true);
      break;
    case "auto-grouping":
      buckets = bucketByAutoGrouping(entries, strategy.scheme, strategy.customTiers);
      break;
    case "thresholds":
      buckets = bucketByThresholds(entries, order, strategy.thresholds);
      break;
  }

  const keepEmptyTiers = strategy.kind === "per-unit" && strategy.showEmptyTiers === true;
  const nonEmpty = keepEmptyTiers ? buckets : buckets.filter((b) => b.entries.length > 0);
  const tiers: TierDefinition[] = nonEmpty.map((bucket, index) => ({
    label: bucket.label,
    color: bucket.color ?? rankColor(index, nonEmpty.length),
  }));
  const tierPlayers = nonEmpty.map((bucket) => bucket.entries.map((entry) => entry.player));

  return { tiers, tierPlayers, leftoverPool };
}
