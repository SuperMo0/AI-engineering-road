---
layout: lesson
lesson_id: "0017"
chapter: 2
chapter_title: "AI System Design"
title: "LangChain, LangGraph, and CrewAI — orchestration frameworks"
description: "40–50 min read · Hands-on coding"
prev: "0016-pydantic-ai.html"
prev_title: "PydanticAI — type-safe AI workflows"
next: "0048-n8n-zapier.html"
next_title: "Visual AI workflows — n8n and Zapier"
prereqs:
  - "Lessons 11–14: you built pipelines, tool calling, agents, and routers from scratch — this lesson shows what a framework does differently"
  - "Install: `uv add langchain langchain-openai langgraph crewai`"
assignment:
  article:
    title: "LangGraph: Multi-Agent Workflows"
    url: "https://blog.langchain.dev/langgraph/"
    author: "LangChain blog"
    time: "about 10 minutes"
    why: "The original LangGraph announcement from the team that built it, explaining the graph-based model and why it was designed to replace the LangChain agent executor. Provides context for why LangGraph exists separately from LangChain."
  task:
    description: "Reimplement the document intelligence pipeline from P004 using LangGraph."
    steps:
      - "Define a `PipelineState` TypedDict with the same fields as `DocumentIntelligence`"
      - "Create nodes: `ingest`, `extract`, `classify`, `summarise`, `evaluate`"
      - "Add a conditional edge from `evaluate`: retry `summarise` if score < 7, else end"
      - "Run on three documents and compare the output to your P004 version"
    expected: "Same `DocumentIntelligence` JSON as P004, produced by a LangGraph workflow."
    why: "Implementing the same pipeline in both styles builds direct intuition for where a framework adds value (state management, branching) and where it adds friction (more setup, harder to customise)."
knowledge_check:
  - q: "What does the `|` operator do in LangChain LCEL?"
    a: "It pipes the output of one component as the input of the next. A chain defined as `prompt | llm | parser` automatically passes the formatted prompt to the LLM, then passes the LLM's response to the parser. Each component is called in sequence when `chain.invoke()` is called."
    section: "#lcel"
    section_title: "LCEL"
  - q: "What are the three parts of every LangGraph workflow?"
    a: "**State** — a TypedDict that flows through every node, holding all data the workflow produces. **Nodes** — Python functions that read from state and return state updates. **Edges** — connections between nodes, either fixed (`add_edge`) or conditional (`add_conditional_edges`)."
    section: "#langgraph"
    section_title: "LangGraph fundamentals"
  - q: "When should you choose raw API over LangGraph?"
    a: "For simple linear pipelines (3–5 steps with no branching), when you need tight control over every token sent (frameworks can add prompt overhead), or when debuggability is the priority (raw API stack traces are more transparent). LangGraph earns its setup cost only for workflows with real branching, state persistence, or human-in-the-loop requirements."
    section: "#when-framework"
    section_title: "When to use a framework vs raw API"
  - q: "What are the three building blocks of every CrewAI workflow, and what does each one do?"
    a: "**Agent** — an LLM configured with a role, goal, and backstory; the backstory shapes how it approaches tasks. **Task** — a specific piece of work with a description and expected output, assigned to an agent. **Crew** — the orchestrator: a list of agents, a list of tasks, and a process (sequential or hierarchical) defining how they collaborate."
    section: "#crewai"
    section_title: "CrewAI — role-based multi-agent coordination"
additional_resources:
  - title: "LangGraph documentation"
    url: "https://langchain-ai.github.io/langgraph/"
    desc: "Full reference; especially the tutorials on human-in-the-loop and multi-agent supervisor patterns"
  - title: "LangChain LCEL documentation"
    url: "https://python.langchain.com/docs/expression_language/"
    desc: "Full reference for the pipe syntax and streaming"
  - title: "CrewAI documentation"
    url: "https://docs.crewai.com/"
    desc: "Full reference for agents, tasks, tools, and the hierarchical process"
---

## Motivation

Every AI engineering job posting lists LangChain or LangGraph. Every second tutorial uses them. You need to know what they do, when they help, and — critically — when they make things worse. The AI engineering community is split: some teams use LangChain for everything; others refuse to touch it. This lesson gives you the knowledge to form your own informed position.

{% include prereqs.html %}

## What LangChain is — and what it is not {#what-langchain-is}

**LangChain** is a Python (and JavaScript) library that provides abstractions for building LLM applications: standard interfaces for LLMs, prompt templates, output parsers, memory, retrievers, and chains. It appeared in 2023 at the start of the LLM engineering boom and became widely adopted quickly.

LangChain's abstractions are useful when they match your problem. They become a liability when they do not — the library has a reputation for complex abstractions that can obscure what is actually happening and make debugging harder.

### What LangChain is good at

