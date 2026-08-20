import Sortable from "sortablejs";

const SHARED_GROUP = "players";

let poolSortable: Sortable | null = null;
let removeSortable: Sortable | null = null;
const tierSortables: Sortable[] = [];
let onBoardChange: () => void = () => {};

export function setOnBoardChange(callback: () => void): void {
  onBoardChange = callback;
}

function removeZoneElement(): HTMLElement | null {
  return document.getElementById("remove-zone");
}

function isPointerOverRemoveZone(x: number, y: number): boolean {
  const zone = removeZoneElement();
  if (!zone) return false;
  const rect = zone.getBoundingClientRect();
  return x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom;
}

function pointerMoveHandler(event: PointerEvent): void {
  const zone = removeZoneElement();
  if (!zone) return;
  zone.classList.toggle("remove-zone--active", isPointerOverRemoveZone(event.clientX, event.clientY));
}

function showRemoveZone(): void {
  removeZoneElement()?.classList.add("remove-zone--visible");
  document.addEventListener("pointermove", pointerMoveHandler);
}

function hideRemoveZone(): void {
  const zone = removeZoneElement();
  zone?.classList.remove("remove-zone--visible", "remove-zone--active");
  document.removeEventListener("pointermove", pointerMoveHandler);
}

function createSortable(element: HTMLElement): Sortable {
  return Sortable.create(element, {
    group: SHARED_GROUP,
    animation: 150,
    ghostClass: "player-card--ghost",
    forceFallback: true,
    fallbackOnBody: true,
    fallbackClass: "player-card--dragging",
    onStart: showRemoveZone,
    onEnd: () => {
      hideRemoveZone();
      onBoardChange();
    },
  });
}

export function initTierSortables(tierDropZoneIds: string[]): void {
  tierSortables.forEach((instance) => instance.destroy());
  tierSortables.length = 0;

  for (const id of tierDropZoneIds) {
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

export function initRemoveZoneSortable(): void {
  removeSortable?.destroy();
  const element = document.getElementById("remove-zone-drop");
  if (!element) {
    removeSortable = null;
    return;
  }

  removeSortable = Sortable.create(element, {
    group: SHARED_GROUP,
    animation: 150,
    ghostClass: "player-card--ghost",
    onAdd: (event) => {
      event.item.remove();
      onBoardChange();
    },
  });
}
