---
layout: lesson
lesson_id: "0051"
chapter: 2
chapter_title: "AI System Design"
title: "CrewAI — role-based multi-agent coordination"
description: "30–40 min read · Hands-on coding"
prev: "0050-langgraph.html"
prev_title: "LangGraph — the agent runtime"
next: "0048-n8n-zapier.html"
next_title: "Visual AI workflows — n8n and Zapier"
prereqs:
  - "[Lesson 50](0050-langgraph.html): LangGraph — you'll contrast its graph model against CrewAI's role-based model directly"
  - "[Lesson 17](0017-langchain.html): LangChain — CrewAI sits at the same framework tier, specialised for multi-agent teams"
  - "Install: `uv add crewai crewai-tools`"
assignment:
  article:
    title: "CrewAI: A Practical Guide to Role-Based Agent Orchestration"
    url: "https://www.digitalocean.com/community/tutorials/crewai-crash-course-role-based-agent-orchestration"
    author: "DigitalOcean Community Tutorials"
    time: "about 15 minutes"
    why: "A practitioner-written crash course that goes from 'hello world' to a working multi-agent crew, with the same hands-on framing as this lesson — worth reading because it shows the role-based mental model applied to a different example than the one below."
  task:
    description: "Build a two-agent CrewAI crew that researches and writes a short brief on any topic."
    steps:
      - "Define a `Researcher` agent (role, goal, backstory) and a `Writer` agent"
      - "Define a `research_task` assigned to the researcher and a `write_task` assigned to the writer, with `context=[research_task]` so the writer receives the researcher's output"
      - "Assemble a `Crew` with `Process.sequential` and call `kickoff()`"
      - "Run it once, then add `verbose=True` to both agents and run again — read the intermediate reasoning each agent produces before its final output"
    expected: "A ~150-word brief produced by the writer, visibly built on top of the researcher's output, plus a transcript of each agent's intermediate reasoning when verbose."
    why: "Watching the verbose trace is the fastest way to see what 'role-based coordination' actually looks like at runtime — each agent reasoning inside its own role, not just outputting a final answer."
knowledge_check:
  - q: "What are the three building blocks of every CrewAI workflow, and what does each one do?"
    a: "**Agent** — an LLM configured with a role, a goal, and a backstory; the backstory shapes how the agent approaches problems, like a system prompt CrewAI manages for you. **Task** — a specific piece of work with a description and expected output, assigned to an agent. **Crew** — the orchestrator: a list of agents, a list of tasks, and a process defining how they collaborate."
    section: "#building-blocks"
    section_title: "Agent, Task, and Crew"
  - q: "What's the difference between `Process.sequential` and `Process.hierarchical`?"
    a: "`Process.sequential` runs each task in order, passing each task's output forward to the next. `Process.hierarchical` adds a manager agent (or `manager_llm`) that dynamically assigns tasks to specialist agents at runtime, the way a project manager delegates work — useful when the right agent for a task isn't known in advance."
    section: "#processes"
    section_title: "Sequential vs hierarchical process"
  - q: "Your workflow has agents with genuinely distinct specialist roles (a researcher, a critic, a writer) that hand off work in a fairly fixed order. Would CrewAI or LangGraph be the more natural fit, and why?"
    a: "CrewAI. Its role-based model maps directly onto that team structure — `context=[...]` handles handoff between agents without you writing state-passing code. LangGraph would still work, but you'd be hand-building the same researcher → critic → writer flow as nodes and edges; reach for LangGraph instead when you need precise control over retries, branching, or durable execution that CrewAI's higher-level model doesn't expose."
    section: "#vs-langgraph"
    section_title: "CrewAI vs LangGraph for multi-agent systems"
  - q: "What problem does Composio solve that CrewAI's or LangChain's own tool systems don't?"
    a: "Composio is a connector framework that gives agents authenticated access to real external services — GitHub, Slack, Notion, Gmail — without you writing OAuth flows and API wrappers by hand. CrewAI's built-in tools and LangChain's `@tool` decorator make it easy to *define* a tool; Composio makes it fast to *connect* to a production SaaS product, and works as a tool source for either framework."
    section: "#composio"
    section_title: "Composio — connectors across frameworks"
