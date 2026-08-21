import "./styles/base.css";
import {
  fetchActivePlayerBirthCountries,
  fetchAllTeamsRoster,
  fetchBirthCountries,
  fetchRoster,
  fetchStatLeaders,
  fetchTeams,
  fetchTeamSeasonStats,
} from "./api/mlbApi";
import { bindQueryBuilder, renderQueryBuilder } from "./components/queryBuilder";
import type { StatQueryParams } from "./components/queryBuilder";
import { renderPlayerPool } from "./components/playerPool";
import {
  bindPoolFilters,
  emptyPoolFilterState,
  isPoolFilterActive,
  matchesPoolFilter,
  renderPoolFilters,
  syncPoolFilterUI,
} from "./components/poolFilters";
import type { PoolFilterState } from "./components/poolFilters";
import { bindPlayerSearch, renderPlayerSearch } from "./components/playerSearch";
import { bindTierBoard, renderTierBoard, tierDropZoneIds } from "./components/tierBoard";
import {
  initPoolSortable,
  initRemoveZoneSortable,
  initTierSortables,
  setOnBoardChange,
} from "./dnd/dragAndDrop";
import { collectPoolPlayerIds, collectTierPlayerIds, collectVisiblePoolPlayerIds } from "./storage/collectBoardState";
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
import { applyStatBadgePref, loadStatBadgePref, saveStatBadgePref } from "./storage/statBadgePref";
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
applyStatBadgePref(loadStatBadgePref());

const CURRENT_YEAR = new Date().getFullYear();
const app = document.querySelector<HTMLDivElement>("#app")!;
const playersById = new Map<number, PoolPlayer>();
let currentQuery: ActiveQuery | null = null;
let currentListId: string | null = null;
let currentTiers: TierDefinition[] = cloneDefaultTiers();
let teams: Team[] = [];
let currentPoolFilter: PoolFilterState = emptyPoolFilterState();
let currentStatValues = new Map<number, number>();
const teamStatCache = new Map<string, Map<number, number>>();
let activeCountryByPlayerId = new Map<number, string>();
let countryFilterOptions: string[] = [];
let poolDrawerOpen = true;

function rememberPlayers(players: PoolPlayer[]): void {
  for (const player of players) {
    if (player.birthCountry === undefined) {
      const activeCountry = activeCountryByPlayerId.get(player.id);
      if (activeCountry) player.birthCountry = activeCountry;
    }
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
    onResetTiers: () => {
      const poolIds = collectPoolPlayerIds();
      const tieredIds = collectTierPlayerIds(currentTiers.length).flat();
      currentTiers = cloneDefaultTiers();
      const emptyTiers = currentTiers.map(() => []);
      rerenderBoardAndPool(emptyTiers, playersFromIds([...poolIds, ...tieredIds]));
    },
  });
}

function renderPoolSection(poolContent: string): string {
  return `
    <section class="pool">
      <div class="pool__header">
        <h2 class="pool__heading">Unranked pool <span id="pool-count" class="pool__count"></span></h2>
        <div class="pool__header-actions">
          ${renderPlayerSearch()}
          <button id="return-all-to-pool" type="button" class="pool__clear">Return all to pool</button>
          <button id="clear-pool" type="button" class="pool__clear">Clear pool</button>
          <button
            id="pool-drawer-toggle"
            type="button"
            class="pool__drawer-toggle"
            aria-expanded="${poolDrawerOpen}"
            aria-controls="pool-body"
            aria-label="${poolDrawerOpen ? "Collapse" : "Expand"} unranked pool"
          ><span aria-hidden="true">${poolDrawerOpen ? "▾" : "▴"}</span></button>
        </div>
      </div>
      <div id="pool-body" class="pool__body">
        ${renderPoolFilters(teams, countryFilterOptions)}
        <div id="pool-content">${poolContent}</div>
      </div>
    </section>
  `;
}

