import { DEFAULT_TIERS } from "../data/tiers";

export function renderTierBoard(): string {
  const rows = DEFAULT_TIERS.map(
    (tier) => `
      <div class="tier-row" style="--tier-color: ${tier.color}">
        <div class="tier-row__label">${tier.label}</div>
        <div class="tier-row__cards">Drag players here</div>
      </div>
    `,
  ).join("");

  return `<div class="board">${rows}</div>`;
}
