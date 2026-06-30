---
layout: lesson
lesson_id: "0017"
chapter: 2
chapter_title: "AI System Design"
title: "LangChain — the agent framework"
description: "30–40 min read · Hands-on coding"
prev: "0016-pydantic-ai.html"
prev_title: "PydanticAI — type-safe AI workflows"
next: "0050-langgraph.html"
next_title: "LangGraph — the agent runtime"
prereqs:
  - "Lessons 11–14: you built pipelines, tool calling, agents, and routers from scratch — this lesson shows what a framework does differently"
  - "[Lesson 16](0016-pydantic-ai.html): PydanticAI — you will compare LangChain against it directly"
  - "Install: `uv add langchain langchain-openai`"
assignment:
  article:
    title: "Agent Middleware"
    url: "https://blog.langchain.com/agent-middleware/"
    author: "LangChain blog"
    time: "about 12 minutes"
    why: "The team that designed LangChain 1.0's middleware system explains why they built it this way — the same problem you'll hit the moment your agent needs anything beyond 'call a tool, get an answer'. Written for engineers who already understand the basic agent loop, which you do after Lesson 15."
  task:
    description: "Rebuild the self-critique agent from Lesson 15 using LangChain's create_agent."
    steps:
      - "Define a `self_critique` tool with `@tool` that sends a draft to a second model call and returns a score (1–10) and feedback, same behaviour as your Lesson 15 version"
      - "Create the agent with `create_agent(model=..., tools=[self_critique], system_prompt=...)`, instructing it to call `self_critique` before giving a final answer and only accept a score ≥ 7"
      - "Add an `InMemorySaver` checkpointer and run the same question twice in the same thread — second time, ask it to recall what it answered first"
      - "Compare line count and readability against your Lesson 15 from-scratch version"
    expected: "A working LangChain agent that self-critiques its draft and remembers the prior turn within a thread — in roughly a third of the code from Lesson 15."
    why: "Rebuilding something you already hand-wrote is the fastest way to see exactly what a framework buys you — and what it hides from you."
knowledge_check:
  - q: "In 2026, is LangChain an alternative to LangGraph, or built on top of it?"
    a: "Built on top of it. As of LangChain 1.0 (October 2025), `create_agent` runs on LangGraph's execution engine under the hood. LangChain is the **framework** tier (abstractions, fast setup); LangGraph is the **runtime** tier underneath it (durable execution, low-level control). You don't need to know LangGraph to use LangChain — but LangGraph is what you reach for when LangChain's defaults aren't enough."
    section: "#what-langchain-is"
    section_title: "What LangChain is in 2026"
  - q: "What are the two required arguments to `create_agent`?"
    a: "`model` (a model identifier string like `\"openai:gpt-4o-mini\"`, or a model object from `init_chat_model`) and `tools` (a list of callables, often decorated with `@tool`). A `system_prompt` is optional but you'll use it in almost every real agent."
    section: "#create-agent"
    section_title: "Building your first LangChain agent"
  - q: "What does `ToolRuntime` give a tool access to, and why is it hidden from the model?"
    a: "`ToolRuntime` gives a tool access to conversation state, immutable per-run context (like a user ID), and the long-term store — without those becoming arguments the LLM has to fill in. It's injected automatically and stripped from the tool's schema, so the model only ever sees the arguments it's actually supposed to reason about."
    section: "#tools"
    section_title: "Tools: the @tool decorator and ToolRuntime"
  - q: "What is middleware in LangChain 1.0, and name one of its three hook points?"
    a: "Middleware intercepts the agent loop the way Express or Django middleware intercepts a web request — running code before or after a model call without rewriting the loop itself. The three hooks are `before_model` (runs before each model call), `after_model` (runs after), and `modify_model_request` (rewrites the prompt, tools, or model settings just before the call)."
    section: "#middleware"
    section_title: "Middleware — customizing the agent loop"
  - q: "Your team needs an agent with three tools and no branching logic, shipped this week. Would you reach for LangChain, PydanticAI, or raw API — and why?"
    a: "LangChain, for speed: `create_agent` gets a working tool-using agent running in under ten lines, with memory and middleware available the moment you need them. PydanticAI earns its place when typed, validated outputs matter more than speed of setup (Lesson 16). Raw API earns its place when you need total control over every token sent, or debuggability matters more than velocity (Lesson 15)."
    section: "#when-langchain"
    section_title: "When to use LangChain vs PydanticAI vs raw API"
additional_resources:
  - title: "LangChain Agents documentation"
    url: "https://docs.langchain.com/oss/python/langchain/agents"
    desc: "Full reference for create_agent, including structured output and streaming"
  - title: "LangChain Tools documentation"
    url: "https://docs.langchain.com/oss/python/langchain/tools"
    desc: "Full reference for @tool, ToolRuntime, and accessing state/context/store from inside a tool"
  - title: "Frameworks, runtimes, and harnesses"
    url: "https://docs.langchain.com/oss/python/concepts/products"
    desc: "LangChain's own explanation of where LangChain, LangGraph, and Deep Agents each sit in the stack"
---

## Motivation

