---
layout: lesson
lesson_id: "0009"
chapter: 2
chapter_title: "AI System Design"
title: "Cognitive architecture — designing data flow"
description: "30–40 min read · Design-focused"
prev: "0008-llm-system-types.html"
prev_title: "What can you build with LLMs? — system types and the Staircase"
next: "0010-minimize-ai.html"
next_title: "The golden rule: minimize AI"
prereqs:
  - "[Lesson 8](0008-llm-system-types.html): the five LLM system types — you will design one of each in this lesson"
  - "[Lesson 4](0004-structured-outputs.html): Pydantic models — the output of each step in a cognitive architecture is always a typed structure"
assignment:
  article:
    title: "LLM Powered Autonomous Agents"
    url: "https://lilianweng.github.io/posts/2023-06-23-agent/"
    author: "Lilian Weng"
    time: "about 15 minutes (sections \"Agent System Overview\" and \"Planning\" only)"
    why: "The most-cited technical overview of LLM agent architecture. The \"Agent System Overview\" section contains a diagram that precisely maps to the cognitive architecture building blocks taught here. Reading it now primes you for Lessons 12–14."
  task:
    description: "Design the cognitive architecture for a CV (résumé) screening tool."
    steps:
      - "Draw the architecture as a text block diagram (like the customer support example above)"
      - "Label every arrow with its data type"
      - "Mark each block as \"Code\" or \"LLM\""
      - "Define at least two Pydantic models for the intermediate and final outputs"
      - "Write it all in a `architecture.py` file — just the models and a docstring describing each step. No API calls."
    expected: "A Python file with 2–3 Pydantic models and a comment block showing the diagram."
    why: "Designing before coding is the habit this lesson builds. The output of this exercise is also the starting point for a real tool you could show in an interview."
knowledge_check:
  - q: "What does a cognitive architecture diagram communicate before any code is written?"
    a: "It shows what raw input enters the system, what typed value each step produces, which steps are AI calls and which are deterministic code, how data flows from one step to the next, and what final output the system produces. This makes every component's responsibility explicit before implementation begins."
    section: "#what-is-cognitive-architecture"
    section_title: "What is a cognitive architecture?"
  - q: "Why is the context builder always a separate step from the LLM call?"
    a: "Because LLMs are stateless — they cannot fetch data themselves during a call. All information the model needs (history, database records, retrieved documents, the current date) must be assembled before the call and injected into the prompt. The context builder is responsible for this assembly. Mixing fetching and calling makes systems impossible to test and debug separately."
    section: "#building-blocks"
    section_title: "The building blocks"
  - q: "What is a pipeline context object and why is it useful?"
    a: "A pipeline context object is a Pydantic model that is passed through every step of a pipeline, accumulating fields as each step runs. Each step reads what it needs and writes what it produces to the same object. This ensures no information is accidentally dropped between steps and makes the full state of the pipeline inspectable at any point."
    section: "#context-propagation"
    section_title: "Context propagation"
additional_resources:
  - title: "LLM Powered Autonomous Agents"
    url: "https://lilianweng.github.io/posts/2023-06-23-agent/"
    desc: "Full post by Lilian Weng; covers memory, tool use, and planning in depth; excellent reference for Lessons 12–14"
---

## Motivation

Senior AI engineers do not open a code editor first. They open a whiteboard. Before a single API call is written, the best teams sketch out what goes in, what comes out, and what each step transforms. This sketch is the system's *cognitive architecture* — the data flow map that tells every developer what their component is responsible for.

Skipping this step is why AI projects get rebuilt three times. You code a chatbot, realise it needs retrieval, bolt it on, realise retrieval needs a pre-processing step, bolt that on, and end up with tangled spaghetti that nobody can debug. Starting with a clear architecture sketch takes 30 minutes and saves weeks.

{% include prereqs.html %}

## What is a cognitive architecture? {#what-is-cognitive-architecture}

A **cognitive architecture** is a diagram that maps the data flow through an AI system. It shows:

- What enters the system (raw input)
- What each step receives and produces (typed intermediate values)
- Which steps involve an LLM and which are deterministic code
- What leaves the system (final output)

The term "cognitive" refers to the thinking steps — the LLM calls. But a well-designed cognitive architecture makes it obvious which steps are AI and which are not, because most steps should *not* be AI. LLM calls are slow and non-deterministic; deterministic code is fast and testable. Good architecture keeps the LLM surface area small.

## The building blocks {#building-blocks}

Every cognitive architecture is composed of the same small set of building blocks:

| Block | What it does | AI or code? |
|---|---|---|
| **Input handler** | Receives raw user input, validates, normalises | Code |
| **Context builder** | Retrieves relevant information (conversation history, database records, retrieved documents) | Code (+ optional LLM for rewriting queries) |
| **LLM call** | The model produces text given a prompt + context | LLM |
| **Output parser** | Validates and structures the LLM's response (Pydantic) | Code |
| **Router / dispatcher** | Decides where to send output next based on its value | Code or LLM |
| **Tool executor** | Runs a function, API call, or database query on behalf of the LLM | Code |
| **Output handler** | Stores, displays, or transmits the final result | Code |

