# NodeProduction Provenance Policy

`bdo-node-productions.json` is an optional provenance layer for worker production
branches. It does not replace Node↔Resource, Item↔Resource, or Region→Node.

`source.sourceType` identifies provenance:

- `xlsx` — source-backed Atlas data;
- `pearl-abyss` — official Pearl Abyss data outside the XLSX snapshot;
- `bdo-codex` — BDO Codex confirmation;
- `verified-external` — independently verified external source.

Every NodeProduction record requires `sourceRef`, `verifiedAt`, and a controlled
source status. `sourceDate` is required for `xlsx` and `pearl-abyss`; it may be
omitted for `bdo-codex` and `verified-external` when the source supplies no
reliable publication/update date. Provenance is never replaced automatically
and post-XLSX records must not be presented as XLSX-backed data.
