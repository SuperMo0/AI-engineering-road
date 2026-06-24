---
layout: lesson
lesson_id: "0010"
chapter: 2
chapter_title: "AI System Design"
title: "The golden rule: use as little AI as possible"
description: "30–35 min read · Design-focused"
prev: "0009-cognitive-architecture.html"
prev_title: "Cognitive architecture — designing data flow"
next: "0011-llm-chaining.html"
next_title: "LLM chaining and parallelization"
prereqs:
  - "[Lesson 8](0008-llm-system-types.html): the Staircase of Complexity — this lesson is a deep dive into its first step"
  - "[Lesson 9](0009-cognitive-architecture.html): cognitive architecture — you will audit an architecture here"
assignment:
  article:
    title: "How To Improve Your LLM-Powered App"
    url: "https://www.aihero.dev/how-to-improve-your-llm-powered-app"
    author: "aihero.dev"
    time: "about 12 minutes (introduction and first five techniques only)"
    why: "The first five techniques in this article are all about using simpler approaches before reaching for a more complex one — the practical implementation of this lesson's golden rule, with real before/after examples."
  task:
    description: "Audit the document summarizer you built in P002 using the substitution test."
    steps:
      - "List every operation in your `summarize.py` that currently uses an LLM"
      - "Apply the substitution test to each one: could code handle it reliably?"
      - "Implement at least two substitutions — pre-LLM code steps that eliminate part of what you were sending to the model"
      - "Measure: run the summarizer before and after, compare token counts"
    expected: "A comment at the top of `summarize.py` listing each substitution and the token count reduction it produced."
    why: "Auditing your own code for unnecessary LLM usage is a skill used in every production AI engineering role. Token count reduction is the concrete metric that shows the audit worked."
knowledge_check:
  - q: "What are the three costs of every LLM call?"
    a: "Money (token billing), latency (1–5 seconds per call), and non-determinism (the same input can produce different outputs). Each cost compounds at scale. Replacing an LLM call with code eliminates all three costs for that step."
    section: "#three-costs"
    section_title: "The three costs"
  - q: "What is the substitution test, and what threshold makes it \"pass\"?"
    a: "For each LLM call, ask: \"Could I replace this with code that handles at least 95% of real inputs correctly?\" If yes, replace it — and optionally fall back to the LLM for the remaining 5%. If no, keep the LLM call and document why code cannot handle it."
    section: "#audit-process"
    section_title: "Auditing a system"
  - q: "Name three tasks where code beats an LLM every time."
    a: "Any three of: fixed-pattern extraction (regex), structured database lookups, business rule conditionals, HTML/string templating and formatting, arithmetic and counting. Code is faster, cheaper, and deterministic for all of these. LLMs are unreliable at maths and have zero advantage over code for fixed-format tasks."
    section: "#what-code-handles"
    section_title: "What code handles better"
---

## Motivation

Every LLM call in your system is a liability: it costs money, takes time (1–5 seconds per call), and occasionally produces wrong answers. Every piece of deterministic code is an asset: it costs nothing to run, executes in milliseconds, and is always correct for its input.

The golden rule of AI engineering: **use as little AI as possible.** Use exactly as much as the problem requires and not one call more. This lesson teaches you to audit an AI system and find every step that can be replaced with faster, cheaper, more reliable code.

{% include prereqs.html %}

## The three costs of an LLM call {#three-costs}

Before replacing a step, you need to understand exactly what you are replacing and why you would bother. Every LLM call carries three costs:

### Cost 1: Money

Every token in and out is billed. A system that processes 10,000 support tickets per day with a 500-token prompt costs roughly $0.75/day at `gpt-4o-mini` prices — not much. But a system that sends a 3,000-token prompt (including full conversation history and retrieved documents) costs $4.50/day for the same volume, and $135/day at `gpt-4o` prices. Token cost is a design decision.

### Cost 2: Latency

An LLM call takes 1–5 seconds. A regex takes 0.001 seconds. A SQL query takes 5–20 milliseconds. If your pipeline makes 3 LLM calls in sequence, the minimum latency is 3–15 seconds — before network overhead, context building, or retries. For a real-time user-facing product, this is the difference between a good and a terrible experience.

### Cost 3: Non-determinism

LLMs do not always give the same answer for the same input. At temperature 0, they are close to deterministic — but "close to" is not the same as "always." For business-critical decisions (routing a payment, triggering a refund, flagging fraud), non-determinism is unacceptable. Code is always deterministic.

## What LLMs are actually good at {#what-llms-are-good-at}

This lesson is not an argument against LLMs — it is an argument for precision. LLMs genuinely excel at tasks that code cannot handle:

