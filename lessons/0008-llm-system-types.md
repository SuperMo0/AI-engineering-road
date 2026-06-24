---
layout: lesson
lesson_id: "0008"
chapter: 2
chapter_title: "AI System Design"
title: "What can you build with LLMs? — system types and the Staircase"
description: "30–40 min read · Conceptual"
prev: "P003-ch1-multi-model-assistant.html"
prev_title: "Chapter Project: Multi-model AI assistant"
next: "0009-cognitive-architecture.html"
next_title: "Cognitive architecture — how LLM systems think"
prereqs:
  - "[Lesson 6](0006-advanced-prompting.html): the Staircase of Complexity — you will see it again here as a design tool, not just a prompting concept"
  - "[Lesson 7](0007-anthropic-api.html): the LLMClient abstraction — Chapter 2 code builds on it throughout"
assignment:
  article:
    title: "What Are LLMs Used For?"
    url: "https://www.aihero.dev/what-are-llms-used-for"
    author: "aihero.dev"
    time: "about 10 minutes"
    why: "A practitioner's taxonomy of what actually ships in production AI products. Maps directly to the five system types in this lesson and gives concrete examples across industries."
  task:
    description: "For each of the five system types, write a one-paragraph design sketch for a system you could personally imagine building."
    steps:
      - "Name the system and the industry"
      - "Describe what comes in and what goes out"
      - "Name which Staircase step it lives on and why"
      - "Write your five sketches in a plain `.txt` or `.md` file"
    expected: "Five paragraphs, one per system type."
    why: "Design thinking before coding. Every lesson in Chapter 2 requires you to first understand what you are building and why — the code comes second. This exercise wires that habit in early."
knowledge_check:
  - q: "What distinguishes a backend automation system (type 4) from a document pipeline (type 1)?"
    a: "A document pipeline is primarily about reading and transforming documents — it processes files and outputs structured data. Backend automation embeds LLM intelligence inside a running service — the LLM is one node among many (database lookups, routing rules, queues), and the end user often doesn't know an LLM is involved."
    section: "#system-type-4"
    section_title: "System type 4: Backend automation"
  - q: "At what point on the Staircase do you reach for multiple agents, and why is it last?"
    a: "Multiple agents are step 6 — the last resort. Each step up the Staircase adds development time, debugging complexity, latency, and cost. Failures compound across agents. You use multi-agent only when a single agent provably cannot handle the task — usually due to scale, specialisation requirements, or context window limits."
    section: "#staircase-as-design-tool"
    section_title: "The Staircase as a design tool"
  - q: "Why does temperature matter more for content generation (type 3) than for extraction (type 1)?"
    a: "Extraction tasks have a single correct answer — the invoice number is what it is. Temperature should be near zero to ensure consistency. Content generation benefits from variation — creative writing, ad copy, and product descriptions are better when they do not all sound identical. Higher temperature produces the variety that makes bulk-generated content feel less mechanical."
    section: "#system-type-3"
    section_title: "System type 3: Content generation"
additional_resources:
  - title: "How To Improve Your LLM-Powered App"
    url: "https://www.aihero.dev/how-to-improve-your-llm-powered-app"
    desc: "17 techniques organised by Staircase step; the reference article for all of Chapter 2"
---

## Motivation

Before writing a single line of Chapter 2 code, you need a map. "Use an LLM" is not an architecture — it is a starting point. Production AI engineering means choosing the right system shape for the problem, not grabbing the most impressive-sounding tool.

This lesson surveys the five major LLM system types, gives you one concrete real-world example of each, and reintroduces the Staircase of Complexity as the chapter-wide design lens. Every lesson that follows builds one of these system types. Knowing the map before the details makes the details stick.

{% include prereqs.html %}

## System type 1: Document processing pipelines {#system-type-1}

**What it is:** Raw, unstructured documents come in — PDFs, emails, HTML pages, scanned images. The pipeline extracts, classifies, enriches, and outputs structured data.

**Real example:** A law firm receives thousands of contracts per month. The pipeline reads each one, extracts the parties, key dates, jurisdiction, and governing law clause, classifies the risk level, and writes the structured fields to a database. Lawyers review the high-risk ones; the rest are handled automatically.

**Characteristics:** typically batch (not real-time), deterministic in structure (same fields every time), heavily parallelisable (each document is independent), and structured-output-heavy. Chapter 2 Project P004 builds this type.

## System type 2: Conversational assistants {#system-type-2}

**What it is:** A chatbot or assistant that maintains a conversation over time, understands context, and helps a user accomplish a goal through dialogue.

