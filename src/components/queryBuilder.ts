import type { Team } from "../types/mlb";
import { teamLogoUrl } from "../types/mlb";
import { fetchTeams } from "../api/mlbApi";
import { STAT_CATEGORIES } from "../data/statCategories";
import { bindComboBox, getComboBoxValue, renderComboBox, setComboBoxOptions } from "./comboBox";
import type { ComboBoxOption } from "./comboBox";

export interface QueryBuilderCallbacks {
  onApplyTeam: (teamId: number, season: number) => void;
  onApplyStat: (statCategoryId: string, season: number, limit: number) => void;
}

const CURRENT_YEAR = new Date().getFullYear();
const ALL_LIMIT = 1000;

function teamOptions(teams: Team[]): ComboBoxOption[] {
  return teams
    .slice()
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((team) => ({ value: String(team.id), label: team.name, iconUrl: teamLogoUrl(team.id) }));
}

function statOptions(): ComboBoxOption[] {
  return STAT_CATEGORIES.map((stat) => ({
    value: stat.id,
    label: `${stat.label} (${stat.group})`,
  }));
}

export function renderQueryBuilder(
  teams: Team[],
  selectedTeamQuery?: { teamId: number; season: number },
): string {
  const teamSeason = selectedTeamQuery?.season ?? CURRENT_YEAR;

  return `
    <h2 class="query-builder__heading">By team &amp; season</h2>
    <label class="query-builder__field">
      Team
      ${renderComboBox(
        "qb-team",
        teamOptions(teams),
        selectedTeamQuery ? String(selectedTeamQuery.teamId) : undefined,
        "Search teams…",
      )}
    </label>
    <label class="query-builder__field">
      Season
      <input id="qb-season" type="number" value="${teamSeason}" min="1901" max="${CURRENT_YEAR}" />
    </label>
    <button id="qb-apply" type="button">Apply</button>

    <h2 class="query-builder__heading query-builder__heading--stat">By stat leaders</h2>
    <label class="query-builder__field">
      Stat
      ${renderComboBox("qb-stat", statOptions(), statOptions()[0]?.value, "Search stats…")}
    </label>
    <label class="query-builder__field">
      Season
      <input id="qb-stat-season" type="number" value="${CURRENT_YEAR}" min="1901" max="${CURRENT_YEAR}" />
    </label>
    <label class="query-builder__field">
      Top N
      <select id="qb-stat-limit">
        <option value="10">Top 10</option>
        <option value="25" selected>Top 25</option>
        <option value="50">Top 50</option>
        <option value="100">Top 100</option>
        <option value="${ALL_LIMIT}">All</option>
      </select>
    </label>
    <button id="qb-stat-apply" type="button">Apply</button>
  `;
}

export function bindQueryBuilder(teams: Team[], callbacks: QueryBuilderCallbacks): void {
  bindComboBox("qb-team", teamOptions(teams), () => {});
  bindComboBox("qb-stat", statOptions(), () => {});

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
    const teamId = Number(getComboBoxValue("qb-team"));
    if (!teamId) return;
    callbacks.onApplyTeam(teamId, Number(seasonInput.value));
  });

  const statSeasonInput = document.querySelector<HTMLInputElement>("#qb-stat-season")!;
  const statLimitSelect = document.querySelector<HTMLSelectElement>("#qb-stat-limit")!;
  const statApplyButton = document.querySelector<HTMLButtonElement>("#qb-stat-apply")!;

  statApplyButton.addEventListener("click", () => {
    const statId = getComboBoxValue("qb-stat");
    if (!statId) return;
    callbacks.onApplyStat(statId, Number(statSeasonInput.value), Number(statLimitSelect.value));
  });
}
