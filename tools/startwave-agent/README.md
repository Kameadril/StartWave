# StartWave Agent Service v1

Local dispatcher for StartWave tasks, Ollama, and the read-only Atlas Worker. It uses Node.js built-ins only.

## MCP server for local chat UIs

Start the loopback-only Streamable HTTP MCP adapter:

```sh
node tools/startwave-agent/mcp-server.mjs
```

Connect the chat UI to `http://127.0.0.1:43118/mcp`. It exposes the same bounded StartWave tools: read/list, approval-only write/delete proposals, and two allowlisted checks. It does not expose arbitrary shell or network access. Proposed changes remain unapplied until approved through the Local Agent with `/approve APPROVAL_ID`.

## Local chat bridge (macOS / Windows / Linux)

Ollama's built-in desktop chat does not currently expose custom tools or MCP servers. The local bridge therefore provides a separate browser window while continuing to use the configured local Ollama model:

```sh
node tools/startwave-agent/chat-bridge.mjs
```

Open `http://127.0.0.1:43117` and try:

```text
Прочитай README.md и верни первый Markdown-заголовок точно как в файле.
```

Deterministic slash commands bypass the model and return the local tool result directly. For example, `/heading README.md` returns the first Markdown heading exactly as stored in the file. Natural-language requests continue through the normal Ollama tool-call loop.

The same bridge exposes an OpenAI-compatible local provider at `http://127.0.0.1:43117/v1` with model id `startwave-agent`. Chat UIs can use this provider when a small Ollama model is unreliable at native MCP function calling; the bridge keeps its deterministic fallback and approval boundary while still using the configured localhost Ollama model.

The bridge listens only on loopback. It can read/list only within the resolved repository root and rejects escaping symlinks. Writes and single-file deletions are saved as proposals under `.startwave-agent/approvals/` and are not applied until the user sends `/approve APPROVAL_ID` as a separate chat message. The only executable commands are Node syntax checking for one in-project JS file and the existing StartWave Agent test. Git operations, package installation, arbitrary shell commands, and network tools are not exposed. The bridge itself calls only the configured localhost Ollama endpoint.

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
