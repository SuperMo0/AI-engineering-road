---
layout: lesson
lesson_id: "0014"
chapter: 2
chapter_title: "AI System Design"
title: "Agentic loops — letting the LLM decide what to do next"
description: "35–45 min read · Hands-on coding"
prev: "0013-evaluator-router.html"
prev_title: "Evaluator-optimizer and LLM routers"
next: "P004-document-pipeline.html"
next_title: "Project: Document pipeline"
prereqs:
  - "[Lesson 12](0012-tool-calling.html): the two-phase tool call exchange — the agentic loop extends this pattern"
  - "[Lesson 11](0011-llm-chaining.html): chaining — you need to understand what an agent replaces and when"
assignment:
  article:
    title: "Building Effective Agents"
    url: "https://www.anthropic.com/engineering/building-effective-agents"
    author: "Anthropic Engineering blog"
    time: "about 20 minutes (full article)"
    why: "The most practically useful article on agent architecture from a team that ships agents in production. Covers when agents are appropriate, how to design tool sets, and the failure modes to anticipate. Everything in this lesson is expanded here with real examples."
  task:
    description: "Build a research agent that answers multi-hop questions."
    steps:
      - "Use the `run_agent()` function from this lesson as the core loop"
      - "Give it three tools: `search_web(query)` (mock or real with Tavily/DuckDuckGo), `calculate(expression)`, `get_current_date()`"
      - "Test with three multi-hop questions of increasing complexity"
      - "Log each iteration: print iteration number, which tool was called, and the result length"
      - "Verify the iteration limit triggers correctly by setting it to 2 and asking a complex question"
    expected: "A final answer to each question, plus an iteration log showing the model's reasoning path."
    why: "Seeing the iteration log is the most educational part — it shows you exactly how the model reasons through a multi-step problem, which builds intuition for when agents help vs hurt."
knowledge_check:
  - q: "What is the stopping condition in a ReAct agent loop?"
    a: "When the model's response contains no tool calls — `message.tool_calls` is empty or None. This signals that the model has gathered enough information and is ready to produce a final answer. The loop exits and returns `message.content`."
    section: "#react"
    section_title: "The ReAct pattern"
  - q: "Name three safety mechanisms every production agent should have."
    a: "Any three of: maximum iteration count, maximum token/cost budget per run, wall-clock timeout, tool execution sandboxing (especially for code execution tools). These prevent runaway loops and limit the blast radius of agent misbehaviour."
    section: "#stopping-conditions"
    section_title: "Stopping conditions and safety"
  - q: "When should you use a chain instead of an agent?"
    a: "When you can predict the sequence of steps before running the code. If you can write the steps on a whiteboard — extract → assess → summarise — use a chain. Use an agent only when the steps depend on what the model discovers along the way and cannot be determined in advance."
    section: "#when-not-agent"
    section_title: "When NOT to use an agent"
additional_resources:
  - title: "LLM Powered Autonomous Agents"
    url: "https://lilianweng.github.io/posts/2023-06-23-agent/"
    desc: "Deep technical background on the ReAct paper, memory systems, and planning approaches"
---

## Motivation

In chaining (Lesson 11), you decide the sequence of steps in advance. In tool calling (Lesson 12), the model decides which tool to call — but you still control when the loop ends. An **agentic loop** removes that control entirely: the model decides what to do at each step, takes actions, observes the results, and continues until it decides the task is complete.

This is what separates an "AI assistant that can use tools" from an "AI agent". Agents are powerful — and genuinely harder to control. This lesson teaches both the pattern and the safety mechanisms that make it production-safe.

{% include prereqs.html %}

## Agent vs chain: the key distinction {#agent-vs-chain}

In a **chain**, you decide the steps: extract → assess → summarise. The model executes each step and produces the typed output you requested. The flow is fixed.

In an **agent**, the model decides the steps. You give it a goal ("research the market size of the EV battery industry") and a set of tools. It chooses which tools to call, in what order, how many times, based on what it observes. You do not know in advance whether it will search once or ten times, or call the calculator, or ask for clarification.

| | Chain | Agent |
|---|---|---|
| Step sequence | Fixed by you | Decided by the LLM |
| Number of LLM calls | Known in advance | Variable — 1 to N |
| Failure mode | One bad step fails clearly | Can loop indefinitely or go off-track |
| Best for | Well-defined, stable pipelines | Open-ended tasks, exploration |

Use an agent only when the task is genuinely open-ended and chaining cannot handle it. Most production problems are solved by chains.

## The ReAct pattern: Reason → Act → Observe → Repeat {#react}

The dominant pattern for agentic loops is **ReAct** (Reasoning + Acting), introduced in a 2022 research paper. The model alternates between:

