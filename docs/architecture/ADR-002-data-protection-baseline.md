# ADR-002: Data Protection Baseline

- Status: Accepted
- Date: 2026-08-19
- Scope: Build inputs, public artifacts, Atlas, and future AI modules

## Context

StartWave combines public site files with curated data, validation tools, project documentation, and future private AI components. Once a build layer exists, publication must be explicit and must fail safely rather than copying the repository wholesale.

## Decision

### Source protection model

The only public output is:

```text
dist/
```

Development sources include:

```text
apps/
GAMES/
ai/
services/
shared/
infra/
tools/
docs/
scripts/
```

Source directories are never deployed directly. A file becomes public only through an approved build mapping.

### Protected paths

The following categories must never be copied into the deployment artifact:

```text
tools/
validation/
agents/
docs/
scripts/
logs/
private/
.env
secrets/
tokens/
keys/
```

Equivalent nested paths, credential files, private keys, local databases, reports, and absolute workstation paths are also prohibited.

## Atlas Protection

The canonical Atlas source is:

```text
GAMES/bdo/atlas/data/
```

It contains Items, Resources, Nodes, Regions, Recipes, Workers, and future NodeProduction data. Publication uses an explicit copy boundary:

```text
GAMES/bdo/atlas/data/
        |
        v
dist/assets/data/
```

Rules:

- Atlas source is the canonical curated store; `dist/` contains only a generated public copy.
- Source and generated copies must have matching SHA-256 values.
- Atlas validation tools, internal documentation, and private reports are never published.
- Validation runs before copying and errors stop the build.
- The builder must not modify, normalize, or auto-fix Atlas JSON.
- New entity families, including NodeProduction, require an explicit schema and mapping decision before publication.

## AI Protection

The future public AI interface belongs under:

```text
ai/site/
```

Future internal layers such as these are protected:

```text
ai/agents/
ai/knowledge/
ai/backend/
```

Prompts, system instructions, private knowledge, credentials, model configuration, endpoints, routing rules, and backend implementation must not enter the public artifact. Public AI assets require explicit per-file mappings like every other module.

## Future Build Security Requirements

### Allowlist

Only reviewed source paths may be mapped. Each entry identifies one source, one public target, and its owning module.

### Denylist

The builder must reject paths or names associated with:

```text
.env
secrets
tokens
keys
private
logs
tools
validation
```

The denylist is a second safety layer and cannot make an unlisted file publishable.

### Collision protection

The build fails when:

- multiple sources claim the same public target;
- an output would be overwritten unexpectedly;
- a source is outside the repository or approved roots;
- an unknown file appears in a mapped directory;
- generated output differs from its recorded manifest.

### Manifest

Each successful build generates `build-manifest.json` containing:

- source path;
- public path;
- SHA-256 of the published file;
- build timestamp.

To preserve reproducibility, the timestamp must come from deterministic build metadata such as `SOURCE_DATE_EPOCH` or the source commit time, not the current wall clock. The manifest itself is part of artifact verification.

## Future Infrastructure Model

Local and CI builds must use the same offline, dependency-controlled workflow. Hosting receives a verified artifact and has no permission to infer mappings from the repository tree. Publication guard checks both outgoing source changes and the generated artifact inventory.

Build reports and temporary files stay outside `dist/`. Generated reports may contain paths and hashes but must not embed secrets or full private source contents.

## Module Isolation

Every public mapping records module ownership. A module may consume explicitly shared public assets but may not publish another module's tools, documentation, private data, or reports. Protected subdirectories remain denied even when a parent module has public files.

## Verification

The future security gate must verify:

- allowlist and denylist enforcement;
- absence of secrets, private keys, tokens, local paths, tools, docs, and reports;
- target uniqueness and complete manifest coverage;
- Atlas parsing, validation, counts, and SHA-256 preservation;
- required public files and link resolution;
- reproducible output from the same source revision;
- publication of `dist/` only.

Any validation error produces a non-zero exit code and prevents deployment.

## Commit Rules

- Protection policy changes use a dedicated reviewed commit.
- Allowlist expansion must name the smallest necessary paths; broad wildcards are prohibited.
- Data changes are committed separately from build, policy, and deployment changes.
- Atlas, AI internals, and protected paths require explicit owner review.
- Hooks and guards must not be bypassed.
- Commit does not imply authorization to push or deploy.

## Consequences

Public deployment becomes intentionally narrower than the repository. New modules require explicit publication decisions, but accidental exposure and silent target replacement are blocked. Atlas remains canonical and verifiable, while future AI internals remain isolated from the public interface.
