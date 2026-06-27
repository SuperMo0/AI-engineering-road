---
layout: lesson
lesson_id: "0026"
chapter: 4
chapter_title: "RAG & Vector Search"
title: "What is RAG and why LLMs need it"
description: "30–40 min read · Hands-on coding"
prev: "P009-ch3-ai-backend.html"
prev_title: "Full AI backend service"
next: "0027-embeddings.html"
next_title: "Embeddings — turning text into numbers"
prereqs:
  - "[Lesson 2](0002-openai-api-basics.html): OpenAI API basics — you need to know how to make a chat completion call"
  - "[Lesson 5](0005-prompt-engineering.html): Prompt engineering — RAG extends the system prompt pattern you already know"
  - "[Lesson 3](0003-chat-and-history.html): Conversations and chat history — the messages array is where retrieved context lives"
assignment:
  article:
    title: "Retrieval-Augmented Generation (RAG)"
    url: "https://www.pinecone.io/learn/retrieval-augmented-generation/"
    author: "Pinecone"
    time: "15 min"
    why: "Pinecone's learning centre is one of the best-maintained RAG references in the industry. This guide walks through the full pipeline with clear diagrams and ties the concept to production systems — the kind you'll be building in this chapter."
  task:
    description: "Build a minimal RAG demo using hardcoded retrieved text."
    steps:
      - "Create `rag_demo.py` and ask GPT-4o a question about a fictional company's return policy with no context. Print the response."
      - "Now hard-code a 3–4 sentence 'retrieved' policy document into a system prompt and ask the same question again."
      - "Add a second question — 'Can I return an item after 6 months?' — and observe how the model answers from context."
    expected: "Two runs: one where the model admits it doesn't know (or makes something up), one where it answers correctly from the hardcoded context."
    why: "Before you build retrieval infrastructure you need to see with your own eyes that context-in-prompt is all RAG is. The LLM half is the same API call you've been making since Chapter 1 — the complexity lives entirely in the retrieval side."
knowledge_check:
  - q: "What is a training cutoff, and why does it matter for AI applications?"
    a: "A training cutoff is the date after which the model's training data ends. The model has no knowledge of events, documents, or changes that happened after that date. It matters because an application that relies on the model's built-in knowledge will give outdated or wrong answers for anything recent — new prices, new policies, new world events."
    section: "#the-knowledge-cutoff-problem"
    section_title: "The knowledge cutoff problem"
  - q: "What does RAG stand for, and what does each word mean in plain English?"
    a: "**Retrieve** — find relevant text from your own document store. **Augment** — add that text to the prompt before sending it to the LLM. **Generate** — the LLM answers using the provided context. The acronym describes the three-step pipeline in order."
    section: "#what-rag-is"
    section_title: "What RAG is"
  - q: "What is hallucination, and what causes it?"
    a: "Hallucination is when an LLM confidently states something false. It happens because LLMs are trained to produce fluent, coherent text — not to retrieve verified facts. When the model doesn't know an answer it still generates plausible-sounding text, which may be entirely wrong. RAG reduces hallucination by supplying the correct answer in context, leaving the model less room to invent."
    section: "#the-hallucination-problem"
    section_title: "The hallucination problem"
  - q: "When should you choose RAG over fine-tuning?"
    a: "Choose RAG when you need the model to know specific facts (company documents, product specs, recent events), when your data changes frequently, or when you need to cite sources. Fine-tuning is better when you want the model to adopt a specific style or output format — not to know new facts. RAG is the correct default; fine-tuning sits at the bottom of the Staircase of Complexity."
    section: "#rag-vs-fine-tuning"
    section_title: "RAG vs fine-tuning"
  - q: "What is the single most important insight to carry into the rest of this chapter?"
    a: "The generation step in RAG is just an ordinary chat completion — the LLM receives retrieved text in the context window and uses it to answer. The entire complexity of a RAG system lives in the retrieval pipeline: how you find the right documents to include. Master retrieval and the LLM half takes care of itself."
    section: "#the-rag-pipeline-in-detail"
    section_title: "The RAG pipeline in detail"
additional_resources:
  - title: "Original RAG paper (Lewis et al., 2020)"
    url: "https://arxiv.org/abs/2005.11401"
    desc: "The academic paper that coined the term — useful if you want to understand the research origins and formal definition"
  - title: "Anthropic: Claude's approach to RAG"
    url: "https://docs.anthropic.com/en/docs/build-with-claude/retrieval-augmented-generation"
    desc: "Claude-specific RAG guidance including prompt patterns and best practices"
  - title: "AWS: What is RAG?"
    url: "https://aws.amazon.com/what-is/retrieval-augmented-generation/"
    desc: "Enterprise-oriented overview useful if you encounter AWS terminology in job descriptions"
