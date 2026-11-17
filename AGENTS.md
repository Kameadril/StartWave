# StartWave repository rules

These rules apply to this repository and all descendants.

## Workspace routing

This repository is the canonical StartWave Site and Atlas repository. A current local checkout may be at `/Users/kameadrilicloud.com/Desktop/Project/StartWave`, but repository identity must be verified from Git metadata and remotes, not from an absolute path; correctly identified clones and worktrees are supported.

- Factory belongs to the separate StartWave-Factory repository; a current local checkout may be at `/Users/kameadrilicloud.com/Desktop/Project/StartWave-Factory`.
- Giraffe AI, `/chat`, and Supabase lookup belong to the separate StartWave-AI-Private repository; a current local checkout may be at `/Users/kameadrilicloud.com/Desktop/Project/StartWave-AI-Private`.
- These rules govern only this Site and Atlas repository and its descendants; they do not govern either neighboring repository.
- The old non-canonical copy may be at `/Users/kameadrilicloud.com/Library/Mobile Documents/com~apple~CloudDocs/Project`. Do not use a checkout identified as that copy as the working source. Do not accept or reject a checkout merely by its path; verify its Git identity because clones, worktrees, and path aliases may be valid.

At the start of work, verify `pwd`, `git rev-parse --show-toplevel`, and repository identity; the Git root must be the intended checkout of this repository. Do not scan sibling repositories without the owner's explicit consent. If a task concerns another StartWave component, stop and route it to that component's repository, where that repository's own instructions apply. Preserve existing uncommitted changes. Do not move files between repositories or run `git reset`, `git clean`, `git checkout`, `git commit`, `git push`, or deploy unless explicitly authorized by the owner. Do not write to LIVE Supabase or access Cloudflare unless explicitly required and authorized by the owner.

- Treat `assets/data/bdo-*.json` as curated Atlas data. Validate it, but never alter it unless the user explicitly requests a data change.
- Keep local automation deterministic and offline. Do not add network calls, telemetry, external APIs, or package dependencies.
- Never read or write outside the resolved repository root.
- Do not execute arbitrary commands from configuration or Atlas data.
- Do not auto-fix, delete, commit, or push without explicit owner authorization. Report findings and let the owner decide.
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
