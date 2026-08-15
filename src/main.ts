import "./styles/base.css";
import { fetchRoster, fetchTeams } from "./api/mlbApi";
import { bindQueryBuilder, renderQueryBuilder } from "./components/queryBuilder";
import { renderPlayerPool } from "./components/playerPool";
import { renderTierBoard } from "./components/tierBoard";
import { initPoolSortable, initTierSortables } from "./dnd/dragAndDrop";
import type { RosterPlayer } from "./types/mlb";

const app = document.querySelector<HTMLDivElement>("#app")!;

function renderShell(queryBuilderContent: string): void {
  app.innerHTML = `
    <header class="topbar">
      <span class="topbar__wordmark">MLB Tier List Maker</span>
    </header>
    <div class="layout">
      <aside class="query-builder">${queryBuilderContent}</aside>
      <div class="board-wrap">
        ${renderTierBoard()}
        <section class="pool">
          <h2 class="pool__heading">Unranked pool</h2>
          <div id="pool-content">
            <p class="pool__placeholder">Players will appear here once a query runs.</p>
          </div>
        </section>
      </div>
    </div>
  `;
}

function setPoolContent(html: string): void {
  document.querySelector<HTMLDivElement>("#pool-content")!.innerHTML = html;
  initPoolSortable();
}

async function loadPool(teamId: number, season: number): Promise<void> {
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

  setPoolContent(renderPlayerPool(players));
}

async function init(): Promise<void> {
  renderShell(
    `<h2 class="query-builder__heading">Build your pool</h2><p class="query-builder__placeholder">Loading teams…</p>`,
  );

  const teams = await fetchTeams();
  renderShell(renderQueryBuilder(teams));
  initTierSortables();

  bindQueryBuilder({
    onApply: (teamId, season) => {
      void loadPool(teamId, season);
    },
  });
}

void init();
