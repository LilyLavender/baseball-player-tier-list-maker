import { renderPlayerCard } from "./playerCard";
import type { PoolPlayer } from "../types/mlb";
import type { TierDefinition } from "../data/tiers";
import type { AutoTierStrategy } from "../tiering/autoTier";
import { bindConditionalField } from "../utils/conditionalField";
import { icon } from "../utils/icon";
import { escapeHtml } from "../utils/escapeHtml";
import { TIER_COLOR_PALETTE } from "../data/tierColors";

const TIER_NAME_MAX_FONT_REM = 1.7;
const TIER_NAME_MIN_FONT_REM = 0.85;
const TIER_NAME_STEP_REM = 0.1;

/** Shrinks `el`'s font size to fit on one line down to a floor, then lets it wrap and grow tall. */
function fitTierNameText(el: HTMLElement): void {
  el.style.whiteSpace = "nowrap";
  el.style.overflow = "hidden";
  let size = TIER_NAME_MAX_FONT_REM;
  el.style.fontSize = `${size}rem`;
  while (size > TIER_NAME_MIN_FONT_REM && el.scrollWidth > el.clientWidth + 1) {
    size = Math.max(TIER_NAME_MIN_FONT_REM, Math.round((size - TIER_NAME_STEP_REM) * 10) / 10);
    el.style.fontSize = `${size}rem`;
  }
  if (el.scrollWidth > el.clientWidth + 1) {
    el.style.whiteSpace = "normal";
    el.style.overflow = "visible";
  }
}

export interface TierBoardCallbacks {
  onRename: (index: number, label: string) => void;
  onRecolor: (index: number, color: string) => void;
  onMoveUp: (index: number) => void;
  onMoveDown: (index: number) => void;
  onDelete: (index: number) => void;
  onAddTier: () => void;
  onResetTiers: () => void;
  onGenerateAutoTiers: (strategy: AutoTierStrategy) => void;
}