1. **Reason** — the model thinks about what to do next (often done internally; with chain-of-thought prompting you can make it explicit)
2. **Act** — the model calls a tool or produces a final answer
3. **Observe** — the tool result is returned to the model as a message
4. **Repeat** — the model reasons again given the new information

The loop exits when the model produces a response without a tool call — that is the model signalling "I have enough information, here is my answer."

```text
Iteration 1:
  Reason: "I need to know the current date to answer."
  Act:    tool_call get_current_date()
  Observe: "2026-06-24"

Iteration 2:
  Reason: "Now I need to search for recent EV market data."
  Act:    tool_call search_web("EV battery market size 2026")
  Observe: "[search results...]"

Iteration 3:
  Reason: "I have enough information. I'll synthesise and answer."
  Act:    (no tool call — final text response)
  → Loop exits
```

## Implementing a ReAct agent {#implementing-agent}

The implementation is an extension of the tool calling pattern from Lesson 12 — the main addition is the loop and the stopping conditions:

```python
import json
import os
from dotenv import load_dotenv
from openai import OpenAI

load_dotenv()
client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))

MAX_ITERATIONS = 10   # safety limit

def run_agent(goal: str, tools: list, execute_tool_fn) -> str:
    """
    Run a ReAct agent until it produces a final answer or hits the iteration limit.
    """
    messages = [
        {
            "role": "system",
            "content": (
                "You are a helpful agent. Use the tools available to accomplish the user's goal. "
                "When you have gathered enough information, produce a final answer without calling any tools."
            ),
        },
        {"role": "user", "content": goal},
    ]

    for iteration in range(MAX_ITERATIONS):
        response = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=messages,
            tools=tools,
        )
        msg = response.choices[0].message

        # Stopping condition: no tool calls = final answer
        if not msg.tool_calls:
            return msg.content

        # Execute all requested tools and collect results
        messages.append(msg)
        for tool_call in msg.tool_calls:
            result = execute_tool_fn(tool_call)
            messages.append({
                "role": "tool",
                "tool_call_id": tool_call.id,
                "content": result,
            })

    # Iteration limit reached — return whatever the model says now
    final = client.chat.completions.create(
        model="gpt-4o-mini",
        messages=messages + [{
            "role": "user",
            "content": "You have reached the iteration limit. Summarise what you found so far."
        }],
    )
    return f"[Iteration limit reached]\n{final.choices[0].message.content}"
```

## Stopping conditions and safety {#stopping-conditions}

An agent without stopping conditions is a bug waiting to happen. In the worst case, a misbehaving agent loops indefinitely, making hundreds of API calls and costing hundreds of dollars. Production agents always enforce multiple stopping conditions:

### 1. Maximum iterations

The simplest safety: count iterations and stop after N. Most tasks complete in 3–5 iterations. Set your limit at 10–15 and treat hitting it as an error condition to log and investigate.

### 2. Maximum cost

Track token usage across all iterations. If accumulated cost exceeds a per-run budget, abort and surface the partial result.

```python
total_tokens = 0
MAX_TOKENS = 50_000

# In the loop:
total_tokens += response.usage.total_tokens
if total_tokens > MAX_TOKENS:
    return "[Budget exceeded]"
```

### 3. Timeout

For user-facing agents, a hard wall-clock timeout prevents the user waiting indefinitely:

```python
import time
start = time.time()
MAX_SECONDS = 60

# In the loop:
if time.time() - start > MAX_SECONDS:
    return "[Timeout]"
```

### 4. Tool execution sandboxing

If you give an agent a `run_python(code)` tool, the code it runs can do anything your process can do — delete files, make network calls, exfiltrate data. Tools that execute arbitrary code must run in a sandboxed subprocess or container with restricted permissions. Never give an agent unrestricted code execution in production.

## When NOT to use an agent {#when-not-agent}

The allure of agents is strong — they feel like the most "AI" thing you can build. But they carry real costs:

- **Unpredictable latency:** 3 iterations = 3–15 seconds; 10 iterations = 10–50 seconds
- **Compounding errors:** a bad decision in iteration 2 poisons iterations 3–10
- **Hard to test:** non-deterministic sequences are difficult to write assertions for
- **Hard to debug:** "why did it call that tool four times?" requires inspecting full message history

Replace an agent with a chain whenever the sequence of steps is predictable. Reserve agents for tasks that are genuinely open-ended — where the right sequence of steps cannot be known until the task is partially done.

<div class="callout warn">
<strong>Rule of thumb:</strong> If you can write the steps on a whiteboard before running the code, use a chain. If you genuinely cannot predict the steps because they depend on what the model discovers along the way, use an agent.
</div>
