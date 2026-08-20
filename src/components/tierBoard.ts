import { renderPlayerCard } from "./playerCard";
import type { PoolPlayer } from "../types/mlb";
import type { TierDefinition } from "../data/tiers";

export interface TierBoardCallbacks {
  onRename: (index: number, label: string) => void;
  onRecolor: (index: number, color: string) => void;
  onMoveUp: (index: number) => void;
  onMoveDown: (index: number) => void;
  onDelete: (index: number) => void;
  onAddTier: () => void;
  onResetTiers: () => void;
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
            />
            <input
              type="text"
              class="tier-row__name"
              data-tier-index="${index}"
              value="${tier.label}"
              maxlength="12"
            />
            <div class="tier-row__controls">
              <button type="button" class="tier-row__ctrl" data-action="up" data-tier-index="${index}" title="Move tier up">▲</button>
              <button type="button" class="tier-row__ctrl" data-action="down" data-tier-index="${index}" title="Move tier down">▼</button>
              <button type="button" class="tier-row__ctrl tier-row__ctrl--delete" data-action="delete" data-tier-index="${index}" title="Delete tier">✕</button>
            </div>
          </div>
          <div id="tier-cards-${index}" class="tier-row__cards sortable-zone">${cards}</div>
        </div>
      `;
    })
    .join("");

  return `
    <div class="board">
      ${rows}
      <div class="board__actions">
        <button type="button" id="add-tier" class="board__add-tier">+ Add tier</button>
        <button type="button" id="reset-tiers" class="board__reset-tiers">Reset tiers</button>
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
}
