import type { PoolPlayer, PositionType, Team } from "../types/mlb";
import { statOptions } from "../data/statCategories";
import { flagForCountry } from "../data/countryFlags";

export type PositionFilter = "all" | PositionType;

const SPECIFIC_POSITIONS = ["C", "1B", "2B", "3B", "SS", "LF", "CF", "RF", "OF", "DH", "P", "TWP"];
/** A two-way player's `positionAbbreviation` is just "TWP", so treat them as playing both. */
const TWO_WAY_SPECIFIC_POSITIONS = ["P", "DH"];

export interface PoolFilterState {
  teamIds: Set<number>;
  position: PositionFilter;
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
    position: "all",
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
  if (state.position !== "all") count++;
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
  if (state.position !== "all" && !isTwoWay && player.positionType !== state.position) {
    return false;
  }
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

let filtersOpen = false;

export function renderPoolFilters(teams: Team[], countries: string[] = []): string {
  const divisions = groupTeamsByDivision(teams);
  const divisionChips = Array.from(divisions.keys())
    .sort()
    .map((division) => `<button type="button" class="pool-filters__chip" data-division="${division}">${division}</button>`)
    .join("");

  const teamOptionGroups = Array.from(divisions.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(
      ([division, divisionTeams]) => `
        <optgroup label="${division}">
          ${divisionTeams.map((team) => `<option value="${team.id}">${team.name}</option>`).join("")}
        </optgroup>
      `,
    )
    .join("");

  const statOpts = statOptions()
    .map((opt) => `<option value="${opt.value}">${opt.label}</option>`)
    .join("");

  return `
    <div class="pool-filters">
      <button
        type="button"
        id="pf-toggle"
        class="pool-filters__disclosure"
        aria-expanded="${filtersOpen}"
        aria-controls="pool-filters-body"
      >
        <span>Filter pool</span>
        <span id="pf-badge" class="pool-filters__badge" hidden>0</span>
        <span class="pool-filters__disclosure-icon" aria-hidden="true">${filtersOpen ? "▾" : "▸"}</span>
      </button>
      <div id="pool-filters-body" class="pool-filters__body"${filtersOpen ? "" : " hidden"}>
        <div class="pool-filters__row">
          <div class="pool-filters__team-picker">
            <div class="pool-filters__chips">${divisionChips}</div>
            <select id="pf-teams" multiple size="4" class="pool-filters__team-select">
              ${teamOptionGroups}
            </select>
          </div>
          <div class="pool-filters__field">
            <span class="pool-filters__label">Position</span>
            <div class="pool-filters__toggle" id="pf-position" role="group" aria-label="Position" data-active="all">
              <button type="button" class="pool-filters__toggle-btn pool-filters__toggle-btn--active" data-value="all" aria-pressed="true">All</button>
              <button type="button" class="pool-filters__toggle-btn" data-value="hitter" aria-pressed="false">Hitters</button>
              <button type="button" class="pool-filters__toggle-btn" data-value="pitcher" aria-pressed="false">Pitchers</button>
            </div>
          </div>
          <label class="pool-filters__field">
            Specific position
            <select id="pf-specific-positions" multiple size="4" class="pool-filters__team-select">
              ${SPECIFIC_POSITIONS.map((pos) => `<option value="${pos}">${pos}</option>`).join("")}
            </select>
          </label>
          <label class="pool-filters__field">
            Country of birth
            <select id="pf-countries" multiple size="4" class="pool-filters__team-select">
              ${countries
                .map((country) => `<option value="${country}">${flagForCountry(country)} ${country}</option>`)
                .join("")}
            </select>
          </label>
        </div>
        <div class="pool-filters__row">
          <label class="pool-filters__field">
            Stat
            <select id="pf-stat">
              <option value="">No stat filter</option>
              ${statOpts}
            </select>
          </label>
          <label class="pool-filters__field">
            <select id="pf-comparator">
              <option value=">=">at least</option>
              <option value="<=">at most</option>
            </select>
          </label>
          <label class="pool-filters__field">
            <input id="pf-stat-value" type="number" placeholder="value" step="any" />
          </label>
          <label class="pool-filters__field pool-filters__field--checkbox">
            <input id="pf-qualified" type="checkbox" />
            Qualified only
          </label>
          <button type="button" id="pf-apply" class="pool-filters__apply">Apply filters</button>
          <button type="button" id="pf-clear" class="pool-filters__clear">Clear filters</button>
          <span id="pf-status" class="pool-filters__label" role="status" aria-live="polite"></span>
        </div>
      </div>
    </div>
  `;
}

export function syncPoolFilterUI(state: PoolFilterState): void {
  const teamSelect = document.querySelector<HTMLSelectElement>("#pf-teams");
  const positionGroup = document.querySelector<HTMLDivElement>("#pf-position");
  const specificPositionSelect = document.querySelector<HTMLSelectElement>("#pf-specific-positions");
  const countrySelect = document.querySelector<HTMLSelectElement>("#pf-countries");
  const statSelect = document.querySelector<HTMLSelectElement>("#pf-stat");
  const comparatorSelect = document.querySelector<HTMLSelectElement>("#pf-comparator");
  const statValueInput = document.querySelector<HTMLInputElement>("#pf-stat-value");
  const qualifiedCheckbox = document.querySelector<HTMLInputElement>("#pf-qualified");
  if (
    !teamSelect ||
    !positionGroup ||
    !specificPositionSelect ||
    !countrySelect ||
    !statSelect ||
    !comparatorSelect ||
    !statValueInput ||
    !qualifiedCheckbox
  ) {
    return;
  }

  Array.from(teamSelect.options).forEach((opt) => {
    opt.selected = state.teamIds.has(Number(opt.value));
  });
  positionGroup.dataset.active = state.position;
  positionGroup.querySelectorAll<HTMLButtonElement>(".pool-filters__toggle-btn").forEach((b) => {
    const active = b.dataset.value === state.position;
    b.classList.toggle("pool-filters__toggle-btn--active", active);
    b.setAttribute("aria-pressed", String(active));
  });
  Array.from(specificPositionSelect.options).forEach((opt) => {
    opt.selected = state.specificPositions.has(opt.value);
  });
  Array.from(countrySelect.options).forEach((opt) => {
    opt.selected = state.birthCountries.has(opt.value);
  });
  statSelect.value = state.statCategoryId ?? "";
  comparatorSelect.value = state.comparator;
  statValueInput.value = state.statValue === null ? "" : String(state.statValue);
  qualifiedCheckbox.checked = state.qualifiedOnly;

  const badge = document.querySelector<HTMLSpanElement>("#pf-badge");
  if (badge) {
    const count = poolFilterActiveCount(state);
    badge.textContent = String(count);
    badge.hidden = count === 0;
  }
}

export function bindPoolFilters(
  teams: Team[],
  onApply: (state: PoolFilterState) => void,
  onClear: () => void,
): void {
  const teamSelect = document.querySelector<HTMLSelectElement>("#pf-teams")!;
  const positionGroup = document.querySelector<HTMLDivElement>("#pf-position")!;
  const specificPositionSelect = document.querySelector<HTMLSelectElement>("#pf-specific-positions")!;
  const countrySelect = document.querySelector<HTMLSelectElement>("#pf-countries")!;
  const statSelect = document.querySelector<HTMLSelectElement>("#pf-stat")!;
  const comparatorSelect = document.querySelector<HTMLSelectElement>("#pf-comparator")!;
  const statValueInput = document.querySelector<HTMLInputElement>("#pf-stat-value")!;
  const qualifiedCheckbox = document.querySelector<HTMLInputElement>("#pf-qualified")!;
  const applyButton = document.querySelector<HTMLButtonElement>("#pf-apply")!;
  const clearButton = document.querySelector<HTMLButtonElement>("#pf-clear")!;
  const disclosureToggle = document.querySelector<HTMLButtonElement>("#pf-toggle")!;
  const disclosureBody = document.querySelector<HTMLDivElement>("#pool-filters-body")!;
  const disclosureIcon = disclosureToggle.querySelector<HTMLSpanElement>(".pool-filters__disclosure-icon")!;

  disclosureToggle.addEventListener("click", () => {
    filtersOpen = !filtersOpen;
    disclosureBody.hidden = !filtersOpen;
    disclosureToggle.setAttribute("aria-expanded", String(filtersOpen));
    disclosureIcon.textContent = filtersOpen ? "▾" : "▸";
  });

  document.querySelectorAll<HTMLButtonElement>(".pool-filters__chip").forEach((chip) => {
    chip.addEventListener("click", () => {
      const division = chip.dataset.division;
      Array.from(teamSelect.options).forEach((option) => {
        const team = teams.find((t) => String(t.id) === option.value);
        if (team?.divisionName === division) option.selected = true;
      });
    });
  });

  positionGroup.querySelectorAll<HTMLButtonElement>(".pool-filters__toggle-btn").forEach((button) => {
    button.addEventListener("click", () => {
      positionGroup.dataset.active = button.dataset.value ?? "all";
      positionGroup.querySelectorAll<HTMLButtonElement>(".pool-filters__toggle-btn").forEach((b) => {
        b.classList.toggle("pool-filters__toggle-btn--active", b === button);
        b.setAttribute("aria-pressed", String(b === button));
      });
    });
  });

  applyButton.addEventListener("click", () => {
    const teamIds = new Set(Array.from(teamSelect.selectedOptions).map((opt) => Number(opt.value)));
    const specificPositions = new Set(
      Array.from(specificPositionSelect.selectedOptions).map((opt) => opt.value),
    );
    const birthCountries = new Set(Array.from(countrySelect.selectedOptions).map((opt) => opt.value));
    const statCategoryId = statSelect.value || null;
    const statValue = statValueInput.value === "" ? null : Number(statValueInput.value);
    onApply({
      teamIds,
      position: (positionGroup.dataset.active as PositionFilter) ?? "all",
      specificPositions,
      birthCountries,
      statCategoryId,
      comparator: comparatorSelect.value === "<=" ? "<=" : ">=",
      statValue: statCategoryId ? statValue : null,
      qualifiedOnly: qualifiedCheckbox.checked,
    });
  });

  clearButton.addEventListener("click", () => {
    teamSelect.querySelectorAll("option").forEach((opt) => (opt.selected = false));
    positionGroup.dataset.active = "all";
    positionGroup
      .querySelectorAll<HTMLButtonElement>(".pool-filters__toggle-btn")
      .forEach((b) => b.classList.toggle("pool-filters__toggle-btn--active", b.dataset.value === "all"));
    specificPositionSelect.querySelectorAll("option").forEach((opt) => (opt.selected = false));
    countrySelect.querySelectorAll("option").forEach((opt) => (opt.selected = false));
    statSelect.value = "";
    statValueInput.value = "";
    qualifiedCheckbox.checked = false;
    onClear();
  });
}
