/**
 * Shows `element` only when `select`'s current value matches one of `visibleFor`, and keeps it in
 * sync on every change. Runs once immediately so the initial hidden state always matches the
 * select's initial value, even if that doesn't match the field's hardcoded `hidden` attribute.
 */
export function bindConditionalField(
  select: HTMLSelectElement,
  element: HTMLElement,
  visibleFor: string[],
): void {
  const sync = () => {
    element.hidden = !visibleFor.includes(select.value);
  };
  select.addEventListener("change", sync);
  sync();
}
