# StartWave repository rules

These rules apply to this repository and all descendants.

- Treat `assets/data/bdo-*.json` as curated Atlas data. Validate it, but never alter it unless the user explicitly requests a data change.
- Keep local automation deterministic and offline. Do not add network calls, telemetry, external APIs, or package dependencies.
- Never read or write outside the resolved repository root.
- Do not execute arbitrary commands from configuration or Atlas data.
- For audits and previews, work read-only: do not auto-fix, delete, commit, or push. Report findings and wait for owner approval.
- Store generated Atlas Worker reports only under `.startwave-agent/logs/`; reports must not contain secrets or full source-file contents.
- Classify validator findings as `ERROR`, `WARNING`, or `INFO`. Validation errors must produce a non-zero exit code.

## Approved APPLY workflow

- An explicit owner-approved APPLY permits only the changes named in that task. Keep the scope exact and run all required validation and tests.
- If validation and tests pass, the agent may commit only the approved APPLY files and push only to the current owner-approved working branch. Report the commit SHA and push result.
- If validation or tests fail, unexpected files change, scope expands, repository state is unsafe or ambiguous, or conflicts occur, do not commit or push. Stop and report to the owner.
- APPLY permission does not authorize unrelated deletion, destructive cleanup, history rewriting, force-push, branch deletion, reset, or other destructive Git operations. Those require separate explicit owner authorization where applicable.
- Commit and push permission does not authorize production deployment. Production deployment requires separate explicit owner approval.
- Git permission does not imply database or Supabase mutation permission. Database APPLY must be separately authorized when required by the task.

## Approved Node ID rule

`APPROVED_NODE_ID_RULE = BDO-NODE-<region-slug>-<node-slug>`. Node IDs are immutable after creation; literal Russian `name` and `region` are stored separately and may change independently. The fixed offline transliteration mapping is implemented in `tools/atlas-agent/node-id.mjs`. Existing-ID collisions return `ID_COLLISION` and require manual resolution; random suffixes and timestamps are forbidden. XLSX-to-Node creation must use this helper.

`APPROVED_REGION_ID_RULE = BDO-REGION-<semantic-slug>`. Region entity IDs are immutable stable identifiers, separate from versioned Region View IDs such as `bdo-region-view-calpheon-v0-5`. Region IDs use the same fixed offline transliteration policy via `tools/atlas-agent/region-id.mjs`; collisions require manual resolution. Regions contain Nodes, while global Resources, Items, Recipes, and Productions are never duplicated per region.

## Analysis discipline

When analyzing the project:

1. Do not scan the whole repository unless explicitly requested.
2. First identify the entry file or relevant folder.
3. Read only the minimum required files.
4. Follow references from the discovered files.
5. Avoid excessive tool calls.
6. For large tasks, split analysis into smaller steps.
