import type { PoolPlayer, Team } from "../types/mlb";
import { teamLogoUrl } from "../types/mlb";
import { statOptions } from "../data/statCategories";
import { continentForCountry, flagForCountry } from "../data/countryFlags";
import { icon } from "../utils/icon";
import { escapeHtml } from "../utils/escapeHtml";

/** A two-way player's `positionAbbreviation` is just "TWP", so treat them as playing both. */
const TWO_WAY_SPECIFIC_POSITIONS = ["P", "DH"];

const POSITION_GROUPS: { label: string; positions: string[] }[] = [
  { label: "Infield", positions: ["1B", "2B", "3B", "SS"] },
  { label: "Outfield", positions: ["LF", "CF", "RF", "OF"] },
  { label: "Other", positions: ["C", "DH", "P", "TWP"] },
];

export type StatComparator = ">=" | "<=";

export interface StatCondition {
  kind: "condition";
  id: string;
  /** null until the user picks a stat for a newly added condition row. */
  statCategoryId: string | null;
  comparator: StatComparator;
  value: number | null;
}

export interface StatGroup {
  kind: "group";
  id: string;
  operator: "AND" | "OR";
  children: StatExpr[];
}

export type StatExpr = StatCondition | StatGroup;

let statNodeIdCounter = 0;
function nextStatNodeId(): string {
  return `sn-${++statNodeIdCounter}`;
}

export function makeStatCondition(): StatCondition {
  return { kind: "condition", id: nextStatNodeId(), statCategoryId: null, comparator: ">=", value: null };
}

export function makeStatGroup(operator: "AND" | "OR" = "AND", children: StatExpr[] = []): StatGroup {
  return { kind: "group", id: nextStatNodeId(), operator, children };
}

function cloneStatExpr(expr: StatExpr): StatExpr {
  return expr.kind === "condition" ? { ...expr } : { ...expr, children: expr.children.map(cloneStatExpr) };
}

/**
 * Drops incomplete conditions (no stat picked, or no value entered) and groups left empty as a
 * result, so a half-built tree left over from editing doesn't affect matching or fetching. Never
 * returns null for the root: an entirely-pruned tree becomes an empty group, meaning "no stat
 * filter".
 */
function pruneStatExpr(expr: StatExpr): StatExpr | null {
  if (expr.kind === "condition") {
    return expr.statCategoryId !== null && expr.value !== null ? expr : null;
  }
  const children = expr.children.map(pruneStatExpr).filter((child): child is StatExpr => child !== null);
  return children.length === 0 ? null : { ...expr, children };
}

function pruneStatRoot(root: StatGroup): StatGroup {
  const pruned = pruneStatExpr(root);
  return (pruned as StatGroup | null) ?? makeStatGroup(root.operator, []);
}

function statExprHasCondition(expr: StatExpr): boolean {
  if (expr.kind === "condition") return expr.statCategoryId !== null && expr.value !== null;
  return expr.children.some(statExprHasCondition);
}

/** Distinct stat category ids referenced anywhere in the tree, for fetching. */
export function collectStatCategoryIds(expr: StatExpr): string[] {
  const ids = new Set<string>();
  const visit = (node: StatExpr): void => {
    if (node.kind === "condition") {
      if (node.statCategoryId !== null) ids.add(node.statCategoryId);
    } else {
      node.children.forEach(visit);
    }
  };
  visit(expr);
  return Array.from(ids);
}

/**
 * True if `player` should be shown given `statValuesByCategory` (a map from stat category id to
 * per-player values for that category). A condition whose value is missing for this player fails
 * just that condition rather than the whole tree, so it can still be routed around by an
 * enclosing OR.
 */
export function evaluateStatExpr(
  expr: StatExpr,
  playerId: number,
  statValuesByCategory: Map<string, Map<number, number>>,
): boolean {
  if (expr.kind === "condition") {
    if (expr.statCategoryId === null || expr.value === null) return true;
    const value = statValuesByCategory.get(expr.statCategoryId)?.get(playerId);
    if (value === undefined) return false;
    return expr.comparator === ">=" ? value >= expr.value : value <= expr.value;
  }
  if (expr.children.length === 0) return true;
  return expr.operator === "AND"
    ? expr.children.every((child) => evaluateStatExpr(child, playerId, statValuesByCategory))
    : expr.children.some((child) => evaluateStatExpr(child, playerId, statValuesByCategory));
}

export interface PoolFilterState {
  teamIds: Set<number>;
  specificPositions: Set<string>;
  birthCountries: Set<string>;
  statExpr: StatGroup;
}

export function emptyPoolFilterState(): PoolFilterState {
  return {
    teamIds: new Set(),
    specificPositions: new Set(),
    birthCountries: new Set(),
    statExpr: makeStatGroup("AND", []),
  };
}

