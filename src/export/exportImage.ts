import { renderExportSnapshot } from "../components/exportBoard";
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

export async function exportTierListAsPng(
  title: string,
  tiers: TierDefinition[],
  tierPlayers: PoolPlayer[][],
): Promise<void> {
  const container = document.createElement("div");
  container.className = "export-snapshot";
  container.style.position = "fixed";
  container.style.left = "-99999px";
  container.style.top = "0";
  container.innerHTML = renderExportSnapshot(title, tiers, tierPlayers);
  document.body.appendChild(container);

  try {
    await import("../styles/export.css");
    await waitForImages(container);
    // Broken images call .remove() via inline onerror; give that a tick to settle.
    await new Promise((resolve) => setTimeout(resolve, 50));

    const { default: html2canvas } = await import("html2canvas");
    const canvas = await html2canvas(container, {
      backgroundColor: "#f5f6f2",
      useCORS: true,
      scale: 2,
    });

    const blob: Blob | null = await new Promise((resolve) => canvas.toBlob(resolve, "image/png"));
    if (!blob) return;

    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${title.replace(/[^\w\- ]+/g, "").trim() || "tier-list"}.png`;
    link.click();
    URL.revokeObjectURL(url);
  } finally {
    container.remove();
  }
}