additional_resources:
  - title: "CrewAI documentation"
    url: "https://docs.crewai.com/"
    desc: "Full reference for agents, tasks, tools, processes, memory, and flows"
  - title: "CrewAI Tools"
    url: "https://github.com/crewAIInc/crewAI-tools"
    desc: "The full library of prebuilt tools — search, scraping, file access, and more"
  - title: "Composio documentation"
    url: "https://docs.composio.dev/"
    desc: "Full reference for the 1000+ connector library and authentication handling"
---

## Motivation

A customer-support pipeline that triages a ticket, researches the account history, drafts a reply, and has a second agent check tone before sending — that's not one agent calling tools, it's a small team with distinct jobs. **CrewAI** is the framework purpose-built for that shape of problem: agents with roles, the way a real team has roles, collaborating on a shared goal. It's increasingly common in interview conversations and production stacks alongside LangChain and LangGraph, and you'll close this lesson — and this three-lesson arc — knowing exactly when to reach for it over the other two.

{% include prereqs.html %}

## CrewAI — modeling a workflow as a team {#what-is-crewai}

**CrewAI** is a framework — the same tier as LangChain (Lesson 17), not the runtime tier LangGraph (Lesson 50) occupies. Where LangGraph models your workflow as a graph of states and transitions, CrewAI models it as a team of people with jobs to do. Both can build a multi-agent system; they just start from a different mental model, and that difference shapes which one fits a given problem more naturally.

## Agent, Task, and Crew {#building-blocks}

Every CrewAI workflow is built from three pieces:

1. **Agent** — a configured LLM with a role, a goal, and a backstory. The backstory shapes how the agent approaches problems — think of it as a system prompt that CrewAI writes and manages for you.
2. **Task** — a specific piece of work with a description and an expected output format, assigned to an agent.
3. **Crew** — the team: a list of agents, a list of tasks, and a process defining how they collaborate.

```python
from crewai import Agent, Task, Crew, Process

# ── Agents ────────────────────────────────────────────────────────────
researcher = Agent(
    role="Research Analyst",
    goal="Gather and synthesise accurate information on any topic",
    backstory=(
        "You are a meticulous analyst who structures findings clearly "
        "and always flags gaps in the available information."
    ),
    llm="gpt-4o-mini",
    verbose=False,
)

writer = Agent(
    role="Technical Writer",
    goal="Transform research findings into clear, developer-friendly summaries",
    backstory="You write concise summaries that a developer can act on in two minutes.",
    llm="gpt-4o-mini",
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

The `context=[research_task]` parameter is how agents share results — the writer automatically receives everything the researcher produced, without you writing any state-passing code. This is CrewAI's signature convenience: agent-to-agent handoff is handled by the framework, not by you.

## Sequential vs hierarchical process {#processes}

A `Crew`'s `process` decides how tasks move between agents:

- **`Process.sequential`** (used above) — each task completes in order, with its output available to the next.
- **`Process.hierarchical`** — a manager agent dynamically assigns tasks to specialist agents at runtime, the way a project manager delegates work, rather than following a fixed order:

```python
manager = Agent(
    role="Project Manager",
    goal="Coordinate the team and ensure the final report meets the brief",
    backstory="An experienced manager skilled at delegation and quality control.",
    allow_delegation=True,
)

