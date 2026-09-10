\# StartWave AI Project Map



\## Purpose



This file helps developers and AI assistants understand the relationship between the public StartWave project and the private AI environment.



\---



\# Main Project



StartWave is the main public project.



Contains:



\- website;

\- pages;

\- assets;

\- services;

\- game databases;

\- documentation.



\---



\# Local AI Environment



The local AI development environment is separated from the main project.



Location:



../StartWave-AI-Private



Purpose:



\- local AI Agent;

\- MCP tools;

\- Ollama integration;

\- internal AI rules;

\- private workflows.



\---



\# AI Private Documentation



The detailed AI environment map is located at:



../StartWave-AI-Private/docs/AI\_PROJECT\_MAP.md



\---



\# Development Rule



Public project files and private AI infrastructure should remain separated.



The AI environment helps analyze and develop StartWave but is not part of the public website.



\---



\# BDO Atlas



Black Desert Online (BDO) is a dedicated knowledge system inside StartWave.



When working with BDO, do not start from apps/web.

Use the BDO structure below.



\---



\## BDO Pages



Location:



pages/



Search pattern:



\- bdo-\*.html



Contains:



\- BDO sections;

\- user-facing pages;

\- archive interfaces.



\---



\## BDO JavaScript



Location:



assets/js/



Search pattern:



\- bdo-\*.js



Contains:



\- page logic;

\- calculators;

\- Atlas interaction;

\- UI behavior.



\---



\## BDO Data



Location:



assets/data/



Search pattern:



\- bdo-\*.json



Contains:



\- Atlas data;

\- items;

\- resources;

\- nodes;

\- regions;

\- recipes;

\- game knowledge.



Rules:



\- Data is curated.

\- Do not modify without explicit user request.

\- Preserve IDs and relationships.



\---



\## BDO Atlas Tools



Location:



tools/atlas-agent/



Contains:



\- validation tools;

\- data processing;

\- Atlas checks.



\---



\## BDO Analysis Workflow



When user asks about BDO:



1\. Read this map first.

2\. Check pages/ for relevant HTML.

3\. Check assets/js/ for connected scripts.

4\. Check assets/data/ for related data.

5\. Check tools/atlas-agent/ if validation is required.

6\. Do not scan the whole repository.

