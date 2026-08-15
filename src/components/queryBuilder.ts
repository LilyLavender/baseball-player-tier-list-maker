import type { Team } from "../types/mlb";
import { teamLogoUrl } from "../types/mlb";
import { fetchTeams } from "../api/mlbApi";
import { STAT_CATEGORIES } from "../data/statCategories";
import { bindComboBox, getComboBoxValue, renderComboBox, setComboBoxOptions } from "./comboBox";
import type { ComboBoxOption } from "./comboBox";
import type { AutoTierStrategy } from "../tiering/autoTier";

export interface QueryBuilderCallbacks {
  onApplyTeam: (teamId: number | "all", season: number) => void;
  onApplyStat: (statCategoryId: string, season: number, limit: number) => void;
  onGenerateAutoTiers: (strategy: AutoTierStrategy) => void;
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

function statOptions(): ComboBoxOption[] {
  return STAT_CATEGORIES.map((stat) => ({
    value: stat.id,
    label: `${stat.label} (${stat.group})`,
  }));
}

export function renderQueryBuilder(
  teams: Team[],
  selectedTeamQuery?: { teamId: number | "all"; season: number },
): string {
  const teamSeason = selectedTeamQuery?.season ?? CURRENT_YEAR;
  const defaultTeamValue = selectedTeamQuery ? String(selectedTeamQuery.teamId) : ALL_TEAMS_VALUE;

  return `
    <h2 class="query-builder__heading">By team &amp; season</h2>
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

    <h2 class="query-builder__heading query-builder__heading--stat">Auto-tier from pool</h2>
    <p class="query-builder__placeholder">Builds tiers from stat values already in the pool. Run a stat leaders query first.</p>
    <label class="query-builder__field">
      Strategy
      <select id="qb-autotier-strategy">
        <option value="interval">Fixed interval</option>
        <option value="per-unit">One tier per value</option>
        <option value="auto-grouping">Auto S-F grouping</option>
        <option value="thresholds">Custom thresholds</option>
      </select>
    </label>
    <label class="query-builder__field" id="qb-autotier-interval-field">
      Interval size
      <input id="qb-autotier-interval" type="number" value="10" min="0.1" step="0.1" />
    </label>
    <label class="query-builder__field" id="qb-autotier-thresholds-field" hidden>
      Thresholds (comma-separated)
      <input id="qb-autotier-thresholds" type="text" placeholder="e.g. 40, 30, 20, 10" />
    </label>
    <button id="qb-autotier-apply" type="button">Generate Tiers</button>
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
    const teamValue = getComboBoxValue("qb-team");
    if (!teamValue) return;
    const teamId = teamValue === ALL_TEAMS_VALUE ? ALL_TEAMS_VALUE : Number(teamValue);
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

  const strategySelect = document.querySelector<HTMLSelectElement>("#qb-autotier-strategy")!;
  const intervalField = document.querySelector<HTMLLabelElement>("#qb-autotier-interval-field")!;
  const intervalInput = document.querySelector<HTMLInputElement>("#qb-autotier-interval")!;
  const thresholdsField = document.querySelector<HTMLLabelElement>("#qb-autotier-thresholds-field")!;
  const thresholdsInput = document.querySelector<HTMLInputElement>("#qb-autotier-thresholds")!;
  const autoTierApplyButton = document.querySelector<HTMLButtonElement>("#qb-autotier-apply")!;

  strategySelect.addEventListener("change", () => {
    intervalField.hidden = strategySelect.value !== "interval";
    thresholdsField.hidden = strategySelect.value !== "thresholds";
  });

  autoTierApplyButton.addEventListener("click", () => {
    const kind = strategySelect.value;
    if (kind === "interval") {
      callbacks.onGenerateAutoTiers({ kind: "interval", size: Number(intervalInput.value) || 1 });
    } else if (kind === "per-unit") {
      callbacks.onGenerateAutoTiers({ kind: "per-unit" });
    } else if (kind === "auto-grouping") {
      callbacks.onGenerateAutoTiers({ kind: "auto-grouping" });
    } else if (kind === "thresholds") {
      const thresholds = thresholdsInput.value
        .split(",")
        .map((part) => Number(part.trim()))
        .filter((n) => Number.isFinite(n));
      callbacks.onGenerateAutoTiers({ kind: "thresholds", thresholds });
    }
  });
}
