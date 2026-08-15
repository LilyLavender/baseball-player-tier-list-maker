import { headshotUrl } from "../types/mlb";
import type { PoolPlayer } from "../types/mlb";
import type { TierDefinition } from "../data/tiers";

export function renderExportSnapshot(
  title: string,
  tiers: TierDefinition[],
  tierPlayers: PoolPlayer[][],
): string {
  const rows = tiers
    .map((tier, index) => {
      const cards = (tierPlayers[index] ?? [])
        .map((player) => {
          const primarySrc = headshotUrl(player.id, player.season);
          const fallbackSrc = headshotUrl(player.id);
          return `
            <div class="export-card">
              <img
                src="${primarySrc}"
                data-fallback-src="${fallbackSrc}"
                alt=""
                crossorigin="anonymous"
                onerror="if (this.src !== this.dataset.fallbackSrc) { this.src = this.dataset.fallbackSrc; } else { this.closest('.export-card').classList.add('export-card--no-photo'); this.remove(); }"
              />
              <span>${player.fullName}</span>
            </div>
          `;
        })
        .join("");
      return `
        <div class="export-row">
          <div class="export-row__label" style="background:${tier.color}">${tier.label}</div>
          <div class="export-row__cards">${cards}</div>
        </div>
      `;
    })
    .join("");

  const generatedOn = new Date().toLocaleDateString(undefined, {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  return `
    <div class="export-header">
      <h1>${title}</h1>
      <span>Generated ${generatedOn}</span>
    </div>
    <div class="export-board">${rows}</div>
    <div class="export-footer">MLB Tier List Maker</div>
  `;
}
