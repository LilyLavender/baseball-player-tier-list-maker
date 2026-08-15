import type { Team } from "../types/mlb";

export interface QueryBuilderCallbacks {
  onApply: (teamId: number, season: number) => void;
}

const CURRENT_YEAR = new Date().getFullYear();

export function renderQueryBuilder(
  teams: Team[],
  selected?: { teamId: number; season: number },
): string {
  const teamOptions = teams
    .slice()
    .sort((a, b) => a.name.localeCompare(b.name))
    .map(
      (team) =>
        `<option value="${team.id}" ${team.id === selected?.teamId ? "selected" : ""}>${team.name}</option>`,
    )
    .join("");

  const season = selected?.season ?? CURRENT_YEAR;

  return `
    <h2 class="query-builder__heading">Build your pool</h2>
    <label class="query-builder__field">
      Team
      <select id="qb-team">${teamOptions}</select>
    </label>
    <label class="query-builder__field">
      Season
      <input id="qb-season" type="number" value="${season}" min="1901" max="${CURRENT_YEAR}" />
    </label>
    <button id="qb-apply" type="button">Apply</button>
  `;
}

export function bindQueryBuilder(callbacks: QueryBuilderCallbacks): void {
  const teamSelect = document.querySelector<HTMLSelectElement>("#qb-team")!;
  const seasonInput = document.querySelector<HTMLInputElement>("#qb-season")!;
  const applyButton = document.querySelector<HTMLButtonElement>("#qb-apply")!;

  applyButton.addEventListener("click", () => {
    const teamId = Number(teamSelect.value);
    const season = Number(seasonInput.value);
    callbacks.onApply(teamId, season);
  });
}
