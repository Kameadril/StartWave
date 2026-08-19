# StartWave Build Manifest Specification

- Status: Draft specification
- Related decisions: ADR-001, ADR-002
- Scope: Future deterministic build layer

## 1. Purpose

The build manifest is the single source of publication rules for StartWave. It defines an explicit relationship:

```text
source path -> public target
```

The repository layout is not a deployment layout. A source file is private by default and becomes publishable only through an approved manifest entry. The future builder must consume this specification without modifying source files.

## 2. Source Mappings

Public targets use URL-root notation. Build output paths are the same values beneath `dist/` without the leading slash.

### Core

| Source | Public target | Module |
|---|---|---|
| `apps/web/index.html` | `/index.html` | `core` |
| `apps/web/profile.html` | `/profile.html` | `core` |
| `apps/web/entertainment.html` | `/entertainment.html` | `core` |

Additional Core files require individual reviewed entries. Files such as historical or backup pages are not published implicitly.

### Games

| Source | Public target | Module |
|---|---|---|
| `GAMES/site/games.html` | `/games.html` | `games` |

### BDO

| Source | Public target | Module |
|---|---|---|
| `GAMES/bdo/site/bdo.html` | `/bdo.html` | `bdo` |
| `GAMES/bdo/site/pages/*` | `/pages/*` | `bdo` |

### BDO assets

| Source | Public target | Module |
|---|---|---|
| `GAMES/bdo/site/assets/*` | `/assets/*` | `bdo` |

### Atlas public data

| Source | Public target | Module |
|---|---|---|
| `GAMES/bdo/atlas/data/*` | `/assets/data/*` | `bdo-atlas` |

### AI

| Source | Public target | Module |
|---|---|---|
| `ai/site/*` | `/ai/*` | `ai` |

### Services

| Source | Public target | Module |
|---|---|---|
| `services/site/*` | `/services/*` | `services` |

An asterisk in this specification means a constrained, recursive mapping owned by one module. Before copying, the builder must enumerate every matched file, apply deny rules, and record each concrete source and target in the generated manifest. It must never copy an entire repository container without inspection.

Shared root assets and any compatibility entry points require their own explicit mappings before the build layer is implemented. Their absence from this specification does not authorize implicit copying.

## 3. Forbidden Publication Paths

The following paths and categories must never appear in a public artifact:

```text
tools/
validation/
agents/
docs/
logs/
private/
.env
secrets/
keys/
```

The restriction applies at repository root and at equivalent nested module paths. It also covers environment variants, private-key formats, tokens, local reports, and files reached through symlinks or path traversal. A deny rule overrides every allow rule.

## 4. Collision Rules

The build must stop with a non-zero exit code when:

- two source files resolve to the same public target;
- a source file has no known mapping;
- a mapping attempts to publish a forbidden path;
- a mapping escapes its declared source root or `dist/` target root;
- a target would overwrite an existing generated file unexpectedly;
- case-only target differences would collide on a supported filesystem.

No entry may win by ordering. Every collision requires an explicit human decision and manifest change.

## 5. Manifest Integrity

Each concrete generated manifest entry must contain:

| Field | Meaning |
|---|---|
| `source` | Repository-relative canonical source path |
| `target` | Artifact-relative public path |
| `module` | Owning StartWave module |
| `public` | Explicit public/private decision; only `true` is copyable |
| `shaPolicy` | Required hashing and source/output equality policy |

Published files use SHA-256. The builder records both the expected source hash and resulting artifact hash and requires equality for copy-only mappings. The manifest must use normalized forward-slash paths and stable entry ordering.

Generated metadata may include a deterministic build timestamp derived from `SOURCE_DATE_EPOCH` or the source commit time. Wall-clock timestamps must not make otherwise identical builds differ.

## 6. Atlas Rules

Canonical Atlas data lives at:

```text
GAMES/bdo/atlas/data/
```

Its public copy is written to:

```text
dist/assets/data/
```

Atlas tools live at:

```text
GAMES/bdo/tools/
```

Tools, validators, operational documentation, reports, and temporary files are never published. Atlas JSON must parse and pass dedicated validation before copying. Copying must preserve file bytes and SHA-256 values; the build must not normalize or auto-fix Atlas data.

New Atlas file families, including future NodeProduction data, require an explicit reviewed mapping before publication.

## 7. Future Modules

The following templates describe future ownership, not automatic publication permission:

| Module type | Source template | Publication requirement |
|---|---|---|
| Game | `GAMES/{game}/site/` | Explicit per-game mapping |
| AI | `ai/site/` | Public UI files only |
| Services | `services/site/` | Explicit service UI mapping |
| Sport | To be decided | Separate architecture decision and manifest entries |

Internal game data, AI agents and knowledge, service backends, and future Sport operational data remain private unless a later reviewed decision defines a safe public subset.

## 8. Verification Pipeline

The future build pipeline runs in this order:

1. **Validate source.** Confirm repository-relative paths, required inputs, schemas, and module ownership.
2. **Build temporary artifact.** Copy approved files into a new isolated temporary directory, never directly into the deployed output.
3. **Check manifest.** Enumerate outputs, reject unknown files and collisions, and verify complete manifest coverage.
4. **Check SHA.** Calculate SHA-256 and enforce the declared source/output policy.
5. **Check private paths.** Apply deny rules and scan for protected files, secrets, local paths, tools, reports, and internal documentation.
6. **Publish artifact.** Promote the verified temporary artifact as `dist/`; hosting may publish only that artifact.

Any failed stage stops the pipeline. Deployment, redirects, and Cloudflare configuration remain outside this specification until the local deterministic build has been implemented and verified separately.
