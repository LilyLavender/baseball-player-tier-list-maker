import { searchPlayers } from "../api/mlbApi";
import { headshotUrl } from "../types/mlb";
import type { PoolPlayer } from "../types/mlb";

export function renderPlayerSearch(): string {
  return `
    <label class="query-builder__field">
      Player
      <input
        id="qb-search-input"
        type="text"
        placeholder="Search by name…"
        aria-label="Search by name"
        autocomplete="off"
        role="combobox"
        aria-expanded="false"
        aria-controls="qb-search-results"
      />
    </label>
    <div
      id="qb-search-results"
      class="player-search__results"
      role="listbox"
      aria-label="Player search results"
      hidden
    ></div>
  `;
}

let debounceHandle: ReturnType<typeof setTimeout> | undefined;

export function bindPlayerSearch(onAdd: (player: PoolPlayer) => void): void {
  const container = document.getElementById("qb-panel-search")!;
  const input = document.getElementById("qb-search-input") as HTMLInputElement;
  const results = document.getElementById("qb-search-results") as HTMLDivElement;

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
      .map((player) => {
        const primarySrc = headshotUrl(player.id, player.season);
        const fallbackSrc = headshotUrl(player.id);
        return `
          <div class="player-search__result" role="option" data-player-id="${player.id}" data-player-name="${player.fullName}">
            <img
              class="player-search__result-headshot"
              src="${primarySrc}"
              data-fallback-src="${fallbackSrc}"
              alt=""
              loading="lazy"
              width="28"
              height="32"
              onerror="if (this.src !== this.dataset.fallbackSrc) { this.src = this.dataset.fallbackSrc; } else { this.remove(); }"
            />
            <span>${player.fullName}</span>
          </div>
        `;
      })
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
