# StartWave repository rules

These rules apply to this repository and all descendants.

- Treat `assets/data/bdo-*.json` as curated Atlas data. Validate it, but never alter it unless the user explicitly requests a data change.
- Keep local automation deterministic and offline. Do not add network calls, telemetry, external APIs, or package dependencies.
- Never read or write outside the resolved repository root.
- Do not execute arbitrary commands from configuration or Atlas data.
- Do not auto-fix, delete, commit, or push. Report findings and let a human decide.
- Store generated Atlas Worker reports only under `.startwave-agent/logs/`; reports must not contain secrets or full source-file contents.
- Classify validator findings as `ERROR`, `WARNING`, or `INFO`. Validation errors must produce a non-zero exit code.

## Approved Node ID rule

`APPROVED_NODE_ID_RULE = BDO-NODE-<region-slug>-<node-slug>`. Node IDs are immutable after creation; literal Russian `name` and `region` are stored separately and may change independently. The fixed offline transliteration mapping is implemented in `tools/atlas-agent/node-id.mjs`. Existing-ID collisions return `ID_COLLISION` and require manual resolution; random suffixes and timestamps are forbidden. XLSX-to-Node creation must use this helper.

`APPROVED_REGION_ID_RULE = BDO-REGION-<semantic-slug>`. Region entity IDs are immutable stable identifiers, separate from versioned Region View IDs such as `bdo-region-view-calpheon-v0-5`. Region IDs use the same fixed offline transliteration policy via `tools/atlas-agent/region-id.mjs`; collisions require manual resolution. Regions contain Nodes, while global Resources, Items, Recipes, and Productions are never duplicated per region.
