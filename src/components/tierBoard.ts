import { DEFAULT_TIERS } from "../data/tiers";
import { renderPlayerCard } from "./playerCard";
import type { PoolPlayer } from "../types/mlb";

export function renderTierBoard(tierPlayers: PoolPlayer[][] = []): string {
  const rows = DEFAULT_TIERS.map((tier, index) => {
    const cards = (tierPlayers[index] ?? []).map(renderPlayerCard).join("");
    return `
      <div class="tier-row" style="--tier-color: ${tier.color}">
        <div class="tier-row__label">${tier.label}</div>
        <div id="tier-cards-${index}" class="tier-row__cards sortable-zone">${cards}</div>
      </div>
    `;
  }).join("");

  return `<div class="board">${rows}</div>`;
}

export function tierDropZoneIds(): string[] {
  return DEFAULT_TIERS.map((_, index) => `tier-cards-${index}`);
}