export function renderTierBoard(tiers: TierDefinition[], tierPlayers: PoolPlayer[][] = []): string {
  const rows = tiers
    .map((tier, index) => {
      const cards = (tierPlayers[index] ?? []).map(renderPlayerCard).join("");
      const safeLabel = escapeHtml(tier.label);
      return `
        <div class="tier-row" style="--tier-color: ${tier.color}">
          <div class="tier-row__label">
            <div
              class="tier-row__name"
              data-tier-index="${index}"
              contenteditable="true"
              spellcheck="false"
              role="textbox"
              aria-label="Name for tier ${index + 1}"
            >${safeLabel}</div>
            <div class="tier-row__hover-controls">
              <button
                type="button"
                class="tier-row__icon-btn"
                data-action="settings"
                data-tier-index="${index}"
                title="Tier settings"
                aria-label="Settings for tier ${safeLabel}"
                aria-haspopup="true"
                aria-expanded="false"
                aria-controls="tier-settings-${index}"
              >${icon("settings")}</button>
              <button type="button" class="tier-row__icon-btn tier-row__move-btn" data-action="up" data-tier-index="${index}" title="Move tier up" aria-label="Move tier ${safeLabel} up">${icon("arrow_upward")}</button>
              <button type="button" class="tier-row__icon-btn tier-row__move-btn" data-action="down" data-tier-index="${index}" title="Move tier down" aria-label="Move tier ${safeLabel} down">${icon("arrow_downward")}</button>
            </div>
            <div id="tier-settings-${index}" class="tier-row__settings" data-tier-index="${index}" hidden>
              <label class="tier-row__settings-field">
                <span>Name</span>
                <input type="text" class="tier-row__settings-name" data-tier-index="${index}" value="${safeLabel}" />
              </label>
              <div class="tier-row__settings-field">
                <span>Color</span>
                <div class="tier-row__color-swatches" data-tier-index="${index}">
                  ${TIER_COLOR_PALETTE.map(
                    (color) => `
                      <button
                        type="button"
                        class="tier-row__color-swatch${color.toLowerCase() === tier.color.toLowerCase() ? " tier-row__color-swatch--active" : ""}"
                        data-tier-index="${index}"
                        data-color="${color}"
                        style="--swatch-color: ${color}"
                        aria-label="Set tier color to ${color}"
                        aria-pressed="${color.toLowerCase() === tier.color.toLowerCase()}"
                      ></button>
                    `,
                  ).join("")}
                  <label class="tier-row__color-swatch tier-row__color-swatch--custom" title="Custom color">
                    <input type="color" class="tier-row__settings-color" data-tier-index="${index}" value="${tier.color}" />
                  </label>
                </div>
              </div>
              <div class="tier-row__settings-row">
                <button type="button" class="tier-row__settings-btn tier-row__move-btn" data-action="up" data-tier-index="${index}">${icon("arrow_upward")} Move up</button>
                <button type="button" class="tier-row__settings-btn tier-row__move-btn" data-action="down" data-tier-index="${index}">${icon("arrow_downward")} Move down</button>
              </div>
              ${
                tiers.length > 1
                  ? `<button type="button" class="tier-row__settings-delete" data-action="delete" data-tier-index="${index}">${icon("delete")} Delete tier</button>`
                  : ""
              }
            </div>
          </div>
          <div id="tier-cards-${index}" class="tier-row__cards sortable-zone" role="list" aria-label="Players in tier ${safeLabel}">${cards}</div>
        </div>
      `;
    })
    .join("");

  return `
    <div class="board">
      ${rows}
      <div class="board__actions">
        <button type="button" id="add-tier" class="board__add-tier">${icon("add")} Add tier</button>
        <div class="board__autotier">
          <button
            type="button"
            id="autotier-toggle"
            class="board__autotier-toggle"
            aria-haspopup="true"
            aria-expanded="false"
            aria-controls="autotier-popover"
          >Auto-tier ${icon("expand_more")}</button>
          <div id="autotier-popover" class="board__autotier-popover" hidden>
            <p class="query-builder__placeholder">
              Builds tiers from stat values already in the pool. Run a stat leaders query first.
            </p>
            <label class="query-builder__field">
              Strategy
              <select id="qb-autotier-strategy">
                <option value="interval">Fixed interval</option>
                <option value="per-unit">One tier per value</option>
                <option value="auto-grouping">Auto S-F grouping (natural breaks)</option>
                <option value="thresholds">Custom thresholds</option>
              </select>
            </label>
            <label class="query-builder__field" id="qb-autotier-interval-field">
              Interval size
              <input id="qb-autotier-interval" type="number" value="10" min="0.1" step="0.1" />
            </label>
            <label class="query-builder__field query-builder__field--checkbox" id="qb-autotier-empty-field" hidden>
              <input id="qb-autotier-empty" type="checkbox" />
              Show empty tiers between values
            </label>
            <label class="query-builder__field" id="qb-autotier-thresholds-field" hidden>
              Thresholds (comma-separated)
              <input id="qb-autotier-thresholds" type="text" placeholder="e.g. 40, 30, 20, 10" />
            </label>
            <label class="query-builder__field" id="qb-autotier-scheme-field" hidden>
              Tier scheme
              <select id="qb-autotier-scheme">
                <option value="sf">S-F (6 tiers)</option>
                <option value="sf-plus-minus">S-F with +/- (up to 18 tiers)</option>
                <option value="custom">Use current tier board's labels</option>
              </select>
            </label>
            <button type="button" id="qb-autotier-apply" class="board__autotier-apply">${icon("stacked_bar_chart")} Generate Tiers</button>
          </div>
        </div>
        <button type="button" id="reset-tiers" class="board__reset-tiers">${icon("restart_alt")} Reset tiers</button>
      </div>
    </div>
  `;
}

export function tierDropZoneIds(tierCount: number): string[] {
  return Array.from({ length: tierCount }, (_, index) => `tier-cards-${index}`);
}

function syncSettingsName(index: number, text: string): void {
  const settingsInput = document.querySelector<HTMLInputElement>(
    `.tier-row__settings-name[data-tier-index="${index}"]`,
  );
  if (settingsInput) settingsInput.value = text;
}

function bindTierNameEditing(callbacks: TierBoardCallbacks): void {
  document.querySelectorAll<HTMLElement>(".tier-row__name").forEach((nameEl) => {
    fitTierNameText(nameEl);

    const commit = () => {
      const index = Number(nameEl.dataset.tierIndex);
      const text = (nameEl.textContent ?? "").trim() || "Tier";
      nameEl.textContent = text;
      fitTierNameText(nameEl);
      callbacks.onRename(index, text);
      syncSettingsName(index, text);
    };

    nameEl.addEventListener("input", () => fitTierNameText(nameEl));
    nameEl.addEventListener("blur", commit);
    nameEl.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === "Escape") {
        event.preventDefault();
        nameEl.blur();
      }
    });
    nameEl.addEventListener("paste", (event) => {
      event.preventDefault();
      const text = event.clipboardData?.getData("text/plain") ?? "";
      const selection = window.getSelection();
      if (!selection || selection.rangeCount === 0) return;
      const range = selection.getRangeAt(0);
      range.deleteContents();
      range.insertNode(document.createTextNode(text));
      range.collapse(false);
      fitTierNameText(nameEl);
    });
  });
}