export function isPoolFilterActive(state: PoolFilterState): boolean {
  return poolFilterActiveCount(state) > 0;
}

/** Number of independent filter dimensions currently active, for the "Filter pool" badge. */
export function poolFilterActiveCount(state: PoolFilterState): number {
  let count = 0;
  if (state.teamIds.size > 0) count++;
  if (state.specificPositions.size > 0) count++;
  if (state.birthCountries.size > 0) count++;
  if (statExprHasCondition(state.statExpr)) count++;
  return count;
}

/**
 * True if `player` should be shown. A stat filter that can't be evaluated (no cached value for
 * this player) hides the player rather than showing it, since "unknown" shouldn't pass a
 * threshold check. Same for a country filter when the player's birth country hasn't been fetched.
 */
export function matchesPoolFilter(
  player: PoolPlayer,
  state: PoolFilterState,
  statValuesByCategory: Map<string, Map<number, number>>,
): boolean {
  if (state.teamIds.size > 0 && (player.teamId === undefined || !state.teamIds.has(player.teamId))) {
    return false;
  }
  const isTwoWay = player.positionAbbreviation === "TWP";
  if (state.specificPositions.size > 0) {
    const matchesSpecificPosition = isTwoWay
      ? TWO_WAY_SPECIFIC_POSITIONS.some((pos) => state.specificPositions.has(pos)) ||
        state.specificPositions.has("TWP")
      : player.positionAbbreviation !== undefined && state.specificPositions.has(player.positionAbbreviation);
    if (!matchesSpecificPosition) return false;
  }
  if (
    state.birthCountries.size > 0 &&
    (player.birthCountry === undefined || !state.birthCountries.has(player.birthCountry))
  ) {
    return false;
  }
  if (state.statExpr.children.length > 0 && !evaluateStatExpr(state.statExpr, player.id, statValuesByCategory)) {
    return false;
  }
  return true;
}

function groupTeamsByDivision(teams: Team[]): Map<string, Team[]> {
  const groups = new Map<string, Team[]>();
  for (const team of teams.slice().sort((a, b) => a.name.localeCompare(b.name))) {
    const key = team.divisionName ?? "Other";
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(team);
  }
  return groups;
}

function renderTeamPicker(teams: Team[]): string {
  const divisions = groupTeamsByDivision(teams);
  const divisionsHtml = Array.from(divisions.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(
      ([division, divisionTeams]) => `
        <div class="pool-filters__division-column">
          <button
            type="button"
            class="pool-filters__division-toggle"
            data-division-toggle="${escapeHtml(division)}"
            title="Select/deselect all of ${escapeHtml(division)}"
            aria-label="Select/deselect all of ${escapeHtml(division)}"
          >${icon("add")}</button>
          <div class="pool-filters__team-column">
            ${divisionTeams
              .map(
                (team) => `
                  <button
                    type="button"
                    class="pool-filters__team-btn"
                    data-team-id="${team.id}"
                    aria-pressed="false"
                    title="${escapeHtml(team.name)}"
                  >
                    <img src="${teamLogoUrl(team.id)}" alt="${escapeHtml(team.name)}" loading="lazy" />
                  </button>
                `,
              )
              .join("")}
          </div>
        </div>
      `,
    )
    .join("");

  return `
    <div class="pool-filters__picker">
      <div class="pool-filters__picker-toolbar">
        <span class="pool-filters__label">Teams</span>
        <button type="button" id="pf-team-select-all" class="pool-filters__select-all-btn" aria-pressed="false">Select all</button>
      </div>
      <div id="pf-team-grid" class="pool-filters__team-columns">${divisionsHtml}</div>
    </div>
  `;
}

function groupCountriesByContinent(countries: string[]): Map<string, string[]> {
  const groups = new Map<string, string[]>();
  for (const country of countries.slice().sort((a, b) => a.localeCompare(b))) {
    const key = continentForCountry(country);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(country);
  }
  return groups;
}

const MAX_COLUMN_ITEMS = 5;

function chunk<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) chunks.push(items.slice(i, i + size));
  return chunks;
}

function renderCountryContinentsHtml(countries: string[]): string {
  const continents = groupCountriesByContinent(countries);
  return Array.from(continents.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([continent, continentCountries]) => {
      const columnsHtml = chunk(continentCountries, MAX_COLUMN_ITEMS)
        .map(
          (column) => `
            <div class="pool-filters__team-column">
              ${column
                .map(
                  (country) => `
                    <button
                      type="button"
                      class="pool-filters__country-btn"
                      data-country="${escapeHtml(country)}"
                      aria-pressed="false"
                      title="${escapeHtml(country)}"
                    >
                      ${flagForCountry(country)}
                    </button>
                  `,
                )
                .join("")}
            </div>
          `,
        )
        .join("");

      return `
        <div class="pool-filters__division-column">
          <button
            type="button"
            class="pool-filters__division-toggle"
            data-continent-toggle="${escapeHtml(continent)}"
            title="Select/deselect all of ${escapeHtml(continent)}"
            aria-label="Select/deselect all of ${escapeHtml(continent)}"
          >${icon("add")}</button>
          <div class="pool-filters__team-subcolumns">${columnsHtml}</div>
        </div>
      `;
    })
    .join("");
}

