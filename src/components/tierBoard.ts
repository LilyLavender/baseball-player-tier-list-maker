import { renderPlayerCard } from "./playerCard";
import type { PoolPlayer } from "../types/mlb";
import type { TierDefinition } from "../data/tiers";
import type { AutoTierStrategy } from "../tiering/autoTier";
import { bindConditionalField } from "../utils/conditionalField";
import { icon } from "../utils/icon";

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
      return `
        <div class="tier-row" style="--tier-color: ${tier.color}">
          <div class="tier-row__label">
            <input
              type="color"
              class="tier-row__color"
              data-tier-index="${index}"
              value="${tier.color}"
              title="Tier color"
              aria-label="Color for tier ${tier.label}"
            />
            <input
              type="text"
              class="tier-row__name"
              data-tier-index="${index}"
              value="${tier.label}"
              maxlength="12"
              aria-label="Name for tier ${index + 1}"
            />
            <div class="tier-row__controls">
              <button type="button" class="tier-row__ctrl" data-action="up" data-tier-index="${index}" title="Move tier up" aria-label="Move tier ${tier.label} up">${icon("arrow_upward")}</button>
              <button type="button" class="tier-row__ctrl" data-action="down" data-tier-index="${index}" title="Move tier down" aria-label="Move tier ${tier.label} down">${icon("arrow_downward")}</button>
              <button type="button" class="tier-row__ctrl tier-row__ctrl--delete" data-action="delete" data-tier-index="${index}" title="Delete tier" aria-label="Delete tier ${tier.label}">${icon("close")}</button>
            </div>
          </div>
          <div id="tier-cards-${index}" class="tier-row__cards sortable-zone" role="list" aria-label="Players in tier ${tier.label}">${cards}</div>
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
            <button type="button" id="qb-autotier-apply" class="board__autotier-apply">${icon("auto_awesome")} Generate Tiers</button>
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

export function bindTierBoard(callbacks: TierBoardCallbacks): void {
  document.querySelectorAll<HTMLInputElement>(".tier-row__name").forEach((input) => {
    input.addEventListener("change", () => {
      callbacks.onRename(Number(input.dataset.tierIndex), input.value.trim() || "Tier");
    });
  });

  document.querySelectorAll<HTMLInputElement>(".tier-row__color").forEach((input) => {
    input.addEventListener("input", () => {
      callbacks.onRecolor(Number(input.dataset.tierIndex), input.value);
    });
  });

  document.querySelectorAll<HTMLButtonElement>(".tier-row__ctrl").forEach((button) => {
    button.addEventListener("click", () => {
      const index = Number(button.dataset.tierIndex);
      const action = button.dataset.action;
      if (action === "up") callbacks.onMoveUp(index);
      else if (action === "down") callbacks.onMoveDown(index);
      else if (action === "delete") callbacks.onDelete(index);
    });
  });

  document.getElementById("add-tier")?.addEventListener("click", () => callbacks.onAddTier());
  document.getElementById("reset-tiers")?.addEventListener("click", () => callbacks.onResetTiers());

  bindAutoTierPopover(callbacks);
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

  container.addEventListener("focusout", (event) => {
    if (!container.contains(event.relatedTarget as Node)) closePopover();
  });

  popover.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      closePopover();
      toggle.focus();
    }
  });

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
