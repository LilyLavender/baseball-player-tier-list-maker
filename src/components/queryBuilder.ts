import type { Team } from "../types/mlb";
import { teamLogoUrl } from "../types/mlb";
import { fetchTeams } from "../api/mlbApi";
import { qualifierFor, STAT_CATEGORIES } from "../data/statCategories";
import { bindComboBox, getComboBoxValue, renderComboBox, setComboBoxOptions } from "./comboBox";
import type { ComboBoxOption } from "./comboBox";
import type { AutoTierStrategy } from "../tiering/autoTier";

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
        <option value="25" selected>Top 25</option>
        <option value="50">Top 50</option>
        <option value="100">Top 100</option>
        <option value="${ALL_LIMIT}">All</option>
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

    <h2 class="query-builder__heading query-builder__heading--stat">Auto-tier from pool</h2>
    <p class="query-builder__placeholder">Builds tiers from stat values already in the pool. Run a stat leaders query first.</p>
    <label class="query-builder__field">
      Strategy
      <select id="qb-autotier-strategy">
        <option value="interval">Fixed interval</option>
        <option value="per-unit">One tier per value</option>
        <option value="auto-grouping">Auto S-F grouping (natural breaks)</option>
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
    <label class="query-builder__field" id="qb-autotier-scheme-field" hidden>
      Tier scheme
      <select id="qb-autotier-scheme">
        <option value="sf">S-F (6 tiers)</option>
        <option value="sf-plus-minus">S-F with +/- (up to 18 tiers)</option>
      </select>
    </label>
    <button id="qb-autotier-apply" type="button">Generate Tiers</button>
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

export function bindQueryBuilder(teams: Team[], callbacks: QueryBuilderCallbacks): void {
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

  statScopeSelect.addEventListener("change", () => {
    statSeasonField.hidden = statScopeSelect.value === "career";
  });

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

  const strategySelect = document.querySelector<HTMLSelectElement>("#qb-autotier-strategy")!;
  const intervalField = document.querySelector<HTMLLabelElement>("#qb-autotier-interval-field")!;
  const intervalInput = document.querySelector<HTMLInputElement>("#qb-autotier-interval")!;
  const thresholdsField = document.querySelector<HTMLLabelElement>("#qb-autotier-thresholds-field")!;
  const thresholdsInput = document.querySelector<HTMLInputElement>("#qb-autotier-thresholds")!;
  const schemeField = document.querySelector<HTMLLabelElement>("#qb-autotier-scheme-field")!;
  const schemeSelect = document.querySelector<HTMLSelectElement>("#qb-autotier-scheme")!;
  const autoTierApplyButton = document.querySelector<HTMLButtonElement>("#qb-autotier-apply")!;

  strategySelect.addEventListener("change", () => {
    intervalField.hidden = strategySelect.value !== "interval";
    thresholdsField.hidden = strategySelect.value !== "thresholds";
    schemeField.hidden = strategySelect.value !== "auto-grouping";
  });

  autoTierApplyButton.addEventListener("click", () => {
    const kind = strategySelect.value;
    if (kind === "interval") {
      callbacks.onGenerateAutoTiers({ kind: "interval", size: Number(intervalInput.value) || 1 });
    } else if (kind === "per-unit") {
      callbacks.onGenerateAutoTiers({ kind: "per-unit" });
    } else if (kind === "auto-grouping") {
      const scheme = schemeSelect.value === "sf-plus-minus" ? "sf-plus-minus" : "sf";
      callbacks.onGenerateAutoTiers({ kind: "auto-grouping", scheme });
    } else if (kind === "thresholds") {
      const thresholds = thresholdsInput.value
        .split(",")
        .map((part) => Number(part.trim()))
        .filter((n) => Number.isFinite(n));
      callbacks.onGenerateAutoTiers({ kind: "thresholds", thresholds });
    }
  });
}