/** Hidden entirely when there's nothing (or only one country) to filter by. */
function renderCountryPicker(countries: string[]): string {
  return `
    <div class="pool-filters__picker" id="pf-country-picker"${countries.length <= 1 ? " hidden" : ""}>
      <div class="pool-filters__picker-toolbar">
        <span class="pool-filters__label">Country of birth</span>
        <button type="button" id="pf-country-select-all" class="pool-filters__select-all-btn" aria-pressed="false">Select all</button>
      </div>
      <div id="pf-country-grid" class="pool-filters__team-columns">${renderCountryContinentsHtml(countries)}</div>
    </div>
  `;
}

function renderPositionPicker(): string {
  const groupsHtml = POSITION_GROUPS.map(
    (group) => `
      <div class="pool-filters__division-column">
        <button
          type="button"
          class="pool-filters__division-toggle"
          data-position-group-toggle="${escapeHtml(group.label)}"
          title="Select/deselect all ${escapeHtml(group.label)} positions"
          aria-label="Select/deselect all ${escapeHtml(group.label)} positions"
        >${icon("add")}</button>
        <div class="pool-filters__team-column">
          ${group.positions
            .map(
              (pos) => `
                <button
                  type="button"
                  class="pool-filters__position-btn"
                  data-position="${pos}"
                  aria-pressed="false"
                  title="${escapeHtml(group.label)}"
                >${pos}</button>
              `,
            )
            .join("")}
        </div>
      </div>
    `,
  ).join("");

  return `
    <div class="pool-filters__picker">
      <div class="pool-filters__picker-toolbar">
        <span class="pool-filters__label">Position</span>
        <button type="button" id="pf-position-select-all" class="pool-filters__select-all-btn" aria-pressed="false">Select all</button>
      </div>
      <div id="pf-position-grid" class="pool-filters__team-columns">${groupsHtml}</div>
    </div>
  `;
}

let filtersOpen = false;

/** Whether the collapsible "Advanced stat filter" section is expanded. Collapsed by default so
 * the popover stays compact for the common case of no stat filter at all. */
let statAdvancedOpen = false;

/**
 * The stat tree currently being edited in the popover. Unlike the team/position/country
 * pickers (which read `aria-pressed` off a fixed set of buttons at Apply time), the stat tree's
 * DOM shape itself changes as groups and conditions are added or removed, so it's modeled as
 * real state that drives re-rendering instead. Reset from the applied `PoolFilterState.statExpr`
 * whenever the popover's contents are resynced (see `syncPoolFilterUI`), so edits are local to
 * the popover until Apply.
 */
let editableStatExpr: StatGroup = makeStatGroup("AND", []);

function findStatGroup(root: StatGroup, id: string): StatGroup | null {
  if (root.id === id) return root;
  for (const child of root.children) {
    if (child.kind === "group") {
      const found = findStatGroup(child, id);
      if (found) return found;
    }
  }
  return null;
}

function findStatParentOf(root: StatGroup, childId: string): StatGroup | null {
  for (const child of root.children) {
    if (child.id === childId) return root;
    if (child.kind === "group") {
      const found = findStatParentOf(child, childId);
      if (found) return found;
    }
  }
  return null;
}

function findStatCondition(root: StatGroup, id: string): StatCondition | null {
  for (const child of root.children) {
    if (child.kind === "condition") {
      if (child.id === id) return child;
    } else {
      const found = findStatCondition(child, id);
      if (found) return found;
    }
  }
  return null;
}

function addStatConditionTo(groupId: string): void {
  findStatGroup(editableStatExpr, groupId)?.children.push(makeStatCondition());
}

function addStatGroupTo(groupId: string): void {
  findStatGroup(editableStatExpr, groupId)?.children.push(makeStatGroup("AND", []));
}

function removeStatNode(nodeId: string): void {
  const parent = findStatParentOf(editableStatExpr, nodeId);
  if (!parent) return;
  parent.children = parent.children.filter((child) => child.id !== nodeId);
}

function setStatGroupOperator(groupId: string, operator: "AND" | "OR"): void {
  const group = findStatGroup(editableStatExpr, groupId);
  if (group) group.operator = operator;
}

function setStatConditionField(
  conditionId: string,
  patch: Partial<Pick<StatCondition, "statCategoryId" | "comparator" | "value">>,
): void {
  const condition = findStatCondition(editableStatExpr, conditionId);
  if (condition) Object.assign(condition, patch);
}

