---
layout: project
lesson_id: "P003"
chapter: 1
chapter_title: "Foundations of AI Engineering"
project_type: "Chapter Project"
title: "Multi-model AI assistant with structured output"
description: "Estimated time: 4–6 hours · Portfolio grade"
prev: "0047-open-models-ollama-huggingface.html"
prev_title: "Open models — running LLMs without an API key"
next: "0008-llm-system-types.html"
next_title: "LLM system types — pipelines, agents, RAG"
prereqs:
  - "All of Chapter 1 complete: Lessons 1–7, 47 and Projects P001–P002"
  - "Both an OpenAI API key and an Anthropic API key in your `.env`"
  - "Packages installed: `uv add openai anthropic pydantic python-dotenv pypdf` (PyPDF2 is deprecated — use `pypdf`)"
---

## Overview

This is the portfolio project for Chapter 1. It demonstrates everything a hiring manager expects an AI engineer to know before their first interview: calling multiple LLM providers, managing conversation state, extracting structured data, handling errors and cost, and shipping a usable CLI tool.

You are building a polished command-line AI assistant that supports both OpenAI and Anthropic, has persistent memory, a document analysis mode, and a cost dashboard. When you finish, this is something you can show in an interview or point to in your portfolio.

{% include prereqs.html %}

## What you are building

A single CLI application (`ai.py`) with four modes:

### 1. Interactive chat

```bash
uv run ai.py chat --provider openai
uv run ai.py chat --provider anthropic
uv run ai.py chat --provider anthropic --model claude-haiku-4-5-20251001
```

Persistent conversation with history saved per session name. Dark terminal output — model replies in a different colour from the user prompt.

### 2. Document analysis

```bash
uv run ai.py analyse report.pdf --provider openai
uv run ai.py analyse contract.txt --provider anthropic --detail detailed
```

Structured summary extraction using the provider specified. Output includes all `DocumentSummary` fields plus cost.

### 3. Provider comparison

```bash
uv run ai.py compare "Explain async Python in one paragraph"
```

Sends the same prompt to both OpenAI and Anthropic simultaneously (using `asyncio`), prints both responses side-by-side with their costs, and shows which was faster.

### 4. Cost dashboard

```bash
uv run ai.py costs
```

Reads a local log file and prints: total spend today, total spend this week, cost breakdown by provider and mode, most expensive single call.

## Requirements

### Architecture

- Uses the `LLMClient` abstraction from Lesson 7 — all provider-specific code is isolated in `OpenAIClient` and `AnthropicClient`
- A `CostLogger` class writes one JSON line per API call to `cost_log.jsonl` (JSONL: one JSON object per line)
- Conversation history stored as `sessions/<name>.json`, one file per named session

### Chat mode

- `--session <name>` flag (default: `default`) — loads and saves to `sessions/<name>.json`
- `--system <text>` flag overrides the default system prompt
- `--stream` flag enables streaming output
- History trimmed to last 20 turns before each call
- Cost and token count printed after each response
- Retry on `RateLimitError` with exponential backoff

### Analyse mode

- Supports `.txt` and `.pdf` files
- `--detail brief | standard | detailed`
- `--json` outputs raw JSON
- Selects model automatically: long documents (>10,000 words) use the provider's most capable model

### Compare mode

- Both provider calls run concurrently with `asyncio.gather()`
- Output shows response from each provider, side by side if terminal is wide enough, stacked if narrow
- Shows: response text, latency in seconds, token count, cost

### Cost dashboard

- Reads `cost_log.jsonl`
- Each log entry must include: timestamp, provider, model, mode, prompt_tokens, completion_tokens, cost_usd, latency_s
- Dashboard shows today vs this week vs all-time, and per-provider breakdown

### Error handling

- Missing API key: print which key is missing and how to add it to `.env`
- File not found: print the path that was looked for
- Unsupported file type: list what is supported
- No call ever crashes with an unhandled exception — all errors surface as clean messages

### Project layout

```text
ai-foundations/
├── ai.py              ← CLI entry point (argparse subcommands)
├── llm/
│   ├── __init__.py
│   ├── base.py        ← LLMClient ABC
│   ├── openai_client.py
│   └── anthropic_client.py
├── tools/
│   ├── __init__.py
│   ├── document.py    ← file reading, DocumentSummary model
│   └── costs.py       ← CostLogger, dashboard renderer
├── sessions/          ← created at runtime
├── cost_log.jsonl     ← created at runtime
├── .env
├── .env.example
├── .gitignore
└── pyproject.toml
```

## Suggested build order

1. Create the folder structure and empty module files.
2. Implement `llm/base.py`, `openai_client.py`, `anthropic_client.py`. Test both clients with a simple call before touching the CLI.
3. Implement `tools/costs.py` — `CostLogger.log()` writes a line; `CostLogger.dashboard()` reads and aggregates.
4. Implement `tools/document.py` — file reader and `DocumentSummary` model.
5. Build `ai.py` subcommand by subcommand: `chat` first, then `analyse`, then `compare`, then `costs`.
6. Add session persistence.
7. Add the compare mode's `asyncio` concurrency.
8. Polish error handling and help text.

<div class="callout info">
<strong>asyncio for compare mode:</strong> Use <code>asyncio.run()</code> as the entry point and <code>asyncio.gather()</code> to run both provider calls in parallel. Each LLM client will need an async version of <code>complete()</code> — or you can run the synchronous clients in a <code>ThreadPoolExecutor</code> via <code>loop.run_in_executor()</code>. Either approach is acceptable.
</div>

## Completion checklist

- [ ] `uv run ai.py chat --provider openai` starts a session that persists across restarts
- [ ] `uv run ai.py chat --provider anthropic` works with the same interface
- [ ] `uv run ai.py analyse file.txt` prints a structured summary
- [ ] `uv run ai.py analyse file.pdf --json` prints valid JSON
- [ ] `uv run ai.py compare "..."` shows responses from both providers
- [ ] `uv run ai.py costs` shows a real cost breakdown from logged calls
- [ ] A wrong API key shows which key is missing, not a stack trace
- [ ] All provider-specific code is inside `llm/` — `ai.py` imports only `LLMClient`
- [ ] `cost_log.jsonl` and `sessions/` are in `.gitignore`

## How to present this in an interview

When a hiring manager asks about your portfolio, lead with the architecture: "I built an LLM-provider abstraction layer so the calling code is completely provider-agnostic. Swapping between OpenAI and Anthropic is a single flag."

Then walk them through the cost dashboard: every call is logged with latency, tokens, and cost, and the dashboard aggregates by provider and mode. This shows you think in terms of production economics, not just demos.

The compare mode is the conversation-starter: "I wanted to A/B test the same prompt across providers, so I built a concurrent comparison mode with asyncio." This demonstrates async Python, which is a core skill for Chapter 3.

## Extension challenges

- **Web UI:** Add a minimal FastAPI endpoint at `/chat` that accepts a message and returns a streamed response — a preview of Chapter 3
- **Vision:** Add an `ai.py describe <image.png>` mode that calls GPT-4o or Claude's vision API with an image file
- **Cost alerts:** Print a warning when daily spend exceeds a configurable threshold (e.g. `DAILY_BUDGET_USD=1.00` in `.env`)