Notice how many blocks are "Code". LLM calls are surrounded by deterministic steps. This is intentional — deterministic steps are fast, cheap, and testable. Every LLM call should have a clear typed input and a clear typed output.

## Example: customer support bot architecture {#example-customer-support}

Let us walk through a concrete example — a customer support bot that can answer questions about orders and escalate complex issues to a human agent.

The architecture as a text block diagram (read top to bottom, arrows show data flow):

```text
USER MESSAGE
     │
     ▼
[Input handler] ─── validate, strip PII, detect language
     │
     │  message: str, language: str
     ▼
[Context builder] ─── load conversation history
                  ─── look up customer record from database (by email/account)
                  ─── retrieve relevant FAQ entries (vector search, Ch.4)
     │
     │  history: list[Message], customer: CustomerRecord, faq: list[str]
     ▼
[LLM call: classifier] ─── system: "Classify this support request"
                       ─── output: TicketClassification (category, priority, needs_escalation)
     │
     ├── needs_escalation = True ──▶ [Router] ──▶ [Escalation handler] ──▶ human queue
     │
     └── needs_escalation = False
              │
              ▼
         [LLM call: responder] ─── system: "You are a support agent"
                               ─── context: customer record + FAQ + history
                               ─── output: SupportResponse (reply, suggested_actions)
              │
              ▼
         [Output handler] ─── save to conversation DB
                          ─── send reply to user
                          ─── update ticket status
```

This diagram communicates several important things before a line of code is written:

- There are **two** LLM calls, not one. The classifier is separate from the responder because they need different system prompts, different context, and different output schemas.
- The router between them is **deterministic code** — just an `if` statement on a Pydantic field. No AI needed there.
- The context builder runs **before** any LLM call. The LLM never fetches data — that is the context builder's job.
- Every arrow has a **type label**. This forces you to define your Pydantic models before writing prompt logic.

## The design process: four questions {#design-process}

Before sketching any new AI system, answer these four questions in order:

### 1. What is the raw input?

Describe exactly what arrives at the system boundary. "User message" is not enough — is it a string? A file? A form submission? What format, encoding, and maximum length? This becomes your input handler's validation rules.

### 2. What is the final output?

Define what the system must produce. A string? A Pydantic object? A database write? A file? Work backwards from this — every step exists to produce the next thing in the chain that eventually produces this output.

### 3. What context does the LLM need at each call?

LLMs are stateless. Any information they need — customer records, conversation history, retrieved documents, the current date — must be explicitly assembled and injected into the prompt. For each LLM call in your diagram, list what goes into the context and where it comes from.

### 4. Which steps need AI and which need code?

Go through your diagram and challenge every step: could this be a regex? A SQL query? A conditional? An API call? LLM calls are expensive and non-deterministic — replace every one that code can handle reliably. (This is the subject of Lesson 10.)

## Typed interfaces between steps {#typed-interfaces}

The single most important habit in cognitive architecture design is to define the data type at every boundary *before* writing the code for either side of that boundary.

Every arrow in your diagram should have a Pydantic model:

```python
from pydantic import BaseModel
from typing import Optional

# Output of the classifier LLM call
class TicketClassification(BaseModel):
    category: str          # "billing" | "technical" | "account" | "other"
    priority: str          # "low" | "medium" | "high" | "urgent"
    needs_escalation: bool
    reason: Optional[str] = None   # why escalation was triggered

# Output of the responder LLM call
class SupportResponse(BaseModel):
    reply: str
    suggested_actions: list[str]
    confidence: str        # "high" | "medium" | "low"
```

Once these types are defined, you can implement each step independently and test them separately. The classifier can be tested without the responder. The responder can be tested with a hard-coded `TicketClassification`. This is how real teams build AI systems without everything depending on everything else.

<div class="callout info">
<strong>Types are contracts.</strong> When you define <code>TicketClassification</code>, you have made a contract: the classifier step promises to produce this object, and every step after it can depend on that promise. Contracts make systems debuggable — when something breaks, you know exactly which step broke the contract.
</div>

## Context propagation {#context-propagation}

One of the most common bugs in AI systems is a step that needs information produced three steps earlier, but that information was never passed forward. **Context propagation** means tracking which data each step needs and ensuring it is available.

A simple pattern is to carry a **context object** through the entire pipeline — a Pydantic model that accumulates fields as each step runs:

```python
from pydantic import BaseModel
from typing import Optional

class PipelineContext(BaseModel):
    # Available from the start
    raw_message: str
    user_id: str

    # Added by context builder
    customer_name: Optional[str] = None
    account_tier: Optional[str] = None
    conversation_history: list[dict] = []

    # Added by classifier
    classification: Optional[TicketClassification] = None

    # Added by responder
    final_response: Optional[SupportResponse] = None
```

Each step receives the context object, reads what it needs, adds what it produces, and passes the updated object to the next step. Nothing is lost between steps.
