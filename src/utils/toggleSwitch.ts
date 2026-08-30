/** Renders the pill-shaped switch control used for "Show stat numbers" and other on/off filters. */
export function renderToggleSwitch(id: string, checked = false): string {
  return `
    <span class="toggle-switch">
      <input id="${id}" type="checkbox" class="toggle-switch-input"${checked ? " checked" : ""} />
      <span class="toggle-switch-track"><span class="toggle-switch-thumb"></span></span>
    </span>
  `;
}