- Standardising calls to multiple LLM providers (OpenAI, Anthropic, local models) behind one interface
- Prompt template management with variable injection
- Rapid prototyping — assembling a working pipeline in 20 lines
- The ecosystem: hundreds of integrations (vector stores, document loaders, tools)

### Where LangChain adds friction

- Opaque abstractions — a bug inside `LLMChain` is harder to debug than your own for-loop
- Rapid API churn — code written for LangChain 0.1 often breaks on 0.2 or 0.3
- Unnecessary abstraction for simple tasks — three lines of direct API code is better than five imports plus a chain definition

**Verdict:** Use LangChain for the integrations (retrievers, document loaders) and for LCEL (LangChain Expression Language) chains when you need rapid composition. Do not let it own your business logic. For anything complex, prefer LangGraph (below) or raw API.

## LCEL: LangChain Expression Language {#lcel}

Modern LangChain uses **LCEL** — a pipeline composition syntax using the `|` operator (pipe). A chain is a sequence of components piped together:

```python
from langchain_openai import ChatOpenAI
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.output_parsers import StrOutputParser

llm = ChatOpenAI(model="gpt-4o-mini")

prompt = ChatPromptTemplate.from_messages([
    ("system", "You are a helpful assistant. Be concise."),
    ("user", "{question}"),
])

chain = prompt | llm | StrOutputParser()

result = chain.invoke({"question": "What is a vector database?"})
print(result)
```

The `|` operator wires components together: the prompt formats the input, the LLM generates a response, and the output parser extracts the text. Each component is called automatically with the previous component's output.

LCEL is elegant for simple, linear chains. For anything with branching or loops, use LangGraph.

## LangGraph — stateful, branching workflows {#langgraph}

**LangGraph** is a separate library from LangChain (same company, different package) that models AI workflows as graphs — nodes connected by edges. Nodes are Python functions that transform state; edges define which node runs next, with support for conditional branching.

LangGraph is designed for the patterns you built in Lessons 13–14: agentic loops, evaluator-optimizer, routers with specialist sub-graphs. It provides:

- **Explicit state management:** the full pipeline state is typed and inspectable at every node
- **Conditional edges:** route to different nodes based on state values
- **Human-in-the-loop:** pause the graph for human approval before continuing
- **Persistence:** save and resume graph state across sessions
- **Streaming:** stream node outputs as they complete

### LangGraph fundamentals: State, Nodes, Edges

Every LangGraph workflow has three parts:

1. **State** — a TypedDict that flows through every node
2. **Nodes** — Python functions that read from state and return state updates
3. **Edges** — connections between nodes (fixed or conditional)

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

`add_conditional_edges()` is the key — it takes a function that reads state and returns a string key, then maps that key to the next node. This is how you implement the evaluator-optimizer loop, branching routers, and agentic loops with built-in state management.

## CrewAI — role-based multi-agent coordination {#crewai}

**CrewAI** is a framework built specifically for multi-agent workflows where different agents play distinct roles — like a team of specialists collaborating on a project. Where LangGraph models your workflow as a graph of states, CrewAI models it as a team of people with jobs to do.

Every CrewAI workflow has three building blocks:

1. **Agent** — a configured LLM with a role, a goal, and a backstory. The backstory shapes how the agent approaches problems — think of it as a system prompt that CrewAI manages for you.
2. **Task** — a specific piece of work with a description and an expected output format. Tasks are assigned to agents.
3. **Crew** — the team: a list of agents, a list of tasks, and a process defining how they collaborate.

The two processes are `Process.sequential` (each task completes before the next starts, passing output forward) and `Process.hierarchical` (a manager LLM dynamically assigns tasks to agents at runtime, like a project manager delegating work).

```python
from crewai import Agent, Task, Crew, Process
from langchain_openai import ChatOpenAI

llm = ChatOpenAI(model="gpt-4o-mini")

# ── Agents ────────────────────────────────────────────────────────────
researcher = Agent(
    role="Research Analyst",
    goal="Gather and synthesise accurate information on any topic",
    backstory=(
        "You are a meticulous analyst who structures findings clearly "
        "and always flags gaps in the available information."
    ),
    llm=llm,
    verbose=False,
)

writer = Agent(
    role="Technical Writer",
    goal="Transform research findings into clear, developer-friendly summaries",
    backstory="You write concise summaries that a developer can act on in two minutes.",
    llm=llm,
    verbose=False,
)

# ── Tasks ─────────────────────────────────────────────────────────────
research_task = Task(
    description=(
        "Research vector databases in 2026: leading options, their trade-offs, "
        "and when to choose each one."
    ),
    expected_output="A structured list of 4–5 vector databases with pros, cons, and ideal use cases.",
    agent=researcher,
)

write_task = Task(
    description="Using the research, write a concise developer-friendly recommendation.",
    expected_output="A 200-word summary with a clear top recommendation and reasoning.",
    agent=writer,
    context=[research_task],   # writer receives researcher's output automatically
)

# ── Crew ──────────────────────────────────────────────────────────────
crew = Crew(
    agents=[researcher, writer],
    tasks=[research_task, write_task],
    process=Process.sequential,
)

result = crew.kickoff()
print(result.raw)
```

