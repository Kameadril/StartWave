# StartWave Games components

All components are native custom elements and accept configuration through `data-*` attributes or `window.StartWaveGames`. They must not contain game names, game links or game-specific colours.

## Components

- `game-header.js` / `<sw-game-header data-game="…">` applies the configured theme class and owns the two-level header shell.
- `game-hero.js` / `<sw-game-hero data-game="…">` connects hero presentation with game metadata while preserving page-owned title and copy.
- `game-navigation.js` / `<sw-game-navigation data-game="…">` renders the configured game navigation and marks the current route.
- `game-search.js` / `<sw-game-search>` provides selectable search scopes. Routes and query prefixes are input data.
- `game-card.js` / `<sw-game-card>` renders article, recipe, item and calculator cards in compact, standard, featured or horizontal layouts.
- `game-footer.js` / `<sw-game-footer>` renders grouped links, statuses, module metadata and the shared `Built with ❤️ by a human and AI` attribution. Use `data-brand`, `data-copyright` and optional `data-attribution` to configure the bottom bar; do not duplicate attribution in page markup.

## Development rules

Keep meaningful content in page HTML so it remains readable before JavaScript upgrades the elements. Use `games.css` for shared structure and accessibility states. Put palette and visual identity only in a theme stylesheet. Prefer CSS custom properties over selectors tied to a game.

Every new module must use unique IDs, valid links and headings, responsive grids based on `minmax(0, 1fr)`, and content that can wrap without horizontal overflow. Run HTML validation, CSS validation where available, `node --check` for every JavaScript file and `git diff --check` before handoff.
