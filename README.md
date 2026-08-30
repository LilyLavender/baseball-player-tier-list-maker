# MLB Player Tier List Maker

A tiermaker.com-style tool for building MLB player tier lists. Pull players straight from the MLB Stats API, drag them into tiers, and save lists locally, no account required.

## Features

- **Player pool query builder**: populate the pool by team/season roster, stat leaders, or manual player search.
- **Pool filters**: narrow the pool by team, position, country of birth, and stat thresholds, combinable and independent of how players were added.
- **Two board modes**:
  - **Custom**: fully editable tiers, drag-and-drop.
  - **Auto-tier**: pre-filled into tiers by stat value.
- **Save and history**: save tier lists locally, reopen, rename, duplicate, delete, or refresh a saved list's data against the live API.
- **Export**: export a finished board as a PNG.
- Light and dark themes
- Persistence across visits

## Stack

- [Vite](https://vitejs.dev/) + TypeScript
- [SortableJS](https://sortablejs.github.io/Sortable/) for drag-and-drop
- [MLB Stats API](https://statsapi.mlb.com/) for player and stat data
- `localStorage` for all persistence, no backend

## Development

Run:
```bash
npm run dev
```

Build:
```bash
npm run build
```
