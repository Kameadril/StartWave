# StartWave Agent Service v1

Local dispatcher for StartWave tasks, Ollama, and the read-only Atlas Worker. It uses Node.js built-ins only.

```powershell
.\scripts\startwave-agent.ps1 start
.\scripts\startwave-agent.ps1 once
.\scripts\startwave-agent.ps1 submit 'Explain this briefly' -Type llm-only
.\scripts\startwave-agent.ps1 submit 'найди актуальные купоны Black Desert PC' -Type bdo-web-search
.\scripts\startwave-agent.ps1 submit 'Analyze Atlas' -Type atlas-analysis -Files assets/data/bdo-items.json
.\scripts\startwave-agent.ps1 status -Id job-...
```

`start` polls continuously; `once` claims at most one queued job. Jobs contain `id`, ISO `createdAt`, `type`, `prompt`, optional `files`, and `validation`. Paths must be relative, remain inside the repository, identify regular files, and fit configured limits. `llm-only` cannot read files.

Queue, atomic claims, results, failed inputs, and Atlas reports live below `.startwave-agent/`, excluded from Git. The service calls only localhost Ollama, never edits Atlas data, and never executes commands supplied by a job. Atlas validation errors make a job `FAILED`.

`bdo-web-search` is an explicit opt-in path. It fetches only HTTPS pages whose hosts are listed in `config.json`, adds the retrieved text as untrusted context, and records source URLs in the result. The normal `llm-only` path is unchanged. Model files remain managed by Ollama outside this repository; no keys or secrets are stored here.