crew = Crew(
    agents=[manager, researcher, writer],
    tasks=[research_task, write_task],
    process=Process.hierarchical,
    manager_llm="gpt-4o-mini",
)
```

Use `sequential` when the order of work is known in advance — research, then write, then review. Reach for `hierarchical` when the right agent for a given task should be decided dynamically, not hard-coded into task order.

## CrewAI vs LangGraph for multi-agent systems {#vs-langgraph}

Both frameworks can coordinate multiple agents — the choice comes down to which mental model fits your problem, and how much control you need over the mechanics of collaboration.

Choose **CrewAI** when you have distinct specialist roles that naturally hand off work — a researcher, a critic, a writer, a planner. The role-based model maps directly onto real team structures, and `context=[...]` removes the need to write state-passing logic by hand.

Choose **LangGraph** when you need precise control over branching, retries, and state at the level of individual transitions. CrewAI is harder to customise at the loop level — you're working within its process abstraction. LangGraph gives full visibility into every node and edge, at the cost of writing more of the coordination logic yourself.

A useful rule of thumb from production teams: in a LangGraph workflow, a routing decision can be a pure Python function costing zero extra tokens. In CrewAI, delegation between agents typically triggers an LLM call. That makes CrewAI faster to build and reason about, but LangGraph cheaper and more predictable to run at scale.

## Built-in tools {#tools}

CrewAI ships a library of prebuilt tools through the separate `crewai_tools` package, so common integrations don't need to be written from scratch:

```python
from crewai_tools import SerperDevTool, FileReadTool, ScrapeWebsiteTool

search_tool = SerperDevTool()                        # web search (requires a Serper API key)
file_tool = FileReadTool(file_path="./data/report.txt")  # read a local file
scrape_tool = ScrapeWebsiteTool()                     # scrape and return a URL's text content

researcher = Agent(
    role="Researcher",
    goal="Find accurate information on the given topic",
    tools=[search_tool, scrape_tool],
    llm="gpt-4o-mini",
)
```

Tools are assigned to individual agents, not the crew as a whole — each agent only sees the tools relevant to its role, which keeps its decision-making focused.

## Composio — connectors across frameworks {#composio}

[Composio](https://composio.dev) is a connector framework that gives agents access to real external services — GitHub, Notion, Slack, Gmail, Linear, and hundreds more — through a single, authentication-managed interface. Instead of writing OAuth flows and API wrappers yourself, you install a connector and hand it to your agent as a tool:

```python
from composio_langchain import ComposioToolSet, Action

toolset = ComposioToolSet()
github_tools = toolset.get_tools(actions=[
    Action.GITHUB_CREATE_ISSUE,
    Action.GITHUB_LIST_PULL_REQUESTS,
])

# These tools work as ordinary tools in either framework — CrewAI or LangChain
agent = Agent(role="Release Manager", goal="Triage open PRs", tools=github_tools, llm="gpt-4o-mini")
```

Composio handles authentication once (via `composio login`), then every agent in your system — built with CrewAI, LangChain, or both — can use those connectors without storing tokens in your code.

**When Composio earns its place:** an assistant that takes real actions across SaaS products — creating a GitHub issue, sending a Slack message, updating a Notion page. For pure data-retrieval tools like web search, rolling your own with `ddgs` (Lesson 12) is simpler and has no extra dependency.

## Choosing your orchestration stack {#choosing-your-stack}

You now know five ways to build an LLM-powered system, in increasing order of how much structure they hand you:

| Situation | Recommendation |
|---|---|
| Need total control, or maximum debuggability | Raw API (Lesson 15) |
| Strict typed input/output validation matters most | PydanticAI (Lesson 16) |
| Need a working tool-using agent fast, with room to grow | LangChain (Lesson 17) |
| Need branching, durable execution, or fine-grained state | LangGraph (Lesson 50) |
| Multi-agent team with distinct, naturally-handing-off roles | CrewAI (this lesson) |

These aren't mutually exclusive in a real system — a production app might use LangChain's `create_agent` for one component, drop to LangGraph for a step that needs durable execution, and use CrewAI for a research sub-team, all behind the same API.

<div class="callout info">
<strong>Career note:</strong> CrewAI now appears in roughly a third of LangGraph-adjacent job listings — stronger co-occurrence than LangChain alone — which signals teams increasingly pair a runtime (LangGraph) with a role-based framework (CrewAI) rather than picking one. Knowing all three, and being able to justify the choice for a given problem, is what 2026 AI Engineering interviews actually probe for.
</div>