function renderStatExprNode(expr: StatExpr, isRoot: boolean): string {
  if (expr.kind === "condition") {
    const statOpts = statOptions()
      .map(
        (opt) =>
          `<option value="${opt.value}"${opt.value === expr.statCategoryId ? " selected" : ""}>${escapeHtml(opt.label)}</option>`,
      )
      .join("");
    return `
      <div class="pool-filters__stat-condition" data-node-id="${expr.id}">
        <select class="pool-filters__stat-condition-stat" data-node-id="${expr.id}" data-field="stat">
          <option value="">Choose stat…</option>
          ${statOpts}
        </select>
        <select class="pool-filters__stat-condition-comparator" data-node-id="${expr.id}" data-field="comparator">
          <option value=">="${expr.comparator === ">=" ? " selected" : ""}>at least</option>
          <option value="<="${expr.comparator === "<=" ? " selected" : ""}>at most</option>
        </select>
        <input
          type="number"
          step="any"
          placeholder="value"
          class="pool-filters__stat-condition-value"
          data-node-id="${expr.id}"
          data-field="value"
          value="${expr.value === null ? "" : expr.value}"
        />
        <button
          type="button"
          class="pool-filters__stat-remove"
          data-remove-node="${expr.id}"
          title="Remove condition"
          aria-label="Remove condition"
        >${icon("close")}</button>
      </div>
    `;
  }

  const childrenHtml = expr.children.length
    ? expr.children
        .map(
          (child, i) => `
            ${i > 0 ? `<div class="pool-filters__stat-group-op-label">${expr.operator}</div>` : ""}
            ${renderStatExprNode(child, false)}
          `,
        )
        .join("")
    : `<p class="pool-filters__stat-empty">No conditions yet.</p>`;

  // AND/OR only matters, and is only shown, once there's more than one condition to combine.
  const showOperatorToggle = expr.children.length > 1;
  const showRemove = !isRoot;
  const headerHtml =
    showOperatorToggle || showRemove
      ? `
        <div class="pool-filters__stat-group-header">
          ${
            showOperatorToggle
              ? `
                <div class="pool-filters__stat-group-toggle" role="group">
                  <button
                    type="button"
                    class="pool-filters__stat-op-btn${expr.operator === "AND" ? " pool-filters__stat-op-btn--active" : ""}"
                    data-set-operator="${expr.id}"
                    data-operator="AND"
                  >AND</button>
                  <button
                    type="button"
                    class="pool-filters__stat-op-btn${expr.operator === "OR" ? " pool-filters__stat-op-btn--active" : ""}"
                    data-set-operator="${expr.id}"
                    data-operator="OR"
                  >OR</button>
                </div>
              `
              : ""
          }
          ${
            showRemove
              ? `<button type="button" class="pool-filters__stat-remove" data-remove-node="${expr.id}" title="Remove group" aria-label="Remove group">${icon("close")}</button>`
              : ""
          }
        </div>
      `
      : "";

  return `
    <div class="pool-filters__stat-group" data-node-id="${expr.id}">
      ${headerHtml}
      <div class="pool-filters__stat-group-children">${childrenHtml}</div>
      <div class="pool-filters__stat-group-actions">
        <button type="button" class="pool-filters__stat-add-btn" data-add-condition="${expr.id}">${icon("add")} Condition</button>
        <button type="button" class="pool-filters__stat-add-btn" data-add-group="${expr.id}">${icon("add")} Group</button>
      </div>
    </div>
  `;
}

function renderStatExprTree(): string {
  return renderStatExprNode(editableStatExpr, true);
}

/** Number of condition rows currently in the tree, filled in or not, for the toggle's label. */
function countStatConditions(expr: StatExpr): number {
  if (expr.kind === "condition") return 1;
  return expr.children.reduce((sum, child) => sum + countStatConditions(child), 0);
}

function statAdvancedToggleLabel(): string {
  const count = countStatConditions(editableStatExpr);
  return count > 0 ? `Advanced stat filter (${count})` : "Advanced stat filter";
}

function updateStatAdvancedToggle(): void {
  const toggle = document.querySelector<HTMLButtonElement>("#pf-stat-advanced-toggle");
  const label = document.querySelector<HTMLSpanElement>("#pf-stat-advanced-toggle-label");
  const wrapper = document.querySelector<HTMLDivElement>("#pf-stat-advanced");
  const chevron = document.querySelector<HTMLSpanElement>("#pf-stat-advanced-toggle-chevron");
  if (!toggle || !label || !wrapper || !chevron) return;
  label.textContent = statAdvancedToggleLabel();
  toggle.setAttribute("aria-expanded", String(statAdvancedOpen));
  wrapper.hidden = !statAdvancedOpen;
  chevron.textContent = statAdvancedOpen ? "expand_less" : "expand_more";
}

