# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

# Project: pranavsuby.github.io Web Apps

## Deployment
This is a **GitHub Pages project**. Every change — no matter how small — must be deployed immediately after:
```
npm run deploy
```
Do not skip this. There is no staging environment; deploy IS the publish step.

## Versioning
Each app has its own version number tracked in `src/HomePage.jsx` (the `tools` array). **Only bump an app's version if that app's code actually changed.** Homepage-only changes (layout, spacing, CSS) do not count as a change to any individual app. Bump the relevant app's version on every change:
- **patch** (x.x.1) — bug fixes, copy changes, minor style tweaks
- **minor** (x.1.0) — new features, new screens, meaningful additions
- **major** (1.0.0) — only when explicitly told

The top-level `package.json` version should mirror the highest app version or be bumped to match the scope of work done.

### Current app versions (update this list when versions change)
| App | Field in `tools[]` | Current version |
|-----|--------------------|-----------------|
| Gym Tracker | `id: 'gym'` | 1.16.0 |
| NutriCore   | `id: 'nutricore'` | 0.25.0 |

## Project structure
```
src/
  App.jsx              # Router — add new app routes here
  HomePage.jsx         # Home screen grid — add new app cards here
  GymApp.jsx           # Gym tracker shell
  nutricore/           # NutriCore food tracker
    NutriCoreApp.jsx   # Shell
    DiaryScreen.jsx
    FoodPickerModal.jsx
    ServingEditorModal.jsx
    CustomFoodModal.jsx
    FoodsScreen.jsx
    GoalsScreen.jsx
    db.js              # IndexedDB layer
    nutrition.js       # Calc utils + tokenized search
    tdee.js            # Mifflin-St Jeor TDEE
    seedFoods.js       # 60 common foods (seeded on first launch)
    TrendsScreen.jsx
    FastingScreen.jsx
    OnboardingModal.jsx
    RecipeModal.jsx
    BarcodeScanner.jsx
    NutriCore.css      # Styles scoped to .nc-app
```

## Mobile input rules
All `<input>`, `<textarea>`, and `<select>` elements **must have `font-size: 16px` or larger**. iOS Safari auto-zooms the page when a focused input has `font-size < 16px`, which breaks the layout. This applies to every new component in every app. The global CSS reset already sets `font-size: max(16px, 1em)` as a fallback, but any inline style or style-object that sets a smaller `fontSize` will override it — so never set `fontSize` below 16 on an input.

## Shared UI component library (`src/ui/`)

Every reusable component lives here. Import from `'../ui'` (or `'./ui'` from App.jsx).

| Component | Props | Notes |
|-----------|-------|-------|
| `NavBar` | `tabs, activeId, onSelect, iconSize?` | Each tab: `{ id, label, Icon }` |
| `TopBar` | `title?, subtitle?, onBack?, backLabel?, right?` | In-flow top bar with safe-area padding |
| `Button` | `variant?, size?, fullWidth?, icon?, disabled?` | variants: `primary secondary ghost danger` · sizes: `sm md lg` |
| `IconButton` | `icon, size?, onClick?` | Square icon-only button |
| `Input` | `label?, value, onChange, type?, placeholder?, suffix?` | Renders `.ui-field > .ui-input-wrap > input` |
| `Sheet` | `open, onClose, title?, tall?, flex?` | Bottom sheet with backdrop dismiss + Escape key |
| `Card` | `padded?, small?, inset?, onClick?` | Card container; `onClick` adds hover state |

**Theming** — components use `--ui-*` CSS variables. Each app maps its own design tokens to these in its root CSS class:
- `src/index.css`: `.app-shell` has defaults; `.app-shell.app` maps GymApp vars
- `src/nutricore/NutriCore.css`: `.nc-app` maps NutriCore vars

**Adding a new app** — define `--ui-*` mappings in the new app's root CSS class and all shared components theme automatically.

**CSS classes** — `src/ui/ui.css` contains `.app-nav`, `.app-nav-btn`, `.app-topbar`, `.ui-btn`, `.ui-input`, `.ui-card`, `.ui-sheet-overlay`, `.minimized-bar`.

## Adding a new app
1. Create `src/<appname>/` with its own shell component and CSS scoped to `.<appname>-app`
2. Add a route in `src/App.jsx`: `<Route path="/<appname>/*" element={<AppComponent />} />`
3. Add a card in `src/HomePage.jsx` `tools` array with its own starting version
4. Run `npm run deploy`

## Commands

```bash
npm start               # local dev server (http://localhost:3000)
npm run build           # production build to /build
npm run deploy          # build + push to gh-pages branch (publishes live)
npm run build:foods     # regenerate public/foods-db.json from USDA source data
npm run build:exercises # merge scripts/extra-exercises.js into src/data/exercises.json
npm run build:icons     # rasterize public/icon.svg into the PNG app icons (needs Playwright)
```

