---
layout: lesson
lesson_id: "0003"
chapter: 1
chapter_title: "Foundations of AI Engineering"
title: "Conversations and chat history"
description: "30–40 min read · Hands-on coding"
prev: "0002-openai-api-basics.html"
prev_title: "Your first LLM API call — how OpenAI works"
next: "0004-structured-outputs.html"
next_title: "Structured outputs and function calling"
prereqs:
  - "[Lesson 1](0001-ai-dev-environment.html): uv project with `openai` and `python-dotenv` installed"
  - "[Lesson 2](0002-openai-api-basics.html): `client.chat.completions.create()` — the messages list, role/content structure, reading responses"
assignment:
  article:
    title: "Role Prompting"
    url: "https://learnprompting.org/docs/basics/roles"
    author: "learnprompting.org"
    time: "about 10 minutes"
    why: "A concise, practical explanation of how system and role messages shape model behaviour, with concrete before/after examples. Grounds the concept you just learned in real prompting technique."
  task:
    description: "Extend the REPL chatbot to save and load conversation history."
    steps:
      - "Copy the REPL loop from this lesson into `main.py`"
      - "On startup, check if a file `history.json` exists — if so, load it as the initial messages list (after the system message)"
      - "After each turn, save the full messages list to `history.json`"
      - "Add `history.json` to `.gitignore`"
      - "Run the script, have a short conversation, quit, restart — confirm it remembers"
    expected: "Restarting the script and saying \"what did I just ask you?\" returns a summary of the previous conversation."
    why: "Persisting history to disk is the simplest real-world version of conversation memory. It also introduces json.dump/load, which appear throughout production AI backends."
knowledge_check:
  - q: "Why does the OpenAI API have no memory of previous calls?"
    a: "The API is stateless — each call is completely independent. The model only knows what you put in the `messages` list of the current request. There is no server-side session or conversation ID that persists between calls."
    section: "#stateless"
    section_title: "The API is stateless"
  - q: "What are the three message roles, and what does each one represent?"
    a: "`\"system\"` — background instructions the user never sees; sets persona, tone, and rules. `\"user\"` — a message from the human. `\"assistant\"` — a message from the model (used to include previous replies in the history)."
    section: "#messages-list"
    section_title: "The messages list"
  - q: "What are the three steps to update conversation history after each turn?"
    a: "1. Append the user's message to the history list. 2. Send the full list to the API. 3. Append the model's reply (with role `\"assistant\"`) to the history list. The list grows by two entries per turn."
    section: "#repl-loop"
    section_title: "Building a conversation loop"
  - q: "What is a context window, and what happens when you exceed it?"
    a: "The context window is the maximum number of tokens a model can process in one call — both the messages you send and the reply it generates. Exceeding it causes an API error. The fix is to trim old messages from the history, always keeping the system message and the most recent turns."
    section: "#context-window"
    section_title: "The context window limit"
  - q: "Why does a long conversation history increase cost?"
    a: "Every token in the messages list — including messages from previous turns — is billed as an input token on each request. A 20-turn conversation means 19 turns of history are re-sent and re-billed on the final request. Trimming the history controls cost."
    section: "#context-window"
    section_title: "The context window limit"
additional_resources:
  - title: "OpenAI: Managing conversation state"
    url: "https://platform.openai.com/docs/guides/conversation-state"
    desc: "Official reference on context window management strategies"
---

## Motivation

Every real AI product — a customer support bot, a coding assistant, a document Q&A tool — needs to remember what was said earlier in the conversation. If a user says "summarise this contract" and then asks "who are the parties involved?", the model must know what "this" and "the parties" refer to. Without that memory, every message is a fresh conversation with an amnesiac.

This lesson explains how chat history actually works under the API — and it is simpler than most developers expect. There is no magic. You are the memory system.

{% include prereqs.html %}

## The API is stateless — it has no memory of its own {#stateless}

The single most important thing to understand about the OpenAI API — and every other LLM API — is that it is **stateless**.

Stateless means that every API call is completely independent. When you call `client.chat.completions.create()`, the model has no knowledge of any previous calls you made. It does not matter if you called it one second ago or one year ago — from the model's perspective, each call is the first and only time it has heard from you.

This surprises developers who assume the API works like ChatGPT, where you can refer back to earlier messages. ChatGPT *does* remember — but ChatGPT is an application built on top of the same API. The application is responsible for storing the conversation history and sending it along with each new request. That is what you are about to do.

The model only knows what you put in the `messages` list. If you want it to know what was said three turns ago, you must include those three turns in the list.

## The messages list is the full conversation {#messages-list}

In Lesson 2, the messages list had a single entry: the user's question. A multi-turn conversation simply has more entries. Each entry is one message in the conversation thread, in chronological order.