---

## Motivation

You've shipped an AI-powered customer support bot. It handles thousands of queries a day. Then your company updates its return policy. The bot doesn't know — it's still answering based on last year's rules. Customers get wrong information. Someone asks about a product that launched last month; the bot has never heard of it.

This is not a bug in your code. It's a fundamental property of how LLMs work. Retrieval-Augmented Generation — RAG — is the solution that every production AI application reaches for. By the end of this chapter you will have built a full RAG pipeline from scratch, and you'll understand exactly how every piece fits together.

{% include prereqs.html %}

## The knowledge cutoff problem

When an LLM is trained, it processes a massive snapshot of text from the internet: books, websites, Wikipedia, code repositories, papers. Then training stops. The date training stops is called the **training cutoff** (or knowledge cutoff).

After that date, the model knows nothing new. It doesn't update automatically. It has no awareness that time has passed.

This creates a hard constraint for production applications:

- Your company's internal documentation has never been on the internet. The model has never seen it.
- Products launched after the cutoff don't exist in the model's world.
- Policies, prices, regulations — anything that changes over time — may be wrong.

Even if the model was trained yesterday, it still doesn't know your private data. And for enterprise applications, private data is almost always the most important data.

## The hallucination problem

There is a second, more dangerous issue: LLMs do not know what they don't know.

Ask a model a question it cannot possibly answer and it will often still generate a confident, fluent response. This is called **hallucination** — the model produces text that sounds plausible but is wrong, invented, or made up.

Hallucination happens because LLMs are trained to predict the next word in a sequence. They are very good at producing text that looks like an answer. The mechanism that generates correct answers is the same mechanism that generates incorrect ones — there is no separate "fact-checking" step happening under the hood.

Here is a concrete example:

```python
from openai import OpenAI

client = OpenAI()

response = client.chat.completions.create(
    model="gpt-4o",
    messages=[{
        "role": "user",
        "content": "What is Acme Corp's current return policy for widgets?"
    }]
)
print(response.choices[0].message.content)
```

Acme Corp is fictional. The model will either say it doesn't know (the honest response) or — more dangerously — invent a plausible-sounding return policy. In production, invented policies lead to real customer complaints and legal exposure.

## The private data problem

There is a third constraint that combines the two above. Even if the model's training data were perfectly up-to-date, your organisation's private data — internal wikis, product specs, customer records, proprietary research — was never in that training data. It lives on your servers, behind your firewall.

An AI system built on LLM capabilities alone cannot access your internal knowledge base. It can only tell customers things the model learned from public text on the internet.

All three problems — knowledge cutoffs, hallucination, and private data — have the same solution.

## What RAG is

RAG stands for **Retrieval-Augmented Generation**. It describes a three-step pipeline:

1. **Retrieve** — search your own document store and find the text most relevant to the user's question.
2. **Augment** — add that retrieved text to the prompt, before the LLM sees the question.
3. **Generate** — the LLM answers the question using the context you provided.

That is the complete concept. Everything else in this chapter — embeddings, vector databases, chunking, hybrid search, re-ranking — is in service of making Step 1 (Retrieve) work reliably at scale.

The generation step (Step 3) is just a chat completion. You already know how to do it.

## The core insight

Before writing a single line of retrieval code, you should understand what RAG feels like in practice. Here is the most minimal possible RAG demo:

```python
from openai import OpenAI

client = OpenAI()

# Step 1: Retrieve (hardcoded for now — real retrieval comes in later lessons)
retrieved_context = """
Acme Widget Return Policy (updated March 2026):
Widgets may be returned within 90 days of purchase for a full refund.
Items must be in original packaging with all accessories included.
Return shipping is free on all orders over $50.
Refunds are processed within 5–7 business days of receiving the return.
"""

# Step 2: Augment — add retrieved text to the system prompt
system_prompt = f"""You are a customer support assistant for Acme Corp.
Answer questions using only the information provided below.
If the answer is not in the context, say you don't have that information.

Context:
{retrieved_context}"""

# Step 3: Generate — ordinary chat completion
response = client.chat.completions.create(
    model="gpt-4o",
    messages=[
        {"role": "system", "content": system_prompt},
        {"role": "user", "content": "What is your return policy?"}
    ]
)
print(response.choices[0].message.content)
```

Run this and you will see the model answer correctly — not because it learned about Acme Corp during training, but because you gave it the answer in the context. The model reads it and reports it back. That is RAG.

