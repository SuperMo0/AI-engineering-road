---
layout: lesson
lesson_id: "0006"
chapter: 1
chapter_title: "Foundations of AI Engineering"
title: "Advanced prompting — tokens, cost, and reliability"
description: "35–45 min read · Hands-on coding"
prev: "0005-prompt-engineering.html"
prev_title: "Prompt engineering fundamentals"
next: "P002-document-summarizer.html"
next_title: "Build a document summarizer"
prereqs:
  - "[Lesson 2](0002-openai-api-basics.html): tokens defined, API call basics, error handling"
  - "[Lesson 5](0005-prompt-engineering.html): system prompts, few-shot, chain-of-thought"
assignment:
  article:
    title: "The AI Engineer Mindset"
    url: "https://www.aihero.dev/the-ai-engineer-mindset"
    author: "Matt Pocock (aihero.dev)"
    time: "about 15 minutes"
    why: "The Staircase of Complexity explained by a practitioner who has applied it across 50+ real client projects. This article is the conceptual foundation for the whole of Chapter 2."
  task:
    description: "Add cost tracking and retry logic to your CLI assistant from Project 1."
    steps:
      - "After each response in interactive and one-shot mode, print the cost: `Cost: $0.000012 | Total session: $0.000045`"
      - "Wrap all API calls in the `call_with_retry` function from this lesson"
      - "Add a `--stream` flag that enables streaming output for interactive mode"
      - "Add a `--temperature` flag (default `0.7`, accepts a float 0.0–1.5)"
    expected: "After each reply, a cost line appears. With `--stream`, words appear incrementally as the model generates them."
    why: "Cost tracking is the first thing a technical manager asks about when reviewing an AI system in production. Retry logic is what separates a demo from a reliable service."
knowledge_check:
  - q: "Output tokens cost more than input tokens. Why does this affect system design?"
    a: "Because you can limit output length with `max_tokens`, but you often cannot reduce input much (you need to send the full context). Constraining output length — asking for bullet points instead of paragraphs, or a one-line summary instead of a full explanation — can significantly reduce per-call cost at scale."
    section: "#token-cost"
    section_title: "Tokens and cost"
  - q: "What temperature would you use for extracting invoice data, and why?"
    a: "0 or close to it. Extraction tasks require consistent, deterministic output — the invoice number is the invoice number, there is no creative interpretation. High temperature introduces variation that would corrupt extracted data. Low temperature guarantees the same answer for the same input."
    section: "#temperature"
    section_title: "Temperature"
  - q: "What is exponential backoff and why is it the right response to a RateLimitError?"
    a: "Exponential backoff means waiting increasingly long delays between retry attempts — 1s, 2s, 4s, 8s. Rate limit errors mean the API is temporarily overloaded. Retrying immediately would keep hitting the same limit. Waiting and doubling the delay gives the server time to recover and avoids amplifying the problem."
    section: "#rate-limits"
    section_title: "Rate limits and retry logic"
  - q: "What is the key principle of the Staircase of Complexity?"
    a: "Start at the simplest step (zero-shot prompt) and climb only when the simpler approach cannot solve the problem reliably. Every step up adds cost, latency, and complexity. Most production problems are solved at steps 1–4. Higher steps (agents, RAG, fine-tuning) exist for specific, justified cases only."
    section: "#staircase"
    section_title: "The Staircase of Complexity"
  - q: "When should you use streaming, and when should you skip it?"
    a: "Use streaming when a user is watching and waiting — chat UIs, CLI tools, interactive generators — so they see output immediately instead of waiting for the full response. Skip streaming for background processing pipelines and batch jobs where no user is watching and the complete result is needed before any processing can begin."
    section: "#streaming"
    section_title: "Streaming responses"
additional_resources:
  - title: "How To Improve Your LLM-Powered App"
    url: "https://www.aihero.dev/how-to-improve-your-llm-powered-app"
    desc: "17 techniques including all the Staircase steps; a reference you will return to throughout the curriculum"
  - title: "OpenAI: Rate limits"
    url: "https://platform.openai.com/docs/guides/rate-limits"
    desc: "Your account tier, how limits scale, and how to request increases"
---

## Motivation

Writing a prompt that works once in a notebook is not engineering. Engineering is writing a prompt that works reliably at scale — consistently, cheaply, and without crashing when the API returns an error or gets temporarily overloaded.

This lesson covers the four things that separate hobby code from production AI systems: understanding token costs so you can design efficiently, controlling randomness with temperature, handling rate limits without crashing, and knowing the mental model that tells you how much AI a problem actually needs.

{% include prereqs.html %}

## Tokens and cost — what you are actually paying for {#token-cost}

Every token that passes through the API costs money. There are two types:

