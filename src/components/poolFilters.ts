import type { PoolPlayer, PositionType, Team } from "../types/mlb";
import { statOptions } from "../data/statCategories";

export type PositionFilter = "all" | PositionType;

export interface PoolFilterState {
  teamIds: Set<number>;
  position: PositionFilter;
  statCategoryId: string | null;
  comparator: ">=" | "<=";
  statValue: number | null;
  qualifiedOnly: boolean;
}

export function emptyPoolFilterState(): PoolFilterState {
  return {
    teamIds: new Set(),
    position: "all",
    statCategoryId: null,
    comparator: ">=",
    statValue: null,
    qualifiedOnly: false,
  };
}

export function isPoolFilterActive(state: PoolFilterState): boolean {
  return state.teamIds.size > 0 || state.position !== "all" || state.statCategoryId !== null;
}

/**
 * True if `player` should be shown. A stat filter that can't be evaluated (no cached value for
 * this player) hides the player rather than showing it, since "unknown" shouldn't pass a
 * threshold check.
 */
export function matchesPoolFilter(
  player: PoolPlayer,
  state: PoolFilterState,
  statValues: Map<number, number>,
): boolean {
  if (state.teamIds.size > 0 && (player.teamId === undefined || !state.teamIds.has(player.teamId))) {
    return false;
  }
  if (state.position !== "all" && player.positionType !== state.position) {
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

export function renderPoolFilters(teams: Team[]): string {
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
      <div class="pool-filters__row">
        <div class="pool-filters__team-picker">
          <div class="pool-filters__chips">${divisionChips}</div>
          <select id="pf-teams" multiple size="4" class="pool-filters__team-select">
            ${teamOptionGroups}
          </select>
        </div>
        <div class="pool-filters__field">
          <span class="pool-filters__label">Position</span>
          <div class="pool-filters__toggle" id="pf-position" role="group" data-active="all">
            <button type="button" class="pool-filters__toggle-btn pool-filters__toggle-btn--active" data-value="all">All</button>
            <button type="button" class="pool-filters__toggle-btn" data-value="hitter">Hitters</button>
            <button type="button" class="pool-filters__toggle-btn" data-value="pitcher">Pitchers</button>
          </div>
        </div>
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
      </div>
    </div>
  `;
}

export function syncPoolFilterUI(state: PoolFilterState): void {
  const teamSelect = document.querySelector<HTMLSelectElement>("#pf-teams");
  const positionGroup = document.querySelector<HTMLDivElement>("#pf-position");
  const statSelect = document.querySelector<HTMLSelectElement>("#pf-stat");
  const comparatorSelect = document.querySelector<HTMLSelectElement>("#pf-comparator");
  const statValueInput = document.querySelector<HTMLInputElement>("#pf-stat-value");
  const qualifiedCheckbox = document.querySelector<HTMLInputElement>("#pf-qualified");
  if (!teamSelect || !positionGroup || !statSelect || !comparatorSelect || !statValueInput || !qualifiedCheckbox) {
    return;
  }

  Array.from(teamSelect.options).forEach((opt) => {
    opt.selected = state.teamIds.has(Number(opt.value));
  });
  positionGroup.dataset.active = state.position;
  positionGroup
    .querySelectorAll<HTMLButtonElement>(".pool-filters__toggle-btn")
    .forEach((b) => b.classList.toggle("pool-filters__toggle-btn--active", b.dataset.value === state.position));
  statSelect.value = state.statCategoryId ?? "";
  comparatorSelect.value = state.comparator;
  statValueInput.value = state.statValue === null ? "" : String(state.statValue);
  qualifiedCheckbox.checked = state.qualifiedOnly;
}

export function bindPoolFilters(
  teams: Team[],
  onApply: (state: PoolFilterState) => void,
  onClear: () => void,
): void {
  const teamSelect = document.querySelector<HTMLSelectElement>("#pf-teams")!;
  const positionGroup = document.querySelector<HTMLDivElement>("#pf-position")!;
  const statSelect = document.querySelector<HTMLSelectElement>("#pf-stat")!;
  const comparatorSelect = document.querySelector<HTMLSelectElement>("#pf-comparator")!;
  const statValueInput = document.querySelector<HTMLInputElement>("#pf-stat-value")!;
  const qualifiedCheckbox = document.querySelector<HTMLInputElement>("#pf-qualified")!;
  const applyButton = document.querySelector<HTMLButtonElement>("#pf-apply")!;
  const clearButton = document.querySelector<HTMLButtonElement>("#pf-clear")!;

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
      positionGroup
        .querySelectorAll(".pool-filters__toggle-btn")
        .forEach((b) => b.classList.toggle("pool-filters__toggle-btn--active", b === button));
    });
  });

  applyButton.addEventListener("click", () => {
    const teamIds = new Set(Array.from(teamSelect.selectedOptions).map((opt) => Number(opt.value)));
    const statCategoryId = statSelect.value || null;
    const statValue = statValueInput.value === "" ? null : Number(statValueInput.value);
    onApply({
      teamIds,
      position: (positionGroup.dataset.active as PositionFilter) ?? "all",
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
    statSelect.value = "";
    statValueInput.value = "";
    qualifiedCheckbox.checked = false;
    onClear();
  });
}
