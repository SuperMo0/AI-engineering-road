---
layout: lesson
lesson_id: "0032"
chapter: 4
chapter_title: "RAG & Vector Search"
title: "Advanced retrieval — contextual retrieval, query expansion, re-ranking"
description: "30–40 min read · Hands-on coding"
prev: "0031-similarity-hybrid-search.html"
prev_title: "Similarity search and hybrid search"
next: "P011-multi-source-rag.html"
next_title: "Multi-source RAG system"
prereqs:
  - "[Lesson 27](0027-embeddings.html): Embeddings — contextual retrieval modifies how chunks are embedded"
  - "[Lesson 28](0028-chunking.html): Chunking — contextual retrieval adds context to each chunk at ingestion time"
  - "[Lesson 31](0031-similarity-hybrid-search.html): Hybrid search — re-ranking sits after hybrid retrieval in the pipeline"
assignment:
  article:
    title: "Introducing Contextual Retrieval"
    url: "https://www.anthropic.com/news/contextual-retrieval"
    author: "Anthropic"
    time: "15 min"
    why: "Anthropic published this after finding that standard RAG failed on their own documentation — chunks lost their context when separated from the surrounding document. This article is the primary reference for contextual retrieval, explains the exact failure mode it fixes, and includes benchmark numbers showing a 49% reduction in retrieval failures on their test set."
  task:
    description: "Implement contextual retrieval for a small document set."
    steps:
      - "Take 5 paragraphs from a long document (each paragraph should make limited sense without the surrounding document)"
      - "For each paragraph, call Claude or GPT-4o with the prompt in this lesson to generate a context sentence"
      - "Create two Chroma collections: one with raw chunks, one with context-prepended chunks"
      - "Run 3 queries that test retrieval on out-of-context paragraphs"
      - "Compare which collection returns the more relevant results"
    expected: "The contextualised collection returns more relevant chunks for questions that rely on document-level context."
    why: "Contextual retrieval is one of the highest-impact improvements you can make to a standard RAG pipeline, and it is cheap: one LLM call per chunk at ingestion time, which you pay once. Implementing it by hand makes the technique yours to use confidently."
knowledge_check:
  - q: "What problem does contextual retrieval solve?"
    a: "Standard chunking strips context. A paragraph like 'The net profit for this period was $47M' is meaningless out of context — it doesn't say which company, which period, or what currency. Contextual retrieval prepends a sentence that supplies that context at ingestion time, so the embedded chunk carries enough information to be matched correctly at query time."
    section: "#contextual-retrieval"
    section_title: "Contextual retrieval"
  - q: "What is query expansion and why does it improve recall?"
    a: "Query expansion generates multiple reformulations of the user's question and runs retrieval for each one. A user question might use different vocabulary than the documents — 'money back guarantee' vs 'refund policy', 'sack' vs 'terminate employment'. Running 3–5 queries based on the original increases the chance of matching documents that use different phrasing. Results are merged and deduplicated before passing to the LLM."
    section: "#query-expansion"
    section_title: "Query expansion"
  - q: "What is a cross-encoder and how does it differ from the bi-encoder used for embedding search?"
    a: "A bi-encoder (the embedding model) processes the query and each document separately, then compares their vectors. It is fast because documents are embedded once. A cross-encoder processes the query and a document together in one pass and produces a single relevance score. It cannot be used for initial retrieval (too slow) but is much more accurate as a re-ranker over a short candidate list (top 20–30 results)."
    section: "#re-ranking-with-a-cross-encoder"
    section_title: "Re-ranking with a cross-encoder"
  - q: "What is self-querying and when is it useful?"
    a: "Self-querying uses an LLM to extract structured metadata filters from a natural-language question. For example, 'Show me all complaints filed in Q1 2026 about billing' is converted to a structured filter: {date_range: '2026-01-01 to 2026-03-31', category: 'billing'}. The filter is applied before vector search, limiting the search space. It is useful when your documents have rich structured metadata and user queries implicitly require filtering by date, author, category, or similar attributes."
    section: "#self-querying"
    section_title: "Self-querying — metadata filters from natural language"
additional_resources:
  - title: "Contextual Retrieval with BM25 (Anthropic)"
    url: "https://www.anthropic.com/news/contextual-retrieval"
    desc: "The full benchmark comparing standard RAG, contextual retrieval, BM25, and their combinations — shows a 67% reduction in failures when combining contextual retrieval with BM25"
  - title: "Cross-Encoder models on Hugging Face"
    url: "https://huggingface.co/cross-encoder"
    desc: "Open-source cross-encoder models for re-ranking — ms-marco-MiniLM-L-6-v2 is the standard starting point"
  - title: "Cohere Rerank API"
    url: "https://docs.cohere.com/docs/rerank-2"
    desc: "Managed cross-encoder API — simplest way to add re-ranking without running a local model"
  - title: "HyDE — Hypothetical Document Embeddings"
    url: "https://arxiv.org/abs/2212.10496"
    desc: "Alternative to query expansion: generate a hypothetical answer to the query, embed that, and search for similar documents. Effective when queries are very short."
