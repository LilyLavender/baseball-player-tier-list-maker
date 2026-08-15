import type { RosterPlayer } from "../types/mlb";

export function renderPlayerPool(players: RosterPlayer[]): string {
  if (players.length === 0) {
    return `<p class="pool__placeholder">Players will appear here once a query runs.</p>`;
  }

  const cards = players
    .map(
      (player) => `
        <div class="pool__card">
          <span class="pool__card-name">${player.fullName}</span>
          <span class="pool__card-position">${player.positionAbbreviation}</span>
        </div>
      `,
    )
    .join("");

  return `<div class="pool__cards">${cards}</div>`;
}
