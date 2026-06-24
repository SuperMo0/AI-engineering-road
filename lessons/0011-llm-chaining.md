---
layout: lesson
lesson_id: "0011"
chapter: 2
chapter_title: "AI System Design"
title: "LLM call chaining and parallelization"
description: "35–45 min read · Hands-on coding"
prev: "0010-minimize-ai.html"
prev_title: "The golden rule: use as little AI as possible"
next: "0012-tool-calling.html"
next_title: "Tool calling"
prereqs:
  - "[Lesson 9](0009-cognitive-architecture.html): typed interfaces between steps — chaining requires typed outputs from each step"
  - "[Lesson 10](0010-minimize-ai.html): you know where to use LLMs; now you chain only where necessary"
  - "Basic Python: `async`/`await` keywords are introduced here from scratch"
assignment:
  article:
    title: "How To Improve Your LLM-Powered App"
    url: "https://www.aihero.dev/how-to-improve-your-llm-powered-app"
    author: "aihero.dev"
    time: "about 10 minutes (sections on \"LLM Chaining\" and \"Parallelization\" specifically)"
    why: "Practitioner-level explanation of when each pattern earns its complexity, with real-world examples showing measurable improvements from decomposition and concurrency."
  task:
    description: "Build a parallelized batch summarizer."
    steps:
      - "Write an `async def summarise_batch(files: list[str]) -> list[DocumentSummary]` function that reads each file and summarises it in parallel"
      - "Cap concurrent calls at 5 using a semaphore"
      - "Time the total run: measure with `time.perf_counter()`"
      - "Run it on 5 text files (create them with any content)"
      - "Compare: comment out `asyncio.gather` and run sequentially, print both times"
    expected: "`Sequential: 8.3s | Parallel: 2.1s | Speedup: 4.0×`"
    why: "The speedup is the proof. Seeing it in your own terminal is more convincing than any diagram."
knowledge_check:
  - q: "Why does chaining improve reliability compared to one large prompt?"
    a: "Each call in a chain is focused on one task with a tailored system prompt, reducing cognitive load on the model. Each output is validated (Pydantic) before the next step starts, catching errors early. Failures are isolated to specific steps, making debugging straightforward. Individual steps can be tested and swapped independently."
    section: "#chaining"
    section_title: "LLM call chaining"
  - q: "What is `asyncio.gather()` and what does it return?"
    a: "`asyncio.gather()` takes multiple async coroutines, runs them concurrently, and returns a list of their results in the same order they were passed in — even though they may complete in a different order. It waits until all coroutines finish before returning."
    section: "#parallelization"
    section_title: "Parallelizing LLM calls"
  - q: "Why can you not parallelize the steps of a chain?"
    a: "Because step 2 needs step 1's output as its input — it cannot start until step 1 finishes. Parallelization only applies to tasks that are independent of each other. In a chain, each step is dependent on the previous one, so they must run sequentially."
    section: "#parallelization"
    section_title: "When you can and cannot parallelize"
  - q: "What is a semaphore and why do you need one when parallelizing many LLM calls?"
    a: "A semaphore is a counter that limits how many operations can run concurrently. Without one, parallelizing 1,000 calls would fire all 1,000 at the same moment, immediately hitting the API's rate limit. A semaphore set to 10 means at most 10 calls are in-flight at any time, keeping throughput high without triggering rate limit errors."
    section: "#parallelization"
    section_title: "Concurrency limits"
additional_resources:
  - title: "Python asyncio documentation"
    url: "https://docs.python.org/3/library/asyncio.html"
    desc: "Full reference; particularly useful for `TaskGroup` (Python 3.11+) as an alternative to `gather()`"
---

## Motivation

A single LLM call handles a single, focused task well. But many real problems are too complex for one call — or involve multiple independent sub-tasks that could run at the same time. Chaining and parallelization are the two fundamental workflow patterns that let you build systems that are both more capable and faster than any single call could be.

A document processing pipeline that runs 10 documents in 2 seconds instead of 20 is not a premature optimisation — it is the difference between a product that feels instant and one that feels broken.

{% include prereqs.html %}

## Part 1: LLM call chaining {#chaining}

### What chaining is

**Chaining** means connecting LLM calls so that the output of one call becomes the input of the next. Each call is specialised for one focused task; the chain handles the full complexity of the problem by decomposing it.

This is different from putting everything in one big prompt. With chaining:

- Each call can use a different system prompt, tailored to its task
- Each call's output is validated (Pydantic) before the next call starts
- A failure in any step is isolated — you know exactly which step failed
- You can swap or test any individual step independently

### When to chain vs one big prompt

| Use one call when… | Use chaining when… |
|---|---|
| The task is self-contained and well-defined | The task has clearly separable phases (extract, then summarise, then classify) |
| The prompt is short enough that the model holds context | The context would overflow a single prompt, or different parts need different system prompts |
| Quality is acceptable with a single pass | One call reliably fails — quality improves with decomposition |

### A concrete chain: document intelligence pipeline

This pipeline takes a raw document and produces a structured intelligence report in three steps:

1. **Extract** — pull key entities from the document (people, dates, amounts)
2. **Assess** — given the extracted entities, assess risk level
3. **Summarise** — given the risk assessment, write an executive summary

