import type { SavedList } from "../storage/savedLists";

export interface HistoryPanelCallbacks {
  onOpen: (id: string) => void;
  onRename: (id: string) => void;
  onDuplicate: (id: string) => void;
  onDelete: (id: string) => void;
  onClose: () => void;
}

function formatDate(timestamp: number): string {
  return new Date(timestamp).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export function renderHistoryPanel(lists: SavedList[]): string {
  const rows = lists.length
    ? lists
        .map(
          (list) => `
            <li class="history-panel__row" data-list-id="${list.id}">
              <div class="history-panel__row-info">
                <span class="history-panel__row-title">${list.title}</span>
                <span class="history-panel__row-date">Updated ${formatDate(list.updatedAt)}</span>
              </div>
              <div class="history-panel__row-actions">
                <button type="button" data-action="open">Open</button>
                <button type="button" data-action="rename">Rename</button>
                <button type="button" data-action="duplicate">Duplicate</button>
                <button type="button" data-action="delete">Delete</button>
              </div>
            </li>
          `,
        )
        .join("")
    : `<li class="history-panel__empty">No saved lists yet.</li>`;

  return `
    <div id="history-overlay" class="history-overlay">
      <div class="history-panel" role="dialog" aria-modal="true" aria-labelledby="history-panel-title">
        <div class="history-panel__header">
          <h2 id="history-panel-title">Saved lists</h2>
          <button type="button" id="history-close">Close</button>
        </div>
        <ul class="history-panel__list">${rows}</ul>
      </div>
    </div>
  `;
}

export function bindHistoryPanel(callbacks: HistoryPanelCallbacks): void {
  const overlay = document.querySelector<HTMLDivElement>("#history-overlay")!;
  const closeButton = document.querySelector<HTMLButtonElement>("#history-close")!;

  overlay.addEventListener("click", (event) => {
    if (event.target === overlay) callbacks.onClose();
  });
  overlay.addEventListener("keydown", (event) => {
    if (event.key === "Escape") callbacks.onClose();
  });
  closeButton.addEventListener("click", () => callbacks.onClose());
  closeButton.focus();

  overlay.querySelectorAll<HTMLLIElement>(".history-panel__row").forEach((row) => {
    const id = row.dataset.listId!;
    row
      .querySelector<HTMLButtonElement>('[data-action="open"]')
      ?.addEventListener("click", () => callbacks.onOpen(id));
    row
      .querySelector<HTMLButtonElement>('[data-action="rename"]')
      ?.addEventListener("click", () => callbacks.onRename(id));
    row
      .querySelector<HTMLButtonElement>('[data-action="duplicate"]')
      ?.addEventListener("click", () => callbacks.onDuplicate(id));
    row
      .querySelector<HTMLButtonElement>('[data-action="delete"]')
      ?.addEventListener("click", () => callbacks.onDelete(id));
  });
}
