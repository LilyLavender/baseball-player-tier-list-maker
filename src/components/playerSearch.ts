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
        aria-label="Add a player by name"
        autocomplete="off"
        role="combobox"
        aria-expanded="false"
        aria-controls="player-search-results"
      />
      <div
        id="player-search-results"
        class="player-search__results"
        role="listbox"
        aria-label="Player search results"
        hidden
      ></div>
    </div>
  `;
}

let debounceHandle: ReturnType<typeof setTimeout> | undefined;

export function bindPlayerSearch(onAdd: (player: PoolPlayer) => void): void {
  const container = document.getElementById("player-search")!;
  const input = document.getElementById("player-search-input") as HTMLInputElement;
  const results = document.getElementById("player-search-results") as HTMLDivElement;

  function setOpen(open: boolean): void {
    results.hidden = !open;
    input.setAttribute("aria-expanded", String(open));
  }

  function showResults(players: PoolPlayer[]): void {
    if (players.length === 0) {
      results.innerHTML = `<div class="player-search__result player-search__result--empty">No players found</div>`;
      setOpen(true);
      return;
    }
    results.innerHTML = players
      .slice(0, 15)
      .map(
        (player) =>
          `<div class="player-search__result" role="option" data-player-id="${player.id}" data-player-name="${player.fullName}">${player.fullName}</div>`,
      )
      .join("");
    setOpen(true);

    results.querySelectorAll<HTMLDivElement>(".player-search__result:not(.player-search__result--empty)").forEach((row) => {
      row.addEventListener("mousedown", (event) => {
        event.preventDefault();
        onAdd({ id: Number(row.dataset.playerId), fullName: row.dataset.playerName! });
        input.value = "";
        setOpen(false);
        results.innerHTML = "";
      });
    });
  }

  function showError(): void {
    results.innerHTML = `<div class="player-search__result player-search__result--empty">Search failed. Try again.</div>`;
    setOpen(true);
  }

  input.addEventListener("input", () => {
    if (debounceHandle) clearTimeout(debounceHandle);
    const query = input.value;
    if (!query.trim()) {
      setOpen(false);
      results.innerHTML = "";
      return;
    }
    debounceHandle = setTimeout(() => {
      searchPlayers(query)
        .then(showResults)
        .catch((error) => {
          console.error(error);
          showError();
        });
    }, 300);
  });

  container.addEventListener("focusout", (event) => {
    if (!container.contains(event.relatedTarget as Node)) {
      setOpen(false);
    }
  });
}
