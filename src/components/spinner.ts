const INFINITY_PATH =
  "M16,17 C16,7 26,7 32,17 C38,27 48,27 48,17 C48,7 38,7 32,17 C26,27 16,27 16,17 Z";

/** "Dual chasers" loading indicator: two colored segments circling a figure-8 track. */
export function renderSpinner(label = "Loading", size?: "sm" | "lg"): string {
  const sizeClass = size ? ` spinner--${size}` : "";
  return `
    <span class="spinner spinner--dual-chasers${sizeClass}" role="status" aria-label="${label}">
      <svg viewBox="0 0 64 34" aria-hidden="true">
        <path class="spinner__track" d="${INFINITY_PATH}"/>
        <path class="spinner__lit-a" d="${INFINITY_PATH}"/>
        <path class="spinner__lit-b" d="${INFINITY_PATH}"/>
      </svg>
    </span>
  `;
}
