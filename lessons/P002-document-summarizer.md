---
layout: project
lesson_id: "P002"
chapter: 1
chapter_title: "Foundations of AI Engineering"
project_type: "Project"
title: "Build a document summarizer"
description: "Estimated time: 2–3 hours"
prev: "0006-advanced-prompting.html"
prev_title: "Advanced prompting — tokens, cost, and reliability"
next: "0007-anthropic-api.html"
next_title: "The Anthropic API — Claude and how it differs"
prereqs:
  - "[Lesson 4](0004-structured-outputs.html): Pydantic models, `.parse()`"
  - "[Lesson 5](0005-prompt-engineering.html): XML tags, system prompts"
  - "[Lesson 6](0006-advanced-prompting.html): temperature, cost tracking, retry logic"
  - "Install: `uv add pypdf2` (for PDF reading)"
---

## Overview

Document summarisation is one of the most common real AI engineering tasks — legal teams summarise contracts, operations teams summarise incident reports, sales teams summarise call transcripts. You are building a CLI tool that takes a `.txt` or `.pdf` file and produces a structured summary, using everything from Lessons 1–6: API calls, structured outputs, XML-tagged prompts, and cost tracking.

{% include prereqs.html %}

## Specification

### Usage

```bash
# Summarise a .txt file
uv run summarize.py report.txt

# Summarise a .pdf file
uv run summarize.py contract.pdf

# Choose detail level
uv run summarize.py report.txt --detail brief
uv run summarize.py report.txt --detail standard   # default
uv run summarize.py report.txt --detail detailed

# Output as JSON (structured fields only)
uv run summarize.py report.txt --json
```

### Output (standard mode)

```text
═══════════════════════════════════════
  DOCUMENT SUMMARY
═══════════════════════════════════════
Title:       Q3 2024 Incident Report
Type:        technical report
Word count:  ~2,400
─────────────────────────────────────
SUMMARY
The Q3 incident report covers three major outages between July and September...

KEY POINTS
• The longest outage (4h 22m) was caused by a misconfigured load balancer
• Two incidents were traced to a single library dependency
• Remediation involved rolling back to version 2.1.4

ACTION ITEMS
• Audit all third-party library upgrade PRs before merge
• Add circuit breaker to the payment service
─────────────────────────────────────
Cost: $0.000089 | Tokens: 1,243
═══════════════════════════════════════
```

## Requirements

- Reads `.txt` files with standard `open()`
- Reads `.pdf` files with `PyPDF2.PdfReader`
- Rejects unsupported file types with a clear error message before calling the API
- Uses a Pydantic model `DocumentSummary` with these fields:
  - `title`: str — inferred from content if not explicit
  - `document_type`: str — e.g. "legal contract", "technical report", "email thread"
  - `estimated_word_count`: int
  - `summary`: str — 2–4 sentences, length depends on detail level
  - `key_points`: list[str] — 3–6 bullet points
  - `action_items`: list[str] — may be empty
- The detail level is passed in the system prompt, not by changing the model
- Uses XML tags to separate document content from instructions in the user message
- Temperature set to `0.3` for consistency
- Wraps the API call in retry logic
- Prints token count and estimated cost after every run
- `--json` flag prints the raw Pydantic model as JSON (`model.model_dump_json(indent=2)`)
- Documents longer than 10,000 words print a warning: "Document is long — using gpt-4o for better quality" and switch to `gpt-4o`

## Suggested approach

1. Build the file reader: a function `read_document(path: str) -> str` that handles both `.txt` and `.pdf`.
2. Define the `DocumentSummary` Pydantic model.
3. Write the `summarize(text: str, detail: str) -> DocumentSummary` function with the API call.
4. Add the formatted print output.
5. Wire up `argparse` for `--detail` and `--json`.
6. Add the word count check and model switching.
7. Test with both a `.txt` and a `.pdf` file.

<div class="callout info">
<strong>Need a test document?</strong> Paste any Wikipedia article into a <code>test.txt</code> file — Wikipedia articles are well-structured and representative of real document summarisation tasks.
</div>

## Prompt structure guidance

Structure your user message like this:

```python
user_message = f"""
<document>
{document_text}
</document>

Summarise the document above. Extract all required fields accurately.
The detail level for this summary is: {detail}
- brief: 1–2 sentence summary, 3 key points
- standard: 2–4 sentence summary, 3–5 key points
- detailed: 4–6 sentence summary, 5–6 key points with sub-points
"""
```

## Completion checklist

- [ ] Reads and summarises a `.txt` file
- [ ] Reads and summarises a `.pdf` file
- [ ] Rejects an unsupported file type with a clear error
- [ ] `--detail brief` produces a noticeably shorter summary than `--detail detailed`
- [ ] `--json` prints valid JSON output
- [ ] Token count and cost printed after every run
- [ ] Long document (>10,000 words) switches to `gpt-4o` with a warning
- [ ] API errors print a helpful message instead of a stack trace

## Extension challenges

- **Multiple files:** Accept multiple file paths and produce a combined cross-document summary
- **Output to file:** Add `--output summary.md` to write a formatted Markdown file
- **Chunking:** For very long documents, split into chunks, summarise each, then summarise the summaries (a "map-reduce" approach you will see again in Chapter 4)
