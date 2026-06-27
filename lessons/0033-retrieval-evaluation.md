---
layout: lesson
lesson_id: "0033"
chapter: 4
chapter_title: "RAG & Vector Search"
title: "Evaluating retrieval quality"
description: "30–40 min read · Hands-on coding"
prev: "P011-multi-source-rag.html"
prev_title: "Multi-source RAG system"
next: "P012-ch4-knowledge-base.html"
next_title: "Enterprise knowledge base"
prereqs:
  - "[Lesson 26](0026-what-is-rag.html): What is RAG — you need to understand what retrieval is before you can evaluate it"
  - "[Project P010](P010-pdf-qa.html): PDF Q&A — you have a retrieval system to evaluate"
  - "[Project P011](P011-multi-source-rag.html): Multi-source RAG — gives you a richer system to run evals against"
assignment:
  article:
    title: "What Are Evals?"
    url: "https://www.aihero.dev/what-are-evals"
    author: "Matt Pocock, AI Hero"
    time: "12 min"
    why: "This article explains what evals are, why they matter, and how to think about them at different stages of an AI system — from unit-level to system-level. It establishes the vocabulary (test dataset, pass rate, failure modes) you need to design and run the evaluation in this lesson's assignment."
  task:
    description: "Write 10 test questions for your PDF Q&A system and report your retrieval pass rate."
    steps:
      - "Choose a PDF you have already ingested. Write 10 questions whose answers are specific to that document."
      - "For each question, record the expected source: the chunk or page number that should appear in the top-3 retrieved results."
      - "Run your retrieval pipeline for each question and check whether the expected source appears in the top-3 results."
      - "Calculate Precision@3: (number of questions where the expected source appeared in top 3) / 10"
      - "For questions that failed, print the top-3 retrieved chunks and try to understand why the right chunk was not returned."
    expected: "A printed report: '7/10 queries retrieved the expected source in the top 3 results (Precision@3 = 0.70). Failures: ...' plus a short analysis of at least one failure mode."
    why: "Until you run this eval, your RAG system is a black box. Once you have a pass rate, you have a baseline — and every improvement you make (hybrid search, contextual retrieval, larger chunks) can be measured against it."
knowledge_check:
  - q: "What is Precision@K in retrieval evaluation?"
    a: "Precision@K measures what fraction of the top-K retrieved results are actually relevant. For example, if you retrieve 3 chunks and 2 of them are relevant, Precision@3 = 0.67. In practice, for RAG evaluation you often simplify this to: 'did the expected source appear in the top K results?' — a binary pass/fail per query."
    section: "#precision-and-recall-at-k"
    section_title: "Precision and Recall at K"
  - q: "What is a question-answer-source triple and why is it the basic unit of a retrieval test dataset?"
    a: "A QAS triple is a tuple of (question, expected answer, expected source chunk/document). The question is what a real user might ask. The expected answer lets you verify the LLM's response is correct. The expected source is which chunk should be retrieved — this is what you evaluate retrieval against. Without the source component, you can only evaluate the final answer, not the retrieval step independently."
    section: "#building-a-test-dataset"
    section_title: "Building a test dataset"
  - q: "What is Mean Reciprocal Rank (MRR) and what does it tell you that Precision@K does not?"
    a: "MRR measures the average reciprocal of the rank of the first relevant result. If the right document appears at rank 1, reciprocal rank = 1/1 = 1. At rank 3, it is 1/3 = 0.33. MRR tells you not just whether the right document appeared in the top K, but how high it ranked. A system with MRR of 0.9 puts the right answer near the top; one with MRR of 0.4 often buries it."
    section: "#mean-reciprocal-rank"
    section_title: "Mean Reciprocal Rank (MRR)"
  - q: "What are the two most common retrieval failure modes in a standard RAG system?"
    a: "1. **Vocabulary mismatch** — the query uses different words than the document ('refund' vs 'money back', 'dismiss' vs 'fire'). Hybrid search (BM25 + embedding) and query expansion address this. 2. **Context loss** — a chunk is correctly embedded but lacks the document-level context that would make it identifiable as the right answer (e.g., 'The net profit was $47M' with no company name). Contextual retrieval addresses this."
    section: "#identifying-failure-modes"
    section_title: "Identifying failure modes"
additional_resources:
  - title: "RAGAS — RAG assessment framework"
    url: "https://docs.ragas.io/"
    desc: "Open-source framework for evaluating RAG pipelines end-to-end, including faithfulness, answer relevancy, and context precision"
  - title: "Evaluating chunking strategies (Chroma research)"
    url: "https://research.trychroma.com/evaluating-chunking"
    desc: "Empirical benchmarks for different chunking approaches — useful reference for interpreting your own eval results"
  - title: "BEIR benchmark"
    url: "https://github.com/beir-cellar/beir"
    desc: "Standard benchmark for evaluating information retrieval systems across many domains and task types"