There are three possible `role` values:

- `"system"` — background instructions for the model. Comes first in the list. Sets tone, persona, rules, and constraints. The user never sees this.
- `"user"` — a message from the human in the conversation.
- `"assistant"` — a message from the model. When you include previous model replies in the list, this is the role you use for them.

Here is what a two-turn conversation looks like in code:

```python
messages = [
    {"role": "system",    "content": "You are a helpful assistant."},
    {"role": "user",      "content": "What is the capital of France?"},
    {"role": "assistant", "content": "The capital of France is Paris."},
    {"role": "user",      "content": "What is its population?"},
]

response = client.chat.completions.create(
    model="gpt-4o-mini",
    messages=messages
)

print(response.choices[0].message.content)
# → "The population of Paris is approximately 2.1 million in the city..."
```

The model sees the entire list and understands that "its" in the final message refers to Paris — because Paris is in the conversation history you provided.

### The system message

The `"system"` role message is your lever for controlling the model's behaviour without the user knowing. You can tell the model what persona to adopt, what domain to focus on, what format to use, and what rules to follow:

```python
{"role": "system", "content": "You are a senior Python engineer. Answer only Python-related questions. When you show code, use type hints. Be concise."}
```

System messages are not a security boundary — a determined user can often override them with clever prompting — but they are effective at steering normal use. They belong at the very start of the messages list, before any user messages.

## Building a conversation loop {#repl-loop}

To make a stateful chatbot, you maintain a list in memory and append to it after every turn: first with the user's message, then with the model's reply. On the next turn, you send the whole list again.

Here is the complete pattern — a REPL (Read–Eval–Print Loop) that holds a conversation until the user types "quit":

```python
import os
from dotenv import load_dotenv
from openai import OpenAI

load_dotenv()
client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))

def chat():
    # The conversation history. System message goes first.
    messages = [
        {"role": "system", "content": "You are a helpful assistant. Be concise."}
    ]

    print("Chat started. Type 'quit' to exit.\n")

    while True:
        user_input = input("You: ").strip()
        if user_input.lower() == "quit":
            break
        if not user_input:
            continue

        # 1. Append the user's message to history.
        messages.append({"role": "user", "content": user_input})

        # 2. Send the full history to the API.
        response = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=messages
        )

        reply = response.choices[0].message.content

        # 3. Append the model's reply to history.
        messages.append({"role": "assistant", "content": reply})

        print(f"\nAssistant: {reply}\n")

if __name__ == "__main__":
    chat()
```

The key insight is in the three numbered comments. The history list grows by two entries every turn — one user message and one assistant reply. By the fifth turn, you are sending ten messages to the API. The model reads all of them and replies with full context.

## The context window limit {#context-window}

The model cannot read an infinitely long conversation. Every LLM has a **context window** — the maximum number of tokens it can process at once, counting both the full messages list you send *and* the reply it generates. For `gpt-4o-mini`, this is 128,000 tokens — roughly a full-length novel.

For most applications, this is not a practical limit in the short term. A typical back-and-forth conversation of 20 turns uses fewer than 5,000 tokens. But long documents, automated pipelines that run for hours, or conversations where users paste large amounts of text can hit the limit.

When the context window is exceeded, the API returns an error. The production solution is to trim the history — keeping the system message and the most recent N turns, discarding older messages. A simple trim function:

```python
def trim_history(messages: list, max_turns: int = 10) -> list:
    """Keep the system message + the most recent max_turns pairs."""
    system = [m for m in messages if m["role"] == "system"]
    conversation = [m for m in messages if m["role"] != "system"]
    # Each turn = 1 user + 1 assistant message = 2 entries
    trimmed = conversation[-(max_turns * 2):]
    return system + trimmed
```

Call this before each API request: `messages = trim_history(messages)`. This keeps memory usage predictable regardless of conversation length.

<div class="callout info">
<strong>Tokens in context window = cost.</strong> Every token in your messages list is billed as an input token, even if the user wrote it three turns ago. Long histories cost more. Trimming is not just a technical fix — it is cost management.
</div>

## Where history actually lives

In the REPL example above, the history lives in a Python list — in memory, for the duration of the script. When the script exits, it is gone.

In a real product, you need to persist conversation history across sessions. The approach depends on the product:

| Product type | Where to store history |
|---|---|
| Single-user CLI tool | A JSON file on disk — simple, good enough |
| Web app, single user | Browser `localStorage` or session storage |
| Web app, multi-user | A database (PostgreSQL, Redis) keyed by conversation ID and user ID |
| Automated pipeline | Usually not stored — each pipeline run starts fresh |

In Chapter 3 you will build a backend with PostgreSQL to store conversations properly. For now, the in-memory list is the right tool.
