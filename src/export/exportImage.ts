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

  // html-to-image serializes into an SVG <foreignObject> and derives its capture
  // area from the node's on-screen position; a node pushed far off-screen (the old
  // `left: -99999px` trick) renders blank (see bubkoo/html-to-image#460). Instead,
  // keep the container pinned at (0, 0) so it stays in-bounds, and hide it visually
  // with a zero-size, clipping host rather than by moving it off-canvas.
  const captureHost = document.createElement("div");
  captureHost.style.position = "fixed";
  captureHost.style.top = "0";
  captureHost.style.left = "0";
  captureHost.style.width = "0";
  captureHost.style.height = "0";
  captureHost.style.overflow = "hidden";
  captureHost.style.pointerEvents = "none";
  document.body.appendChild(captureHost);

  const container = document.createElement("div");
  container.className = `export-snapshot export-snapshot--${options.theme}`;
  container.style.background = palette.bg;
  container.style.color = palette.text;
  container.innerHTML = renderExportSnapshot(options, tiers, tierPlayers, qrDataUrl);
  captureHost.appendChild(container);

  try {
    await import("../styles/export.css");
    await waitForImages(container);
    // Broken images call .remove() via inline onerror; give that a tick to settle.
    await new Promise((resolve) => setTimeout(resolve, 50));
    await document.fonts.ready;

    const { toBlob } = await import("html-to-image");
    const renderOptions = {
      backgroundColor: palette.bg,
      pixelRatio: 2,
      cacheBust: true,
    };
    // html-to-image serializes the DOM into an SVG <foreignObject>, which the browser
    // treats as its own document: @font-face fonts don't reliably resolve there before
    // the first capture, which can drop content and leave stray font-embedding state
    // behind. Priming with a throwaway call first (then discarding it) lets the library
    // finish embedding fonts before the real capture, which renders cleanly.
    await toBlob(container, renderOptions);
    const blob = await toBlob(container, renderOptions);
    if (!blob) return;

    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${slugify(options.title) || "tier-list"}.png`;
    link.click();
    URL.revokeObjectURL(url);
  } finally {
    captureHost.remove();
  }
}
