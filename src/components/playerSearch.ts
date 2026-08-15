import { searchPlayers } from "../api/mlbApi";
import type { PoolPlayer } from "../types/mlb";

export function renderPlayerSearch(): string {
  return `
    <div class="player-search" id="player-search">
      <input
        id="player-search-input"
        type="text"
        class="player-search__input"
        placeholder="Add a player by name…"
        autocomplete="off"
      />
      <div id="player-search-results" class="player-search__results" hidden></div>
    </div>
  `;
}

let debounceHandle: ReturnType<typeof setTimeout> | undefined;

export function bindPlayerSearch(onAdd: (player: PoolPlayer) => void): void {
  const container = document.getElementById("player-search")!;
  const input = document.getElementById("player-search-input") as HTMLInputElement;
  const results = document.getElementById("player-search-results") as HTMLDivElement;

  function showResults(players: PoolPlayer[]): void {
    if (players.length === 0) {
      results.hidden = true;
      results.innerHTML = "";
      return;
    }
    results.innerHTML = players
      .slice(0, 15)
      .map(
        (player) =>
          `<div class="player-search__result" data-player-id="${player.id}" data-player-name="${player.fullName}">${player.fullName}</div>`,
      )
      .join("");
    results.hidden = false;

    results.querySelectorAll<HTMLDivElement>(".player-search__result").forEach((row) => {
      row.addEventListener("mousedown", (event) => {
        event.preventDefault();
        onAdd({ id: Number(row.dataset.playerId), fullName: row.dataset.playerName! });
        input.value = "";
        results.hidden = true;
        results.innerHTML = "";
      });
    });
  }

  input.addEventListener("input", () => {
    if (debounceHandle) clearTimeout(debounceHandle);
    const query = input.value;
    debounceHandle = setTimeout(() => {
      searchPlayers(query)
        .then(showResults)
        .catch((error) => console.error(error));
    }, 300);
  });

  container.addEventListener("focusout", (event) => {
    if (!container.contains(event.relatedTarget as Node)) {
      results.hidden = true;
    }
  });
}
