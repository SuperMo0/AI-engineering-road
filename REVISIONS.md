# Chapter 2 Revisions

Tracked changes from the June 2026 review session. Check off each item as it is implemented. Delete this file when all items are done.

---

## Step 1 — File renames

Do these first. Every subsequent step depends on the new filenames.

- [x] `0013-agentic-loops.md` → `0014-agentic-loops.md`
- [x] `0014-evaluator-router.md` → `0013-evaluator-router.md`
- [x] `0017-agents-from-scratch.md` → `0015-agents-from-scratch.md`
- [x] `0015-langchain-langgraph.md` → `0017-langchain-langgraph.md`

(`0016-pydantic-ai.md` and `0048-n8n-zapier.md` keep their filenames.)

---

## Step 2 — Content updates

### `0012-tool-calling.md`
- [x] Replace mocked `search_web` with a real implementation using the `ddgs` package
- [x] Add Trafilatura integration: show how to pass search result URLs to Trafilatura to extract clean text
- [x] Add a "Choosing a search backend" comparison section: ddgs (zero config, no API key, free) vs Tavily (built for agents, requires API key) vs Google Custom Search (requires API console setup)

### New `0013-evaluator-router.md` (was `0014`)
- [x] Fix `confidence` field in `ModerationDecision` from `str` to `Literal["low", "medium", "high"]`
- [x] Add 8 concrete test samples as a copy-pasteable code block (2 safe, 2 spam, 2 hate speech, 2 borderline/ambiguous)
- [x] Fix assignment step formatting — use proper bullet points and inline code for all model fields
- [x] Clarify evaluator-optimizer data flow: if `confidence == "low"`, the **evaluator LLM** generates feedback → that feedback is passed back into the **generator LLM** → generator produces a revised decision
- [x] Remove "Building Effective Agents" from `additional_resources` (it was the assignment article; no longer referenced here)
- [x] Add GitHub Gists (https://gist.github.com) to `additional_resources` as a tool for pasting large text samples during testing
- [x] Assignment: coding task only — no article

### New `0014-agentic-loops.md` (was `0013`)
- [x] Update `prev:` → `0013-evaluator-router.html`
- [x] No content changes

### `P004-document-pipeline.md`
- [x] Clarify that `Entities` is a **nested model** inside `DocumentIntelligence` (not a flat field)
- [x] Clarify that `DocumentIntelligence` is the **pipeline state/context object** — it is created in Step 1 and incrementally populated through each subsequent step
- [x] In Step 1 (Ingest), explicitly name the `langdetect` package for non-LLM language detection

### New `0015-agents-from-scratch.md` (was `0017`)
- [x] Update `prev:` → `P004-document-pipeline.html`, `next:` → `0016-pydantic-ai.html`
- [x] Rewrite the Motivation paragraph: strip all phrasing implying the learner has already used frameworks (e.g. "LangGraph, PydanticAI, and every other framework you have seen…"). Replace with forward-looking framing: building an agent from scratch now means the learner will truly appreciate what LangGraph, PydanticAI, and CrewAI do for them in the upcoming lessons

### `0016-pydantic-ai.md`
- [x] Update `prev:` → `0015-agents-from-scratch.html`
- [x] Update `next:` → `0017-langchain-langgraph.html`

### New `0017-langchain-langgraph.md` (was `0015`)
- [x] Update `prev:` → `0016-pydantic-ai.html`, `next:` → `0048-n8n-zapier.html`
- [x] Add new section: **LangChain Tool ecosystem** — explain `@tool` decorator vs `BaseTool` subclass, when to use each
- [x] Add subsection: **CrewAI built-in tools** — show the tools CrewAI ships out of the box (search, file, web scraping)
- [x] Add subsection: **Composio** — introduce as a production connector framework (1000+ integrations); show how it plugs into both LangChain and CrewAI

### `0048-n8n-zapier.md`
- [x] Update `prev:` → `0017-langchain-langgraph.html`
- [x] No content changes

---

## Step 3 — Manifest and PLAN.md

- [x] Update `assets/lesson-manifest.json` — reorder Ch2 `ch2-workflows` and `ch2-frameworks` items to match new file sequence
- [x] Update PLAN.md table — confirm all filenames and statuses reflect completed renames
