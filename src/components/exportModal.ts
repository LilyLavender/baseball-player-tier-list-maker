import type { ThemeName } from "../storage/themePref";
import { formatExportDate } from "./exportBoard";
import { renderToggleSwitch } from "../utils/toggleSwitch";
import { escapeHtml } from "../utils/escapeHtml";
import { icon } from "../utils/icon";

export interface ExportPanelDefaults {
  title: string;
  theme: ThemeName;
}

export interface ExportPanelCallbacks {
  onExport: (options: { title: string; subtitle: string; theme: ThemeName }) => void;
  onClose: () => void;
}

export function renderExportPanel(defaults: ExportPanelDefaults): string {
  return `
    <div id="export-panel" class="export-panel" role="dialog" aria-modal="true" aria-labelledby="export-panel-title" hidden>
      <div class="export-panel__header">
        <h2 id="export-panel-title">Export tier list</h2>
        <button type="button" id="export-panel-close" class="export-panel__close" aria-label="Close">
          ${icon("close")}
        </button>
      </div>
      <label class="export-panel__field">
        <span>Title</span>
        <input id="export-panel-title-input" type="text" value="${escapeHtml(defaults.title)}" />
      </label>
      <label class="export-panel__field">
        <span>Subtitle</span>
        <input
          id="export-panel-subtitle-input"
          type="text"
          value="${escapeHtml(`Generated ${formatExportDate()}`)}"
        />
      </label>
      <label class="export-panel__field export-panel__field--row">
        <span>Dark mode</span>
        ${renderToggleSwitch("export-panel-theme-toggle", defaults.theme === "dark")}
      </label>
      <button type="button" id="export-panel-submit" class="export-panel__submit">
        ${icon("download")} Export PNG
      </button>
    </div>
  `;
}

export function bindExportPanel(callbacks: ExportPanelCallbacks): void {
  const panel = document.querySelector<HTMLDivElement>("#export-panel")!;
  const closeButton = document.querySelector<HTMLButtonElement>("#export-panel-close")!;
  const submitButton = document.querySelector<HTMLButtonElement>("#export-panel-submit")!;
  const titleInput = document.querySelector<HTMLInputElement>("#export-panel-title-input")!;
  const subtitleInput = document.querySelector<HTMLInputElement>("#export-panel-subtitle-input")!;
  const themeToggle = document.querySelector<HTMLInputElement>("#export-panel-theme-toggle")!;

  closeButton.addEventListener("click", () => callbacks.onClose());
  panel.addEventListener("keydown", (event) => {
    if (event.key === "Escape") callbacks.onClose();
  });
  submitButton.addEventListener("click", () => {
    callbacks.onExport({
      title: titleInput.value.trim() || "Tier List",
      subtitle: subtitleInput.value,
      theme: themeToggle.checked ? "dark" : "light",
    });
  });
}