**Real example:** Notion AI's Q&A feature. A user asks "what was decided in the last product review?" — the assistant retrieves relevant pages from the user's workspace (RAG, covered in Chapter 4) and answers with citations. Follow-up questions refer to the previous answer.

**Characteristics:** real-time (low latency matters), stateful (conversation history must be managed), often needs tool access (search, calendar, database queries), and must handle off-topic or ambiguous input gracefully. You built the foundation of this type in Chapter 1.

## System type 3: Content generation systems {#system-type-3}

**What it is:** Systems that produce new content — text, summaries, translations, ad copy, code — at scale, often with human review in the loop.

**Real example:** An e-commerce company uses an LLM pipeline to draft product descriptions from structured data (SKU, category, dimensions, materials). A human editor reviews the top 5% most complex products; the rest publish automatically. The pipeline runs nightly and processes 10,000 items.

**Characteristics:** output quality varies — evaluation is essential; often uses evaluator-optimizer patterns to self-correct (Lesson 14); high throughput with parallelism; temperature matters more here than in extraction tasks.

## System type 4: Backend automation {#system-type-4}

**What it is:** An LLM embedded in a backend service as one step in a larger workflow — classifying, routing, enriching, or triaging — without the user ever knowing an LLM is involved.

**Real example:** A SaaS support platform uses an LLM to classify incoming tickets (billing / technical / account / other), set a priority (low / medium / high / urgent), and extract customer account ID from the body — all before a human sees the ticket. The LLM is one node in a larger orchestration pipeline alongside database lookups and routing rules.

**Characteristics:** latency budget is tight; must not hallucinate structured fields; structured outputs are non-negotiable; cost per call compounds quickly at volume; error rates must be measured and monitored (Chapter 5).

## System type 5: Multi-agent workflows {#system-type-5}

**What it is:** Multiple LLM agents working in concert — each specialised for a sub-task — with one coordinating agent orchestrating the overall workflow and routing work between specialists.

**Real example:** An automated research assistant (this chapter's Chapter Project, P006). A user asks a business question. A coordinator agent decides whether the answer needs web search, database queries, or financial analysis. It dispatches to specialist agents, collects their outputs, feeds them to an evaluator agent that checks quality and requests clarification if needed, then assembles the final report.

**Characteristics:** most complex to build and debug; failures compound across agents; requires careful state management, observability (Chapter 5), and stopping conditions. Only use this type when a single agent provably cannot handle the task. The Staircase applies at the system level: reach for multi-agent last.

## The Staircase of Complexity as a design tool {#staircase-as-design-tool}

In Lesson 6 you learned the Staircase as a prompting heuristic: try zero-shot before few-shot, few-shot before chain-of-thought, and so on. In Chapter 2, the same ladder applies at the *system* level — across the entire architecture, not just a single prompt.

When a new requirement arrives, work up the Staircase from the bottom:

1. **Can a non-AI approach solve it?** A regex, a SQL query, a lookup table, a conditional? If yes, stop.
2. **Can a single LLM call solve it?** One prompt, one response. If yes, stop.
3. **Does it need chaining?** One call's output feeds the next. Only chain when a single call reliably fails.
4. **Does it need tools?** The LLM must take external actions (search, calculate, write). Only add tools when a chain cannot handle it.
5. **Does it need an agentic loop?** The LLM must decide what to do next based on feedback. Only build an agent when fixed chaining cannot handle the branching.
6. **Does it need multiple agents?** The problem is too large for one agent to manage. Only split here when scale or specialisation demands it.

Each step up adds development time, debugging complexity, latency, and cost. The systems that fail in production are usually the ones that jumped to step 5 when step 2 was sufficient.

<div class="callout info">
<strong>Chapter 2 in one sentence:</strong> lessons 9–14 teach you how to build systems at each step of the Staircase; lessons 15–17 give you the frameworks that make those systems maintainable at scale.
</div>

## Choosing the right system type {#choosing-system-type}

| If the problem looks like… | Start with… |
|---|---|
| Structured extraction from documents | Document pipeline (type 1) — single LLM call with structured output |
| User dialogue, ongoing task | Conversational assistant (type 2) — chat history + optional tool calling |
| Bulk content at scale | Content generation (type 3) — parallelised pipeline with evaluator |
| Background enrichment / triage | Backend automation (type 4) — LLM as one node, not the whole system |
| Open-ended research or complex multi-step task | Multi-agent (type 5) — only after proving simpler types cannot work |
