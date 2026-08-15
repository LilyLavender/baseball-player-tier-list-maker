import type { RosterPlayer } from "../types/mlb";

export function renderPlayerCard(player: RosterPlayer): string {
  return `
    <div class="player-card" data-player-id="${player.id}">
      <span class="player-card__name">${player.fullName}</span>
      <span class="player-card__position">${player.positionAbbreviation}</span>
    </div>
  `;
}
