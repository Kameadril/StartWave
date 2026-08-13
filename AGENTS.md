# StartWave repository rules

These rules apply to this repository and all descendants.

- Treat `assets/data/bdo-*.json` as curated Atlas data. Validate it, but never alter it unless the user explicitly requests a data change.
- Keep local automation deterministic and offline. Do not add network calls, telemetry, external APIs, or package dependencies.
- Never read or write outside the resolved repository root.
- Do not execute arbitrary commands from configuration or Atlas data.
- Do not auto-fix, delete, commit, or push. Report findings and let a human decide.
- Store generated Atlas Worker reports only under `.startwave-agent/logs/`; reports must not contain secrets or full source-file contents.
- Classify validator findings as `ERROR`, `WARNING`, or `INFO`. Validation errors must produce a non-zero exit code.