function bindPoolDrawerToggle(): void {
  const rail = document.querySelector<HTMLElement>("#pool-rail");
  const toggle = document.querySelector<HTMLButtonElement>("#pool-drawer-toggle");
  if (!rail || !toggle) return;

  rail.classList.toggle("pool-rail--open", poolDrawerOpen);
  toggle.addEventListener("click", () => {
    poolDrawerOpen = !poolDrawerOpen;
    rail.classList.toggle("pool-rail--open", poolDrawerOpen);
    toggle.setAttribute("aria-expanded", String(poolDrawerOpen));
    toggle.setAttribute("aria-label", poolDrawerOpen ? "Collapse unranked pool" : "Expand unranked pool");
    toggle.querySelector("span")!.textContent = poolDrawerOpen ? "▾" : "▴";
  });
}

async function ensureStatValues(
  statCategoryId: string,
  players: PoolPlayer[],
  qualifiedOnly: boolean,
): Promise<Map<number, number>> {
  const stat = STAT_CATEGORIES.find((s) => s.id === statCategoryId);
  if (!stat) return new Map();

  const teamSeasonPairs = new Set<string>();
  for (const player of players) {
    if (player.teamId === undefined) continue;
    teamSeasonPairs.add(`${player.teamId}:${player.season ?? CURRENT_YEAR}`);
  }

  await Promise.all(
    Array.from(teamSeasonPairs).map(async (pair) => {
      const [teamIdStr, seasonStr] = pair.split(":");
      const teamId = Number(teamIdStr);
      const season = Number(seasonStr);
      const cacheKey = `${statCategoryId}:${teamId}:${season}:${qualifiedOnly}`;
      if (teamStatCache.has(cacheKey)) return;

      try {
        const raw = await fetchTeamSeasonStats(teamId, season, stat.group, qualifiedOnly);
        const values = new Map<number, number>();
        for (const [playerId, statLine] of raw) {
          const value = parseFloat(String(statLine[stat.statKey]));
          if (!Number.isNaN(value)) values.set(playerId, value);
        }
        teamStatCache.set(cacheKey, values);
      } catch (error) {
        console.error(`Couldn't load team stats for team ${teamId}, season ${season}`, error);
      }
    }),
  );

  const merged = new Map<number, number>();
  for (const pair of teamSeasonPairs) {
    const [teamIdStr, seasonStr] = pair.split(":");
    const values = teamStatCache.get(`${statCategoryId}:${teamIdStr}:${seasonStr}:${qualifiedOnly}`);
    if (!values) continue;
    for (const [playerId, value] of values) merged.set(playerId, value);
  }
  return merged;
}

/** Fetches and caches birth country for any pool player that doesn't have it yet, in place. */
async function ensureBirthCountries(players: PoolPlayer[]): Promise<void> {
  const missingIds = players.filter((p) => p.birthCountry === undefined).map((p) => p.id);
  if (missingIds.length === 0) return;

  const countries = await fetchBirthCountries(missingIds);
  for (const player of players) {
    const country = countries.get(player.id);
    if (country) player.birthCountry = country;
  }
}

function applyPoolFilterToDom(): void {
  const cards = document.querySelectorAll<HTMLElement>("#pool-content .player-card");
  cards.forEach((card) => {
    const id = Number(card.dataset.playerId);
    const player = playersById.get(id);
    const visible = !player || matchesPoolFilter(player, currentPoolFilter, currentStatValues);
    card.classList.toggle("player-card--filtered-out", !visible);
  });
  updatePoolCount();
}

function bindPoolFilterControls(): void {
  syncPoolFilterUI(currentPoolFilter);
  bindPoolFilters(
    teams,
    (state) => {
      currentPoolFilter = state;
      const poolPlayers = playersFromIds(collectPoolPlayerIds());

      const statValuesPromise =
        state.statCategoryId && state.statValue !== null
          ? ensureStatValues(state.statCategoryId, poolPlayers, state.qualifiedOnly)
          : Promise.resolve(new Map<number, number>());
      const birthCountriesPromise =
        state.birthCountries.size > 0 ? ensureBirthCountries(poolPlayers) : Promise.resolve();

      const statusEl = document.querySelector<HTMLSpanElement>("#pf-status");
      const applyButton = document.querySelector<HTMLButtonElement>("#pf-apply");
      if (statusEl) statusEl.textContent = "Applying…";
      if (applyButton) applyButton.disabled = true;

      void Promise.all([statValuesPromise, birthCountriesPromise])
        .then(([values]) => {
          currentStatValues = values;
          applyPoolFilterToDom();
          if (statusEl) statusEl.textContent = "";
        })
        .catch((error) => {
          console.error(error);
          if (statusEl) statusEl.textContent = "Couldn't load data for the pool filter. Try again.";
        })
        .finally(() => {
          if (applyButton) applyButton.disabled = false;
        });
    },
    () => {
      currentPoolFilter = emptyPoolFilterState();
      currentStatValues = new Map();
      applyPoolFilterToDom();
    },
  );
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

  bindPlayerSearch((player) => {
    rememberPlayers([player]);
    const existingIds = new Set([
      ...collectPoolPlayerIds(),
      ...collectTierPlayerIds(currentTiers.length).flat(),
    ]);
    if (existingIds.has(player.id)) return;

    const poolPlayers = playersFromIds(collectPoolPlayerIds());
    setPoolContent(renderPlayerPool([...poolPlayers, player]));
  });
}