- **Input tokens** — all the text you send (system message + full conversation history + user's message). Billed at a lower rate.
- **Output tokens** — all the text the model generates. Billed at a higher rate (2–4× more expensive than input).

| Model | Input (per M tokens) | Output (per M tokens) |
|---|---|---|
| `gpt-4o-mini` | $0.15 | $0.60 |
| `gpt-4o` | $2.50 | $10.00 |

At those prices, a single API call costs a fraction of a cent. But at scale — a system processing 100,000 documents per day — the numbers matter. Here is how to think about it:

```python
def estimate_cost(prompt_tokens: int, completion_tokens: int, model: str = "gpt-4o-mini") -> float:
    rates = {
        "gpt-4o-mini": (0.15, 0.60),
        "gpt-4o":      (2.50, 10.00),
    }
    input_rate, output_rate = rates[model]
    cost = (prompt_tokens / 1_000_000 * input_rate) + (completion_tokens / 1_000_000 * output_rate)
    return cost

# After a call:
cost = estimate_cost(response.usage.prompt_tokens, response.usage.completion_tokens)
print(f"This call cost: ${cost:.6f}")
```

### How to reduce token cost

- **Trim history** — every old message in the conversation costs input tokens. Keep only what the model needs.
- **Concise system prompts** — a system prompt is resent on every call. A 500-token system prompt on 10,000 calls = 5 million tokens billed.
- **Right-size the model** — use `gpt-4o-mini` for everything that does not require deep reasoning. Reserve `gpt-4o` for tasks that actually need it.
- **Limit output length** — use the `max_tokens` parameter to cap output at what you actually need.

```python
response = client.chat.completions.create(
    model="gpt-4o-mini",
    messages=messages,
    max_tokens=200,    # stop generating after 200 tokens
)
```

## Temperature — controlling randomness {#temperature}

When an LLM generates each token, it does not always pick the single most-likely word. It samples from a probability distribution — sometimes choosing a less likely word to introduce variety. The **temperature** parameter controls how much sampling randomness there is.

- **Temperature 0** — always pick the most likely token. Fully deterministic output. Same prompt always gives the same (or very similar) answer.
- **Temperature 0.7** — the default. A balanced amount of variation. Good for most tasks.
- **Temperature 1.0+** — high randomness. Creative, unpredictable. Useful for brainstorming; dangerous for factual extraction.

| Task | Recommended temperature |
|---|---|
| Data extraction, classification, JSON output | 0 – 0.2 |
| Q&A, summarisation, code generation | 0.2 – 0.5 |
| General conversation, explanations | 0.5 – 0.8 |
| Creative writing, brainstorming | 0.8 – 1.2 |

For production systems where consistency matters, default to a low temperature and increase it only if outputs are too repetitive.

```python
response = client.chat.completions.create(
    model="gpt-4o-mini",
    messages=messages,
    temperature=0.2,   # low: consistent, less creative
)
```

## Rate limits and retry logic {#rate-limits}

Every OpenAI account has rate limits: a maximum number of requests per minute and a maximum number of tokens per minute. Exceed them and the API returns a `RateLimitError` (HTTP 429). This is not a bug — it is a normal operating condition for any production system.

The right response to a rate limit error is to wait and retry — with a delay that grows each time the error repeats. This is called **exponential backoff**: try again after 1 second, then 2 seconds, then 4 seconds, then 8, up to a maximum wait.

```python
import time
from openai import OpenAI, RateLimitError, OpenAIError

def call_with_retry(client: OpenAI, messages: list, model: str = "gpt-4o-mini",
                    max_retries: int = 4) -> str:
    delay = 1.0
    for attempt in range(max_retries):
        try:
            response = client.chat.completions.create(
                model=model,
                messages=messages,
            )
            return response.choices[0].message.content

        except RateLimitError:
            if attempt == max_retries - 1:
                raise
            print(f"Rate limit hit. Waiting {delay:.0f}s...")
            time.sleep(delay)
            delay *= 2   # double the wait each time

        except OpenAIError:
            raise   # don't retry on other errors
```

This handles the vast majority of transient rate limit errors transparently. In Chapter 5 you will learn how to instrument these retries with proper observability.

## Streaming responses {#streaming}

By default, the API waits until the model has finished generating the entire response, then returns it all at once. For long responses — a 500-word essay, a detailed explanation — this can mean waiting 5–10 seconds before anything appears.

**Streaming** sends each token back to your code as it is generated, so you can display text incrementally — exactly like ChatGPT does. Set `stream=True` on the call:

```python
stream = client.chat.completions.create(
    model="gpt-4o-mini",
    messages=[{"role": "user", "content": "Explain how photosynthesis works."}],
    stream=True,
)

for chunk in stream:
    delta = chunk.choices[0].delta.content
    if delta:
        print(delta, end="", flush=True)

print()  # newline at the end
```

Each `chunk` contains a small piece of the response. The `delta.content` field holds the new text (or `None` for control chunks). `flush=True` forces each piece to print immediately rather than buffering.

Use streaming for any interface where the user is waiting for a response — chat UIs, CLI tools, document generators. Skip it for background processing pipelines where the user is not watching.

## The Staircase of Complexity {#staircase}

The most important mental model in AI engineering is not a prompting technique — it is a question: *how much AI does this problem actually need?*

Adding AI adds cost, latency, and unpredictability. A regex that takes 0.001 seconds is always better than an LLM call that takes 2 seconds, when the regex is good enough. The goal is to use as little AI as possible to solve the problem reliably.

The Staircase of Complexity is a framework for finding that minimum. Each step is more powerful than the one above it — and more expensive. Always start at the top and climb only as high as the problem forces you:

| Step | Approach | When to use |
|---|---|---|
| 1 | Zero-shot prompt | Simple task the model handles well with just a clear instruction |
| 2 | Few-shot prompt | Consistent format needed; examples outperform written instructions |
| 3 | Chain-of-thought | Complex reasoning; accuracy matters more than speed |
| 4 | Structured outputs | Machine-readable output required; freetext breaks downstream code |
| 5 | Multiple LLM calls | Task too complex for one call; pipeline with specialised steps |
| 6 | Agents | Task requires deciding what tools to call based on environment feedback |
| 7 | RAG | Model needs domain knowledge not in training data |
| 8 | Fine-tuning | Narrow, validated use case with thousands of training examples — last resort |

You will encounter all of these in this curriculum, in roughly this order. The Staircase tells you where to start (Step 1) and when to climb. Most production problems are solved at steps 1–4. Steps 5–8 exist for specific, justified cases.

<div class="callout info">
In Chapter 2 you will learn to design full AI systems using this framework. For now, internalise the rule: <strong>solve it at the lowest step that works.</strong>
</div>
