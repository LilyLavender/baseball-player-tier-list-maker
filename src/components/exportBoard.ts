import { headshotUrl } from "../types/mlb";
import type { PoolPlayer } from "../types/mlb";
import type { TierDefinition } from "../data/tiers";
import type { ThemeName } from "../storage/themePref";
import { escapeHtml } from "../utils/escapeHtml";

export const EXPORT_SITE_URL = "https://lilylavender.github.io/baseball-player-tier-list-maker";

export interface ExportOptions {
  title: string;
  subtitle: string;
  theme: ThemeName;
  showStatBadges: boolean;
}

export const EXPORT_PALETTE: Record<ThemeName, Record<string, string>> = {
  light: {
    bg: "#f5f6f2",
    text: "#062f68",
    textMuted: "#5b6b85",
    surface: "#ffffff",
    border: "#d9dee6",
    accent: "#e50f4a",
    chalk: "#f5f6f2",
    highlight: "#ff6f91",
    inkNavy: "#062f68",
  },
  dark: {
    bg: "#0a0e14",
    text: "#f5f6f2",
    textMuted: "#93a3bd",
    surface: "#131b28",
    border: "#263449",
    accent: "#e50f4a",
    chalk: "#f5f6f2",
    highlight: "#ff6f91",
    inkNavy: "#062f68",
  },
};

export function formatExportDate(date = new Date()): string {
  return date.toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" });
}

export function renderExportSnapshot(
  options: ExportOptions,
  tiers: TierDefinition[],
  tierPlayers: PoolPlayer[][],
  qrDataUrl: string,
): string {
  const palette = EXPORT_PALETTE[options.theme];

  const rows = tiers
    .map((tier, index) => {
      const cards = (tierPlayers[index] ?? [])
        .map((player) => {
          const primarySrc = headshotUrl(player.id, player.season);
          const fallbackSrc = headshotUrl(player.id);
          const statBadge =
            options.showStatBadges && player.statValue
              ? `<span class="export-card__stat" style="background:${palette.highlight};color:${palette.inkNavy}">${player.statValue}</span>`
              : "";
          return `
            <div class="export-card">
              <img
                src="${primarySrc}"
                data-fallback-src="${fallbackSrc}"
                alt=""
                crossorigin="anonymous"
                onerror="if (this.src !== this.dataset.fallbackSrc) { this.src = this.dataset.fallbackSrc; } else { this.closest('.export-card').classList.add('export-card--no-photo'); this.remove(); }"
              />
              ${statBadge}
              <span class="export-card__name">${escapeHtml(player.fullName)}</span>
            </div>
          `;
        })
        .join("");
      return `
        <div class="export-row">
          <div class="export-row__label" style="background:${tier.color}">${escapeHtml(tier.label)}</div>
          <div class="export-row__cards">${cards}</div>
        </div>
      `;
    })
    .join("");

  const subtitle = options.subtitle.trim()
    ? `<p class="export-header__subtitle" style="color:${palette.textMuted}">${escapeHtml(options.subtitle.trim())}</p>`
    : "";

  return `
    <div class="export-header">
      <h1 style="color:${palette.text}">${escapeHtml(options.title)}</h1>
      ${subtitle}
    </div>
    <div class="export-board" style="border-color:${palette.border}">${rows}</div>
    <div class="export-footer">
      <img class="export-footer__qr" src="${qrDataUrl}" alt="QR code linking to ${EXPORT_SITE_URL}" />
      <div class="export-footer__text" style="color:${palette.textMuted}">
        <span>Make your own at</span>
        <a href="${EXPORT_SITE_URL}" style="color:${palette.text}">${EXPORT_SITE_URL.replace(/^https?:\/\//, "")}</a>
      </div>
    </div>
  `;
}
