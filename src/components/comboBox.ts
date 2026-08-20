export interface ComboBoxOption {
  value: string;
  label: string;
  iconUrl?: string;
}

function optionRowsHtml(options: ComboBoxOption[]): string {
  return options
    .map(
      (opt) => `
        <div class="combo__option" role="option" aria-selected="false" data-value="${opt.value}">
          ${opt.iconUrl ? `<img class="combo__option-icon" src="${opt.iconUrl}" alt="" loading="lazy" />` : ""}
          <span>${opt.label}</span>
        </div>
      `,
    )
    .join("");
}

export function renderComboBox(
  id: string,
  options: ComboBoxOption[],
  selectedValue?: string,
  placeholder = "Search…",
): string {
  const selected = options.find((o) => o.value === selectedValue);

  return `
    <div class="combo" id="${id}" data-value="${selected?.value ?? ""}">
      <input
        type="text"
        class="combo__input"
        id="${id}-input"
        placeholder="${placeholder}"
        aria-label="${placeholder.replace(/…$/, "")}"
        autocomplete="off"
        role="combobox"
        aria-expanded="false"
        aria-controls="${id}-list"
        aria-autocomplete="list"
        value="${selected?.label ?? ""}"
      />
      <div class="combo__list" id="${id}-list" role="listbox" hidden>${optionRowsHtml(options)}</div>
    </div>
  `;
}

const boundSelectHandlers = new Map<string, (value: string) => void>();
const boundOptionsById = new Map<string, ComboBoxOption[]>();

function bindOptionRows(id: string): void {
  const container = document.getElementById(id)!;
  const list = document.getElementById(`${id}-list`) as HTMLDivElement;

  list.querySelectorAll<HTMLDivElement>(".combo__option").forEach((row) => {
    row.addEventListener("mousedown", (event) => {
      event.preventDefault();
      const value = row.dataset.value!;
      container.dataset.value = value;
      boundSelectHandlers.get(id)?.(value);
      list.hidden = true;
      const input = document.getElementById(`${id}-input`) as HTMLInputElement;
      input.value = row.textContent?.trim() ?? "";
    });
  });
}

export function bindComboBox(
  id: string,
  options: ComboBoxOption[],
  onSelect: (value: string) => void,
): void {
  boundSelectHandlers.set(id, onSelect);
  boundOptionsById.set(id, options);

  const container = document.getElementById(id)!;
  const input = document.getElementById(`${id}-input`) as HTMLInputElement;
  const list = document.getElementById(`${id}-list`) as HTMLDivElement;

  function currentLabel(): string {
    const value = container.dataset.value;
    return boundOptionsById.get(id)?.find((o) => o.value === value)?.label ?? "";
  }

  function filterList(query: string): void {
    const q = query.trim().toLowerCase();
    list.querySelectorAll<HTMLDivElement>(".combo__option").forEach((row) => {
      const label = row.textContent?.toLowerCase() ?? "";
      row.style.display = label.includes(q) ? "flex" : "none";
    });
  }

  function openList(): void {
    list.hidden = false;
    input.setAttribute("aria-expanded", "true");
    filterList(input.value === currentLabel() ? "" : input.value);
  }

  function closeList(): void {
    list.hidden = true;
    input.setAttribute("aria-expanded", "false");
    input.value = currentLabel();
  }

  input.addEventListener("focus", () => {
    input.select();
    openList();
  });

  input.addEventListener("input", () => {
    openList();
  });

  input.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      closeList();
      input.blur();
    } else if (event.key === "Enter") {
      event.preventDefault();
      const firstVisible = Array.from(list.querySelectorAll<HTMLDivElement>(".combo__option")).find(
        (row) => row.style.display !== "none",
      );
      firstVisible?.click();
    }
  });

  container.addEventListener("focusout", (event) => {
    if (!container.contains(event.relatedTarget as Node)) {
      closeList();
    }
  });

  bindOptionRows(id);
}

/** Replace a combo box's options in place (e.g. teams for a different season). */
export function setComboBoxOptions(id: string, options: ComboBoxOption[], preferredValue?: string): void {
  boundOptionsById.set(id, options);

  const container = document.getElementById(id)!;
  const input = document.getElementById(`${id}-input`) as HTMLInputElement;
  const list = document.getElementById(`${id}-list`) as HTMLDivElement;

  const keepValue = options.some((o) => o.value === preferredValue)
    ? preferredValue
    : options.some((o) => o.value === container.dataset.value)
      ? container.dataset.value
      : undefined;
  const selected = options.find((o) => o.value === keepValue);

  list.innerHTML = optionRowsHtml(options);
  container.dataset.value = selected?.value ?? "";
  input.value = selected?.label ?? "";
  bindOptionRows(id);
}

export function getComboBoxValue(id: string): string {
  return document.getElementById(id)?.dataset.value ?? "";
}
