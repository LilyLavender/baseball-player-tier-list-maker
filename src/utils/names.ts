export function lastName(fullName: string): string {
  const parts = fullName.trim().split(/\s+/);
  return parts[parts.length - 1] ?? fullName;
}

export function sortByLastName<T extends { fullName: string }>(players: T[]): T[] {
  return players
    .slice()
    .sort((a, b) => lastName(a.fullName).localeCompare(lastName(b.fullName)));
}
