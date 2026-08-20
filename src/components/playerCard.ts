import { headshotUrl } from "../types/mlb";
import type { PoolPlayer } from "../types/mlb";

export function renderPlayerCard(player: PoolPlayer): string {
  const statBadge = player.statValue
    ? `<span class="player-card__stat">${player.statValue}</span>`
    : "";

  const primarySrc = headshotUrl(player.id, player.season);
  const fallbackSrc = headshotUrl(player.id);

  return `
    <div class="player-card" data-player-id="${player.id}" role="listitem" aria-label="${player.fullName}">
      <img
        class="player-card__headshot"
        src="${primarySrc}"
        data-fallback-src="${fallbackSrc}"
        alt=""
        loading="lazy"
        width="112"
        height="128"
        onerror="if (this.src !== this.dataset.fallbackSrc) { this.src = this.dataset.fallbackSrc; } else { this.closest('.player-card').classList.add('player-card--no-photo'); this.remove(); }"
      />
      ${statBadge}
      <span class="player-card__name">${player.fullName}</span>
    </div>
  `;
}
