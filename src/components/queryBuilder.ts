import type { Team } from "../types/mlb";
import { STAT_CATEGORIES } from "../data/statCategories";

export interface QueryBuilderCallbacks {
  onApplyTeam: (teamId: number, season: number) => void;
  onApplyStat: (statCategoryId: string, season: number, limit: number) => void;
}

const CURRENT_YEAR = new Date().getFullYear();

export function renderQueryBuilder(
  teams: Team[],
  selectedTeamQuery?: { teamId: number; season: number },
): string {
  const teamOptions = teams
    .slice()
    .sort((a, b) => a.name.localeCompare(b.name))
    .map(
      (team) =>
        `<option value="${team.id}" ${team.id === selectedTeamQuery?.teamId ? "selected" : ""}>${team.name}</option>`,
    )
    .join("");

  const teamSeason = selectedTeamQuery?.season ?? CURRENT_YEAR;

  const statOptions = STAT_CATEGORIES.map(
    (stat) => `<option value="${stat.id}">${stat.label} (${stat.group})</option>`,
  ).join("");

  return `
    <h2 class="query-builder__heading">By team &amp; season</h2>
    <label class="query-builder__field">
      Team
      <select id="qb-team">${teamOptions}</select>
    </label>
    <label class="query-builder__field">
      Season
      <input id="qb-season" type="number" value="${teamSeason}" min="1901" max="${CURRENT_YEAR}" />
    </label>
    <button id="qb-apply" type="button">Apply</button>

    <h2 class="query-builder__heading query-builder__heading--stat">By stat leaders</h2>
    <label class="query-builder__field">
      Stat
      <select id="qb-stat">${statOptions}</select>
    </label>
    <label class="query-builder__field">
      Season
      <input id="qb-stat-season" type="number" value="${CURRENT_YEAR}" min="1901" max="${CURRENT_YEAR}" />
    </label>
    <label class="query-builder__field">
      Top N
      <input id="qb-stat-limit" type="number" value="25" min="1" max="100" />
    </label>
    <button id="qb-stat-apply" type="button">Apply</button>
  `;
}

export function bindQueryBuilder(callbacks: QueryBuilderCallbacks): void {
  const teamSelect = document.querySelector<HTMLSelectElement>("#qb-team")!;
  const seasonInput = document.querySelector<HTMLInputElement>("#qb-season")!;
  const applyButton = document.querySelector<HTMLButtonElement>("#qb-apply")!;

  applyButton.addEventListener("click", () => {
    callbacks.onApplyTeam(Number(teamSelect.value), Number(seasonInput.value));
  });

  const statSelect = document.querySelector<HTMLSelectElement>("#qb-stat")!;
  const statSeasonInput = document.querySelector<HTMLInputElement>("#qb-stat-season")!;
  const statLimitInput = document.querySelector<HTMLInputElement>("#qb-stat-limit")!;
  const statApplyButton = document.querySelector<HTMLButtonElement>("#qb-stat-apply")!;

  statApplyButton.addEventListener("click", () => {
    callbacks.onApplyStat(
      statSelect.value,
      Number(statSeasonInput.value),
      Number(statLimitInput.value),
    );
  });
}
