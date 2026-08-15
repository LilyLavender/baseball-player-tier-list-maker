import "./styles/base.css";
import { fetchAllTeamsRoster, fetchRoster, fetchStatLeaders, fetchTeams } from "./api/mlbApi";
import { bindQueryBuilder, renderQueryBuilder } from "./components/queryBuilder";
import type { StatQueryParams } from "./components/queryBuilder";
import { renderPlayerPool } from "./components/playerPool";
import { bindTierBoard, renderTierBoard, tierDropZoneIds } from "./components/tierBoard";
import {
  initPoolSortable,
  initRemoveZoneSortable,
  initTierSortables,
} from "./dnd/dragAndDrop";
import { collectPoolPlayerIds, collectTierPlayerIds } from "./storage/collectBoardState";
import type { ActiveQuery } from "./storage/activeQuery";
import {
  deleteSavedList,
  duplicateSavedList,
  getAllSavedLists,
  getLastOpenedId,
  getSavedList,
  renameSavedList,
  setLastOpenedId,
  upsertSavedList,
} from "./storage/savedLists";
import { applyTheme, loadThemePref, saveThemePref } from "./storage/themePref";
import type { ThemeName } from "./storage/themePref";
import { bindHistoryPanel, renderHistoryPanel } from "./components/historyPanel";
import { qualifierFor, STAT_CATEGORIES } from "./data/statCategories";
import { cloneDefaultTiers } from "./data/tiers";
import type { TierDefinition } from "./data/tiers";
import { describeQuery } from "./utils/queryLabel";
import { exportTierListAsPng } from "./export/exportImage";
import { generateAutoTiers } from "./tiering/autoTier";
import type { AutoTierStrategy } from "./tiering/autoTier";
import type { PoolPlayer, Team } from "./types/mlb";

applyTheme(loadThemePref());

const app = document.querySelector<HTMLDivElement>("#app")!;
const playersById = new Map<number, PoolPlayer>();
let currentQuery: ActiveQuery | null = null;
let currentListId: string | null = null;
let currentTiers: TierDefinition[] = cloneDefaultTiers();
let teams: Team[] = [];

function rememberPlayers(players: PoolPlayer[]): void {
  for (const player of players) {
    playersById.set(player.id, player);
  }
}

function playersFromIds(ids: number[]): PoolPlayer[] {
  return ids.map((id) => playersById.get(id)).filter((p): p is PoolPlayer => p !== undefined);
}

function bindTierBoardCallbacks(): void {
  bindTierBoard({
    onRename: (index, label) => {
      currentTiers[index].label = label;
    },
    onRecolor: (index, color) => {
      currentTiers[index].color = color;
      const row = document.querySelectorAll<HTMLElement>(".tier-row")[index];
      row?.style.setProperty("--tier-color", color);
    },
    onMoveUp: (index) => {
      if (index === 0) return;
      const poolIds = collectPoolPlayerIds();
      const tierIds = collectTierPlayerIds(currentTiers.length);
      [currentTiers[index - 1], currentTiers[index]] = [currentTiers[index], currentTiers[index - 1]];
      [tierIds[index - 1], tierIds[index]] = [tierIds[index], tierIds[index - 1]];
      rerenderBoardAndPool(tierIds.map(playersFromIds), playersFromIds(poolIds));
    },
    onMoveDown: (index) => {
      if (index === currentTiers.length - 1) return;
      const poolIds = collectPoolPlayerIds();
      const tierIds = collectTierPlayerIds(currentTiers.length);
      [currentTiers[index + 1], currentTiers[index]] = [currentTiers[index], currentTiers[index + 1]];
      [tierIds[index + 1], tierIds[index]] = [tierIds[index], tierIds[index + 1]];
      rerenderBoardAndPool(tierIds.map(playersFromIds), playersFromIds(poolIds));
    },
    onDelete: (index) => {
      if (currentTiers.length <= 1) return;
      const poolIds = collectPoolPlayerIds();
      const tierIds = collectTierPlayerIds(currentTiers.length);
      const orphaned = tierIds[index] ?? [];
      currentTiers.splice(index, 1);
      tierIds.splice(index, 1);
      rerenderBoardAndPool(tierIds.map(playersFromIds), playersFromIds([...poolIds, ...orphaned]));
    },
    onAddTier: () => {
      const poolIds = collectPoolPlayerIds();
      const tierIds = collectTierPlayerIds(currentTiers.length);
      currentTiers.push({ label: "New", color: "#4a5568" });
      tierIds.push([]);
      rerenderBoardAndPool(tierIds.map(playersFromIds), playersFromIds(poolIds));
    },
  });
}

function renderPoolSection(poolContent: string): string {
  return `
    <section class="pool">
      <div class="pool__header">
        <h2 class="pool__heading">Unranked pool</h2>
        <div class="pool__header-actions">
          <button id="return-all-to-pool" type="button" class="pool__clear">Return all to pool</button>
          <button id="clear-pool" type="button" class="pool__clear">Clear pool</button>
        </div>
      </div>
      <div id="pool-content">${poolContent}</div>
    </section>
  `;
}