---

## Motivation

Hybrid search from Lesson 31 significantly improves recall — you are less likely to miss relevant documents. But there are still failure modes:

- A paragraph chunk says "The net profit was $47M" — great answer to "what was the company's net profit?" but the chunk has no idea which company it is talking about.
- A user asks "What did the CTO say about the roadmap?" — query expansion could help find this even if the document calls them "VP of Engineering."
- A user query filters by date: "Show me incidents from March 2026" — semantic search cannot extract that intent.
- You retrieve 20 documents; you want the LLM to see only the 5 most relevant — the order from vector search is not precise enough.

This lesson covers four advanced techniques that address these failure modes. Each one fits into a specific slot in the retrieval pipeline.

{% include prereqs.html %}

## Contextual retrieval

Contextual retrieval, introduced by Anthropic in 2024, addresses one of the most common RAG failure modes: **chunk context loss**.

When you split a document into chunks, each chunk is embedded independently. A chunk that says "The company reported strong growth this quarter" has no knowledge of which company, which quarter, or what "strong" means in context. When a user asks "How did Acme Corp perform in Q1 2026?", this chunk's embedding may not match well — because the chunk's vector captures a generic statement about growth, not a specific statement about Acme Corp.

**Contextual retrieval** fixes this by prepending a context sentence to each chunk before embedding it. The context sentence is generated by an LLM that can see the whole document:

```python
from anthropic import Anthropic

client = Anthropic()

def generate_chunk_context(document: str, chunk: str) -> str:
    """Generate a context sentence for a chunk, given its source document."""
    prompt = f"""<document>
{document}
</document>

Here is a chunk from the document:
<chunk>
{chunk}
</chunk>

Write a short sentence (1–2 sentences) that situates this chunk within the document.
Mention the document's subject, the relevant section, and any key identifiers
(company name, date, product name) that appear elsewhere in the document but
not in this chunk. Reply with only the context sentence, nothing else."""

    response = client.messages.create(
        model="claude-haiku-4-5-20251001",  # use Haiku — fast and cheap for this task
        max_tokens=100,
        messages=[{"role": "user", "content": prompt}]
    )
    return response.content[0].text.strip()

def contextualise_chunks(document: str, chunks: list[str]) -> list[str]:
    """Prepend context sentences to all chunks in a document."""
    contextualised = []
    for chunk in chunks:
        context = generate_chunk_context(document, chunk)
        contextualised.append(f"{context}\n\n{chunk}")
    return contextualised
```

The result: instead of embedding "The net profit was $47M", you embed "This chunk is from Acme Corp's Q1 2026 earnings report, covering financial results. The net profit was $47M."

According to Anthropic's benchmarks, contextual retrieval reduces retrieval failures by 49% compared to standard chunking. Combined with BM25, the improvement reaches 67%.

<div class="callout info">
<strong>Cost note:</strong> contextual retrieval adds one LLM call per chunk at ingestion time. Using Claude Haiku (the cheapest Claude model), 1,000 chunks costs roughly $0.05. This is a one-time ingestion cost — pay once, benefit every query.
</div>

## Query expansion

A user asks "Can I get my money back?" Your knowledge base says "Refund Policy: items may be returned within 30 days." Embedding search might find this — but it depends on how similarly the model represents "money back" and "refund". Sometimes it works; sometimes it does not.

**Query expansion** hedges against vocabulary mismatch by generating multiple reformulations of the user's question and running retrieval for each:

```python
from openai import OpenAI

client = OpenAI()

def expand_query(question: str, n: int = 3) -> list[str]:
    """Generate N reformulations of the question for retrieval."""
    response = client.chat.completions.create(
        model="gpt-4o-mini",
        messages=[{
            "role": "user",
            "content": f"""Generate {n} different phrasings of this question for document retrieval.
Use different vocabulary and sentence structure for each.
Return only the phrasings, one per line.

Question: {question}"""
        }],
        temperature=0.5
    )
    lines = response.choices[0].message.content.strip().split("\n")
    return [question] + [line.strip() for line in lines if line.strip()]

# Example
question = "Can I get my money back?"
queries = expand_query(question)
print(queries)
# ['Can I get my money back?',
#  'What is the refund policy?',
#  'How do I return a product?',
#  'Is there a money-back guarantee?']
```

Run retrieval for each query, merge the results, deduplicate, and rank with RRF:

```python
def retrieve_with_expansion(
    question: str,
    collection,  # Chroma collection
    n_queries: int = 3,
    results_per_query: int = 5
) -> list[str]:
    """Retrieve with query expansion + deduplication."""
    queries = expand_query(question, n=n_queries)
    
    all_results = {}  # doc_id → (text, best_score)
    
    for query in queries:
        results = collection.query(
            query_texts=[query],
            n_results=results_per_query
        )
        for doc_id, text, distance in zip(
            results["ids"][0],
            results["documents"][0],
            results["distances"][0]
        ):
            if doc_id not in all_results or distance < all_results[doc_id][1]:
                all_results[doc_id] = (text, distance)
    
    # Sort by best distance score and return top 5
    sorted_results = sorted(all_results.values(), key=lambda x: x[1])
    return [text for text, _ in sorted_results[:5]]
```

