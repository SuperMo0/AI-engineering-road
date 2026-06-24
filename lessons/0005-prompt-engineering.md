---
layout: lesson
lesson_id: "0005"
chapter: 1
chapter_title: "Foundations of AI Engineering"
title: "Prompt engineering fundamentals"
description: "35–45 min read · Hands-on coding"
prev: "P001-cli-assistant.html"
prev_title: "Build a CLI AI assistant"
next: "0006-advanced-prompting.html"
next_title: "Advanced prompting — tokens, cost, and reliability"
prereqs:
  - "[Lesson 2](0002-openai-api-basics.html): `client.chat.completions.create()`, system messages"
  - "[Lesson 3](0003-chat-and-history.html): system/user/assistant roles"
assignment:
  article:
    title: "Chain-of-Thought Prompting"
    url: "https://learnprompting.org/docs/intermediate/chain_of_thought"
    author: "learnprompting.org"
    time: "about 10 minutes"
    why: "A clear explanation of why CoT works, with worked examples of the same problem solved with and without it. Builds intuition for when the technique actually helps."
  task:
    description: "Demonstrate each technique with a before/after comparison. Write a single script that runs five tests, each printing a \"before\" (basic prompt) and \"after\" (improved prompt) response for the same input."
    steps:
      - "Vague vs specific: ask for a summary of a paragraph, first vaguely, then with length and audience constraints"
      - "No system prompt vs strong system prompt: classify a support email, first with no system message, then with a clear one"
      - "Raw input vs XML-tagged input: ask a question about a document, first by pasting both together, then with `<document>` and `<question>` tags"
      - "Zero-shot vs few-shot: classify text tone (formal/casual), first with no examples, then with three examples"
      - "No CoT vs CoT: ask a multi-step reasoning question; compare the answers"
    expected: "Ten responses total. For at least three of the five pairs, the \"after\" response should be measurably better (more consistent format, more accurate, or shorter)."
    why: "Seeing the difference side by side is far more memorable than reading about it. This exercise also gives you a reusable test harness for prompt iteration."
knowledge_check:
  - q: "Why do few-shot examples often outperform written instructions for format-sensitive tasks?"
    a: "It is easier to demonstrate a format than to describe it. Written instructions can be ambiguous or interpreted in unexpected ways. An example shows the exact pattern — length, tone, structure — unambiguously. The model pattern-matches to examples more reliably than it follows abstract descriptions."
    section: "#few-shot"
    section_title: "Few-shot prompting"
  - q: "What is chain-of-thought prompting, and when is it worth the extra token cost?"
    a: "CoT prompting instructs the model to work through the problem step by step before giving its final answer. It is worth the extra tokens for complex reasoning tasks — multi-step maths, logic, legal/medical analysis — where a fast guess is likely wrong. For simple extraction or classification, CoT does not improve accuracy and is not worth using."
    section: "#chain-of-thought"
    section_title: "Chain-of-thought"
  - q: "What does the system message control, and what does it not control?"
    a: "The system message controls persona, tone, domain restrictions, output format, and rules that apply for the whole session. It does not provide a hard security boundary — a determined user can often override it with clever prompting. It is effective for steering normal use, not for enforcing security constraints."
    section: "#system-prompts"
    section_title: "System prompts"
  - q: "Why use XML tags when a prompt contains multiple pieces of information?"
    a: "Multiple pieces of raw text in a prompt can blur together — the model may give some sections undue weight or confuse which part is the instruction and which is the data. XML tags make the boundaries explicit and unambiguous, because the model has learned to treat them as structural separators."
    section: "#xml-tags"
    section_title: "XML tags"
additional_resources:
  - title: "Anthropic Prompt Library"
    url: "https://docs.anthropic.com/en/prompt-library/library"
    desc: "Real, production-tested prompts across many domains; excellent source for system prompt patterns"
  - title: "learnprompting.org"
    url: "https://learnprompting.org/"
    desc: "Free, community-maintained prompt engineering guide covering beginner through advanced techniques"
---

## Motivation

An LLM is a capable new employee who knows almost everything but has no context about your specific situation. If you give vague instructions, you get vague results. If you give clear, structured instructions, you get consistent, production-worthy outputs. The craft of writing those instructions is prompt engineering — and it is one of the highest-leverage skills an AI engineer can have.

A well-crafted prompt can turn a mediocre model response into one that's correct 90% of the time. A badly-crafted one will frustrate you into thinking the model is broken when the instructions were the problem all along.

{% include prereqs.html %}

## Technique 1: Be clear, direct, and specific {#clear-direct-specific}

LLMs do not infer intent from vague requests — they pattern-match to the most likely response for the exact words you used. If your words are ambiguous, the output will reflect that ambiguity.

Treat the model like a brilliant contractor who has just joined your team. They are capable of extraordinary work but have no knowledge of your organisation, your standards, or what "good" looks like for your use case. You must be explicit.

| Vague (bad) | Clear (good) |
|---|---|
| "Write a summary." | "Write a 3-sentence summary for a non-technical executive. Focus on business impact, not technical details." |
| "Fix my code." | "Find and fix the bug in this Python function. Return only the corrected function, no explanation." |
| "Translate this." | "Translate the following from English to French. Preserve the formal register." |

Every adjective you add is a constraint. Every constraint narrows the output distribution. Narrower distributions produce more consistent results.

