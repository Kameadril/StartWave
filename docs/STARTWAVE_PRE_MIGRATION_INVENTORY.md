# StartWave Pre-Migration Inventory

## Repository

- Branch: `integrate/mac-main-update-2026-08-17`
- HEAD: `744dad8` (`Refine AI Hub cards and daily card styles`)
- Working tree before baseline documentation: clean
- Repository root: `.`

## Core

Existing Core HTML files:

- `index.html`
- `index_old.html`
- `ai.html`
- `entertainment.html`
- `games.html`
- `profile.html`
- `services.html`

## BDO

- BDO entry page: `bdo.html`
- BDO pages: 19 files matching `pages/bdo-*.html`
- BDO JavaScript: 13 files matching `assets/js/bdo-*.js`
- BDO Atlas JSON: 12 files matching `assets/data/bdo-*.json`
- BDO runtime data script: `assets/data/bdo-coupons.js`
- BDO image directory: `assets/images/bdo/`
- Additional BDO image: `assets/images/bdo-workers-interface.jpg`
- Atlas Agent directory: `tools/atlas-agent/`
- Atlas Agent launcher: `scripts/atlas-agent.ps1`
- Atlas status document: `docs/CALPHEON_ATLAS_STATUS.md`

## Shared

The following files are shared Core/BDO dependencies before separation:

- `assets/css/style.css`
- `assets/js/script.js`

## Missing

- Gold Ore pilot is absent from this checkout.
- NodeProduction data is absent from this checkout.
- `assets/data/bdo-node-productions.json` does not exist.

These missing data must not be recreated during structural migration. They are expected to be transferred later from another checkout.

## Planned target

The future target structure is recorded for planning only. No directories have been moved or created by this inventory.

```text
StartWave/
├── site/
├── bdo/
├── docs/
├── scripts/
└── repository configuration
```
