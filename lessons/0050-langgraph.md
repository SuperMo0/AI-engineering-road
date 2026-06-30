---
layout: lesson
lesson_id: "0050"
chapter: 2
chapter_title: "AI System Design"
title: "LangGraph — the agent runtime"
description: "30–40 min read · Hands-on coding"
prev: "0017-langchain.html"
prev_title: "LangChain — the agent framework"
next: "0051-crewai.html"
next_title: "CrewAI — role-based multi-agent coordination"
prereqs:
  - "[Lesson 17](0017-langchain.html): LangChain — you'll see what's actually running underneath create_agent"
  - "[Lessons 13–14](0013-evaluator-router.html): evaluator-optimizer, routers, and agentic loops — LangGraph models these natively"
  - "Install: `uv add langgraph langchain-openai`"
assignment:
  article:
    title: "LangGraph: Multi-Agent Workflows"
    url: "https://blog.langchain.dev/langgraph/"
    author: "LangChain blog"
    time: "about 10 minutes"
    why: "The original LangGraph announcement from the team that built it, explaining the graph-based model and why it was designed as a separate, lower-level runtime rather than another layer inside LangChain. Direct context for the Framework/Runtime distinction from the previous lesson."
  task:
    description: "Reimplement the document intelligence pipeline from P004 using LangGraph."
    steps:
      - "Define a `PipelineState` TypedDict with the same fields as `DocumentIntelligence`"
      - "Create nodes: `ingest`, `extract`, `classify`, `summarise`, `evaluate`"
      - "Add a conditional edge from `evaluate`: retry `summarise` if score < 7, else end"
      - "Run on three documents and compare the output to your P004 version"
    expected: "Same `DocumentIntelligence` JSON as P004, produced by a LangGraph workflow."
    why: "Implementing the same pipeline in both styles builds direct intuition for where the runtime adds value (explicit state, branching, persistence) and where it adds friction (more setup than a plain for-loop)."
knowledge_check:
  - q: "What are the three parts of every LangGraph workflow?"
    a: "**State** — a TypedDict that flows through every node, holding all data the workflow produces. **Nodes** — Python functions that read from state and return state updates. **Edges** — connections between nodes, either fixed (`add_edge`) or conditional (`add_conditional_edges`)."
    section: "#fundamentals"
    section_title: "State, Nodes, and Edges"
  - q: "What does `add_conditional_edges` actually do?"
    a: "It takes a routing function that reads the current state and returns a string key, then maps that key to the next node to run. This is the mechanism behind every branching pattern you built by hand in Lessons 13–14 — evaluator-optimizer retries, router dispatch, agentic loop continuation — now expressed as a graph edge instead of an if-statement."
    section: "#fundamentals"
    section_title: "State, Nodes, and Edges"
  - q: "What does a checkpointer give a LangGraph workflow that a plain Python loop doesn't?"
    a: "Durable execution: the graph's state is saved after every node, so a long-running workflow can survive a crash or restart and resume exactly where it left off — instead of starting over from the beginning. This is what makes LangGraph suitable for production workflows that run for minutes, hours, or days."
    section: "#durable-execution"
    section_title: "Durable execution and persistence"
  - q: "Your LangChain agent (Lesson 17) needs a step where a human reviews a draft before it's sent, and the workflow must pause — possibly for hours — until they respond. Why does this push you toward LangGraph directly, rather than just adding more middleware?"
    a: "Pausing a workflow indefinitely and resuming it later requires the runtime to persist state externally and support being interrupted and restarted on demand — that's an `interrupt`, a LangGraph primitive. LangChain's middleware customises the agent loop's behavior in-process; it doesn't give you durable, resumable pauses across hours. Reaching for LangGraph here isn't abandoning LangChain — `create_agent` already runs on LangGraph, so you're just working at the lower tier directly."
    section: "#when-langgraph"
    section_title: "When to drop down to LangGraph directly"
additional_resources:
  - title: "LangGraph documentation"
    url: "https://langchain-ai.github.io/langgraph/"
    desc: "Full reference; especially the tutorials on human-in-the-loop and multi-agent supervisor patterns"
  - title: "Persistence"
    url: "https://docs.langchain.com/oss/python/langgraph/persistence"
    desc: "Checkpointers, thread-level state, and production-grade persistent storage backends"
  - title: "Human-in-the-loop"
    url: "https://docs.langchain.com/oss/python/langgraph/interrupts"
    desc: "Pausing a graph for human approval and resuming it later"
---

## Motivation

Every time you called `create_agent` in the last lesson, something was running underneath it that you never saw: LangGraph. It's the engine LangChain 1.0 is built on — and the moment your workflow needs something `create_agent`'s defaults don't cover (real branching across multiple paths, a process that must survive a server restart, a human approval step that pauses for hours), you drop down and use that engine directly. This lesson opens the hood.

{% include prereqs.html %}

## LangGraph: the runtime underneath {#langgraph-runtime}

Recall the three-tier split from the last lesson: **framework** (LangChain, fast to start), **runtime** (LangGraph, low-level control), **harness** (Deep Agents SDK, opinionated and autonomous). LangGraph is a separate package from LangChain — same company, different layer — that models a workflow as a **graph**: nodes connected by edges, where each node is a Python function that reads and updates a shared state object.

You already know this pattern. The agentic loops, evaluator-optimizer, and routers you built from scratch in Lessons 13–14 are all graphs in everything but name: a step that does work, a decision about what happens next, possibly a loop back. LangGraph gives that pattern explicit, inspectable structure instead of nested if-statements, and adds production infrastructure on top:

