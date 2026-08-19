# ADR-001: Source Containers and Deterministic Deployment Artifact

- Status: Accepted
- Date: 2026-08-19
- Scope: StartWave public web platform

## Context

StartWave began as a flat static site where source paths, browser paths, and deployment paths were the same. As the project expands into the core website, games, BDO Atlas, AI, and services, that layout makes ownership unclear and risks publishing internal tools or data by accident.

The source has therefore been grouped into development containers. This physical organization is not a public URL design and must not be exposed directly by hosting.

## Decision

### Source layout

The following directories are the internal development structure:

```text
apps/
GAMES/
ai/
services/
shared/
infra/
```

Source containers optimize maintenance, ownership, and future module growth. They do not define public URLs.

### Public URL contract

User-facing addresses are an independent compatibility contract. Existing routes remain stable unless a separate reviewed decision replaces them:

```text
/
/games.html
/bdo.html
/pages/bdo-*.html
/ai.html
/services.html
```

### Deployment artifact

The source repository is not a hosting root. A generated artifact is the only publishable website:

```text
Source containers
        |
        v
Deterministic build layer
        |
        v
dist/
        |
        v
Cloudflare / hosting
```

The future build layer will map approved source files to explicit public targets while preserving the public URL contract.

## Build Principles

1. **Deterministic build.** Identical source and build configuration must produce identical file contents and paths.
2. **Explicit mapping.** Every published file requires a reviewed `source -> public target` rule. Uncontrolled wildcard copying is prohibited.
3. **Public artifact isolation.** Hosting receives only `dist/`; source containers are never published directly.
4. **Fail closed.** Unknown inputs, target collisions, missing required entries, and protected paths stop the build.
5. **No source mutation.** Building must not rewrite source HTML, CSS, JavaScript, JSON, or Atlas data.

## Future Infrastructure Model

The build definition belongs in repository-controlled infrastructure, separate from product source. It should contain an explicit mapping manifest, deterministic offline build logic, and validation commands. Cloudflare or another host should run the same verified build and publish only its output directory.

Infrastructure configuration must not silently define additional content mappings. A deployment change follows the same review process as build logic and is introduced only after local artifact verification passes.

## Module Isolation

- `apps/web/` owns the core public experience.
- `GAMES/site/` owns the games entry point.
- `GAMES/bdo/site/` owns BDO browser runtime files.
- `GAMES/bdo/atlas/` owns canonical Atlas data and internal Atlas documentation.
- `GAMES/bdo/tools/` owns Atlas validation and maintenance tooling.
- `ai/`, `services/`, and `shared/` may evolve independently but publish only through explicit mappings.
- `GAMES/Mir_Kameadril/` is outside the StartWave public artifact.

Modules may share public assets through approved build mappings; they must not copy internal tools or depend on another module's private files.

## Verification

Before any artifact is eligible for deployment, verification must confirm:

- every mapped source exists and every output has one owner;
- required legacy public routes are present;
- local `href`, `src`, CSS `url()`, and browser data requests resolve inside the artifact;
- Atlas JSON parses and passes its dedicated validators;
- protected paths, credentials, absolute local paths, and private reports are absent;
- artifact hashes and the build manifest match generated files;
- repeated builds from the same revision produce the same result.

## Commit Rules

- Architecture documentation, build implementation, runtime path changes, and deployment configuration use separate commits.
- A build commit must not include unrelated HTML, CSS, JavaScript, JSON, or Atlas changes.
- Runtime repair must be reviewed independently from container moves.
- Publication guard and verification checks must pass without bypass flags.
- Push and deployment require explicit owner authorization after local verification.

## Consequences

The repository may temporarily contain source files that cannot run correctly from their source locations. Runtime compatibility is restored by the future build mapping, not by treating source containers as public directories. This adds a controlled build step but provides stable URLs, module isolation, reproducible artifacts, and a smaller publication surface.