---

## Motivation

You have built a RAG system. Does it work? "It seems to answer correctly" is not an answer you can take to a client, use to track improvements, or compare with a colleague's implementation.

Evaluation is how you turn "seems to work" into "retrieves the correct source 84% of the time." Once you have a number, every change to your pipeline — different chunk size, hybrid search, contextual retrieval — can be measured. Without a number, you are guessing.

This lesson teaches you to build a test dataset and compute retrieval quality metrics. The principles here carry forward to Lessons 36 and 37 (LLM output evaluation and LLM-as-judge), which extend the same ideas to the generation step.

{% include prereqs.html %}

## What retrieval evaluation measures

A RAG system has two separate quality concerns:

1. **Retrieval quality**: did the system find the right documents?
2. **Answer quality**: did the LLM produce the right answer from those documents?

These must be evaluated separately. If the LLM produces a wrong answer, the cause might be bad retrieval (wrong documents retrieved) or bad generation (right documents, wrong answer). Conflating the two makes debugging impossible.

This lesson focuses on retrieval quality. Answer quality is covered in Chapter 5.

## Building a test dataset

The foundation of any evaluation is a **test dataset**: a collection of known inputs with known expected outputs. For retrieval evaluation, the unit is a **question-answer-source triple**:

- **Question** — what a real user might ask
- **Expected answer** — the correct answer (used to verify generation quality; not needed for retrieval-only eval)
- **Expected source** — which specific chunk or document should be retrieved to answer this question

The expected source is the key element. It is what you compare against the retrieval results.

```python
# A test dataset for a product manual RAG system
TEST_DATASET = [
    {
        "question": "What is the torque spec for the drive shaft bolts?",
        "expected_answer": "65 ft-lb using a calibrated torque wrench",
        "expected_source": "manual.pdf",
        "expected_chunk_contains": "torque the drive shaft bolts to 65 ft-lb"
    },
    {
        "question": "How often should universal joints be inspected?",
        "expected_answer": "Every 30,000 miles",
        "expected_source": "manual.pdf",
        "expected_chunk_contains": "inspect the universal joints for wear every 30,000 miles"
    },
    {
        "question": "What is the refund window for enterprise accounts?",
        "expected_answer": "180 days",
        "expected_source": "policy.pdf",
        "expected_chunk_contains": "enterprise accounts are eligible for refunds within 180 days"
    },
    # ... 7 more
]
```

**Creating good test questions:**
- Write them yourself from the documents — do not generate them with an LLM (generated questions are too easy to retrieve)
- Include questions whose answers span multiple sections
- Include at least 2 questions with no answer in the document (to test the "I don't know" behaviour)
- Include questions that use different vocabulary than the document (paraphrase test)
- Aim for 10–50 questions for initial evaluation; 100+ for production tracking

## Precision and Recall at K

**Precision@K** (P@K) answers: "Of the K documents I retrieved, how many are relevant?"

For the simplified RAG evaluation where each question has exactly one expected source:

```
P@K = 1 if expected_source appears in top K results
      0 otherwise
```

Averaged over all test questions, this gives your pass rate.

**Recall@K** asks: "Of all relevant documents, how many did I retrieve in the top K?" For most RAG setups where each question has one expected document, recall and precision at K are equivalent.

Let's implement:

```python
def evaluate_retrieval(
    test_dataset: list[dict],
    retrieve_fn,  # callable: query -> list of {"text": ..., "source": ...} dicts
    k: int = 3
) -> dict:
    """
    Evaluate retrieval quality on a test dataset.
    retrieve_fn should return chunks in ranked order (best first).
    """
    results = {
        "total": len(test_dataset),
        "passed": 0,
        "failed": [],
        "precision_at_k": 0.0
    }
    
    for item in test_dataset:
        question = item["question"]
        expected_contains = item["expected_chunk_contains"].lower()
        
        retrieved = retrieve_fn(question)[:k]
        
        # Check if expected content appears in any of the top-K chunks
        found = any(
            expected_contains in chunk["text"].lower()
            for chunk in retrieved
        )
        
        if found:
            results["passed"] += 1
        else:
            results["failed"].append({
                "question": question,
                "expected": expected_contains,
                "got": [c["text"][:100] for c in retrieved]
            })
    
    results["precision_at_k"] = results["passed"] / results["total"]
    return results

# Run the evaluation
eval_results = evaluate_retrieval(TEST_DATASET, retrieve_fn=your_retrieval_fn, k=3)

print(f"Precision@3: {eval_results['precision_at_k']:.2%}")
print(f"Passed: {eval_results['passed']}/{eval_results['total']}")
```

