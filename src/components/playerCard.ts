import { headshotUrl } from "../types/mlb";
import type { RosterPlayer } from "../types/mlb";

export function renderPlayerCard(player: RosterPlayer): string {
  return `
    <div class="player-card" data-player-id="${player.id}">
      <img
        class="player-card__headshot"
        src="${headshotUrl(player.id)}"
        alt=""
        loading="lazy"
        width="60"
        height="60"
      />
      <span class="player-card__name">${player.fullName}</span>
      <span class="player-card__position">${player.positionAbbreviation}</span>
    </div>
  `;
}
