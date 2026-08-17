# StartWave public publication policy

`Kameadril/StartWave` is a public product repository. Only explicitly approved public paths may be committed or pushed.

The publication guard combines an allowlist with a denylist and scans both staged content and outgoing commits. It blocks Factory/Agent internals, private profile material, credentials, local databases, generated internal reports, machine-specific paths, and unknown directories.

The guard never deletes files, resets changes, rewrites history, or force-pushes. A blocked operation prints the file and reason so the owner can classify it deliberately.

Factory infrastructure belongs in the private `Kameadril/StartWave-Factory`. Portable personal Codex material belongs in the private `Kameadril/CodexProfileSync`. Credentials and machine state remain local only.

Install the hooks in a checkout with:

```bash
./scripts/install-publication-guard.sh
```

or on Windows PowerShell:

```powershell
.\scripts\install-publication-guard.ps1
```