function rerenderStatExprTree(): void {
  const container = document.querySelector<HTMLDivElement>("#pf-stat-tree");
  if (!container) return;
  container.innerHTML = renderStatExprTree();
  updateStatAdvancedToggle();
}

function bindStatExprTree(): void {
  const container = document.querySelector<HTMLDivElement>("#pf-stat-tree");
  if (!container) return;

  container.addEventListener("click", (event) => {
    const target = event.target as HTMLElement;

    const addCondition = target.closest<HTMLButtonElement>("[data-add-condition]");
    if (addCondition) {
      addStatConditionTo(addCondition.dataset.addCondition!);
      rerenderStatExprTree();
      return;
    }
    const addGroup = target.closest<HTMLButtonElement>("[data-add-group]");
    if (addGroup) {
      addStatGroupTo(addGroup.dataset.addGroup!);
      rerenderStatExprTree();
      return;
    }
    const removeBtn = target.closest<HTMLButtonElement>("[data-remove-node]");
    if (removeBtn) {
      removeStatNode(removeBtn.dataset.removeNode!);
      rerenderStatExprTree();
      return;
    }
    const opBtn = target.closest<HTMLButtonElement>("[data-set-operator]");
    if (opBtn) {
      setStatGroupOperator(opBtn.dataset.setOperator!, opBtn.dataset.operator === "OR" ? "OR" : "AND");
      rerenderStatExprTree();
    }
  });

  container.addEventListener("change", (event) => {
    const target = event.target as HTMLElement;
    const nodeId = target.dataset.nodeId;
    const field = target.dataset.field;
    if (!nodeId || !field) return;

    if (field === "stat") {
      setStatConditionField(nodeId, { statCategoryId: (target as HTMLSelectElement).value || null });
    } else if (field === "comparator") {
      setStatConditionField(nodeId, { comparator: (target as HTMLSelectElement).value === "<=" ? "<=" : ">=" });
    } else if (field === "value") {
      const raw = (target as HTMLInputElement).value;
      setStatConditionField(nodeId, { value: raw === "" ? null : Number(raw) });
    }
    // Deliberately not re-rendering here: rebuilding the subtree on every keystroke would steal
    // focus from the input mid-edit. The tree's shape only changes via add/remove/operator
    // clicks, which do re-render above.
  });
}

function bindStatAdvancedToggle(): void {
  const toggle = document.querySelector<HTMLButtonElement>("#pf-stat-advanced-toggle");
  if (!toggle) return;
  toggle.addEventListener("click", () => {
    statAdvancedOpen = !statAdvancedOpen;
    if (statAdvancedOpen) {
      // Opening onto an empty tree (e.g. the very first time) starts with one condition row
      // rather than making the user click "+ Condition" for the common single-condition case.
      if (editableStatExpr.children.length === 0) {
        addStatConditionTo(editableStatExpr.id);
      }
    } else {
      // Closing without ever picking a stat for that seeded row should revert to "no filter"
      // rather than leaving a phantom, incomplete condition that still shows "(1)" on the toggle.
      const onlyChild = editableStatExpr.children.length === 1 ? editableStatExpr.children[0] : null;
      if (onlyChild?.kind === "condition" && onlyChild.statCategoryId === null) {
        editableStatExpr.children = [];
      }
    }
    rerenderStatExprTree();
  });
}

/**
 * `countries` should be the birth countries actually present among players currently in the
 * pool (not every country in MLB), so the grid only ever shows options that can match someone.
 */
export function renderPoolFilters(teams: Team[], countries: string[] = []): string {
  return `
    <div class="pool-filters">
      <button
        type="button"
        id="pf-toggle"
        class="pool-filters__main-toggle"
        aria-haspopup="true"
        aria-expanded="${filtersOpen}"
        aria-controls="pool-filters-popover"
      >
        ${icon("filter_alt")}
        <span>Filter pool</span>
        <span id="pf-badge" class="pool-filters__badge" hidden>0</span>
      </button>
      <div id="pool-filters-popover" class="pool-filters__popover"${filtersOpen ? "" : " hidden"}>
        <div class="pool-filters__row pool-filters__row--grids">
          ${renderTeamPicker(teams)}
          ${renderPositionPicker()}
          ${renderCountryPicker(countries)}
        </div>
        <div class="pool-filters__row">
          <button
            type="button"
            id="pf-stat-advanced-toggle"
            class="pool-filters__advanced-toggle"
            aria-expanded="${statAdvancedOpen}"
            aria-controls="pf-stat-advanced"
          >
            ${icon("tune")}
            <span id="pf-stat-advanced-toggle-label">${statAdvancedToggleLabel()}</span>
            <span id="pf-stat-advanced-toggle-chevron" class="material-symbols-outlined" aria-hidden="true">${
              statAdvancedOpen ? "expand_less" : "expand_more"
            }</span>
          </button>
        </div>
        <div id="pf-stat-advanced" class="pool-filters__stat-advanced"${statAdvancedOpen ? "" : " hidden"}>
          <div id="pf-stat-tree" class="pool-filters__stat-tree">${renderStatExprTree()}</div>
        </div>
        <div class="pool-filters__row">
          <div class="pool-filters__actions">
            <button type="button" id="pf-clear" class="pool-filters__clear">${icon("clear_all")} Clear filters</button>
            <button type="button" id="pf-apply" class="pool-filters__apply">${icon("check")} Apply filters</button>
          </div>
          <span id="pf-status" class="pool-filters__label" role="status" aria-live="polite"></span>
        </div>
      </div>
    </div>
  `;
}