## Self-querying — metadata filters from natural language

If your documents have rich metadata (dates, authors, categories, departments), users will implicitly filter by them: "Show me complaints from last month" or "Find the design guidelines written by the UX team."

**Self-querying** uses an LLM to extract the filter from the query before running retrieval:

```python
import json

def extract_filters(question: str) -> tuple[str, dict]:
    """Return (cleaned_query, metadata_filters)."""
    response = client.chat.completions.create(
        model="gpt-4o-mini",
        messages=[{
            "role": "user",
            "content": f"""Extract any metadata filters from this question.
Return JSON with two fields:
- "query": the question without the filter constraints
- "filters": a dict of filter key-value pairs (empty if none)

Available metadata fields: date (YYYY-MM-DD), category, author, department

Question: {question}

Reply with only JSON."""
        }]
    )
    
    result = json.loads(response.choices[0].message.content)
    return result["query"], result.get("filters", {})

# Example
question = "What complaints about billing did we receive in March 2026?"
query, filters = extract_filters(question)
print(query)    # "What complaints did we receive about billing?"
print(filters)  # {"date": "2026-03", "category": "billing"}

# Apply filters in Chroma
results = collection.query(
    query_texts=[query],
    where={"category": "billing"},  # metadata pre-filter
    n_results=5
)
```

Self-querying works best when:
- Your collection has consistent metadata on every document
- User queries frequently reference metadata attributes ("last month", "from the finance team")
- The filter narrows the search space meaningfully

## Re-ranking with a cross-encoder

Hybrid retrieval with RRF gives you a ranked list of 20–30 candidates. The ranking is based on vector distances and BM25 scores — which are approximate. The top-5 is not always the truly most relevant top-5.

**Re-ranking** applies a more precise model to the candidate list. A **cross-encoder** reads both the query and a candidate document together and produces a single relevance score. This is much more accurate than the bi-encoder distance used in embedding search.

The cross-encoder cannot be used for initial retrieval (it would need to score every document in the collection — too slow). But it is fast over a short candidate list of 20–30 results.

Using the Sentence-Transformers library with a pre-trained cross-encoder:

```python
from sentence_transformers import CrossEncoder

# ms-marco-MiniLM-L-6-v2 is the standard starting point
reranker = CrossEncoder("cross-encoder/ms-marco-MiniLM-L-6-v2")

def rerank(query: str, candidates: list[str], top_k: int = 5) -> list[str]:
    """Re-rank a list of candidate passages using a cross-encoder."""
    pairs = [(query, doc) for doc in candidates]
    scores = reranker.predict(pairs)
    
    ranked = sorted(zip(scores, candidates), reverse=True)
    return [doc for _, doc in ranked[:top_k]]

# Example usage
question = "What is the refund policy for enterprise accounts?"
hybrid_candidates = retrieve_with_expansion(question, collection, n_queries=3)
final_context = rerank(question, hybrid_candidates, top_k=5)
```

Alternatively, use Cohere's Rerank API — a managed cross-encoder that requires no local model:

```python
import cohere

co = cohere.Client()

def rerank_with_cohere(query: str, candidates: list[str], top_k: int = 5) -> list[str]:
    results = co.rerank(
        query=query,
        documents=candidates,
        top_n=top_k,
        model="rerank-english-v3.0"
    )
    return [results.results[i].document["text"] for i in range(top_k)]
```

<div class="callout info">
<strong>Re-ranking cost:</strong> cross-encoder inference on 20 candidates takes 100–300ms on a CPU with a small model like MiniLM. The Cohere API charges per call. Re-ranking is worth it when retrieval precision matters more than latency.
</div>

## The complete advanced retrieval pipeline

Putting all four techniques together:

```
User query
    │
    ├──▶ Self-query: extract metadata filters  ──────────────────────┐
    │                                                                  │
    ├──▶ Query expansion: generate 3–5 query variants               │
    │         │                                                        │
    │         ├──▶ BM25 search (top 20, per variant)  ──┐            │
    │         │                                           ├──▶ RRF  ──┤
    │         └──▶ Embedding search (top 20, per variant)─┘           │
    │                                                                  │
    └──────────────── metadata pre-filter applied ◀──────────────────┘
                                │
                         Cross-encoder re-rank (top 5–10)
                                │
                         LLM context window
```

You do not need all four techniques for every application. Start with basic embedding search, add hybrid search when you see exact-match failures, add contextual retrieval when chunks lose context, add query expansion when query vocabulary diverges from document vocabulary, and add re-ranking when you need precision on a short candidate list.

## What comes next

You now have the full retrieval toolkit. The next page is your second project: build a multi-source RAG system that retrieves from PDFs, web pages, and CSV files simultaneously, using hybrid search and showing sources in the output.
