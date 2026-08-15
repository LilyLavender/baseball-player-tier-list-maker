import type { RosterPlayer } from "../types/mlb";
import { renderPlayerCard } from "./playerCard";
import { sortByLastName } from "../utils/names";

export function renderPlayerPool(players: RosterPlayer[]): string {
  if (players.length === 0) {
    return `<p class="pool__placeholder">Players will appear here once a query runs.</p>`;
  }

  const cards = sortByLastName(players).map(renderPlayerCard).join("");
  return `<div id="pool-cards" class="pool__cards sortable-zone">${cards}</div>`;
}
