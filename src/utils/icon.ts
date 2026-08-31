/** Renders a Material Symbols (Outlined) icon by its ligature name, e.g. icon("delete"). */
export function icon(name: string, extraClass = ""): string {
  const cls = extraClass ? `material-symbols-outlined ${extraClass}` : "material-symbols-outlined";
  return `<span class="${cls}" aria-hidden="true">${name}</span>`;
}

/** Inline X (formerly Twitter) logo mark, colored via currentColor. */
export function xIcon(): string {
  return `<svg class="icon-x" viewBox="0 0 24 24" width="14" height="14" fill="currentColor" aria-hidden="true"><path d="M18.9 2H22l-7.6 8.7L23.3 22H16.9l-5-6.5L6 22H2.9l8.1-9.3L1 2h6.6l4.5 6 6.8-6Zm-1.1 18h1.7L7.3 3.9H5.5L17.8 20Z"/></svg>`;
}
