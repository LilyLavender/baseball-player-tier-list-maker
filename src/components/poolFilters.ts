import type { PoolPlayer, Team } from "../types/mlb";
import { teamLogoUrl } from "../types/mlb";
import { statOptions } from "../data/statCategories";
import { continentForCountry, flagForCountry } from "../data/countryFlags";
import { icon } from "../utils/icon";
import { escapeHtml } from "../utils/escapeHtml";
import { renderToggleSwitch } from "../utils/toggleSwitch";

/** A two-way player's `positionAbbreviation` is just "TWP", so treat them as playing both. */
const TWO_WAY_SPECIFIC_POSITIONS = ["P", "DH"];

const POSITION_GROUPS: { label: string; positions: string[] }[] = [
  { label: "Infield", positions: ["1B", "2B", "3B", "SS"] },
  { label: "Outfield", positions: ["LF", "CF", "RF", "OF"] },
  { label: "Other", positions: ["C", "DH", "P", "TWP"] },
];

export interface PoolFilterState {
  teamIds: Set<number>;
  specificPositions: Set<string>;
  birthCountries: Set<string>;
  statCategoryId: string | null;
  comparator: ">=" | "<=";
  statValue: number | null;
  qualifiedOnly: boolean;
}

export function emptyPoolFilterState(): PoolFilterState {
  return {
    teamIds: new Set(),
    specificPositions: new Set(),
    birthCountries: new Set(),
    statCategoryId: null,
    comparator: ">=",
    statValue: null,
    qualifiedOnly: false,
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
  if (state.statCategoryId !== null) count++;
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
  statValues: Map<number, number>,
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
  if (state.statCategoryId !== null && state.statValue !== null) {
    const value = statValues.get(player.id);
    if (value === undefined) return false;
    return state.comparator === ">=" ? value >= state.statValue : value <= state.statValue;
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

/**
 * `countries` should be the birth countries actually present among players currently in the
 * pool (not every country in MLB), so the grid only ever shows options that can match someone.
 */
export function renderPoolFilters(teams: Team[], countries: string[] = []): string {
  const statOpts = statOptions()
    .map((opt) => `<option value="${opt.value}">${opt.label}</option>`)
    .join("");

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
          <label class="pool-filters__field pool-filters__field--checkbox pool-filters__field--qualified">
            ${renderToggleSwitch("pf-qualified")}
            Qualified only
          </label>
          <label class="pool-filters__field">
            Stat
            <select id="pf-stat">
              <option value="">No stat filter</option>
              ${statOpts}
            </select>
          </label>
          <label class="pool-filters__field" id="pf-comparator-field">
            <select id="pf-comparator">
              <option value=">=">at least</option>
              <option value="<=">at most</option>
            </select>
          </label>
          <label class="pool-filters__field" id="pf-stat-value-field">
            <input id="pf-stat-value" type="number" placeholder="value" step="any" />
          </label>
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
  const statSelect = document.querySelector<HTMLSelectElement>("#pf-stat");
  const comparatorSelect = document.querySelector<HTMLSelectElement>("#pf-comparator");
  const statValueInput = document.querySelector<HTMLInputElement>("#pf-stat-value");
  const qualifiedCheckbox = document.querySelector<HTMLInputElement>("#pf-qualified");
  if (!statSelect || !comparatorSelect || !statValueInput || !qualifiedCheckbox) {
    return;
  }

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

  statSelect.value = state.statCategoryId ?? "";
  comparatorSelect.value = state.comparator;
  statValueInput.value = state.statValue === null ? "" : String(state.statValue);
  qualifiedCheckbox.checked = state.qualifiedOnly;
  syncStatFieldVisibility();

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
    if (!container.contains(event.target as Node)) {
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

/** The comparator and value fields only make sense once a stat has actually been picked. */
function syncStatFieldVisibility(): void {
  const statSelect = document.querySelector<HTMLSelectElement>("#pf-stat");
  const comparatorField = document.querySelector<HTMLElement>("#pf-comparator-field");
  const statValueField = document.querySelector<HTMLElement>("#pf-stat-value-field");
  if (!statSelect || !comparatorField || !statValueField) return;
  const hasStat = statSelect.value !== "";
  comparatorField.hidden = !hasStat;
  statValueField.hidden = !hasStat;
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
  const statSelect = document.querySelector<HTMLSelectElement>("#pf-stat")!;
  const comparatorSelect = document.querySelector<HTMLSelectElement>("#pf-comparator")!;
  const statValueInput = document.querySelector<HTMLInputElement>("#pf-stat-value")!;
  const qualifiedCheckbox = document.querySelector<HTMLInputElement>("#pf-qualified")!;
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

  statSelect.addEventListener("change", syncStatFieldVisibility);
  syncStatFieldVisibility();

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
    const statCategoryId = statSelect.value || null;
    const statValue = statValueInput.value === "" ? null : Number(statValueInput.value);
    onApply({
      teamIds,
      specificPositions,
      birthCountries,
      statCategoryId,
      comparator: comparatorSelect.value === "<=" ? "<=" : ">=",
      statValue: statCategoryId ? statValue : null,
      qualifiedOnly: qualifiedCheckbox.checked,
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
    statSelect.value = "";
    statValueInput.value = "";
    qualifiedCheckbox.checked = false;
    syncStatFieldVisibility();
    onClear();
  });
}
