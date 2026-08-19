# ADR-003: AI-Ready Platform Architecture

- Status: Accepted
- Date: 2026-08-19
- Scope: Future StartWave AI, knowledge, and module boundaries
- Depends on: ADR-001, ADR-002, BUILD-MANIFEST-SPEC

## Context

StartWave is evolving from a static website into a modular platform. Its architecture must support future integration of local AI, cloud AI, agents, retrieval-augmented generation (RAG), and a Knowledge Graph without giving AI unrestricted access to source code, private tooling, credentials, or the filesystem.

This decision establishes boundaries and access principles only. It does not select models, services, storage engines, APIs, or implementation technologies.

## Decision

StartWave is divided into independent domains:

```text
Core Web
Games
AI
Services
Sport
Shared Infrastructure
```

Each domain has its own responsibility, data, access rules, and development lifecycle. A domain may expose controlled public or knowledge interfaces, but its internal files are not automatically available to other domains or AI systems.

## Module Boundaries

### Core Web

Core Web is responsible for:

- the primary user interface;
- the homepage;
- shared navigation;
- foundational user-facing functions.

It must not contain game data, AI models, or service business logic.

### Games

Games is responsible for:

- game-specific directions;
- game knowledge bases;
- game-specific tools.

Current example:

```text
GAMES/
├── site/
└── bdo/
    ├── site/
    ├── atlas/
    └── tools/
```

Public game interfaces, canonical knowledge data, and internal maintenance tools remain separate even when they belong to the same game.

### AI

AI is responsible for:

- public AI interfaces;
- future agents;
- controlled knowledge integration;
- model routing.

Future structure:

```text
ai/
├── site/
├── agents/
├── knowledge/
└── backend/
```

Only explicitly approved files from `ai/site/` may become public. Agents, knowledge internals, routing configuration, and backend code remain protected.

### Services

Services is responsible for:

- user tools;
- calculators;
- information services;
- future assistants.

Future structure:

```text
services/
├── site/
├── calculators/
├── news/
└── help/
```

Public interfaces and internal service logic require separate access and publication decisions.

### Sport

Sport is a reserved future domain. No implementation is created by this decision.

Potential responsibilities include:

- sports statistics;
- training information;
- analytics;
- AI-assisted features.

Its data ownership, privacy model, and public mappings require a later architecture decision.

### Shared Infrastructure

Shared Infrastructure contains only genuinely common elements:

```text
shared/
├── css/
├── js/
├── components/
├── images/
└── utils/
```

A file belongs in `shared/` only when multiple domains intentionally depend on it and a clear owner is recorded. Shared placement does not make a file public or AI-indexable automatically.

## AI Data Access Model

AI must not work directly across the repository. Knowledge reaches an assistant through a controlled boundary:

```text
Source modules
      |
      v
Controlled knowledge layer
      |
      v
RAG / Knowledge Graph
      |
      v
AI Assistant
```

The controlled knowledge layer selects, validates, normalizes, and labels permitted information. Retrieval systems operate on approved derived knowledge, not arbitrary repository traversal.

## Knowledge Permissions

Every knowledge source must declare:

- an owner;
- its purpose;
- an access level;
- whether indexing is permitted.

Example for BDO Atlas:

```yaml
source: GAMES/bdo/atlas/data/
index: yes
publish: controlled
modify: restricted
```

Example for private tools:

```yaml
index: no
publish: no
```

Permission to index does not grant permission to publish or modify. Modification always requires a separate, explicit capability and validation workflow.

## AI Router Architecture

The future routing model is:

```text
User
  |
  v
StartWave AI Interface
  |
  v
AI Router
  |
  +-- Local AI
  |
  +-- Cloud AI
```

The AI Router is responsible for:

- selecting an appropriate model;
- controlling cost;
- enforcing security policy;
- selecting permitted knowledge sources.

Routing decisions must not weaken source permissions. Local and cloud providers receive only the minimum approved context required for a request.

## Security Boundary

AI systems do not receive:

- unrestricted filesystem access;
- secrets;
- private keys;
- deployment credentials;
- private tools.

Every access passes through approved sources, controlled interfaces, and explicit access rules. Actions that can modify data, source, Git state, deployment, or external systems require separate authorization, validation, and auditability.

Default access is read-only and fail-closed. Unknown sources and unknown capabilities are denied.

## Future Evolution Path

### Phase 1: Documented knowledge sources

Record ownership, purpose, access level, indexing permission, and canonical location.

### Phase 2: Parsing and normalization

Create deterministic, source-specific parsers without changing canonical source data.

### Phase 3: Knowledge layer

Produce validated knowledge records with provenance and access metadata.

### Phase 4: RAG

Retrieve only approved knowledge and preserve source attribution and permission boundaries.

### Phase 5: AI agents

Introduce narrowly scoped agents with explicit capabilities and no ambient repository access.

### Phase 6: Controlled autonomous assistants

Allow bounded actions only through reviewed interfaces, owner authorization, validation, logging, and safe rollback strategies.

Each phase requires its own implementation plan and security review. Later phases do not begin merely because earlier documentation exists.

## Relationship with StartWave Architecture

ADR-003 depends on:

- **ADR-001:** source containers, public URL contract, and deterministic deployment artifact;
- **ADR-002:** data protection baseline and publication boundaries;
- **BUILD-MANIFEST-SPEC:** explicit source-to-public mapping rules.

Together they form the foundation:

```text
Architecture
    +
Security
    +
Build system
    +
Knowledge foundation
    =
AI-ready StartWave platform
```

## Consequences

StartWave can evolve toward AI features without treating the repository as a single unprotected knowledge source. The model adds ownership and permission work before indexing or automation, but it prevents accidental publication, uncontrolled context sharing, and agents with excessive authority.

This ADR authorizes no AI runtime, model, agent, vector database, RAG implementation, backend, or external integration.