/**
 * Re-renders the country grid with the birth countries currently present in the pool (called
 * once they've been fetched), preserving whatever selection is already pending in the UI. The
 * whole picker stays hidden whenever there's nothing (or only one country) to filter by.
 */
export function refreshPoolFilterCountries(countries: string[]): void {
  const wrapper = document.querySelector<HTMLDivElement>("#pf-country-picker");
  const grid = document.querySelector<HTMLDivElement>("#pf-country-grid");
  if (!wrapper || !grid) return;

  wrapper.hidden = countries.length <= 1;

  const previouslySelected = new Set(
    Array.from(
      grid.querySelectorAll<HTMLButtonElement>('.pool-filters__country-btn[aria-pressed="true"]'),
    ).map((btn) => btn.dataset.country!),
  );

  grid.innerHTML = renderCountryContinentsHtml(countries);
  grid.querySelectorAll<HTMLButtonElement>(".pool-filters__country-btn").forEach((btn) => {
    const active = previouslySelected.has(btn.dataset.country!);
    btn.classList.toggle("pool-filters__country-btn--active", active);
    btn.setAttribute("aria-pressed", String(active));
  });
  updateSelectAllButton('#pf-country-grid .pool-filters__country-btn', "pf-country-select-all");
}

export function syncPoolFilterUI(state: PoolFilterState): void {
  if (!document.querySelector<HTMLButtonElement>("#pf-stat-advanced-toggle")) {
    return;
  }

  editableStatExpr = cloneStatExpr(state.statExpr) as StatGroup;
  rerenderStatExprTree();

  document.querySelectorAll<HTMLButtonElement>("#pf-team-grid .pool-filters__team-btn").forEach((btn) => {
    const active = state.teamIds.has(Number(btn.dataset.teamId));
    btn.classList.toggle("pool-filters__team-btn--active", active);
    btn.setAttribute("aria-pressed", String(active));
  });
  updateSelectAllButton('#pf-team-grid .pool-filters__team-btn', "pf-team-select-all");

  document.querySelectorAll<HTMLButtonElement>("#pf-country-grid .pool-filters__country-btn").forEach((btn) => {
    const active = state.birthCountries.has(btn.dataset.country!);
    btn.classList.toggle("pool-filters__country-btn--active", active);
    btn.setAttribute("aria-pressed", String(active));
  });
  updateSelectAllButton('#pf-country-grid .pool-filters__country-btn', "pf-country-select-all");

  document.querySelectorAll<HTMLButtonElement>("#pf-position-grid .pool-filters__position-btn").forEach((btn) => {
    const active = state.specificPositions.has(btn.dataset.position!);
    btn.classList.toggle("pool-filters__position-btn--active", active);
    btn.setAttribute("aria-pressed", String(active));
  });
  updateSelectAllButton('#pf-position-grid .pool-filters__position-btn', "pf-position-select-all");

  const badge = document.querySelector<HTMLSpanElement>("#pf-badge");
  if (badge) {
    const count = poolFilterActiveCount(state);
    badge.textContent = String(count);
    badge.hidden = count === 0;
  }
}

let poolFiltersOutsideClickBound = false;

/** Registered once for the app's lifetime; queries the live popover so it survives re-renders. */
function bindPoolFiltersOutsideClick(): void {
  if (poolFiltersOutsideClickBound) return;
  poolFiltersOutsideClickBound = true;
  document.addEventListener("click", (event) => {
    const popover = document.querySelector<HTMLElement>("#pool-filters-popover");
    const container = document.querySelector<HTMLElement>(".pool-filters");
    const toggle = document.querySelector<HTMLButtonElement>("#pf-toggle");
    if (!popover || !container || !toggle || popover.hidden) return;
    // Use composedPath rather than container.contains(event.target): a click inside the stat
    // tree can trigger a re-render that replaces the clicked element's innerHTML before this
    // listener runs, detaching event.target from the DOM and making contains() wrongly report
    // "outside". composedPath is captured at dispatch time, so it's unaffected by that mutation.
    if (!event.composedPath().includes(container)) {
      filtersOpen = false;
      popover.hidden = true;
      toggle.setAttribute("aria-expanded", "false");
    }
  });
}