```python
import os
from dotenv import load_dotenv
from openai import OpenAI
from pydantic import BaseModel
from typing import Optional

load_dotenv()
client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))

# ── Step 1 output type ─────────────────────────────────────────
class Entities(BaseModel):
    parties: list[str]
    key_dates: list[str]
    monetary_amounts: list[str]
    jurisdiction: Optional[str] = None

# ── Step 2 output type ─────────────────────────────────────────
class RiskAssessment(BaseModel):
    risk_level: str          # "low" | "medium" | "high"
    risk_factors: list[str]
    flags: list[str]

# ── Step 3 output type ─────────────────────────────────────────
class IntelligenceReport(BaseModel):
    executive_summary: str
    risk_level: str
    key_entities: list[str]
    recommended_action: str

def extract_entities(document: str) -> Entities:
    r = client.beta.chat.completions.parse(
        model="gpt-4o-mini",
        messages=[
            {"role": "system", "content": "Extract all named entities from this document."},
            {"role": "user",   "content": document},
        ],
        response_format=Entities,
    )
    return r.choices[0].message.parsed

def assess_risk(document: str, entities: Entities) -> RiskAssessment:
    context = f"Entities found:\n{entities.model_dump_json(indent=2)}"
    r = client.beta.chat.completions.parse(
        model="gpt-4o-mini",
        messages=[
            {"role": "system", "content": "Assess the risk level of this document given the extracted entities."},
            {"role": "user",   "content": f"<document>{document}</document>\n\n<entities>{context}</entities>"},
        ],
        response_format=RiskAssessment,
    )
    return r.choices[0].message.parsed

def generate_report(entities: Entities, risk: RiskAssessment) -> IntelligenceReport:
    context = (
        f"Entities: {entities.model_dump_json()}\n"
        f"Risk: {risk.model_dump_json()}"
    )
    r = client.beta.chat.completions.parse(
        model="gpt-4o-mini",
        messages=[
            {"role": "system", "content": "Write an executive intelligence report based on the analysis."},
            {"role": "user",   "content": context},
        ],
        response_format=IntelligenceReport,
    )
    return r.choices[0].message.parsed

# ── Run the chain ──────────────────────────────────────────────
def analyse_document(document: str) -> IntelligenceReport:
    entities = extract_entities(document)         # Step 1
    risk     = assess_risk(document, entities)    # Step 2, uses Step 1 output
    report   = generate_report(entities, risk)    # Step 3, uses Steps 1+2 output
    return report
```

Each step is a pure function: typed input, typed output, easy to test in isolation. The `analyse_document` function orchestrates them without knowing their internals.

## Part 2: Parallelizing LLM calls {#parallelization}

### What parallelization is

When two or more LLM calls do not depend on each other's output, they can run at the same time instead of sequentially. Running 10 independent document summaries in parallel takes the same wall-clock time as running one — because each call waits for the network independently.

This is done with Python's **asyncio** library. Asyncio allows Python to send multiple network requests and handle their responses without blocking — while one request is waiting for the API's response, Python can send the next one.

### Async Python — the minimum you need to know

An **async function** is defined with `async def`. Inside it, `await` pauses the function and lets other async functions run while waiting for a slow operation (like a network request). `asyncio.gather()` runs multiple async functions at the same time and collects their results.

```python
import asyncio

async def slow_task(name: str) -> str:
    await asyncio.sleep(1)   # simulates a 1-second API call
    return f"{name} done"

async def main():
    # Sequential: takes 3 seconds
    r1 = await slow_task("A")
    r2 = await slow_task("B")
    r3 = await slow_task("C")

    # Parallel: takes 1 second
    r1, r2, r3 = await asyncio.gather(
        slow_task("A"),
        slow_task("B"),
        slow_task("C"),
    )

asyncio.run(main())
```

### Parallel LLM calls with the AsyncOpenAI client

The `openai` package includes an async client: `AsyncOpenAI`. Its methods are identical to the synchronous client but must be `await`ed:

```python
import asyncio
import os
from dotenv import load_dotenv
from openai import AsyncOpenAI
from pydantic import BaseModel

load_dotenv()
aclient = AsyncOpenAI(api_key=os.getenv("OPENAI_API_KEY"))

class DocumentSummary(BaseModel):
    title: str
    one_line_summary: str
    sentiment: str

async def summarise_one(document: str) -> DocumentSummary:
    r = await aclient.beta.chat.completions.parse(
        model="gpt-4o-mini",
        messages=[
            {"role": "system", "content": "Summarise this document."},
            {"role": "user",   "content": document},
        ],
        response_format=DocumentSummary,
    )
    return r.choices[0].message.parsed

async def summarise_all(documents: list[str]) -> list[DocumentSummary]:
    tasks = [summarise_one(doc) for doc in documents]
    return await asyncio.gather(*tasks)

# Entry point
documents = ["Document 1 text...", "Document 2 text...", "Document 3 text..."]
summaries = asyncio.run(summarise_all(documents))
```

Three API calls that would take 6–9 seconds sequentially now take 2–3 seconds — the time of a single call, because all three are in-flight simultaneously.

### When you can and cannot parallelize

| Can parallelize ✓ | Cannot parallelize ✗ |
|---|---|
| Summarising 10 independent documents | Steps in a chain where step 2 needs step 1's output |
| Classifying 100 customer emails | Agentic loops where each iteration depends on the last |
| Translating text into 5 languages simultaneously | Evaluator-optimizer loops (generate → evaluate → improve is sequential) |
| Running the same analysis with two different models to compare | Any step that mutates shared state |

### Concurrency limits

Parallelizing 10 calls is fine. Parallelizing 1,000 at once will hit your rate limit. Use `asyncio.Semaphore` to cap concurrent calls:

```python
async def summarise_all_bounded(documents: list[str], max_concurrent: int = 10) -> list[DocumentSummary]:
    semaphore = asyncio.Semaphore(max_concurrent)

    async def bounded_summarise(doc: str) -> DocumentSummary:
        async with semaphore:
            return await summarise_one(doc)

    tasks = [bounded_summarise(doc) for doc in documents]
    return await asyncio.gather(*tasks)
```

With `max_concurrent=10`, at most 10 API calls are in-flight at any moment, regardless of how many documents you pass in.
