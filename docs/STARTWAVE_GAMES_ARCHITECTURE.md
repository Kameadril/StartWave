# StartWave Games Framework v1.0

StartWave Games is a small, dependency-free layer built from native custom elements, shared CSS and a game registry. Game content remains in HTML; the framework supplies presentation and reusable behaviour.

## Structure

- `assets/js/game-config.js` — game registry: name, logo, theme, routes, sections and module statuses.
- `assets/js/components/` — game-agnostic custom elements.
- `assets/css/games.css` — shared layout, responsive rules and semantic design tokens.
- `assets/css/themes/<theme>.css` — game-specific token overrides only.
- `pages/` — game module content.

The page loads `style.css`, `games.css`, then one theme stylesheet. Scripts load the registry before components. A page selects a game with `data-game="<id>"`; components read the corresponding registry entry and never contain game names, links or palettes.

## Adding a game

1. Add an entry to `game-config.js` with `name`, `shortName`, `logo`, `theme`, `home`, `searchPrefix`, `links`, `sections` and `modules`.
2. Create `assets/css/themes/<theme>.css` and override only `--game-*` tokens.
3. Create the page, load the shared styles, its theme, registry and required components.
4. Set `data-game` on the header, navigation and hero.
5. Add module content without changing shared components.

Module statuses use `ready`, `development`, `skeleton` or `planned`. New behaviour belongs in a general component only when it is useful to more than one game; game rules and content stay in configuration or the page.

## Boundaries

Version 1.0 deliberately has no CMS, application framework, database, complex engine or AI Core. The registry is static JavaScript and can later become an adapter boundary for another data source without changing component APIs.

## BDO Workers knowledge model

The Workers module is the first linked-knowledge implementation. Its page content uses the shared Card Engine and preserves this relation path:

`worker → city → node → resource → production`

The first migration stage provides sections for system basics, worker types, cities, nodes, resources, production chains and beginner advice. Calculator, node map, resource-chain and AI-search cards are explicit extension points; they remain planned until their data sources and behaviour are implemented.
