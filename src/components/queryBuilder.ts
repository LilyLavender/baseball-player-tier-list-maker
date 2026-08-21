import type { Team } from "../types/mlb";
import { teamLogoUrl } from "../types/mlb";
import { fetchTeams } from "../api/mlbApi";
import { qualifierFor, statOptions, STAT_CATEGORIES } from "../data/statCategories";
import { bindComboBox, getComboBoxValue, renderComboBox, setComboBoxOptions } from "./comboBox";
import type { ComboBoxOption } from "./comboBox";
import { bindConditionalField } from "../utils/conditionalField";

export interface StatQueryParams {
  statCategoryId: string;
  scope: "season" | "career";
  season: number;
  limit: number;
  qualified: boolean;
  minValue?: number;
  minQualifierValue?: number;
}

export interface QueryBuilderCallbacks {
  onApplyTeam: (teamId: number | "all", season: number) => void;
  onApplyStat: (params: StatQueryParams) => void;
}

const CURRENT_YEAR = new Date().getFullYear();
const ALL_LIMIT = 1000;
const ALL_TEAMS_VALUE = "all";

function teamOptions(teams: Team[]): ComboBoxOption[] {
  const sorted = teams
    .slice()
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((team) => ({ value: String(team.id), label: team.name, iconUrl: teamLogoUrl(team.id) }));
  return [{ value: ALL_TEAMS_VALUE, label: "All Teams" }, ...sorted];
}

export function renderQueryBuilder(
  teams: Team[],
  selectedTeamQuery?: { teamId: number | "all"; season: number },
): string {
  const teamSeason = selectedTeamQuery?.season ?? CURRENT_YEAR;
  const defaultTeamValue = selectedTeamQuery ? String(selectedTeamQuery.teamId) : ALL_TEAMS_VALUE;

  return `
    <div class="query-builder__tabs" role="tablist" aria-label="Pool source">
      <button
        type="button"
        id="qb-tab-team"
        class="query-builder__tab query-builder__tab--active"
        role="tab"
        aria-selected="true"
        aria-controls="qb-panel-team"
      >Team &amp; Season</button>
      <button
        type="button"
        id="qb-tab-stat"
        class="query-builder__tab"
        role="tab"
        aria-selected="false"
        aria-controls="qb-panel-stat"
        tabindex="-1"
      >Stat Leaders</button>
    </div>

    <div id="qb-panel-team" class="query-builder__panel" role="tabpanel" aria-labelledby="qb-tab-team">
      <label class="query-builder__field">
        Team
        ${renderComboBox(
          "qb-team",
          teamOptions(teams),
          defaultTeamValue,
          "Search teams…",
        )}
      </label>
      <label class="query-builder__field">
        Season
        <input id="qb-season" type="number" value="${teamSeason}" min="1901" max="${CURRENT_YEAR}" />
      </label>
      <button id="qb-apply" type="button">Apply</button>
    </div>

    <div id="qb-panel-stat" class="query-builder__panel" role="tabpanel" aria-labelledby="qb-tab-stat" hidden>
      <label class="query-builder__field">
        Stat
        ${renderComboBox("qb-stat", statOptions(), statOptions()[0]?.value, "Search stats…")}
      </label>
      <label class="query-builder__field">
        Scope
        <select id="qb-stat-scope">
          <option value="season" selected>Single season</option>
          <option value="career">Career (all-time)</option>
        </select>
      </label>
      <label class="query-builder__field" id="qb-stat-season-field">
        Season
        <input id="qb-stat-season" type="number" value="${CURRENT_YEAR}" min="1901" max="${CURRENT_YEAR}" />
      </label>
      <label class="query-builder__field">
        Top N
        <select id="qb-stat-limit">
          <option value="10">Top 10</option>
          <option value="25">Top 25</option>
          <option value="50">Top 50</option>
          <option value="100">Top 100</option>
          <option value="${ALL_LIMIT}" selected>All</option>
        </select>
      </label>
      <label class="query-builder__field">
        Min <span id="qb-stat-value-label">value</span>
        <input id="qb-stat-min-value" type="number" placeholder="No minimum" step="any" />
      </label>
      <label class="query-builder__field query-builder__field--checkbox">
        <input id="qb-stat-qualified" type="checkbox" />
        Use official qualified minimum
      </label>
      <label class="query-builder__field">
        Min <span id="qb-stat-qualifier-label">Plate Appearances</span>
        <input id="qb-stat-min-qualifier" type="number" placeholder="No minimum" step="any" />
      </label>
      <button id="qb-stat-apply" type="button">Apply</button>
    </div>
  `;
}