- **Ambiguous natural language:** "The customer seems upset about a charge" requires understanding; a regex cannot judge upset-ness.
- **Variable structure:** Contracts, emails, and support tickets do not have a fixed schema. Extracting meaning from them requires understanding, not pattern matching.
- **Contextual reasoning:** "Is this follow-up question related to the previous message?" requires holding context; a keyword lookup cannot.
- **Generation:** Writing a reply, a summary, or a product description. Code cannot generate novel, coherent prose.
- **Classification with nuance:** Sentiment, intent, and severity on a spectrum — not binary — require judgement.

Use LLMs for tasks in this list. Replace everything else with code.

## What code handles better than an LLM {#what-code-handles}

### Pattern matching — use regex

Extracting a UK postcode, a date in YYYY-MM-DD format, an email address, an order number with a known prefix — all of these have fixed patterns. Regex is instantaneous, free, and 100% reliable for well-defined patterns.

```python
import re

# Don't use an LLM for this
def extract_order_id(text: str) -> str | None:
    match = re.search(r'\bORD-\d{6}\b', text)
    return match.group(0) if match else None
```

### Structured lookups — use a database

"What is the price of product SKU-1234?" is a database query, not an LLM prompt. Asking an LLM for factual data that lives in a database produces hallucinations. Query the database, inject the result into the LLM's context if the LLM needs it.

```python
# Don't ask the LLM for the price
# Do this instead:
price = db.query("SELECT price FROM products WHERE sku = ?", sku)
# Then inject it into context if needed:
context = f"The price of {sku} is ${price:.2f}."
```

### Fixed rules and thresholds — use conditionals

"Escalate if priority is urgent" is a conditional, not a decision the LLM should make on the fly every time. Encode business rules as code — they are faster, auditable, and easier to change.

```python
def should_escalate(classification: TicketClassification) -> bool:
    return (
        classification.priority == "urgent"
        or classification.category == "billing"
        and classification.priority in ("high", "urgent")
    )
```

### Formatting and templating — use f-strings

"Format this response as an HTML email" does not need an LLM. A template with the LLM's text inserted is faster, cheaper, and produces consistent formatting.

```python
def format_email(reply: str, customer_name: str) -> str:
    return f"""Dear {customer_name},

{reply}

Best regards,
Support Team"""
```

### Counting, sorting, arithmetic — use Python

LLMs are notoriously unreliable at arithmetic and counting. If you need "the three most recent orders" — sort a list. If you need "total spend this quarter" — sum a column. Never delegate maths to an LLM.

## Auditing a system: the substitution test {#audit-process}

For every LLM call in your cognitive architecture, apply the **substitution test**: ask "could I replace this with code that handles at least 95% of real inputs correctly?"

If yes: replace it. You can always handle the remaining 5% with a fallback to the LLM for edge cases — a hybrid that is mostly fast code and occasionally calls the model.

If no: keep the LLM call, but document why code cannot handle it. "The input is free-form natural language with no fixed structure" is a valid reason. "It was easier to prompt than to code" is not.

### A worked example: email routing

Suppose your system routes customer emails to the right support queue. Your first design uses an LLM call to classify every email. Let us apply the substitution test:

| Sub-task | LLM needed? | Alternative |
|---|---|---|
| Is this email in English? | No | `langdetect` library — 0.5ms |
| Does subject contain "URGENT" or "billing"? | No | `"urgent" in subject.lower()` |
| Is this a reply to an existing ticket? | No | Check for ticket ID pattern in subject: `re.search(r'TKT-\d+')` |
| What is the emotional tone of the email? | Yes | Tone is nuanced — code cannot reliably detect it |
| What is the specific technical issue described? | Yes | Free-form description — LLM needed for understanding |

Result: three of the five sub-tasks can be handled by code. The LLM call handles only tone and issue categorisation — a much smaller and more focused prompt, which improves accuracy and cuts cost by 60%.

## The hybrid pattern {#hybrid-pattern}

Many production systems use a hybrid: fast code as a first pass, LLM as a fallback for cases the code cannot handle:

```python
def classify_email(email: str) -> TicketClassification:
    # Fast, cheap first pass
    subject = email.split('\n')[0].lower()
    if 'unsubscribe' in subject or 'opt out' in subject:
        return TicketClassification(category="unsubscribe", priority="low",
                                    needs_escalation=False)
    if re.search(r'TKT-\d+', subject):
        return TicketClassification(category="existing_ticket", priority="medium",
                                    needs_escalation=False)

    # Only call the LLM for emails that code cannot classify
    return classify_with_llm(email)
```

In a typical support inbox, 30–40% of emails can be classified by code alone. The LLM handles the rest. This pattern cuts LLM call volume by a third with zero loss in quality for the classified emails.