function bindClearPoolButton(): void {
  document.querySelector<HTMLButtonElement>("#clear-pool")!.addEventListener("click", () => {
    setPoolContent(`<p class="pool__placeholder">Players will appear here once a query runs.</p>`);
  });

  document.querySelector<HTMLButtonElement>("#return-all-to-pool")!.addEventListener("click", () => {
    const poolIds = collectPoolPlayerIds();
    const tierIds = collectTierPlayerIds(currentTiers.length).flat();
    const emptyTiers = currentTiers.map(() => []);
    rerenderBoardAndPool(emptyTiers, playersFromIds([...poolIds, ...tierIds]));
  });
}

function rerenderBoardAndPool(tierPlayers: PoolPlayer[][], poolPlayers: PoolPlayer[]): void {
  const boardWrap = document.querySelector<HTMLDivElement>(".board-wrap")!;
  boardWrap.innerHTML = `
    ${renderTierBoard(currentTiers, tierPlayers)}
    ${renderPoolSection(renderPlayerPool(poolPlayers))}
  `;
  initTierSortables(tierDropZoneIds(currentTiers.length));
  initPoolSortable();
  bindClearPoolButton();
  bindTierBoardCallbacks();
}

function openHistoryPanel(): void {
  document.body.insertAdjacentHTML("beforeend", renderHistoryPanel(getAllSavedLists()));
  bindHistoryPanel({
    onClose: closeHistoryPanel,
    onOpen: (id) => {
      closeHistoryPanel();
      void openSavedList(id);
    },
    onRename: (id) => {
      const list = getSavedList(id);
      if (!list) return;
      const title = window.prompt("Rename list", list.title);
      if (title && title.trim()) {
        renameSavedList(id, title.trim());
      }
      closeHistoryPanel();
      openHistoryPanel();
    },
    onDuplicate: (id) => {
      duplicateSavedList(id);
      closeHistoryPanel();
      openHistoryPanel();
    },
    onDelete: (id) => {
      if (window.confirm("Delete this saved list?")) {
        deleteSavedList(id);
      }
      closeHistoryPanel();
      openHistoryPanel();
    },
  });
}

function closeHistoryPanel(): void {
  document.querySelector("#history-overlay")?.remove();
}

function renderShell(
  queryBuilderContent: string,
  poolContent: string,
  tierPlayers: PoolPlayer[][] = [],
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
        <button id="new-list" type="button" class="topbar__btn">New</button>
        <button id="history-open" type="button" class="topbar__btn">History</button>
        <button id="export-list" type="button" class="topbar__btn">Export</button>
        <button id="save-list" type="button" class="topbar__save">Save</button>
      </div>
    </header>
    <div class="layout">
      <aside class="query-builder">
        ${queryBuilderContent}
        <div id="remove-zone" class="remove-zone">
          <div class="remove-zone__content">
            <span class="remove-zone__icon" aria-hidden="true">🗑</span>
            <span>Remove player</span>
          </div>
          <div id="remove-zone-drop" class="remove-zone__drop"></div>
        </div>
      </aside>
      <div class="board-wrap">
        ${renderTierBoard(currentTiers, tierPlayers)}
        ${renderPoolSection(poolContent)}
      </div>
    </div>
  `;
  initTierSortables(tierDropZoneIds(currentTiers.length));
  initPoolSortable();
  initRemoveZoneSortable();
  bindTierBoardCallbacks();
  bindClearPoolButton();

  document.querySelector<HTMLButtonElement>("#save-list")!.addEventListener("click", () => {
    let title = currentListId ? getSavedList(currentListId)?.title : undefined;
    if (!title) {
      const suggestion = describeQuery(currentQuery, teams);
      title = window.prompt("Name this tier list", suggestion) ?? undefined;
      if (!title || !title.trim()) return;
      title = title.trim();
    }

    const saved = upsertSavedList({
      id: currentListId,
      title,
      query: currentQuery,
      tiers: currentTiers,
      players: Array.from(playersById.values()),
      poolPlayerIds: collectPoolPlayerIds(),
      tierPlayerIds: collectTierPlayerIds(currentTiers.length),
    });
    currentListId = saved.id;
    setLastOpenedId(saved.id);
  });

  document.querySelector<HTMLButtonElement>("#new-list")!.addEventListener("click", () => {
    currentListId = null;
    currentQuery = null;
    currentTiers = cloneDefaultTiers();
    setLastOpenedId(null);
    renderShell(renderQueryBuilder(teams), `<p class="pool__placeholder">Players will appear here once a query runs.</p>`);
    bindQueryBuilderCallbacks();
  });

  document.querySelector<HTMLButtonElement>("#history-open")!.addEventListener("click", () => {
    openHistoryPanel();
  });

  document.querySelector<HTMLButtonElement>("#export-list")!.addEventListener("click", (event) => {
    const button = event.currentTarget as HTMLButtonElement;
    const title =
      (currentListId && getSavedList(currentListId)?.title) || describeQuery(currentQuery, teams);
    const tierPlayers = collectTierPlayerIds(currentTiers.length).map(playersFromIds);

    button.disabled = true;
    const originalLabel = button.textContent;
    button.textContent = "Exporting…";

    exportTierListAsPng(title, currentTiers, tierPlayers)
      .catch((error) => {
        console.error(error);
        window.alert("Couldn't export the tier list. Try again.");
      })
      .finally(() => {
        button.disabled = false;
        button.textContent = originalLabel;
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

async function loadTeamPool(teamId: number | "all", season: number): Promise<void> {
  currentQuery = { kind: "team", teamId, season };
  setPoolContent(
    `<p class="pool__placeholder">${teamId === "all" ? "Loading all rosters…" : "Loading roster…"}</p>`,
  );

  let players: PoolPlayer[] = [];
  try {
    players = teamId === "all" ? await fetchAllTeamsRoster(season) : await fetchRoster(teamId, season);
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

async function loadStatPool(params: StatQueryParams): Promise<void> {
  const stat = STAT_CATEGORIES.find((s) => s.id === params.statCategoryId);
  if (!stat) return;

  currentQuery = {
    kind: "stat",
    statCategoryId: params.statCategoryId,
    season: params.season,
    limit: params.limit,
  };
  setPoolContent(`<p class="pool__placeholder">Loading leaders…</p>`);

  let players: PoolPlayer[] = [];
  try {
    players = await fetchStatLeaders({
      sortStat: stat.sortStat,
      statKey: stat.statKey,
      statGroup: stat.group,
      order: stat.order,
      statLabel: stat.label,
      season: params.season,
      limit: params.limit,
      qualified: params.qualified,
      minValue: params.minValue,
      qualifierKey: qualifierFor(stat.group).key,
      minQualifierValue: params.minQualifierValue,
    });
  } catch (error) {
    setPoolContent(
      `<p class="pool__placeholder">Couldn't load that leaderboard. Try a different stat or season.</p>`,
    );
    console.error(error);
    return;
  }

  rememberPlayers(players);
  setPoolContent(renderPlayerPool(players));
}

