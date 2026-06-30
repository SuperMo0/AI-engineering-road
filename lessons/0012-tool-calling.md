---
layout: lesson
lesson_id: "0012"
chapter: 2
chapter_title: "AI System Design"
title: "Tool calling — giving your LLM hands"
description: "35–45 min read · Hands-on coding"
prev: "0011-llm-chaining.html"
prev_title: "LLM call chaining and parallelization"
next: "0013-evaluator-router.html"
next_title: "Evaluator-optimizer and LLM routers"
prereqs:
  - "[Lesson 2](0002-openai-api-basics.html): the messages list, reading responses"
  - "[Lesson 3](0003-chat-and-history.html): appending messages to history — tool calling extends this pattern"
  - "[Lesson 4](0004-structured-outputs.html): Pydantic models — tool arguments use the same schema approach"
assignment:
  article:
    title: "Building Effective Agents"
    url: "https://www.anthropic.com/engineering/building-effective-agents"
    author: "Anthropic"
    time: "about 10 minutes (read only the \"Tool Use\" section)"
    why: "Anthropic's production perspective on tool design: how to write good tool descriptions, how to scope tools so the model uses them correctly, and common tool design mistakes. Directly applicable to the project below."
  task:
    description: "Add real tool calling to your CLI assistant from Project 1."
    steps:
      - "Define three tools using Pydantic schemas: `get_current_datetime()`, `calculate(expression)`, and `read_file(path)` (reads a file from disk and returns its content)"
      - "Implement the two-phase tool loop in the assistant's `complete()` method"
      - "Test: ask \"What time is it?\", \"What is 17 * 83?\", and \"Read the contents of my .env.example file\""
      - "Make sure the loop handles parallel tool calls (model requests two at once)"
    expected: "The assistant accurately answers all three questions using its tools."
    why: "Adding tools to an existing assistant reinforces the two-phase pattern, and reading files is a real capability that makes your assistant genuinely useful."
knowledge_check:
  - q: "Does the LLM execute tools itself? Explain what actually happens."
    a: "No. The LLM has no access to your filesystem, network, or anything outside the API. It only decides which tool to call and what arguments to use, then tells your code via `message.tool_calls`. Your code executes the real function and sends the result back in a second API call. The LLM only sees the result as a message."
    section: "#how-it-works"
    section_title: "How tool calling works"
  - q: "What two messages do you append to the conversation after executing a tool call?"
    a: "1. The assistant message that contained the tool call — the full `message` object from phase 1. 2. A `\"tool\"` role message with the `tool_call_id` and the result string. The ID ties the result back to the specific tool call request."
    section: "#executing-tools"
    section_title: "Executing the tool and returning the result"
  - q: "Why is the tool description more important than the parameter schema?"
    a: "The model uses the description to decide when and why to call the tool. A vague description (\"get data\") will cause the model to use the tool at the wrong time or not at all. The parameter schema tells it what to pass, but the description tells it whether to call it in the first place. Good descriptions include the trigger condition: \"Call this when the user asks about…\""
    section: "#defining-tools"
    section_title: "Defining tools"
additional_resources:
  - title: "OpenAI: Function calling guide"
    url: "https://platform.openai.com/docs/guides/function-calling"
    desc: "Full reference including `tool_choice` forcing, strict mode, and structured outputs with tools"
  - title: "Anthropic: Tool use"
    url: "https://docs.anthropic.com/en/docs/build-with-claude/tool-use"
    desc: "Claude's tool calling API; the request/response format differs from OpenAI's but the concept is identical"
  - title: "Tool Calls with the Vercel AI SDK"
    url: "https://www.aihero.dev/vercel-ai-sdk-tutorial"
    desc: "How the Vercel AI SDK (TypeScript) handles tool definitions and execution — parallel to the Python patterns in this lesson"
---

## Motivation

So far, LLMs in this curriculum have only talked — they read text and produced text. But most real tasks require doing: look up a customer's order, search the web, run a calculation, write a file. Tool calling is the API feature that gives an LLM the ability to take actions in the world — or more precisely, to tell your code what actions to take on its behalf.

Tool calling is the foundation of every agent you will ever build. Understanding how it works at the API level — not just how a framework wraps it — is one of the most important skills in this curriculum.

{% include prereqs.html %}

## How tool calling works {#how-it-works}

The key insight: the LLM never executes a tool. It cannot — it has no access to your filesystem, your database, or the internet. What it does is *decide* which tool to call and with what arguments, then tells you. Your code reads that decision, executes the real function, and sends the result back so the model can continue.

The two-phase exchange looks like this:

```text
Phase 1: You → API
  messages: [{"role": "user", "content": "What's the weather in Paris?"}]
  tools: [definition of get_weather function]

Phase 1: API → You
  message.tool_calls: [{"name": "get_weather", "arguments": {"city": "Paris"}}]
  (no text reply yet — the model is waiting for the tool result)

Your code: actually call get_weather("Paris") → "15°C, partly cloudy"

Phase 2: You → API
  messages: [original messages] + [tool call message] + [tool result message]

Phase 2: API → You
  message.content: "The weather in Paris is currently 15°C and partly cloudy."
```