- **Explicit state:** the full pipeline state is typed and inspectable at every node — useful for debugging and for tracing tools like LangSmith
- **Conditional branching:** route to different nodes based on state, not buried inside a function body
- **Durable execution:** a graph's progress is checkpointed, so a multi-hour workflow can resume after a crash instead of restarting
- **Human-in-the-loop:** pause a graph mid-execution for a human decision, then resume it — possibly much later
- **Streaming:** stream intermediate node outputs as they complete, not just the final answer

## State, Nodes, and Edges {#fundamentals}

Every LangGraph workflow has exactly three parts:

1. **State** — a `TypedDict` that flows through every node
2. **Nodes** — Python functions that read from state and return state updates
3. **Edges** — connections between nodes, fixed (`add_edge`) or conditional (`add_conditional_edges`)

Here's the evaluator-optimizer loop from Lesson 14, rebuilt as a graph:

```python
from langgraph.graph import StateGraph, START, END
from langchain_openai import ChatOpenAI
from typing import TypedDict

llm = ChatOpenAI(model="gpt-4o-mini")

# ── State ─────────────────────────────────────────────────────
class State(TypedDict):
    document: str
    summary: str
    quality_score: int
    iterations: int

# ── Nodes ─────────────────────────────────────────────────────
def summarise(state: State) -> dict:
    feedback = f" Improve on: {state.get('feedback', '')}" if state.get('feedback') else ""
    response = llm.invoke(f"Summarise this document in 3 sentences.{feedback}\n\n{state['document']}")
    return {"summary": response.content, "iterations": state["iterations"] + 1}

def evaluate(state: State) -> dict:
    response = llm.invoke(
        f"Rate this summary 1-10 for accuracy and clarity. Reply with just the number.\n\nSummary: {state['summary']}"
    )
    try:
        score = int(response.content.strip())
    except ValueError:
        score = 5
    return {"quality_score": score}

def should_retry(state: State) -> str:
    if state["quality_score"] < 7 and state["iterations"] < 3:
        return "retry"
    return "done"

# ── Graph ─────────────────────────────────────────────────────
graph = StateGraph(State)
graph.add_node("summarise", summarise)
graph.add_node("evaluate",  evaluate)

graph.add_edge(START,       "summarise")
graph.add_edge("summarise", "evaluate")
graph.add_conditional_edges("evaluate", should_retry, {
    "retry": "summarise",   # loop back
    "done":  END,
})

app = graph.compile()

result = app.invoke({
    "document": "Your document text here...",
    "summary": "",
    "quality_score": 0,
    "iterations": 0,
})
print(f"Final summary (score {result['quality_score']}/10):")
print(result["summary"])
```

`add_conditional_edges` is the part that matters most: it takes a routing function (`should_retry`) that reads state and returns a string key, then maps that key to the next node. This single mechanism is how LangGraph expresses every branching pattern from Lessons 13–14 — evaluator-optimizer retries, router dispatch to a specialist node, an agentic loop deciding to continue or stop — as an explicit, visualisable edge instead of logic buried inside a function.

## Durable execution and persistence {#durable-execution}

A plain Python loop loses all progress the moment the process crashes or restarts. LangGraph solves this with a **checkpointer** — the same mechanism LangChain's short-term memory (Lesson 17) is built on, because `create_agent` is itself a compiled LangGraph graph:

```python
from langgraph.checkpoint.memory import InMemorySaver

checkpointer = InMemorySaver()
app = graph.compile(checkpointer=checkpointer)

config = {"configurable": {"thread_id": "doc-batch-42"}}
result = app.invoke({"document": "...", "summary": "", "quality_score": 0, "iterations": 0}, config)
```

After every node runs, the graph's full state is saved against `thread_id`. If the process crashes mid-run, invoking the graph again with the same `thread_id` resumes from the last completed node instead of starting over. `InMemorySaver` is for development; production deployments use a database-backed checkpointer (Postgres, for example) so state survives a server restart, not just a single process.

## Human-in-the-loop {#human-in-the-loop}

Some workflows need a person to approve a step before the graph continues — sending an email, executing a refund, deploying code. LangGraph supports this with `interrupt`, which pauses graph execution at a specific point and waits — for seconds or for days — until you resume it with a human decision:

```python
from langgraph.types import interrupt, Command

def request_approval(state: State) -> dict:
    decision = interrupt({"summary": state["summary"], "question": "Approve this summary?"})
    return {"approved": decision}
```

Calling `app.invoke(...)` on a graph containing this node stops execution at `interrupt` and returns control to your application. Later — after a human reviews `state["summary"]` through whatever interface you build — you resume the exact same thread with `app.invoke(Command(resume=True), config)`. The graph picks up exactly where it paused, with full state intact. This is the kind of long-lived pause `create_agent`'s middleware (Lesson 17) cannot do on its own — it requires the runtime's checkpointing underneath.

## When to drop down to LangGraph directly {#when-langgraph}

| Situation | Recommendation |
|---|---|
| Single agent, tools, no real branching | LangChain `create_agent` (Lesson 17) — you're already running on LangGraph anyway |
| Workflow with explicit branching across multiple paths | LangGraph directly — `add_conditional_edges` makes the logic visible |
| Must survive a crash or restart mid-workflow | LangGraph — checkpointing gives you durable execution |
| Approval step that pauses for minutes, hours, or days | LangGraph — `interrupt`/`resume` |
| Need to see and control every node transition | LangGraph — `create_agent`'s loop is fixed; a custom graph is fully yours |

<div class="callout info">
<strong>Career note:</strong> Companies running agents in production for over a year — Uber, LinkedIn, Klarna among them — run LangGraph underneath, whether or not their application code calls LangChain's <code>create_agent</code> or builds the graph directly. Understanding what's happening at the runtime layer is what separates "I used LangChain" from "I can debug why an agent hung in production."
</div>
