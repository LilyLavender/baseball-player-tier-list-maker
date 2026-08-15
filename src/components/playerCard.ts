import { headshotUrl } from "../types/mlb";
import type { PoolPlayer } from "../types/mlb";

export function renderPlayerCard(player: PoolPlayer): string {
  const statBadge = player.statValue
    ? `<span class="player-card__stat">${player.statValue}</span>`
    : "";

  return `
    <div class="player-card" data-player-id="${player.id}">
      <img
        class="player-card__headshot"
        src="${headshotUrl(player.id)}"
        alt=""
        loading="lazy"
        width="112"
        height="128"
      />
      ${statBadge}
      <span class="player-card__name">${player.fullName}</span>
    </div>
  `;
}