The `context=[research_task]` parameter is how agents share results — the writer automatically receives everything the researcher produced, without you writing any state-passing code. This is CrewAI's key feature: agent collaboration is handled by the framework.

### When to use CrewAI vs LangGraph

Choose **CrewAI** when you have distinct specialist roles that naturally hand off work — a researcher, a critic, a writer, a planner. The role-based model maps well onto real team structures and is easy to reason about.

Choose **LangGraph** when you need precise control over branching, retries, and state. CrewAI is harder to customise at the loop level; LangGraph gives you full visibility into every transition.

## The tool ecosystem: LangChain, CrewAI, and Composio {#tool-ecosystem}

In Lesson 12 you built tools from scratch — a raw JSON Schema definition wired to a Python function. Every framework in this lesson wraps that same idea, but adds a layer that makes tools easier to discover, validate, and reuse.

### LangChain tools: `@tool` vs `BaseTool`

LangChain provides two ways to define a tool. The `@tool` decorator is the quick option — it wraps any function and uses the docstring as the tool description:

```python
from langchain_core.tools import tool

@tool
def search_web(query: str) -> str:
    """Search the web for current information. Use for recent events or facts."""
    with DDGS() as ddgs:
        results = list(ddgs.text(query, max_results=5))
    return "\n".join(r["body"] for r in results)
```

The `BaseTool` subclass gives more control — useful when you need custom error handling, async support, or metadata:

```python
from langchain_core.tools import BaseTool
from pydantic import BaseModel, Field

class SearchInput(BaseModel):
    query: str = Field(description="The search query")

class WebSearchTool(BaseTool):
    name: str = "search_web"
    description: str = "Search the web for current information."
    args_schema: type[BaseModel] = SearchInput

    def _run(self, query: str) -> str:
        with DDGS() as ddgs:
            results = list(ddgs.text(query, max_results=5))
        return "\n".join(r["body"] for r in results)
```

Use `@tool` for most cases. Reach for `BaseTool` when you need the tool to carry state, handle errors differently, or plug into a tool registry.

### CrewAI built-in tools

CrewAI ships a library of pre-built tools so you do not have to write common integrations from scratch. Notable examples:

```python
from crewai_tools import SerperDevTool, FileReadTool, ScrapeWebsiteTool

# Web search (requires a Serper API key)
search_tool = SerperDevTool()

# Read a local file
file_tool = FileReadTool(file_path="./data/report.txt")

# Scrape and return the text content of any URL
scrape_tool = ScrapeWebsiteTool()

researcher = Agent(
    role="Researcher",
    goal="Find accurate information on the given topic",
    tools=[search_tool, scrape_tool],
    llm="gpt-4o-mini",
)
```

The tool is assigned to an agent, not the crew — each agent only sees the tools relevant to its role.

### Composio — 1000+ production connectors

[Composio](https://composio.dev) is a connector framework that gives your agents access to external services — GitHub, Notion, Slack, Gmail, Linear, and hundreds more — through a single, authentication-managed interface. Instead of writing OAuth flows and API wrappers yourself, you install a connector and hand it to your agent as a tool:

```python
from composio_langchain import ComposioToolSet, Action

toolset = ComposioToolSet()
github_tools = toolset.get_tools(actions=[
    Action.GITHUB_CREATE_ISSUE,
    Action.GITHUB_LIST_PULL_REQUESTS,
])

# Use with LangChain or CrewAI as normal tools
agent = create_react_agent(llm, tools=github_tools)
```

Composio handles authentication once (via `composio login`), then every agent in your system can use those connectors without storing tokens in your code.

**When Composio earns its place:** building an AI assistant that takes actions across real SaaS products (create a GitHub issue, send a Slack message, update a Notion page). For pure data-retrieval tools like web search, rolling your own with ddgs is simpler.

## When to use a framework vs raw API {#when-framework}

| Situation | Recommendation |
|---|---|
| Prototype / proof of concept | LangChain LCEL — fastest to assemble |
| Stateful workflow with branching | LangGraph — built for this |
| Need human-in-the-loop approval | LangGraph — has native interrupt/resume |
| Multi-agent team with specialist roles | CrewAI — role-based model maps to team patterns |
| Simple linear pipeline, 3–5 steps | Raw API — less overhead, easier to debug |
| Production agentic system | LangGraph or PydanticAI (next lesson) |
| Tight control over every token | Raw API — frameworks can add unexpected prompt overhead |

<div class="callout info">
<strong>Career note:</strong> Many teams use raw API in production and LangGraph only for orchestration. CrewAI is increasingly common in interview conversations — knowing all three (LangGraph, CrewAI, raw API) and when each earns its cost is what 2026 AI Engineering job postings look for.
</div>
