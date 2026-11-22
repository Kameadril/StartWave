# Owner-approved full snapshot

`STARTWAVE_OWNER_APPROVED_FULL_SNAPSHOT=1` is an exceptional, manual owner authorization. It is never set by the repository, hooks, CI, or workflow files.

## Exact effect

The flag is recognized only by Publication Guard v2 in `--staged` and `--outgoing` modes. In those two modes it bypasses only the repository path allowlist so that an explicitly approved full snapshot may contain otherwise ordinary paths that are not normally publishable.

Repository safety denies are not bypassable. Every path listed by `deniedExact` or matched by `deniedPrefixes`, `deniedSegments`, `deniedBasenames`, `.env.*`, or `deniedExtensions` remains blocked. This includes owner-review/private paths, `AGENTS.md`, environment files, private-key files, logs, and local database files, even when their contents look harmless.

All of these protections remain active:

- every repository safety deny described above;
- text content and credential-pattern scanning, including private keys, GitHub tokens, Supabase secret keys, credential assignments, and absolute local user paths;
- the narrow Supabase publishable-key source exception, which applies only to `GAMES/bdo/site/assets/js/bdo-live-data.js`; artifact validation separately accepts its exact generated counterpart only at `dist-bdo/assets/js/bdo-live-data.js` while validating `dist-bdo`;
- fail-closed content reads;
- complete commit-history inspection for outgoing ranges;
- explicit first-push base, allowed `origin/factory` identity, full-SHA, and ancestry checks.

The flag is rejected in `--range`, `--ci-range`, and `--artifact` modes. It therefore cannot weaken CI verification or deployment-artifact allowlists, symlink rejection, forbidden-file checks, or artifact secret scanning.

## Invocation boundary

Authorization must be supplied explicitly on the individual local command:

```sh
STARTWAVE_OWNER_APPROVED_FULL_SNAPSHOT=1 sh scripts/publication-guard.sh --staged
```

For a first push, the separately required `STARTWAVE_PUBLICATION_BASE_SHA` must still be the exact commit resolved by an allowed `refs/remotes/origin/factory` ref. The bypass does not infer or relax that value.

Any value other than the exact string `1` leaves the bypass disabled. The guard prints a conspicuous banner when the bypass is active. No repository file may export or persist the variable automatically.

This mechanism is not a runtime, deployment, or publication approval. It only changes one local guard decision after the owner has separately authorized that exact snapshot operation.
