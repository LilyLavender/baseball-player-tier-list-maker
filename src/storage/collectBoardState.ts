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

/** Pool player ids currently passing the pool filter bar (i.e. actually visible), for auto-tiering. */
export function collectVisiblePoolPlayerIds(): number[] {
  const container = document.getElementById("pool-cards");
  if (!container) return [];
  return Array.from(container.querySelectorAll<HTMLElement>("[data-player-id]"))
    .filter((el) => !el.classList.contains("player-card--filtered-out"))
    .map((el) => Number(el.dataset.playerId));
}

export function collectTierPlayerIds(tierCount: number): number[][] {
  return tierDropZoneIds(tierCount).map(playerIdsIn);
}