function bindTierMoveAndDelete(callbacks: TierBoardCallbacks): void {
  document.querySelectorAll<HTMLButtonElement>(".tier-row__move-btn").forEach((button) => {
    button.addEventListener("click", () => {
      const index = Number(button.dataset.tierIndex);
      if (button.dataset.action === "up") callbacks.onMoveUp(index);
      else callbacks.onMoveDown(index);
    });
  });

  document.querySelectorAll<HTMLButtonElement>(".tier-row__settings-delete").forEach((button) => {
    button.addEventListener("click", () => callbacks.onDelete(Number(button.dataset.tierIndex)));
  });
}

function setActiveSwatch(index: number, color: string): void {
  document
    .querySelectorAll<HTMLButtonElement>(`.tier-row__color-swatch[data-tier-index="${index}"]`)
    .forEach((swatch) => {
      const active = swatch.dataset.color?.toLowerCase() === color.toLowerCase();
      swatch.classList.toggle("tier-row__color-swatch--active", active);
      swatch.setAttribute("aria-pressed", String(active));
    });
}

function bindTierSettingsFields(callbacks: TierBoardCallbacks): void {
  document.querySelectorAll<HTMLInputElement>(".tier-row__settings-color").forEach((input) => {
    input.addEventListener("input", () => {
      const index = Number(input.dataset.tierIndex);
      setActiveSwatch(index, input.value);
      callbacks.onRecolor(index, input.value);
    });
  });

  document.querySelectorAll<HTMLButtonElement>(".tier-row__color-swatch[data-color]").forEach((swatch) => {
    swatch.addEventListener("click", () => {
      const index = Number(swatch.dataset.tierIndex);
      const color = swatch.dataset.color!;
      setActiveSwatch(index, color);
      const colorInput = document.querySelector<HTMLInputElement>(
        `.tier-row__settings-color[data-tier-index="${index}"]`,
      );
      if (colorInput) colorInput.value = color;
      callbacks.onRecolor(index, color);
    });
  });

  document.querySelectorAll<HTMLInputElement>(".tier-row__settings-name").forEach((input) => {
    input.addEventListener("input", () => {
      const index = Number(input.dataset.tierIndex);
      const nameEl = document.querySelector<HTMLElement>(`.tier-row__name[data-tier-index="${index}"]`);
      if (!nameEl) return;
      nameEl.textContent = input.value || "Tier";
      fitTierNameText(nameEl);
    });
    input.addEventListener("change", () => {
      const index = Number(input.dataset.tierIndex);
      const text = input.value.trim() || "Tier";
      input.value = text;
      callbacks.onRename(index, text);
    });
  });
}

function closeTierSettingsPopover(popover: HTMLElement): void {
  popover.hidden = true;
  const toggle = document.querySelector<HTMLButtonElement>(
    `.tier-row__icon-btn[data-action="settings"][data-tier-index="${popover.dataset.tierIndex}"]`,
  );
  toggle?.setAttribute("aria-expanded", "false");
}

let tierSettingsOutsideClickBound = false;

/**
 * Registered once for the app's lifetime (guarded by the flag) rather than once per board
 * re-render, so it doesn't accumulate a fresh listener every time the tier board rerenders.
 */
function bindTierSettingsOutsideClick(): void {
  if (tierSettingsOutsideClickBound) return;
  tierSettingsOutsideClickBound = true;
  document.addEventListener("click", (event) => {
    const target = event.target as Node;
    document.querySelectorAll<HTMLElement>(".tier-row__settings:not([hidden])").forEach((popover) => {
      const label = popover.closest(".tier-row__label");
      if (label && !label.contains(target)) closeTierSettingsPopover(popover);
    });
  });
}

function bindTierSettingsPopovers(): void {
  const toggles = Array.from(
    document.querySelectorAll<HTMLButtonElement>('.tier-row__icon-btn[data-action="settings"]'),
  );

  function closeAll(): void {
    document.querySelectorAll<HTMLElement>(".tier-row__settings").forEach(closeTierSettingsPopover);
  }

  toggles.forEach((toggle) => {
    const index = toggle.dataset.tierIndex;
    const popover = document.querySelector<HTMLElement>(`.tier-row__settings[data-tier-index="${index}"]`);
    if (!popover) return;

    toggle.addEventListener("click", () => {
      const willOpen = popover.hidden;
      closeAll();
      popover.hidden = !willOpen;
      toggle.setAttribute("aria-expanded", String(willOpen));
      if (willOpen) popover.querySelector<HTMLInputElement>(".tier-row__settings-name")?.focus();
    });

    popover.addEventListener("keydown", (event) => {
      if (event.key === "Escape") {
        closeTierSettingsPopover(popover);
        toggle.focus();
      }
    });
  });

  bindTierSettingsOutsideClick();
}