function setButtonPressed(button: HTMLButtonElement, pressed: boolean, activeClass: string): void {
  button.classList.toggle(activeClass, pressed);
  button.setAttribute("aria-pressed", String(pressed));
}

/** Keeps a grid's "Select all" / "Select none" toggle button in sync with its items. */
function updateSelectAllButton(itemsSelector: string, buttonId: string): void {
  const button = document.querySelector<HTMLButtonElement>(`#${buttonId}`);
  if (!button) return;
  const items = document.querySelectorAll<HTMLButtonElement>(itemsSelector);
  const allSelected = items.length > 0 && Array.from(items).every((b) => b.getAttribute("aria-pressed") === "true");
  button.textContent = allSelected ? "Select none" : "Select all";
  button.setAttribute("aria-pressed", String(allSelected));
}

function bindTeamPicker(): void {
  const picker = document.querySelector<HTMLDivElement>("#pf-team-grid");
  const selectAllButton = document.querySelector<HTMLButtonElement>("#pf-team-select-all");
  if (!picker || !selectAllButton) return;

  const refreshSelectAll = () => updateSelectAllButton('#pf-team-grid .pool-filters__team-btn', "pf-team-select-all");

  picker.addEventListener("click", (event) => {
    const target = event.target as HTMLElement;
    const teamButton = target.closest<HTMLButtonElement>(".pool-filters__team-btn");
    if (teamButton) {
      setButtonPressed(teamButton, teamButton.getAttribute("aria-pressed") !== "true", "pool-filters__team-btn--active");
      refreshSelectAll();
      return;
    }
    const divisionButton = target.closest<HTMLButtonElement>("[data-division-toggle]");
    if (divisionButton) {
      const teamButtons =
        divisionButton
          .closest(".pool-filters__division-column")
          ?.querySelectorAll<HTMLButtonElement>(".pool-filters__team-btn") ?? [];
      const allSelected = Array.from(teamButtons).every((btn) => btn.getAttribute("aria-pressed") === "true");
      teamButtons.forEach((btn) => setButtonPressed(btn, !allSelected, "pool-filters__team-btn--active"));
      refreshSelectAll();
    }
  });

  selectAllButton.addEventListener("click", () => {
    const selectAll = selectAllButton.getAttribute("aria-pressed") !== "true";
    document
      .querySelectorAll<HTMLButtonElement>("#pf-team-grid .pool-filters__team-btn")
      .forEach((btn) => setButtonPressed(btn, selectAll, "pool-filters__team-btn--active"));
    refreshSelectAll();
  });

  refreshSelectAll();
}

function bindCountryPicker(): void {
  const picker = document.querySelector<HTMLDivElement>("#pf-country-grid");
  const selectAllButton = document.querySelector<HTMLButtonElement>("#pf-country-select-all");
  if (!picker || !selectAllButton) return;

  const refreshSelectAll = () =>
    updateSelectAllButton('#pf-country-grid .pool-filters__country-btn', "pf-country-select-all");

  picker.addEventListener("click", (event) => {
    const target = event.target as HTMLElement;
    const countryButton = target.closest<HTMLButtonElement>(".pool-filters__country-btn");
    if (countryButton) {
      setButtonPressed(
        countryButton,
        countryButton.getAttribute("aria-pressed") !== "true",
        "pool-filters__country-btn--active",
      );
      refreshSelectAll();
      return;
    }
    const continentButton = target.closest<HTMLButtonElement>("[data-continent-toggle]");
    if (continentButton) {
      const countryButtons =
        continentButton
          .closest(".pool-filters__division-column")
          ?.querySelectorAll<HTMLButtonElement>(".pool-filters__country-btn") ?? [];
      const allSelected = Array.from(countryButtons).every((btn) => btn.getAttribute("aria-pressed") === "true");
      countryButtons.forEach((btn) => setButtonPressed(btn, !allSelected, "pool-filters__country-btn--active"));
      refreshSelectAll();
    }
  });

  selectAllButton.addEventListener("click", () => {
    const selectAll = selectAllButton.getAttribute("aria-pressed") !== "true";
    document
      .querySelectorAll<HTMLButtonElement>("#pf-country-grid .pool-filters__country-btn")
      .forEach((btn) => setButtonPressed(btn, selectAll, "pool-filters__country-btn--active"));
    refreshSelectAll();
  });

  refreshSelectAll();
}

