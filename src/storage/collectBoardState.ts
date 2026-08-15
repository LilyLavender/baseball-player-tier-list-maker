import { tierDropZoneIds } from "../components/tierBoard";

function playerIdsIn(containerId: string): number[] {
  const container = document.getElementById(containerId);
  if (!container) return [];
  return Array.from(container.querySelectorAll<HTMLElement>("[data-player-id]")).map(
    (el) => Number(el.dataset.playerId),
  );
}

export function collectPoolPlayerIds(): number[] {
  return playerIdsIn("pool-cards");
}

export function collectTierPlayerIds(tierCount: number): number[][] {
  return tierDropZoneIds(tierCount).map(playerIdsIn);
}
