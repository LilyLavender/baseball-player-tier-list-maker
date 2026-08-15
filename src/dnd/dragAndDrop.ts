import Sortable from "sortablejs";
import { tierDropZoneIds } from "../components/tierBoard";

const SHARED_GROUP = "players";

let poolSortable: Sortable | null = null;
const tierSortables: Sortable[] = [];

function createSortable(element: HTMLElement): Sortable {
  return Sortable.create(element, {
    group: SHARED_GROUP,
    animation: 150,
    ghostClass: "player-card--ghost",
  });
}

export function initTierSortables(): void {
  tierSortables.forEach((instance) => instance.destroy());
  tierSortables.length = 0;

  for (const id of tierDropZoneIds()) {
    const element = document.getElementById(id);
    if (element) {
      tierSortables.push(createSortable(element));
    }
  }
}

export function initPoolSortable(): void {
  poolSortable?.destroy();
  const element = document.getElementById("pool-cards");
  poolSortable = element ? createSortable(element) : null;
}