function bindPositionPicker(): void {
  const grid = document.querySelector<HTMLDivElement>("#pf-position-grid");
  const selectAllButton = document.querySelector<HTMLButtonElement>("#pf-position-select-all");
  if (!grid || !selectAllButton) return;

  const refreshSelectAll = () =>
    updateSelectAllButton('#pf-position-grid .pool-filters__position-btn', "pf-position-select-all");

  grid.addEventListener("click", (event) => {
    const target = event.target as HTMLElement;
    const button = target.closest<HTMLButtonElement>(".pool-filters__position-btn");
    if (button) {
      setButtonPressed(button, button.getAttribute("aria-pressed") !== "true", "pool-filters__position-btn--active");
      refreshSelectAll();
      return;
    }
    const groupButton = target.closest<HTMLButtonElement>("[data-position-group-toggle]");
    if (groupButton) {
      const positionButtons =
        groupButton
          .closest(".pool-filters__division-column")
          ?.querySelectorAll<HTMLButtonElement>(".pool-filters__position-btn") ?? [];
      const allSelected = Array.from(positionButtons).every((btn) => btn.getAttribute("aria-pressed") === "true");
      positionButtons.forEach((btn) => setButtonPressed(btn, !allSelected, "pool-filters__position-btn--active"));
      refreshSelectAll();
    }
  });

  selectAllButton.addEventListener("click", () => {
    const selectAll = selectAllButton.getAttribute("aria-pressed") !== "true";
    document
      .querySelectorAll<HTMLButtonElement>("#pf-position-grid .pool-filters__position-btn")
      .forEach((btn) => setButtonPressed(btn, selectAll, "pool-filters__position-btn--active"));
    refreshSelectAll();
  });

  refreshSelectAll();
}

export function bindPoolFilters(
  onApply: (state: PoolFilterState) => void,
  onClear: () => void,
  onOpen?: () => void,
): void {
  const applyButton = document.querySelector<HTMLButtonElement>("#pf-apply")!;
  const clearButton = document.querySelector<HTMLButtonElement>("#pf-clear")!;
  const toggle = document.querySelector<HTMLButtonElement>("#pf-toggle")!;
  const popover = document.querySelector<HTMLDivElement>("#pool-filters-popover")!;

  const closePopover = () => {
    filtersOpen = false;
    popover.hidden = true;
    popover.style.left = "";
    toggle.setAttribute("aria-expanded", "false");
  };
  const openPopover = () => {
    filtersOpen = true;
    popover.hidden = false;
    toggle.setAttribute("aria-expanded", "true");
    onOpen?.();

    popover.style.left = "0";
    const margin = 16;
    const overflowRight = popover.getBoundingClientRect().right - (window.innerWidth - margin);
    if (overflowRight > 0) popover.style.left = `-${overflowRight}px`;
  };

  toggle.addEventListener("click", () => {
    if (popover.hidden) openPopover();
    else closePopover();
  });

  bindPoolFiltersOutsideClick();

  popover.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      closePopover();
      toggle.focus();
    }
  });

  bindTeamPicker();
  bindCountryPicker();
  bindPositionPicker();
  bindStatExprTree();
  bindStatAdvancedToggle();

  applyButton.addEventListener("click", () => {
    const teamIds = new Set(
      Array.from(
        document.querySelectorAll<HTMLButtonElement>('#pf-team-grid .pool-filters__team-btn[aria-pressed="true"]'),
      ).map((btn) => Number(btn.dataset.teamId)),
    );
    const specificPositions = new Set(
      Array.from(
        document.querySelectorAll<HTMLButtonElement>(
          '#pf-position-grid .pool-filters__position-btn[aria-pressed="true"]',
        ),
      ).map((btn) => btn.dataset.position!),
    );
    const birthCountries = new Set(
      Array.from(
        document.querySelectorAll<HTMLButtonElement>(
          '#pf-country-grid .pool-filters__country-btn[aria-pressed="true"]',
        ),
      ).map((btn) => btn.dataset.country!),
    );
    onApply({
      teamIds,
      specificPositions,
      birthCountries,
      statExpr: pruneStatRoot(editableStatExpr),
    });
  });

  clearButton.addEventListener("click", () => {
    document
      .querySelectorAll<HTMLButtonElement>("#pf-team-grid .pool-filters__team-btn")
      .forEach((btn) => setButtonPressed(btn, false, "pool-filters__team-btn--active"));
    updateSelectAllButton('#pf-team-grid .pool-filters__team-btn', "pf-team-select-all");
    document
      .querySelectorAll<HTMLButtonElement>("#pf-country-grid .pool-filters__country-btn")
      .forEach((btn) => setButtonPressed(btn, false, "pool-filters__country-btn--active"));
    updateSelectAllButton('#pf-country-grid .pool-filters__country-btn', "pf-country-select-all");
    document
      .querySelectorAll<HTMLButtonElement>("#pf-position-grid .pool-filters__position-btn")
      .forEach((btn) => setButtonPressed(btn, false, "pool-filters__position-btn--active"));
    updateSelectAllButton('#pf-position-grid .pool-filters__position-btn', "pf-position-select-all");
    editableStatExpr = makeStatGroup("AND", []);
    rerenderStatExprTree();
    onClear();
  });
}
