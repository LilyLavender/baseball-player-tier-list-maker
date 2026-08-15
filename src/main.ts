import "./styles/base.css";
import { fetchRoster, fetchTeams } from "./api/mlbApi";
import { bindQueryBuilder, renderQueryBuilder } from "./components/queryBuilder";
import { renderPlayerPool } from "./components/playerPool";
import { renderTierBoard } from "./components/tierBoard";
import { initPoolSortable, initTierSortables, initTrashSortable } from "./dnd/dragAndDrop";
import { collectPoolPlayerIds, collectTierPlayerIds } from "./storage/collectBoardState";
import { loadActiveList, saveActiveList } from "./storage/activeList";
import { applyTheme, loadThemePref, saveThemePref } from "./storage/themePref";
import type { ThemeName } from "./storage/themePref";
import type { RosterPlayer } from "./types/mlb";

applyTheme(loadThemePref());

const app = document.querySelector<HTMLDivElement>("#app")!;
const playersById = new Map<number, RosterPlayer>();
let currentQuery: { teamId: number; season: number } | null = null;

function rememberPlayers(players: RosterPlayer[]): void {
  for (const player of players) {
    playersById.set(player.id, player);
  }
}

function renderShell(
  queryBuilderContent: string,
  poolContent: string,
  tierPlayers: RosterPlayer[][] = [],
): void {
  app.innerHTML = `
    <header class="topbar">
      <span class="topbar__wordmark">MLB Tier List Maker</span>
      <div class="topbar__controls">
        <select id="theme-select" class="topbar__theme-select">
          <option value="scorecard">Scorecard</option>
          <option value="light">Classic Light</option>
          <option value="dark">Classic Dark</option>
        </select>
        <button id="save-list" type="button" class="topbar__save">Save</button>
      </div>
    </header>
    <div class="layout">
      <aside class="query-builder">${queryBuilderContent}</aside>
      <div class="board-wrap">
        ${renderTierBoard(tierPlayers)}
        <section class="pool">
          <h2 class="pool__heading">Unranked pool</h2>
          <div id="pool-content">${poolContent}</div>
        </section>
      </div>
    </div>
    <div id="trash-zone" class="trash-zone">Drag here to remove</div>
  `;
  initTierSortables();
  initPoolSortable();
  initTrashSortable();

  document.querySelector<HTMLButtonElement>("#save-list")!.addEventListener("click", () => {
    saveActiveList({
      query: currentQuery,
      players: Array.from(playersById.values()),
      poolPlayerIds: collectPoolPlayerIds(),
      tierPlayerIds: collectTierPlayerIds(),
    });
  });

  const themeSelect = document.querySelector<HTMLSelectElement>("#theme-select")!;
  themeSelect.value = loadThemePref();
  themeSelect.addEventListener("change", () => {
    const theme = themeSelect.value as ThemeName;
    applyTheme(theme);
    saveThemePref(theme);
  });
}

function setPoolContent(html: string): void {
  document.querySelector<HTMLDivElement>("#pool-content")!.innerHTML = html;
  initPoolSortable();
}

async function loadPool(teamId: number, season: number): Promise<void> {
  currentQuery = { teamId, season };
  setPoolContent(`<p class="pool__placeholder">Loading roster…</p>`);

  let players: RosterPlayer[] = [];
  try {
    players = await fetchRoster(teamId, season);
  } catch (error) {
    setPoolContent(
      `<p class="pool__placeholder">Couldn't load that roster. Try a different team or season.</p>`,
    );
    console.error(error);
    return;
  }

  rememberPlayers(players);
  setPoolContent(renderPlayerPool(players));
}

async function init(): Promise<void> {
  renderShell(
    `<h2 class="query-builder__heading">Build your pool</h2><p class="query-builder__placeholder">Loading teams…</p>`,
    `<p class="pool__placeholder">Players will appear here once a query runs.</p>`,
  );

  const teams = await fetchTeams();
  const saved = loadActiveList();

  if (saved) {
    rememberPlayers(saved.players);
    currentQuery = saved.query;

    const poolPlayers = saved.poolPlayerIds
      .map((id) => playersById.get(id))
      .filter((p): p is RosterPlayer => p !== undefined);
    const tierPlayers = saved.tierPlayerIds.map((ids) =>
      ids.map((id) => playersById.get(id)).filter((p): p is RosterPlayer => p !== undefined),
    );

    renderShell(
      renderQueryBuilder(teams, saved.query ?? undefined),
      renderPlayerPool(poolPlayers),
      tierPlayers,
    );
  } else {
    renderShell(renderQueryBuilder(teams), `<p class="pool__placeholder">Players will appear here once a query runs.</p>`);
  }

  bindQueryBuilder({
    onApply: (teamId, season) => {
      void loadPool(teamId, season);
    },
  });
}

void init();