function rerenderBoardAndPool(tierPlayers: PoolPlayer[][], poolPlayers: PoolPlayer[]): void {
  const boardWrap = document.querySelector<HTMLDivElement>(".board-wrap")!;
  boardWrap.innerHTML = renderTierBoard(currentTiers, tierPlayers);

  const poolRail = document.querySelector<HTMLElement>("#pool-rail")!;
  poolRail.innerHTML = renderPoolSection(renderPlayerPool(poolPlayers));

  initTierSortables(tierDropZoneIds(currentTiers.length));
  initPoolSortable();
  bindClearPoolButton();
  bindTierBoardCallbacks();
  bindPoolFilterControls();
  bindPoolDrawerToggle();
  applyPoolFilterToDom();
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
        <button id="theme-toggle" type="button" class="topbar__theme-toggle" title="Toggle light/dark theme">
          <span class="topbar__theme-toggle-icon" aria-hidden="true">🌙</span>
        </button>
        <label class="topbar__checkbox">
          <input id="stat-badge-toggle" type="checkbox" />
          Show stat numbers
        </label>
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
      </div>
      <aside class="pool-rail" id="pool-rail">
        ${renderPoolSection(poolContent)}
      </aside>
    </div>
  `;
  initTierSortables(tierDropZoneIds(currentTiers.length));
  initPoolSortable();
  initRemoveZoneSortable();
  bindTierBoardCallbacks();
  bindClearPoolButton();
  bindPoolFilterControls();
  bindPoolDrawerToggle();
  applyPoolFilterToDom();

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
    currentPoolFilter = emptyPoolFilterState();
    currentStatValues = new Map();
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

  const themeToggle = document.querySelector<HTMLButtonElement>("#theme-toggle")!;
  const themeToggleIcon = themeToggle.querySelector<HTMLSpanElement>(".topbar__theme-toggle-icon")!;
  const syncThemeToggle = (theme: ThemeName) => {
    themeToggleIcon.textContent = theme === "dark" ? "☀️" : "🌙";
    themeToggle.setAttribute("aria-label", theme === "dark" ? "Switch to light theme" : "Switch to dark theme");
  };
  syncThemeToggle(loadThemePref());
  themeToggle.addEventListener("click", () => {
    const theme: ThemeName = loadThemePref() === "dark" ? "light" : "dark";
    applyTheme(theme);
    saveThemePref(theme);
    syncThemeToggle(theme);
  });

  const statBadgeToggle = document.querySelector<HTMLInputElement>("#stat-badge-toggle")!;
  statBadgeToggle.checked = loadStatBadgePref();
  statBadgeToggle.addEventListener("change", () => {
    applyStatBadgePref(statBadgeToggle.checked);
    saveStatBadgePref(statBadgeToggle.checked);
  });
}

function updatePoolCount(): void {
  const countEl = document.querySelector<HTMLSpanElement>("#pool-count");
  if (!countEl) return;
  const cards = document.querySelectorAll<HTMLElement>("#pool-content .player-card");
  const total = cards.length;
  if (!isPoolFilterActive(currentPoolFilter)) {
    countEl.textContent = `(${total})`;
    return;
  }
  const visible = Array.from(cards).filter((c) => !c.classList.contains("player-card--filtered-out")).length;
  countEl.textContent = `(${visible} of ${total})`;
}

function setPoolContent(html: string): void {
  document.querySelector<HTMLDivElement>("#pool-content")!.innerHTML = html;
  initPoolSortable();
  applyPoolFilterToDom();
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

  const season = params.scope === "career" ? undefined : params.season;

  currentQuery = {
    kind: "stat",
    statCategoryId: params.statCategoryId,
    scope: params.scope,
    season,
    limit: params.limit,
  };
  setPoolContent(
    `<p class="pool__placeholder">${params.scope === "career" ? "Loading career leaders…" : "Loading leaders…"}</p>`,
  );

  let players: PoolPlayer[] = [];
  try {
    players = await fetchStatLeaders({
      sortStat: stat.sortStat,
      statKey: stat.statKey,
      statGroup: stat.group,
      order: stat.order,
      statLabel: stat.label,
      season,
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
  const visibleIds = new Set(collectVisiblePoolPlayerIds());
  const filteredOutIds = collectPoolPlayerIds().filter((id) => !visibleIds.has(id));
  const poolPlayers = playersFromIds(Array.from(visibleIds));
  const query = currentQuery;
  const order =
    query !== null && query.kind === "stat"
      ? (STAT_CATEGORIES.find((s) => s.id === query.statCategoryId)?.order ?? "desc")
      : "desc";

  const resolvedStrategy: AutoTierStrategy =
    strategy.kind === "auto-grouping" && strategy.scheme === "custom"
      ? { ...strategy, customTiers: currentTiers }
      : strategy;

  const { tiers, tierPlayers, leftoverPool } = generateAutoTiers(poolPlayers, order, resolvedStrategy);
  if (tiers.length === 0) {
    window.alert("No stat values found in the pool. Run a stat leaders query first.");
    return;
  }

  currentTiers = tiers;
  rerenderBoardAndPool(tierPlayers, [...leftoverPool, ...playersFromIds(filteredOutIds)]);
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
  currentPoolFilter = emptyPoolFilterState();
  currentStatValues = new Map();
  setLastOpenedId(list.id);

  const poolPlayers = playersFromIds(list.poolPlayerIds);
  const tierPlayers = list.tierPlayerIds.map(playersFromIds);

  const selectedTeamQuery = list.query?.kind === "team" ? list.query : undefined;

  renderShell(renderQueryBuilder(teams, selectedTeamQuery), renderPlayerPool(poolPlayers), tierPlayers);
  bindQueryBuilderCallbacks();
}

function renderInitError(): void {
  app.innerHTML = `
    <div class="state-banner state-banner--error" style="padding: 2rem; justify-content: center;">
      <span>Couldn't load MLB team data. Check your connection and try again.</span>
      <button type="button" id="init-retry" class="state-banner__retry">Retry</button>
    </div>
  `;
  document.querySelector<HTMLButtonElement>("#init-retry")!.addEventListener("click", () => {
    void init();
  });
}

async function init(): Promise<void> {
  renderShell(
    `<h2 class="query-builder__heading">Build your pool</h2><p class="query-builder__placeholder">Loading teams…</p>`,
    `<p class="pool__placeholder">Players will appear here once a query runs.</p>`,
  );

  let fetchedTeams: Team[];
  let activeCountries: { byPlayerId: Map<number, string>; countries: string[] };
  try {
    [fetchedTeams, activeCountries] = await Promise.all([
      fetchTeams(),
      fetchActivePlayerBirthCountries(CURRENT_YEAR).catch((error) => {
        console.error("Couldn't load active player birth countries", error);
        return { byPlayerId: new Map<number, string>(), countries: [] };
      }),
    ]);
  } catch (error) {
    console.error("Couldn't load teams", error);
    renderInitError();
    return;
  }
  teams = fetchedTeams;
  activeCountryByPlayerId = activeCountries.byPlayerId;
  countryFilterOptions = activeCountries.countries;

  const lastOpenedId = getLastOpenedId();
  if (lastOpenedId && getSavedList(lastOpenedId)) {
    await openSavedList(lastOpenedId);
    return;
  }

  renderShell(renderQueryBuilder(teams), `<p class="pool__placeholder">Players will appear here once a query runs.</p>`);
  bindQueryBuilderCallbacks();
}

setOnBoardChange(updatePoolCount);
void init();