There are no tests. There is no linter configured.

## Architecture

### Navigation — two layers, single ownership each
These are app-like mobile PWAs (tab bar + deep modal/overlay stacks), so screens are
intentionally NOT URL-addressable. Navigation has two cleanly separated layers:

- **React Router** (`src/App.jsx`) owns ONLY the three real pages: `/`, `/gym-app`,
  `/nutricore`. It never sees in-app navigation.
- **NavStack** (`src/ui/navStack.js`, exported as `useBackClose` from `src/ui`) is the app's
  single owner of the browser Back button for all in-app layers (tab sub-views, overlays,
  modals, sheets). Any overlay/sub-view calls `useBackClose(onClose, active?)` so Back/swipe
  closes one layer at a time (LIFO) instead of leaving the app. It keeps one sentinel history
  entry while any layer is open and is router-safe (`pushState(window.history.state, '')`
  preserves React Router's state). The shared `Sheet` registers automatically; gym fixed-
  overlay views and all NutriCore modals call the hook directly. **Do not** add a second
  back/history mechanism — route every new overlay's Back through `useBackClose`.

### Data layer — IndexedDB only, no backend
All persistence is client-side IndexedDB via the `idb` library. There are two separate databases:

- **`gymapp-v2`** (`src/db.js`) — stores: `routines`, `sessions`, `customExercises`, `settings`. The `settings` store doubles as a key-value bag for the active session (`key: 'activeSession'`) and last workout settings (`key: 'lastWorkoutSettings'`).
- **`nutricore-v1`** (`src/nutricore/db.js`, v3) — stores: `nc_foods`, `nc_diary`, `nc_meals`, `nc_goals`, `nc_water`, `nc_profile`, `nc_favorites`, `nc_biometrics`, `nc_fasts`.

### Gym Tracker state management

Two React contexts, always nested `AppProvider > WorkoutProvider`:

- **`AppContext`** (`src/contexts/AppContext.jsx`) — loads settings, routines, sessions, and custom exercises from IndexedDB once on mount. Exposes `refreshX()` callbacks that re-fetch a single store; call these after any write so consumers see fresh data.
- **`WorkoutContext`** (`src/contexts/WorkoutContext.jsx`) — owns the entire live workout session: elapsed timer, rest timer countdown, PR detection, minimize/expand state. The active session is written to IndexedDB with a 500 ms debounce so it survives page refresh; it is restored on mount. Session settings (rest time, intensity mode) are persisted per-routine when the session finishes.

### NutriCore state management

- **`NCContext`** (`src/nutricore/NCContext.jsx`, `useNutriCore()`) — mirrors the gym's `AppContext`. `NCProvider` runs `initNutriCore()` + loads the `profile` singleton on mount (exposes `ready`/`initError`). It owns shared state so screens don't each re-fetch and drift:
  - `profile` + `updateProfile`/`refreshProfile` — the one profile read by Diary/Data/Trends/Settings/Goals and written via the context (which persists + bumps `dataVersion`).
  - `dataVersion` + `bumpData()` — bumped after any diary/water/biometric/profile write. Aggregate screens (Data, Trends) list `dataVersion` in a load effect so they re-fetch even while mounted under an overlay. Diary owns its own date-scoped reload and just calls `bumpData()` after writes.

### Exercise data (Gym Tracker)

- **Bundled library**: `src/data/exercises.json` (~1800 exercises from ExerciseDB, read-only). Never modified at runtime.
- **Custom exercises**: stored in the `customExercises` IndexedDB store, surfaced via `AppContext`.
- `src/utils/exercises.js` merges both sources for search/filter. `src/utils/stats.js` provides Epley 1RM, volume, per-exercise PR records, and chart data helpers.

Set type cycle: **N** (normal) → **W** (warm-up) → **D** (drop set) → **F** (failure) → N.

### NutriCore food database

- **Seed foods** (`src/nutricore/seedFoods.js`): 60 common foods with micronutrients, written into `nc_foods` on first launch (and refreshed on DB v3 upgrade).
- **Full food DB** (`public/foods-db.json`): a large compact JSON blob built by `scripts/build-food-db.js` and served as a static asset. `FoodDbDownloader.jsx` fetches it on first use, expands the compact field aliases (e.g. `f.k` → `kcal`), and bulk-inserts into `nc_foods`. Version is tracked in `localStorage` under `nc_food_db_v`; increment `FOOD_DB_VERSION` in `FoodDbDownloader.jsx` to force a re-download.

### Styling

CSS custom properties for theming (`--bg2`, `--border`, `--accent`, `--text`, etc.) defined in `src/index.css`. Each app is scoped: `.app` for Gym Tracker, `.nc-app` for NutriCore. Avoid inline styles that hardcode colors — use the CSS variables.