## Mean Reciprocal Rank

**Mean Reciprocal Rank (MRR)** is more informative than Precision@K because it rewards systems that rank the expected document higher.

For a single query, the Reciprocal Rank is `1/rank` where rank is the position of the first relevant document (1-indexed). If the expected document is at position 1, RR = 1. At position 3, RR = 0.33. Not found in top K: RR = 0.

MRR is the average Reciprocal Rank across all queries:

```python
def compute_mrr(
    test_dataset: list[dict],
    retrieve_fn,
    k: int = 10
) -> float:
    reciprocal_ranks = []
    
    for item in test_dataset:
        question = item["question"]
        expected = item["expected_chunk_contains"].lower()
        
        retrieved = retrieve_fn(question)[:k]
        
        rr = 0.0
        for rank, chunk in enumerate(retrieved, start=1):
            if expected in chunk["text"].lower():
                rr = 1.0 / rank
                break
        
        reciprocal_ranks.append(rr)
    
    return sum(reciprocal_ranks) / len(reciprocal_ranks)

mrr = compute_mrr(TEST_DATASET, retrieve_fn=your_retrieval_fn, k=10)
print(f"MRR@10: {mrr:.4f}")
```

MRR interpretation:
- 0.9+ — excellent; the right answer is almost always the first result
- 0.7–0.9 — good; occasionally ranked 2nd or 3rd
- 0.5–0.7 — acceptable; some retrieval failures
- Below 0.5 — significant retrieval problems to investigate

## Identifying failure modes

The most valuable output of an eval run is not the score — it is the list of failures. Examine them manually:

```python
def print_failures(eval_results: dict) -> None:
    print(f"\n=== FAILED QUERIES ({len(eval_results['failed'])}) ===\n")
    for i, failure in enumerate(eval_results["failed"], 1):
        print(f"Failure {i}:")
        print(f"  Question: {failure['question']}")
        print(f"  Expected: {failure['expected'][:80]}")
        print(f"  Got top-3:")
        for chunk_preview in failure["got"][:3]:
            print(f"    - {chunk_preview[:80]}")
        print()

print_failures(eval_results)
```

**Common failure patterns and fixes:**

| Pattern | What you see | Fix |
|---------|-------------|-----|
| Vocabulary mismatch | Question uses "refund"; document uses "money-back guarantee" | Add hybrid search (BM25) |
| Context loss | Chunk retrieved but missing key identifiers | Add contextual retrieval |
| Wrong chunk size | Related content is split across two chunks; neither alone scores well | Adjust chunk size or overlap |
| Too-similar chunks | The right chunk scores 0.82; a wrong chunk scores 0.81 | Add re-ranking |
| Multi-hop question | Answer requires combining two chunks; neither alone is flagged as expected | Redesign test case or add multi-hop retrieval |

## Automating evaluation

For ongoing monitoring, run evals on every code change or pipeline configuration change:

```python
def run_full_eval(config: dict, test_dataset: list[dict]) -> None:
    """Run evaluation and print a summary report."""
    print(f"Config: chunk_size={config['chunk_size']}, k={config['k']}, hybrid={config['hybrid']}")
    
    # Build the pipeline with this config
    retrieve_fn = build_retrieval_fn(config)
    
    p_at_k = evaluate_retrieval(test_dataset, retrieve_fn, k=config['k'])
    mrr = compute_mrr(test_dataset, retrieve_fn, k=config['k'])
    
    print(f"  Precision@{config['k']}: {p_at_k['precision_at_k']:.2%}")
    print(f"  MRR@{config['k']}:       {mrr:.4f}")
    print(f"  Failures:        {len(p_at_k['failed'])}/{p_at_k['total']}")

# Compare two configurations
run_full_eval({"chunk_size": 300, "k": 3, "hybrid": False}, TEST_DATASET)
run_full_eval({"chunk_size": 512, "k": 3, "hybrid": True}, TEST_DATASET)
```

This is the foundation of the evaluation harness you will build in Chapter 5's chapter project.

## What comes next

The final item in Chapter 4 is the chapter project: build an enterprise knowledge base that combines everything from this chapter — ingestion pipeline, hybrid search, contextual retrieval, and a retrieval evaluation harness — into a single deployable system. You will run evals before and after applying retrieval improvements and show measurable quality gains.