Now try a question the context doesn't answer:

```python
response = client.chat.completions.create(
    model="gpt-4o",
    messages=[
        {"role": "system", "content": system_prompt},
        {"role": "user", "content": "Can I return a widget after 6 months?"}
    ]
)
print(response.choices[0].message.content)
# "The return policy covers returns within 90 days. I don't have information
# about returns after that period."
```

The model does not hallucinate an answer — it correctly reports that the context doesn't cover this case. This is exactly the behaviour you want in production, and it comes from the system prompt instruction: "If the answer is not in the context, say you don't have that information."

## The RAG pipeline in detail

In the demo above, the "retrieved" text was hardcoded. In a real system, Step 1 works automatically: given any user question, the system finds the most relevant passages from a document store that might contain thousands of documents.

Here is the full picture:

**At ingestion time** (when you load your documents):
1. Split documents into chunks of text (a paragraph or two each).
2. Convert each chunk into a **vector** — a list of numbers that captures its meaning.
3. Store those vectors in a **vector database**.

**At query time** (when a user asks a question):
1. Convert the user's question into a vector using the same method.
2. Search the vector database for the chunks whose vectors are closest to the question's vector.
3. Take the top-K results and insert them into the prompt.
4. Send the augmented prompt to the LLM.
5. Return the LLM's answer.

The rest of this chapter teaches you each of these steps. Lesson 27 covers vectors (embeddings). Lesson 28 covers chunking. Lesson 29 covers vector databases. By the end of this chapter you will have built every part of this pipeline.

<div class="callout info">
<strong>Why not just put all your documents in the context window?</strong> Modern LLMs have large context windows — up to 200,000 tokens for some models. If your document store is small enough to fit, you can skip retrieval entirely and include everything in the prompt. This is called <strong>context stuffing</strong> and it works well when you have a handful of documents. RAG becomes necessary when your document store is too large to fit — or when you want to retrieve only the most relevant material to reduce cost and improve accuracy.
</div>

## RAG vs fine-tuning

A common question is: "Why not just fine-tune the model on our documents instead of doing all this retrieval work?"

Fine-tuning means taking a pre-trained model and training it further on your own data, so the model's weights encode your domain knowledge. This sounds appealing — you'd skip the retrieval system entirely.

In practice, fine-tuning is the wrong tool for the job in almost every case:

| Situation | RAG | Fine-tuning |
|-----------|-----|-------------|
| Model needs to know specific facts | ✓ | ✗ — facts learned during training degrade over time |
| Data changes frequently | ✓ — re-index without retraining | ✗ — requires retraining for every update |
| Need to cite sources | ✓ — you know exactly which chunks were retrieved | ✗ — model can't cite what it learned during training |
| Want a specific output format | ✗ | ✓ — format is best taught through examples |
| Want a specific tone or persona | ✗ | ✓ — style transfers well through fine-tuning |
| Have limited training examples | ✓ — RAG works with any number of documents | ✗ — fine-tuning needs hundreds to thousands of examples |

The rule of thumb from the Staircase of Complexity (Lesson 6): **try RAG first, reach for fine-tuning only when RAG has been proven insufficient for the specific problem**.

Fine-tuning is covered in Lesson 40 — after you have used the entire stack and can make an informed decision.

## When RAG is not the answer

RAG is not a universal solution. There are cases where it is the wrong approach:

**When the question requires reasoning, not recall.** If a user asks "What is the best pricing strategy for our new product?", there is no document that contains the answer. The model needs to reason, not retrieve. RAG cannot substitute for reasoning.

**When your data is too structured.** If the answer to a question lives in a database table — "What was our revenue in Q3 2025?" — a SQL query is faster, cheaper, and more reliable than a RAG pipeline. Use structured data tools for structured data questions.

**When you need real-time information.** A RAG pipeline answers from a document store that was indexed at ingestion time. If the answer changes minute-to-minute (live stock prices, sensor readings, production logs), you need a different architecture — a tool-calling agent that queries a live data source, not a retrieval system querying a static index.

**When the context window is sufficient.** If your entire knowledge base fits in 50,000 tokens and you can afford to include it on every request, do that — it is simpler, has no retrieval failures, and gives the model full context.

RAG is the right choice when: you have a large body of text documents that do not fit in a context window, the answers to user questions live in those documents, and the documents change frequently enough that re-training would be impractical.

## What comes next

You now understand what RAG is and why it exists. The rest of Chapter 4 teaches you how to build it.

The next lesson introduces **embeddings** — the mechanism that makes "find relevant documents" work. Without embeddings, there is no way to search by meaning rather than by exact keyword match.