function applyAutoTiers(strategy: AutoTierStrategy): void {
  const poolPlayers = playersFromIds(collectPoolPlayerIds());
  const query = currentQuery;
  const order =
    query !== null && query.kind === "stat"
      ? (STAT_CATEGORIES.find((s) => s.id === query.statCategoryId)?.order ?? "desc")
      : "desc";

  const { tiers, tierPlayers, leftoverPool } = generateAutoTiers(poolPlayers, order, strategy);
  if (tiers.length === 0) {
    window.alert("No stat values found in the pool. Run a stat leaders query first.");
    return;
  }

  currentTiers = tiers;
  rerenderBoardAndPool(tierPlayers, leftoverPool);
}

function bindQueryBuilderCallbacks(): void {
  bindQueryBuilder(teams, {
    onApplyTeam: (teamId, season) => {
      void loadTeamPool(teamId, season);
    },
    onApplyStat: (params) => {
      void loadStatPool(params);
    },
    onGenerateAutoTiers: (strategy) => {
      applyAutoTiers(strategy);
    },
  });
}

async function openSavedList(id: string): Promise<void> {
  const list = getSavedList(id);
  if (!list) return;

  rememberPlayers(list.players);
  currentQuery = list.query;
  currentListId = list.id;
  currentTiers = list.tiers?.length ? list.tiers.map((t) => ({ ...t })) : cloneDefaultTiers();
  setLastOpenedId(list.id);

  const poolPlayers = playersFromIds(list.poolPlayerIds);
  const tierPlayers = list.tierPlayerIds.map(playersFromIds);

  const selectedTeamQuery = list.query?.kind === "team" ? list.query : undefined;

  renderShell(renderQueryBuilder(teams, selectedTeamQuery), renderPlayerPool(poolPlayers), tierPlayers);
  bindQueryBuilderCallbacks();
}

async function init(): Promise<void> {
  renderShell(
    `<h2 class="query-builder__heading">Build your pool</h2><p class="query-builder__placeholder">Loading teams…</p>`,
    `<p class="pool__placeholder">Players will appear here once a query runs.</p>`,
  );

  teams = await fetchTeams();

  const lastOpenedId = getLastOpenedId();
  if (lastOpenedId && getSavedList(lastOpenedId)) {
    await openSavedList(lastOpenedId);
    return;
  }

  renderShell(renderQueryBuilder(teams), `<p class="pool__placeholder">Players will appear here once a query runs.</p>`);
  bindQueryBuilderCallbacks();
}

void init();
