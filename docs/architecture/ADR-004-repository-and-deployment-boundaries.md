# ADR-004: Repository and Deployment Boundaries

- Status: Accepted
- Date: 2026-08-19
- Scope: Repository publication policy and deployment artifact policy
- Depends on: ADR-001, ADR-002, BUILD-MANIFEST-SPEC

## Context

The StartWave Git repository and its deployment artifact have different purposes and therefore require different security boundaries.

The Git repository stores:

- source code;
- change history;
- development and validation tools;
- canonical project data;
- architecture documentation.

The deployment artifact contains only public website files and must expose the smallest practical attack surface.

The original publication guard treated repository inclusion and deployment inclusion as the same decision. This creates a conflict for controlled engineering files such as `GAMES/bdo/tools/`: they are legitimate repository source but must never become public website content.

## Decision

StartWave uses two independent security boundaries. Passing the repository boundary does not grant permission to enter the deployment artifact.

### Repository boundary

The repository boundary may allow:

- source code;
- canonical Atlas data;
- controlled tools;
- validation code;
- architecture documentation.

It blocks:

- secrets and private keys;
- credentials and access tokens;
- private materials;
- local reports and state;
- unknown sensitive paths.

Allowed engineering files remain subject to content scanning and explicit path policy. Repository access does not make a file user-facing content.

### Deployment boundary

The deployment boundary permits only a verified `dist/` artifact assembled through the approved build manifest.

It excludes:

- tools;
- validation code;
- agents and AI internals;
- documentation;
- logs and reports;
- private data;
- secrets and credentials.

A file must pass both its repository policy and an explicit source-to-public build mapping before it can be deployed.

## Atlas Tools Policy

```text
GAMES/bdo/tools/

Repository: ALLOWED
Deployment: DENIED
```

Atlas tools are part of the project's engineering infrastructure. They may remain in Git because they are required for development, data validation, migrations, and Atlas maintenance.

They are not part of the public website. Mandatory rules are:

- tools are never copied into `dist/`;
- tools are never published through Cloudflare or another host;
- tools are not classified as user content;
- tools remain subject to secret and credential scanning;
- storing a tool does not authorize its automatic execution.

The same repository/deployment distinction may apply to controlled validation tools belonging to future modules.

## Guard Responsibility

### Repository guard

The repository guard determines what may be stored in Git. It protects against accidental inclusion of secrets, private materials, and sensitive paths.

Its current policy and enforcement files are:

```text
.startwave-public-guard.json
scripts/publication-guard.sh
```

The repository guard evaluates staged and outgoing repository changes. It must not use deployment exclusions to reject legitimate, reviewed source infrastructure.

### Deployment validator

The future deployment validator determines what enters `dist/` and can be published. It verifies the build manifest and the complete public artifact:

```text
Source
  |
  v
Build manifest
  |
  v
Builder
  |
  v
Deployment validator
  |
  v
dist/
```

The deployment validator must fail on unknown files, forbidden paths, target collisions, manifest mismatch, or protected content.

## Build Relationship

```text
Git Repository
        |
        v
Deterministic Builder
        |
        v
Public Artifact (dist)
        |
        v
Deployment Validation
        |
        v
Cloudflare / Hosting
```

Each stage has one responsibility:

- Git preserves approved source and engineering history.
- The builder applies explicit source-to-public mappings.
- The public artifact contains only generated website content.
- Deployment validation enforces artifact policy.
- Hosting receives only a validated artifact.

## Verification Matrix

| Path | Repository | Deployment |
|---|---|---|
| `apps/web/index.html` | PASS | PASS |
| `GAMES/bdo/site/` | PASS | PASS |
| `GAMES/bdo/atlas/data/` | PASS | PASS, public copy only |
| `GAMES/bdo/tools/` | PASS | FAIL |
| `GAMES/bdo/atlas/validation/` | PASS | FAIL |
| `docs/architecture/` | PASS | FAIL |
| `.env` | FAIL | FAIL |
| `secrets/` | FAIL | FAIL |

Deployment PASS means that an explicit build-manifest entry and all artifact checks also pass. The matrix does not authorize uncontrolled directory copying.

## Consequences

Positive consequences include:

- development tools remain part of the reviewed project history;
- deployment keeps a minimal public surface;
- repository and deployment rules have unambiguous meanings;
- new modules can own internal tools without exposing them;
- future AI and build systems can operate against explicit boundaries;
- outgoing Git checks no longer need to model the contents of `dist/`.

The project must maintain two coordinated policies rather than one overloaded guard. Build implementation cannot be considered safe until the deployment validator exists and enforces the manifest independently.

## Migration Compatibility

The current conflict can be corrected without:

- deleting existing files;
- rewriting Git history;
- rebasing published architecture commits;
- force-pushing.

The transition uses new architecture rules, separate commits, and verifiable repository-guard changes. Historical container moves remain intact.

## Safe Transition Plan

1. Create and review ADR-004.
2. Verify the documentation-only change.
3. Update the repository guard in a separate commit so controlled Atlas tools are repository-allowed while secrets and private paths remain blocked.
4. Repeat the full pre-push audit, including outgoing guard validation.
5. Push only after explicit owner authorization and a complete PASS.

Deployment policy remains documented and unchanged until the deterministic builder and deployment validator are implemented in later, separately reviewed work.