Every AI engineering job posting lists LangChain. It is the most widely adopted framework for building LLM applications, with an ecosystem of hundreds of integrations — and a reputation, earned a few years ago, for being needlessly complex. That reputation is increasingly out of date. LangChain rebuilt its core agent API in late 2025 (version 1.0), replacing the tangle of chain classes that earned the complaints with a single function: `create_agent`. This lesson teaches the framework as it exists today, not as it existed in 2023 tutorials you'll still find online.

{% include prereqs.html %}

## What LangChain is in 2026 — and how it relates to LangGraph and CrewAI {#what-langchain-is}

**LangChain** is a Python (and JavaScript) library that provides ready-made abstractions for building LLM applications: a standard interface across model providers, a tool-calling system, memory, and — as of version 1.0 — a built-in agent loop you don't have to write yourself.

Before going further, it's worth being precise about a question that confuses a lot of learners: **is LangChain an alternative to LangGraph, which you cover in the next lesson?** No. According to LangChain's own documentation, the ecosystem splits into three tiers, and LangChain and LangGraph occupy different ones:

| Tier | What it gives you | Examples |
|---|---|---|
| **Framework** | Abstractions and integrations — fast to start, opinionated defaults | **LangChain**, CrewAI, PydanticAI |
| **Runtime** | Durable execution, persistence, low-level control | **LangGraph**, Temporal |
| **Harness** | Opinionated, batteries-included autonomous agents | Deep Agents SDK, Claude Agent SDK |

The key fact: **LangChain 1.0 is built on top of LangGraph.** When you call `create_agent`, LangGraph's execution engine is running underneath, managing the loop of "call the model, check for tool calls, run them, repeat." You don't need to know anything about LangGraph to use LangChain — that's the point of a framework, it's a layer of abstraction over the runtime. But when your application outgrows what `create_agent` gives you by default — when you need fine-grained control over branching, long-running durable workflows, or custom state — you drop down to LangGraph directly, which is exactly what the next lesson covers.

CrewAI, covered two lessons from now, sits at the same tier as LangChain: it's a framework, just one specialised for a different shape of problem — a *team* of role-playing agents rather than a single agent with tools.

### What LangChain is good at

- Getting a working, tool-using agent running in minutes, with sensible defaults
- Standardising calls to multiple LLM providers (OpenAI, Anthropic, Google, local models) behind one interface
- A large ecosystem of integrations — document loaders, retrievers, vector store connectors
- A clear customisation path (middleware, covered below) when the defaults aren't enough

### Where LangChain still adds friction

- An extra abstraction layer between you and the raw API — when something breaks, you're debugging through `create_agent` as well as your own code
- A library that has changed its core API more than once — code written for LangChain 0.1 will not run unmodified against LangChain 1.0
- Real branching logic (a workflow that splits into different paths depending on what happened) is awkward to express through `create_agent` alone — that's LangGraph's job

**Verdict:** reach for LangChain when you want a working agent fast and your workflow is a single agent calling tools in a loop. Reach for LangGraph (next lesson) the moment you need explicit control over branching, state, or long-running execution.

## Building your first LangChain agent with `create_agent` {#create-agent}

`create_agent` takes a model and a list of tools, and returns a working agent — no manual loop required:

```python
from langchain.agents import create_agent

def get_weather(city: str) -> str:
    """Get the current weather for a city."""
    return f"It's sunny and 22°C in {city}."

agent = create_agent(
    model="openai:gpt-4o-mini",
    tools=[get_weather],
    system_prompt="You are a helpful assistant. Be concise.",
)

result = agent.invoke({
    "messages": [{"role": "user", "content": "What's the weather in Lisbon?"}]
})
print(result["messages"][-1].content)
```