## Technique 2: Use the system prompt for persistent context {#system-prompts}

The system message is not just a nice-to-have — it is where you define who the model is for the entire session. Use it to set:

- **Persona:** what role the model plays
- **Tone:** formal, casual, concise, verbose
- **Domain:** restrict the model to relevant knowledge areas
- **Output format:** always respond in JSON, always use bullet points, etc.
- **Hard rules:** never reveal internal reasoning, never make up citations

A well-structured system prompt for a customer support bot:

```python
system_prompt = """You are Aria, a friendly customer support agent for Acme Software.

Your job:
- Answer questions about Acme's products (pricing, features, integrations).
- Help customers troubleshoot common issues.
- Escalate complex problems by saying "I'll connect you with our support team."

Rules:
- Never make up product features that are not in the context provided.
- Never discuss competitors by name.
- Keep replies under 150 words.
- Always end with: "Is there anything else I can help you with?"

Tone: warm, professional, direct."""
```

Notice how the prompt separates job description, rules, and tone. This structure is easy to iterate on — you can tweak just the rules without touching the persona.

## Technique 3: Use XML tags to structure multi-part input {#xml-tags}

When your prompt contains multiple distinct pieces of information — a document, a question, some context, some instructions — the model can mix them up or give one piece more weight than intended.

Wrapping each piece in XML-style tags makes the structure unambiguous:

```python
user_message = """
<document>
{document_text}
</document>

<question>
{user_question}
</question>

Answer the question using only information from the document.
If the answer is not in the document, say "I don't know."
"""
```

The model has seen enormous amounts of XML and HTML during training, so it correctly interprets these as structural separators. This approach is especially useful when injecting retrieved documents into a RAG system (Chapter 4) or when passing code alongside instructions.

You can also ask the model to respond using XML tags:

```text
"Respond using this format:
<answer>Your answer here</answer>
<confidence>high | medium | low</confidence>"
```

This is a lightweight alternative to full structured outputs when you just need a few fields — you parse the tags yourself with a simple string extract.

## Technique 4: Few-shot prompting — examples beat instructions {#few-shot}

Sometimes the clearest way to show the model what you want is not to describe it in words, but to show it examples of correct input-output pairs. This is called **few-shot prompting** — "few-shot" means you are providing a few examples.

Few-shot is particularly effective for:

- Tasks with a specific output style that is hard to describe
- Classification tasks where the categories need demonstration
- Formatting tasks where the exact format matters

The examples go in the messages list as `user`/`assistant` pairs, before the real user message:

```python
messages = [
    {"role": "system", "content": "Classify the sentiment of each review as: positive, neutral, or negative."},

    # Example 1
    {"role": "user",      "content": "This product changed my life. Absolutely love it."},
    {"role": "assistant", "content": "positive"},

    # Example 2
    {"role": "user",      "content": "Works fine, nothing special."},
    {"role": "assistant", "content": "neutral"},

    # Example 3
    {"role": "user",      "content": "Broke after two days. Total waste of money."},
    {"role": "assistant", "content": "negative"},

    # Real input
    {"role": "user", "content": "Decent quality, but the shipping took three weeks."},
]
```

The model sees the pattern — single-word reply, no explanation — and applies it consistently to the real input. Without the examples, it might reply with a full sentence like "The review appears to be neutral in sentiment."

Three examples is usually enough. More than five rarely helps and increases token cost. Choose examples that cover edge cases, not just easy cases.

## Technique 5: Chain-of-thought — ask the model to think first {#chain-of-thought}

LLMs generate text token by token. When they produce an answer immediately, they have committed to it before "reasoning" about it. Asking the model to show its reasoning before giving the final answer — known as **chain-of-thought (CoT)** prompting — forces it to work through the problem step by step, which consistently improves accuracy on complex tasks.

The simplest form: add "Think step by step" to your prompt.

| Without CoT | With CoT |
|---|---|
| "Is this contract clause legally enforceable? Answer yes or no." | "Is this contract clause legally enforceable? Think through the relevant legal considerations step by step, then give your final answer." |

For production use, you often want the reasoning hidden from the user and only the final answer surfaced. Use XML tags for this:

```python
system_prompt = """When answering complex questions:
1. First, think through the problem inside <thinking> tags.
2. Then give your final answer inside <answer> tags.

The user will only see the answer tag."""
```

Then strip the `<thinking>` block from the response before showing it to the user. The model gets to reason; the user gets a clean answer.

CoT is most valuable for: multi-step reasoning, maths, logic puzzles, legal or medical analysis, and any task where a fast guess is worse than a slower, considered response. For simple classification tasks or extraction, CoT adds tokens without improving accuracy.

## Choosing the right technique

| Situation | Technique |
|---|---|
| Output is vague or inconsistent | Be more specific; add constraints to system prompt |
| Output format is wrong | Add format examples (few-shot) or use XML tags |
| Multi-part input is getting confused | XML tags to separate sections |
| Accuracy on complex tasks is low | Chain-of-thought |
| Classification is inconsistent | Few-shot with representative examples |
| Model invents facts | Restrict to provided context; add "if not in context, say I don't know" |

Always start with the simplest technique and add complexity only if it helps. A clear system message often solves the problem on its own. Reach for few-shot or CoT when basic clarity is not enough.
