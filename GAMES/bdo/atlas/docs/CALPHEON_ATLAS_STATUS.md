# Calpheon Atlas — Development Status

## Current checkpoint

**Wood Processing Chain v2 — candidate**
Recorded: 2026-10-24

The first verified production chain of Calpheon Atlas is represented across the Resource, Item and Recipe archives. This checkpoint records the current architecture only and does not introduce new game data or relationships.

## Completed archives

### Resource Archive

- The wood-resource collection contains 14 archived resource branches.

### Item Archive

- Log — `SW-ITEM-013`;
- Usable Scantling — `SW-ITEM-027`;
- Standardized Timber Square — `SW-ITEM-014`;
- Pine Timber — `SW-ITEM-016`;
- Pine Plank — `SW-ITEM-150`;
- Pine Plywood — `SW-ITEM-044`;
- Imperial Calpheon Timber Crate — `SW-ITEM-017`.

### Recipe Archive

- Log ×10 → Usable Scantling — `SW-RECIPE-001`, variable output;
- Usable Scantling ×10 → Standardized Timber Square — `SW-RECIPE-002`, variable output;
- Pine Timber ×5 → Pine Plank — `SW-RECIPE-023`, variable output;
- Pine Plank ×10 → Pine Plywood — `SW-RECIPE-004`, variable output;
- Alder Plywood ×5 + Cypress Plywood ×5 + Cedar Plywood ×5 + Black Stone Powder ×1 → Imperial Calpheon Timber Crate — `SW-RECIPE-005`.

## State boundary

Wood Processing Chain v2 separates the universal and pine identities. `SW-ITEM-150` is a local Atlas ID without an external game ID. No nodes, fixed yields, rare secondary outputs, LIVE records or `bdo-resource-wood-log` item relation are added in this candidate.