The `model` argument takes a `"provider:model-name"` string — `create_agent` resolves the provider and credentials for you, reading the relevant API key from your environment (`OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, and so on). `tools` is a list of plain Python functions; a clear docstring on each one becomes part of what the model reads to decide when to call it.

Internally, `create_agent` builds exactly the loop you implemented by hand in Lesson 15 — call the model, check whether it asked to call a tool, run the tool, feed the result back, repeat until the model returns a final answer. The difference is that loop, plus error handling, retries, and streaming support, now ships as one function call.

## Tools: the `@tool` decorator and `ToolRuntime` {#tools}

The `@tool` decorator turns a typed Python function into something the agent can call, using the function's type hints and docstring to build the schema the model sees:

```python
from langchain.tools import tool

@tool
def search_orders(customer_id: str, status: str = "all") -> str:
    """Look up a customer's orders, optionally filtered by status.

    Args:
        customer_id: The customer's unique ID
        status: Filter by order status — "pending", "shipped", or "all"
    """
    return f"3 orders found for {customer_id} with status={status}"
```

Type hints are required — they define the schema the model uses to decide what arguments to pass. Most tools you write will look exactly like this.

Some tools need more than their declared arguments — they need to read the conversation so far, know who the current user is, or write to persistent storage. For that, add a `ToolRuntime` parameter. It's automatically injected and invisible to the model — the LLM never sees it in the tool's schema, so it can't (and doesn't need to) try to fill it in:

```python
from dataclasses import dataclass
from langchain.tools import tool, ToolRuntime

@dataclass
class UserContext:
    user_id: str

@tool
def get_account_balance(runtime: ToolRuntime[UserContext]) -> str:
    """Get the current user's account balance."""
    user_id = runtime.context.user_id
    return f"Balance for {user_id}: $1,204.50"
```

`runtime.context` holds immutable per-run data you pass in at invocation time (like a user ID). `runtime.state` holds the conversation's short-term memory. `runtime.store` holds long-term memory that survives across conversations — covered next.

## Middleware — customizing the agent loop {#middleware}

Middleware is LangChain 1.0's answer to "I need to change how the agent loop behaves, without rewriting the loop." It works like middleware in a web framework — Express or Django — intercepting a request on the way in and the response on the way out. In an agent, the "request" is a call to the model, and middleware can hook in at three points:

- **`before_model`** — runs before each model call; can inspect or modify state, or skip straight to a different step
- **`after_model`** — runs after each model call; can inspect or modify the model's response before the loop continues
- **`modify_model_request`** — runs just before the call, letting you change the prompt, the tool list, or the model itself for that one call

LangChain ships prebuilt middleware for common needs — summarizing long conversation history, requiring human approval before a tool runs, retrying a failed tool call automatically. You attach middleware as a list:

```python
from langchain.agents import create_agent
from langchain.agents.middleware import SummarizationMiddleware

agent = create_agent(
    model="openai:gpt-4o-mini",
    tools=[get_weather],
    middleware=[
        SummarizationMiddleware(
            model="openai:gpt-4o-mini",
            max_tokens_before_summary=4000,
        ),
    ],
)
```

This agent automatically compresses old conversation history into a summary once the thread passes 4,000 tokens, instead of letting the context window fill up and the model start "forgetting" early messages. Without middleware, you'd have to write that truncation logic yourself, inside your own loop — which is exactly the kind of hand-rolled plumbing a framework exists to remove.

## Memory: short-term and long-term {#memory}

An agent with no memory forgets everything the moment `invoke` returns. LangChain distinguishes two kinds of memory, matching the **State** vs. **Store** distinction from `ToolRuntime` above:

**Short-term memory** (a `checkpointer`) persists the conversation within one thread — the back-and-forth of a single chat session:

```python
from langchain.agents import create_agent
from langgraph.checkpoint.memory import InMemorySaver

agent = create_agent(
    model="openai:gpt-4o-mini",
    tools=[get_weather],
    checkpointer=InMemorySaver(),
)

config = {"configurable": {"thread_id": "session-1"}}

agent.invoke({"messages": [{"role": "user", "content": "My name is Priya."}]}, config)
result = agent.invoke({"messages": [{"role": "user", "content": "What's my name?"}]}, config)
print(result["messages"][-1].content)  # "Your name is Priya."
```

The `thread_id` is what ties two separate `invoke` calls into one remembered conversation. `InMemorySaver` is for development; production systems use a database-backed checkpointer instead, so a thread survives a server restart.

**Long-term memory** (a `store`) persists data *across* threads — a user's preferences remembered weeks later, in a different conversation entirely. Tools read and write it through `runtime.store`, as shown in the previous section. Use short-term memory for "remember this conversation"; use long-term memory for "remember this user."

## LCEL: the older composition style {#lcel}

Before `create_agent` existed, LangChain's main composition tool was **LCEL** (LangChain Expression Language) — chaining components with the `|` (pipe) operator:

```python
from langchain_openai import ChatOpenAI
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.output_parsers import StrOutputParser

llm = ChatOpenAI(model="gpt-4o-mini")
prompt = ChatPromptTemplate.from_messages([("user", "Summarise in one sentence: {text}")])

chain = prompt | llm | StrOutputParser()
result = chain.invoke({"text": "A long article about vector databases..."})
```

You'll still see LCEL in older tutorials, existing codebases, and anywhere you need a simple, fixed, linear pipeline with no tool calls or branching — it's still a fine choice for that narrow case. But for anything agentic — a model deciding what to do next, calling tools, looping — `create_agent` is the current, idiomatic way to build it. Don't reach for LCEL chains to build an agent; that's what the rest of this lesson is for.

## When to use LangChain vs PydanticAI vs raw API {#when-langchain}

| Situation | Recommendation |
|---|---|
| Need a working tool-using agent fast | LangChain — `create_agent` in under 10 lines |
| Strict typed input/output validation matters most | PydanticAI (Lesson 16) — typed by design |
| Need total control over every token, or maximum debuggability | Raw API (Lesson 15) |
| Need branching, durable execution, or fine-grained state control | LangGraph (next lesson) — what's running underneath LangChain anyway |
| Simple linear pipeline, no tools, no branching | LCEL, or even just a direct API call |

<div class="callout info">
<strong>Career note:</strong> LangChain remains the framework most commonly named in 2026 AI Engineering job postings. Knowing the current <code>create_agent</code> + middleware model — not the 2023-era chain classes — is what separates a candidate who's kept current from one repeating outdated tutorials.
</div>