function applyStatFieldDefaults(statId: string): void {
  const stat = STAT_CATEGORIES.find((s) => s.id === statId);
  if (!stat) return;

  const qualifier = qualifierFor(stat.group);
  document.querySelector("#qb-stat-value-label")!.textContent = stat.label;
  document.querySelector("#qb-stat-qualifier-label")!.textContent = qualifier.label;
  document.querySelector<HTMLInputElement>("#qb-stat-qualified")!.checked = stat.qualified;
}

function bindQueryBuilderTabs(): void {
  const tabs = Array.from(document.querySelectorAll<HTMLButtonElement>(".query-builder__tab"));

  const activate = (tab: HTMLButtonElement, focus: boolean): void => {
    for (const t of tabs) {
      const selected = t === tab;
      t.setAttribute("aria-selected", String(selected));
      t.tabIndex = selected ? 0 : -1;
      t.classList.toggle("query-builder__tab--active", selected);
      const panel = document.getElementById(t.getAttribute("aria-controls") ?? "");
      if (panel) panel.hidden = !selected;
    }
    if (focus) tab.focus();
  };

  tabs.forEach((tab, index) => {
    tab.addEventListener("click", () => activate(tab, false));
    tab.addEventListener("keydown", (event) => {
      if (event.key !== "ArrowRight" && event.key !== "ArrowLeft") return;
      event.preventDefault();
      const nextIndex =
        event.key === "ArrowRight" ? (index + 1) % tabs.length : (index - 1 + tabs.length) % tabs.length;
      activate(tabs[nextIndex], true);
    });
  });
}

export function bindQueryBuilder(teams: Team[], callbacks: QueryBuilderCallbacks): void {
  bindQueryBuilderTabs();
  bindComboBox("qb-team", teamOptions(teams), () => {});
  bindComboBox("qb-stat", statOptions(), (statId) => applyStatFieldDefaults(statId));
  applyStatFieldDefaults(getComboBoxValue("qb-stat"));

  const seasonInput = document.querySelector<HTMLInputElement>("#qb-season")!;
  const applyButton = document.querySelector<HTMLButtonElement>("#qb-apply")!;

  let lastLoadedSeason = Number(seasonInput.value);
  seasonInput.addEventListener("change", () => {
    const season = Number(seasonInput.value);
    if (!season || season === lastLoadedSeason) return;
    lastLoadedSeason = season;

    const preferredTeamId = getComboBoxValue("qb-team");
    fetchTeams(season)
      .then((seasonTeams) => {
        setComboBoxOptions("qb-team", teamOptions(seasonTeams), preferredTeamId);
      })
      .catch((error) => {
        console.error(error);
      });
  });

  applyButton.addEventListener("click", () => {
    const teamValue = getComboBoxValue("qb-team");
    if (!teamValue) return;
    const teamId = teamValue === ALL_TEAMS_VALUE ? ALL_TEAMS_VALUE : Number(teamValue);
    callbacks.onApplyTeam(teamId, Number(seasonInput.value));
  });

  const statScopeSelect = document.querySelector<HTMLSelectElement>("#qb-stat-scope")!;
  const statSeasonField = document.querySelector<HTMLLabelElement>("#qb-stat-season-field")!;
  const statSeasonInput = document.querySelector<HTMLInputElement>("#qb-stat-season")!;
  const statLimitSelect = document.querySelector<HTMLSelectElement>("#qb-stat-limit")!;
  const statMinValueInput = document.querySelector<HTMLInputElement>("#qb-stat-min-value")!;
  const statQualifiedCheckbox = document.querySelector<HTMLInputElement>("#qb-stat-qualified")!;
  const statMinQualifierInput = document.querySelector<HTMLInputElement>("#qb-stat-min-qualifier")!;
  const statApplyButton = document.querySelector<HTMLButtonElement>("#qb-stat-apply")!;

  bindConditionalField(statScopeSelect, statSeasonField, ["season"]);

  statApplyButton.addEventListener("click", () => {
    const statId = getComboBoxValue("qb-stat");
    if (!statId) return;
    callbacks.onApplyStat({
      statCategoryId: statId,
      scope: statScopeSelect.value === "career" ? "career" : "season",
      season: Number(statSeasonInput.value),
      limit: Number(statLimitSelect.value),
      qualified: statQualifiedCheckbox.checked,
      minValue: statMinValueInput.value === "" ? undefined : Number(statMinValueInput.value),
      minQualifierValue:
        statMinQualifierInput.value === "" ? undefined : Number(statMinQualifierInput.value),
    });
  });
}
