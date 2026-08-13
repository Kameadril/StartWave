# StartWave Agent Service v1

Local dispatcher for StartWave tasks, Ollama, and the read-only Atlas Worker. It uses Node.js built-ins only.

```powershell
.\scripts\startwave-agent.ps1 start
.\scripts\startwave-agent.ps1 once
.\scripts\startwave-agent.ps1 submit 'Explain this briefly' -Type llm-only
.\scripts\startwave-agent.ps1 submit 'Analyze Atlas' -Type atlas-analysis -Files assets/data/bdo-items.json
.\scripts\startwave-agent.ps1 status -Id job-...
```

`start` polls continuously; `once` claims at most one queued job. Jobs contain `id`, ISO `createdAt`, `type`, `prompt`, optional `files`, and `validation`. Paths must be relative, remain inside the repository, identify regular files, and fit configured limits. `llm-only` cannot read files.

Queue, atomic claims, results, failed inputs, and Atlas reports live below `.startwave-agent/`, excluded from Git. The service calls only localhost Ollama, never edits Atlas data, and never executes commands supplied by a job. Atlas validation errors make a job `FAILED`.
