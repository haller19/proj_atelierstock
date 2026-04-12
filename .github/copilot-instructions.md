# Workspace instructions for Atelier Stock

This repository is a small single-page React + Vite PWA for managing handmade accessory inventory, purchases, sales, and consignment.

## Project overview

- App entry: `src/main.jsx`
- Main UI + logic: `src/App.jsx`
- Build: Vite with `npm run dev`, `npm run build`, `npm run preview`
- Script commands: `dev`, `build`, `lint`, `preview`
- Styling approach: CSS template literal injected from `src/App.jsx`
- State management: React `useState` / `useMemo`; no external state library
- Persistence: LocalStorage via custom hooks and constants stored in `src/App.jsx`

## Recommended workflow

- Use `README.md` for feature-level context and `CLAUDE.md` for detailed data design and domain rules.
- Prefer small, incremental edits in `src/App.jsx` unless the change clearly benefits from component extraction.
- Keep the app structure simple, because this repo is currently intentionally single-file.
- Validate behavior with `npm run dev` and production output with `npm run build`.

## Key conventions

- `src/App.jsx` contains the domain model, helper functions, UI, and CSS.
- Constants such as `CH_FEE`, `MIN_STOCK`, `PART_CATS`, and `CHANNELS` are used for app state and display logic.
- Inventory formulas are implemented in helper functions like `calcPartStock`, `calcProductStock`, `calcConsigneeStock`, and `calcSaleProfit`.
- Use existing helper patterns rather than adding duplicate calculation logic.
- Keep data structure shape consistent with the current LocalStorage-backed model.

## Important files

- `README.md` — app introduction, features, and development commands
- `CLAUDE.md` — detailed design notes, data schema, inventory/price logic, and future improvement ideas
- `src/App.jsx` — source of truth for UI, state, persistence, and calculations
- `package.json` — available scripts and dependency versions
- `vite.config.js` — build configuration
- `eslint.config.js` — linting rules

## When editing

- For feature additions, first check `CLAUDE.md` for expected app tabs, data shapes, and inventory rules.
- For any UI or layout work, keep styling inside `src/App.jsx` and follow the existing CSS variable palette.
- For domain logic changes, preserve the current calculation helper style and avoid duplicating formula definitions.
- For bug fixes, run lint with `npm run lint` and verify the app still builds successfully.

## Example prompts

- "Add a new sales channel option and update the profit calculation accordingly."
- "Refactor part inventory display into a reusable component while keeping the app behavior unchanged."
- "Implement a JSON export/import backup feature for LocalStorage data."
- "Update the dashboard so low-stock parts show a stronger alert and use the existing `MIN_STOCK` thresholds."
