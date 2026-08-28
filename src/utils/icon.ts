/** Renders a Material Symbols (Outlined) icon by its ligature name, e.g. icon("delete"). */
export function icon(name: string, extraClass = ""): string {
  const cls = extraClass ? `material-symbols-outlined ${extraClass}` : "material-symbols-outlined";
  return `<span class="${cls}" aria-hidden="true">${name}</span>`;
}
