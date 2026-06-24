---
layout: project
lesson_id: "P001"
chapter: 1
chapter_title: "Foundations of AI Engineering"
project_type: "Project"
title: "Build a CLI AI assistant"
description: "Estimated time: 2–3 hours"
prev: "0004-structured-outputs.html"
prev_title: "Structured outputs and function calling"
next: "0005-prompt-engineering.html"
next_title: "Prompt engineering fundamentals"
prereqs:
  - "[Lesson 1](0001-ai-dev-environment.html): uv project, `.env` file"
  - "[Lesson 2](0002-openai-api-basics.html): OpenAI client, `.create()`, error handling"
  - "[Lesson 3](0003-chat-and-history.html): messages list, REPL loop, JSON persistence"
  - "[Lesson 4](0004-structured-outputs.html): Pydantic models, `.parse()`"
---

## Overview

You have called the OpenAI API, managed conversation history, and extracted structured data. Now you will wire all three together into a real, usable tool.

You are building a command-line AI assistant that supports persistent conversations, a configurable system prompt, API error handling, and a `--structured` mode that extracts a JSON summary from any text. When you finish, you will have a tool you can actually use day-to-day.

{% include prereqs.html %}

## Specification

Your CLI tool (`assistant.py`) must support the following usage:

### Interactive chat mode (default)

```bash
uv run assistant.py
```

Starts a REPL loop. Conversation history is saved to `history.json` and reloaded on the next run. The user types messages; the assistant replies. Typing `quit` or `exit` ends the session.

### One-shot question mode

```bash
uv run assistant.py "What is the speed of light?"
```

Sends the question, prints the answer, exits. Does not save to history.

### Custom system prompt

```bash
uv run assistant.py --system "You are a Python code reviewer. Be terse."
```

Overrides the default system prompt for the session. Works in both modes.

### Structured extraction mode

```bash
uv run assistant.py --structured "Invoice INV-001, total $500 USD, due 2025-03-01"
```

Extracts a `TextSummary` object from the input and prints each field. Does not use conversation history.

### Clear history

```bash
uv run assistant.py --clear
```

Deletes `history.json` and exits with a confirmation message.

## Requirements

- Uses `argparse` for all CLI flags (`--system`, `--structured`, `--clear`)
- Default model: `gpt-4o-mini`
- History saved as JSON, reloaded on startup in interactive mode
- History trimmed to the last 20 turns (40 messages) before each API call
- Catches `AuthenticationError`, `RateLimitError`, and `OpenAIError` with clear messages
- API key loaded from `.env` via `python-dotenv` — never hardcoded
- `--structured` mode uses a Pydantic model with at least: `main_topic` (str), `key_entities` (list[str]), `sentiment` (str: "positive", "neutral", "negative"), `one_line_summary` (str)
- Empty input is ignored (does not send an API call)
- `.env` and `history.json` in `.gitignore`

## Suggested approach

Build in this order — each step is runnable before the next:

1. Set up `argparse` and print which mode was selected. Verify flags work.
2. Implement one-shot mode first (no history, single call).
3. Add interactive REPL mode with in-memory history.
4. Add JSON persistence (save/load `history.json`).
5. Add history trimming.
6. Add the `--structured` mode with the Pydantic model.
7. Add `--clear`.
8. Add error handling throughout.

<div class="callout info">
<strong>Test each step before moving to the next.</strong> It is much easier to find a bug in 20 lines than in 150.
</div>

## Completion checklist

- [ ] `uv run assistant.py` starts an interactive session
- [ ] Conversation history survives a restart
- [ ] `uv run assistant.py "question"` answers and exits
- [ ] `--system "..."` changes the assistant's persona visibly
- [ ] `--structured "some text"` prints four structured fields
- [ ] `--clear` deletes history and confirms
- [ ] A wrong API key prints a helpful message, does not crash
- [ ] `.env` and `history.json` are in `.gitignore`

## Extension challenges

Finished early? These are not required, but push the project closer to production quality:

- **Token tracking:** After each response, print the tokens used and running cost estimate (gpt-4o-mini: $0.15/M input, $0.60/M output)
- **Model flag:** Add `--model` to switch between `gpt-4o-mini` and `gpt-4o`
- **Streaming:** Stream the response token-by-token so the user sees output as it generates rather than waiting. Use `stream=True` in the API call.
- **Multiple histories:** Add `--session <name>` to save separate conversation histories (e.g. `history-work.json`, `history-personal.json`)