export function bindTierBoard(callbacks: TierBoardCallbacks): void {
  bindTierNameEditing(callbacks);
  bindTierMoveAndDelete(callbacks);
  bindTierSettingsFields(callbacks);
  bindTierSettingsPopovers();

  document.getElementById("add-tier")?.addEventListener("click", () => callbacks.onAddTier());
  document.getElementById("reset-tiers")?.addEventListener("click", () => callbacks.onResetTiers());

  bindAutoTierPopover(callbacks);
}

let autoTierOutsideClickBound = false;

/** Registered once for the app's lifetime; queries the live popover so it survives re-renders. */
function bindAutoTierOutsideClick(): void {
  if (autoTierOutsideClickBound) return;
  autoTierOutsideClickBound = true;
  document.addEventListener("click", (event) => {
    const popover = document.querySelector<HTMLElement>("#autotier-popover");
    const container = document.querySelector<HTMLElement>(".board__autotier");
    const toggle = document.querySelector<HTMLButtonElement>("#autotier-toggle");
    if (!popover || !container || !toggle || popover.hidden) return;
    if (!container.contains(event.target as Node)) {
      popover.hidden = true;
      toggle.setAttribute("aria-expanded", "false");
    }
  });
}

function bindAutoTierPopover(callbacks: TierBoardCallbacks): void {
  const toggle = document.querySelector<HTMLButtonElement>("#autotier-toggle");
  const popover = document.querySelector<HTMLDivElement>("#autotier-popover");
  const container = document.querySelector<HTMLDivElement>(".board__autotier");
  if (!toggle || !popover || !container) return;

  const closePopover = () => {
    popover.hidden = true;
    toggle.setAttribute("aria-expanded", "false");
  };
  const openPopover = () => {
    popover.hidden = false;
    toggle.setAttribute("aria-expanded", "true");
  };

  toggle.addEventListener("click", () => {
    if (popover.hidden) openPopover();
    else closePopover();
  });

  popover.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      closePopover();
      toggle.focus();
    }
  });

  bindAutoTierOutsideClick();

  const strategySelect = document.querySelector<HTMLSelectElement>("#qb-autotier-strategy")!;
  const intervalField = document.querySelector<HTMLLabelElement>("#qb-autotier-interval-field")!;
  const intervalInput = document.querySelector<HTMLInputElement>("#qb-autotier-interval")!;
  const emptyTiersField = document.querySelector<HTMLLabelElement>("#qb-autotier-empty-field")!;
  const emptyTiersCheckbox = document.querySelector<HTMLInputElement>("#qb-autotier-empty")!;
  const thresholdsField = document.querySelector<HTMLLabelElement>("#qb-autotier-thresholds-field")!;
  const thresholdsInput = document.querySelector<HTMLInputElement>("#qb-autotier-thresholds")!;
  const schemeField = document.querySelector<HTMLLabelElement>("#qb-autotier-scheme-field")!;
  const schemeSelect = document.querySelector<HTMLSelectElement>("#qb-autotier-scheme")!;
  const autoTierApplyButton = document.querySelector<HTMLButtonElement>("#qb-autotier-apply")!;

  bindConditionalField(strategySelect, intervalField, ["interval"]);
  bindConditionalField(strategySelect, emptyTiersField, ["per-unit"]);
  bindConditionalField(strategySelect, thresholdsField, ["thresholds"]);
  bindConditionalField(strategySelect, schemeField, ["auto-grouping"]);

  autoTierApplyButton.addEventListener("click", () => {
    const kind = strategySelect.value;
    if (kind === "interval") {
      callbacks.onGenerateAutoTiers({ kind: "interval", size: Number(intervalInput.value) || 1 });
    } else if (kind === "per-unit") {
      callbacks.onGenerateAutoTiers({ kind: "per-unit", showEmptyTiers: emptyTiersCheckbox.checked });
    } else if (kind === "auto-grouping") {
      const scheme =
        schemeSelect.value === "sf-plus-minus" || schemeSelect.value === "custom"
          ? schemeSelect.value
          : "sf";
      callbacks.onGenerateAutoTiers({ kind: "auto-grouping", scheme });
    } else if (kind === "thresholds") {
      const thresholds = thresholdsInput.value
        .split(",")
        .map((part) => Number(part.trim()))
        .filter((n) => Number.isFinite(n));
      callbacks.onGenerateAutoTiers({ kind: "thresholds", thresholds });
    }
    closePopover();
  });
}