This two-phase pattern is the foundation of every agent in this curriculum.

## Defining tools {#defining-tools}

Tools are described to the API as JSON Schema objects — a specification of the function's name, description, and parameters. The description is critical: it tells the model when and why to use the tool.

```python
tools = [
    {
        "type": "function",
        "function": {
            "name": "get_weather",
            "description": "Get the current weather for a city. Call this when the user asks about weather conditions.",
            "parameters": {
                "type": "object",
                "properties": {
                    "city": {
                        "type": "string",
                        "description": "The city name, e.g. 'Paris' or 'New York'"
                    },
                    "unit": {
                        "type": "string",
                        "enum": ["celsius", "fahrenheit"],
                        "description": "Temperature unit. Default to celsius unless asked otherwise."
                    }
                },
                "required": ["city"]
            }
        }
    }
]
```

The `"required"` list tells the model which parameters it must always provide. Optional parameters (like `unit` above) can be omitted and you handle the default in your code.

### Generating tool definitions from Pydantic

Writing JSON Schema by hand is tedious and error-prone. The `openai` package provides a helper that generates a tool definition from a Pydantic model — the same pattern you already know:

```python
from pydantic import BaseModel, Field
import openai

class GetWeatherArgs(BaseModel):
    city: str = Field(description="The city name, e.g. 'Paris'")
    unit: str = Field(default="celsius", description="Temperature unit: celsius or fahrenheit")

# openai SDK helper (v1.x):
tool = openai.pydantic_function_tool(GetWeatherArgs, name="get_weather",
    description="Get current weather for a city.")
```

`pydantic_function_tool()` produces a correctly formatted tool definition from the Pydantic model's schema. Use this approach — it is less error-prone than writing the schema by hand.

## Making the tool-enabled API call {#making-the-call}

Pass the tools list to `client.chat.completions.create()` as the `tools` parameter:

```python
response = client.chat.completions.create(
    model="gpt-4o-mini",
    messages=[{"role": "user", "content": "What's the weather in Paris?"}],
    tools=tools,
)
```

The model responds in one of two ways:

- **Tool call:** `response.choices[0].message.tool_calls` is a non-empty list — the model wants you to run a tool
- **Direct reply:** `response.choices[0].message.content` is a string — the model answered without needing a tool

```python
message = response.choices[0].message

if message.tool_calls:
    tool_call = message.tool_calls[0]
    print(f"Model wants to call: {tool_call.function.name}")
    print(f"With args: {tool_call.function.arguments}")  # JSON string
else:
    print(f"Direct reply: {message.content}")
```

## Executing the tool and returning the result {#executing-tools}

When `message.tool_calls` is not empty, your code executes the function and sends the result back in a second API call. Two messages are added to the history:

1. The assistant message that contains the tool call (from phase 1)
2. A `"tool"` role message with the result

```python
import json

def execute_tool(tool_call) -> str:
    """Dispatch to the right function and return its result as a string."""
    name = tool_call.function.name
    args = json.loads(tool_call.function.arguments)

    if name == "get_weather":
        return get_weather(**args)   # your real function
    raise ValueError(f"Unknown tool: {name}")

# Full two-phase exchange:
messages = [{"role": "user", "content": "What's the weather in Paris?"}]

# Phase 1
response = client.chat.completions.create(
    model="gpt-4o-mini", messages=messages, tools=tools
)
assistant_message = response.choices[0].message

if assistant_message.tool_calls:
    tool_call = assistant_message.tool_calls[0]
    result = execute_tool(tool_call)

    # Append phase 1 result to history
    messages.append(assistant_message)      # the tool-call decision
    messages.append({
        "role": "tool",
        "tool_call_id": tool_call.id,
        "content": result,                  # the result string
    })

    # Phase 2 — model sees the result and produces a reply
    final_response = client.chat.completions.create(
        model="gpt-4o-mini", messages=messages, tools=tools
    )
    print(final_response.choices[0].message.content)
else:
    print(assistant_message.content)
```

The `tool_call_id` in the tool result message ties it back to the specific tool call from phase 1. This matters when the model calls multiple tools at once (parallel tool calling — covered next).

## Parallel tool calls {#parallel-tool-calls}

The model can request multiple tool calls in a single response — for example, asking for the weather in both Paris and Tokyo at the same time. When this happens, `message.tool_calls` contains more than one item.

Execute all tool calls (in parallel if you like) and add one `"tool"` message per call, matching each by `tool_call_id`:

```python
if assistant_message.tool_calls:
    messages.append(assistant_message)

    # Execute all requested tool calls
    for tool_call in assistant_message.tool_calls:
        result = execute_tool(tool_call)
        messages.append({
            "role": "tool",
            "tool_call_id": tool_call.id,
            "content": result,
        })

    # Phase 2 with all results
    final_response = client.chat.completions.create(
        model="gpt-4o-mini", messages=messages, tools=tools
    )
    print(final_response.choices[0].message.content)
```

## Complete example: a research assistant with tools {#complete-example}

Here is a complete, runnable assistant with three tools — web search (mocked), calculator, and current date. The `execute_tool` dispatcher pattern scales cleanly:

