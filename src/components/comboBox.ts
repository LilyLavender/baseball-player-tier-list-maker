export interface ComboBoxOption {
  value: string;
  label: string;
  iconUrl?: string;
}

export function renderComboBox(
  id: string,
  options: ComboBoxOption[],
  selectedValue?: string,
  placeholder = "Search…",
): string {
  const selected = options.find((o) => o.value === selectedValue);

  const optionRows = options
    .map(
      (opt) => `
        <div class="combo__option" data-value="${opt.value}">
          ${opt.iconUrl ? `<img class="combo__option-icon" src="${opt.iconUrl}" alt="" loading="lazy" />` : ""}
          <span>${opt.label}</span>
        </div>
      `,
    )
    .join("");

  return `
    <div class="combo" id="${id}" data-value="${selected?.value ?? ""}">
      <input
        type="text"
        class="combo__input"
        id="${id}-input"
        placeholder="${placeholder}"
        autocomplete="off"
        value="${selected?.label ?? ""}"
      />
      <div class="combo__list" id="${id}-list" hidden>${optionRows}</div>
    </div>
  `;
}

export function bindComboBox(
  id: string,
  options: ComboBoxOption[],
  onSelect: (value: string) => void,
): void {
  const container = document.getElementById(id)!;
  const input = document.getElementById(`${id}-input`) as HTMLInputElement;
  const list = document.getElementById(`${id}-list`) as HTMLDivElement;

  function currentLabel(): string {
    const value = container.dataset.value;
    return options.find((o) => o.value === value)?.label ?? "";
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
    filterList(input.value === currentLabel() ? "" : input.value);
  }

  function closeList(): void {
    list.hidden = true;
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

  list.querySelectorAll<HTMLDivElement>(".combo__option").forEach((row) => {
    row.addEventListener("mousedown", (event) => {
      event.preventDefault();
      const value = row.dataset.value!;
      container.dataset.value = value;
      onSelect(value);
      closeList();
    });
  });

  container.addEventListener("focusout", (event) => {
    if (!container.contains(event.relatedTarget as Node)) {
      closeList();
    }
  });
}

export function getComboBoxValue(id: string): string {
  return document.getElementById(id)?.dataset.value ?? "";
}
