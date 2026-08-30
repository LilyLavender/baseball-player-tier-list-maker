import QRCode from "qrcode";
import { EXPORT_PALETTE, renderExportSnapshot, EXPORT_SITE_URL } from "../components/exportBoard";
import type { ExportOptions } from "../components/exportBoard";
import type { PoolPlayer } from "../types/mlb";
import type { TierDefinition } from "../data/tiers";

function waitForImages(container: HTMLElement): Promise<void> {
  const images = Array.from(container.querySelectorAll("img"));
  return Promise.all(
    images.map(
      (img) =>
        new Promise<void>((resolve) => {
          if (img.complete) {
            resolve();
            return;
          }
          img.addEventListener("load", () => resolve(), { once: true });
          img.addEventListener("error", () => resolve(), { once: true });
        }),
    ),
  ).then(() => undefined);
}

/**
 * html2canvas doesn't reliably honor `object-fit: cover` (it tends to stretch the
 * image to fill the box instead of cropping), so we replicate cover manually with
 * exact pixel geometry, matching the "top center" object-position the live cards use.
 */
function applyManualCover(img: HTMLImageElement): void {
  const { naturalWidth, naturalHeight } = img;
  const parent = img.parentElement;
  if (!naturalWidth || !naturalHeight || !parent) return;

  const boxWidth = parent.clientWidth;
  const boxHeight = parent.clientHeight;
  const scale = Math.max(boxWidth / naturalWidth, boxHeight / naturalHeight);
  const width = naturalWidth * scale;
  const height = naturalHeight * scale;

  img.style.width = `${width}px`;
  img.style.height = `${height}px`;
  img.style.left = `${(boxWidth - width) / 2}px`;
  img.style.top = "0px";
}

function slugify(title: string): string {
  return title
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export async function exportTierListAsPng(
  options: ExportOptions,
  tiers: TierDefinition[],
  tierPlayers: PoolPlayer[][],
): Promise<void> {
  const palette = EXPORT_PALETTE[options.theme];
  const qrDataUrl = await QRCode.toDataURL(EXPORT_SITE_URL, {
    margin: 0,
    color: { dark: palette.text, light: "#00000000" },
  });

  const container = document.createElement("div");
  container.className = `export-snapshot export-snapshot--${options.theme}`;
  container.style.position = "fixed";
  container.style.left = "-99999px";
  container.style.top = "0";
  container.style.background = palette.bg;
  container.style.color = palette.text;
  container.innerHTML = renderExportSnapshot(options, tiers, tierPlayers, qrDataUrl);
  document.body.appendChild(container);

  try {
    await import("../styles/export.css");
    await waitForImages(container);
    // Broken images call .remove() via inline onerror; give that a tick to settle.
    await new Promise((resolve) => setTimeout(resolve, 50));

    container
      .querySelectorAll<HTMLImageElement>(".export-card img")
      .forEach((img) => applyManualCover(img));

    const { default: html2canvas } = await import("html2canvas");
    const canvas = await html2canvas(container, {
      backgroundColor: palette.bg,
      useCORS: true,
      scale: 2,
    });

    const blob: Blob | null = await new Promise((resolve) => canvas.toBlob(resolve, "image/png"));
    if (!blob) return;

    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${slugify(options.title) || "tier-list"}.png`;
    link.click();
    URL.revokeObjectURL(url);
  } finally {
    container.remove();
  }
}