```python
import json
import os
import datetime
from dotenv import load_dotenv
from openai import OpenAI
import openai
from pydantic import BaseModel, Field
from ddgs import DDGS

load_dotenv()
client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))

# ── Tool implementations ──────────────────────────────────────
def search_web(query: str, max_results: int = 5) -> str:
    with DDGS() as ddgs:
        results = list(ddgs.text(query, max_results=max_results))
    if not results:
        return "No results found."
    lines = [f"Title: {r['title']}\nURL: {r['href']}\nSnippet: {r['body']}" for r in results]
    return "\n\n".join(lines)

def calculate(expression: str) -> str:
    try:
        result = eval(expression, {"__builtins__": {}})
        return str(result)
    except Exception as e:
        return f"Error: {e}"

def get_current_date() -> str:
    return datetime.date.today().isoformat()

# ── Tool argument schemas ─────────────────────────────────────
class SearchArgs(BaseModel):
    query: str = Field(description="The search query")

class CalculateArgs(BaseModel):
    expression: str = Field(description="A safe arithmetic expression, e.g. '2 + 2 * 10'")

# ── Tool registry ─────────────────────────────────────────────
TOOLS = [
    openai.pydantic_function_tool(SearchArgs, name="search_web",
        description="Search the web for current information."),
    openai.pydantic_function_tool(CalculateArgs, name="calculate",
        description="Evaluate an arithmetic expression. Use for any maths."),
    {"type": "function", "function": {
        "name": "get_current_date",
        "description": "Get today's date in ISO format.",
        "parameters": {"type": "object", "properties": {}, "required": []}
    }},
]

def execute_tool(tool_call) -> str:
    name = tool_call.function.name
    args = json.loads(tool_call.function.arguments)
    if name == "search_web":        return search_web(**args)
    if name == "calculate":         return calculate(**args)
    if name == "get_current_date":  return get_current_date()
    raise ValueError(f"Unknown tool: {name}")

def ask(question: str) -> str:
    messages = [
        {"role": "system", "content": "You are a helpful research assistant. Use tools when needed."},
        {"role": "user",   "content": question},
    ]
    while True:
        response = client.chat.completions.create(
            model="gpt-4o-mini", messages=messages, tools=TOOLS
        )
        msg = response.choices[0].message
        if not msg.tool_calls:
            return msg.content      # final answer

        # Execute all requested tools
        messages.append(msg)
        for tc in msg.tool_calls:
            messages.append({
                "role": "tool",
                "tool_call_id": tc.id,
                "content": execute_tool(tc),
            })
        # Loop back — model will incorporate results and may call more tools

if __name__ == "__main__":
    print(ask("What is 1234 * 5678, and what is today's date?"))
```

The `while True` loop is the beginning of an agentic loop — the model can call as many tools as needed before producing a final answer. The next lesson formalises this pattern and adds the safety controls it needs in production.

## Web search and text extraction {#web-search}

The `search_web` tool in the example above uses **ddgs** — the official Python package for DuckDuckGo Search. It requires no API key, no account, and no configuration:

```bash
uv add ddgs trafilatura
```

`ddgs.text()` returns a list of result dicts. Each has three keys you care about:

```python
{
    "title":  "The page title",
    "href":   "https://example.com/the-url",
    "body":   "A short snippet of the page content"
}
```

The snippet (`body`) is enough for many use cases. But when you need the full article text — for a summarisation tool, a RAG ingestion step, or a deep research agent — pass the URL to **Trafilatura**, which downloads the page and strips out navigation, ads, and boilerplate:

```python
import trafilatura

def fetch_page_text(url: str) -> str:
    """Download a URL and extract clean article text."""
    downloaded = trafilatura.fetch_url(url)
    text = trafilatura.extract(downloaded)
    return text or f"[Could not extract text from {url}]"
```

A typical agent pattern combines both: search first to find relevant URLs, then fetch the top result for full content:

```python
def research(topic: str) -> str:
    # Step 1: find relevant pages
    results_text = search_web(topic, max_results=3)
    # Parse the first URL out of the results
    first_url = results_text.split("URL: ")[1].split("\n")[0]
    # Step 2: get the full article
    return fetch_page_text(first_url)
```

## Choosing a search backend {#choosing-search-backend}

Three options appear in real AI engineering stacks. Here is when to use each:

| | **ddgs** | **Tavily** | **Google Custom Search** |
|---|---|---|---|
| API key | None | Required | Required + GCP console |
| Cost | Free | Free tier, then paid | Paid per query |
| Setup | `uv add ddgs` | Sign up + set key | Cloud console + credentials |
| Results | DuckDuckGo index | AI-optimized for agents | Google index |
| Rate limits | Soft (no hard quota) | Plan-based | Strict quota |
| Best for | Development, prototypes, tools that don't need a key | Production agents where search quality is critical | Enterprise with existing GCP contracts |

**Use ddgs while learning and building.** It runs with zero setup and teaches the tool-calling pattern without API key friction. When you ship an agent to production and search quality becomes critical, evaluate Tavily — it returns cleaner, more agent-friendly results and supports filtering by domain, date, and content type.
