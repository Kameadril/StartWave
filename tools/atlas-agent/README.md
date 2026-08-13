# StartWave BDO Atlas Worker

A deterministic, offline validator for `assets/data/bdo-*.json`. It uses only Node.js built-ins and never changes Atlas data.

## Run

From the repository root:

```powershell
.\scripts\atlas-agent.ps1 validate
.\scripts\atlas-agent.ps1 report
```

- `validate` prints `ERROR`, `WARNING`, and `INFO` findings.
- `report` performs the same validation and writes a timestamped JSON report to `.startwave-agent/logs/`.
- Exit code `0` means no errors; `1` means validation errors; `2` means invocation or configuration failure. Warnings do not fail validation.

The worker checks JSON/top-level structure, required fields, IDs and uniqueness, references, recipe/production/item consistency, applicable symmetric relations, dates/statuses, non-canonical legacy references, and intentionally empty layers. It has no auto-fix mode, network access, package dependencies, or command-execution feature.

