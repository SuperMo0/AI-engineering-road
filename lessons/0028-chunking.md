---
layout: lesson
lesson_id: "0028"
chapter: 4
chapter_title: "RAG & Vector Search"
title: "Chunking strategies — splitting documents for retrieval"
description: "30–40 min read · Hands-on coding"
prev: "0027-embeddings.html"
prev_title: "Embeddings — turning text into numbers"
next: "0029-vector-databases.html"
next_title: "Vector databases — storing and searching embeddings"
prereqs:
  - "[Lesson 27](0027-embeddings.html): Embeddings — you need to understand why a document must be split before it can be embedded effectively"
  - "Basic Python string handling — this lesson uses string slicing and splitting"
assignment:
  article:
    title: "Chunking Strategies for LLM Applications"
    url: "https://www.pinecone.io/learn/chunking-strategies/"
    author: "Pinecone"
    time: "15 min"
    why: "This is the most cited chunking reference in the industry — it benchmarks strategies against each other and explains the trade-offs with concrete numbers. After reading it, the choices you make in this lesson's assignment will be informed rather than arbitrary."
  task:
    description: "Chunk a sample document with three different strategies and compare the results."
    steps:
      - "Install `langchain-text-splitters`: `uv add langchain-text-splitters`"
      - "Download or create a 3–5 paragraph plain-text document (a Wikipedia article or a product manual excerpt works well)"
      - "Chunk it three ways: fixed-size at 200 characters with no overlap, fixed-size at 200 characters with 50-character overlap, and recursive splitting at 300 characters with 50-character overlap"
      - "For each strategy, print the number of chunks produced and the first two chunks"
    expected: "Three outputs showing how chunk count and content vary across strategies. The recursive splitter should produce cleaner cuts at natural text boundaries."
    why: "Chunking decisions are invisible when they work and catastrophic when they don't. Making them deliberately now — and seeing the difference with your own data — builds the intuition you need to tune a production pipeline."
knowledge_check:
  - q: "Why can't you embed an entire document as a single piece of text?"
    a: "Two reasons. First, embedding models have an input limit (typically 8,191 tokens) — a long document may exceed it. Second, even if it fits, the resulting vector is a single average of the whole document's meaning. When you retrieve it for a specific question, you pull in irrelevant sections, which dilutes the context and can confuse the LLM. Smaller chunks produce more precise, targeted retrieval."
    section: "#why-chunking-matters"
    section_title: "Why chunking matters"
  - q: "What is chunk overlap and why is it used?"
    a: "Chunk overlap means adjacent chunks share a small region of text — for example, the last 50 characters of chunk N become the first 50 characters of chunk N+1. It is used to prevent answers from being cut in half at a chunk boundary. Without overlap, a sentence split across two chunks might be fully retrievable only when you retrieve both, which may not happen."
    section: "#chunk-overlap"
    section_title: "Chunk overlap"
  - q: "What is recursive text splitting, and why is it preferred over fixed-size splitting?"
    a: "Recursive splitting tries a sequence of separators in order — paragraph break, then sentence end, then word boundary, then individual characters — and only falls back to the next separator if the current one would produce a chunk that is too large. The result is chunks that respect natural text boundaries (paragraphs and sentences) when possible, rather than cutting mid-word or mid-sentence as fixed-size splitting can do."
    section: "#recursive-text-splitting"
    section_title: "Recursive text splitting"
  - q: "What chunk size is a reasonable starting point for most production RAG systems?"
    a: "300–500 tokens (roughly 1,200–2,000 characters) with 10–15% overlap is the validated default for general text. The benchmark-validated sweet spot from 2025–2026 studies is 512 tokens with 15% overlap. That said, the right size depends on your documents — short FAQ entries want smaller chunks; long technical reports can use larger ones. Always benchmark against your real data."
    section: "#choosing-chunk-size"
    section_title: "Choosing chunk size"
additional_resources:
  - title: "Evaluating chunking strategies (Chroma research)"
    url: "https://research.trychroma.com/evaluating-chunking"
    desc: "Empirical comparison of chunking strategies across document types — read this before committing to a strategy in production"
  - title: "LangChain text splitters documentation"
    url: "https://python.langchain.com/docs/how_to/#text-splitters"
    desc: "Reference for all splitting implementations used in this lesson"
  - title: "Semantic chunking with sentence transformers"
    url: "https://www.pinecone.io/learn/chunking-strategies/#semantic-chunking"
    desc: "Advanced technique that splits at natural semantic boundaries rather than fixed sizes"
---

## Motivation

You have a 200-page technical manual. A user asks: "What is the torque spec for the drive shaft?" You embed the entire manual as one vector and search it. The result tells you the manual is probably relevant. That is not helpful — the manual is obviously relevant. You need the specific paragraph with the torque specification.

Chunking is the process of splitting a document into smaller, retrievable units before embedding. It is the first step in the RAG ingestion pipeline, and it is where most production RAG systems have their quality problems. Too large, and retrieval brings back noise. Too small, and chunks lose the surrounding context needed to understand the answer.

{% include prereqs.html %}

## Why chunking matters

An embedding model converts a piece of text into a single vector. That vector represents the average meaning of the entire input. If the input is a 200-page document, the vector is a blurry average of everything in the document — too coarse to retrieve a specific paragraph.

Consider this analogy: if you had to describe a whole city with a single GPS coordinate, you would probably pick the city centre. That works for navigation at the continent level, but not for finding a specific street. Chunking is the process of creating one coordinate per street, not one per city.

There is also a practical limit: the `text-embedding-3-small` model accepts a maximum of 8,191 tokens. A long document would need to be truncated. You want to control where cuts happen — not let the model cut arbitrarily at the limit.

## Fixed-size chunking

The simplest approach is to split text at fixed character (or token) intervals:

```python
def fixed_size_chunks(text: str, chunk_size: int, overlap: int = 0) -> list[str]:
    chunks = []
    start = 0
    while start < len(text):
        end = start + chunk_size
        chunks.append(text[start:end])
        start = end - overlap
    return chunks

sample = """
The drive shaft connects the transmission to the rear differential.
Proper torque is critical for safe operation. Torque the drive shaft bolts
to 65 ft-lb using a calibrated torque wrench. Inspect the universal joints
for wear every 30,000 miles. Replace any joint showing signs of rust or
excessive play. Never use an impact wrench to tighten drive shaft bolts.
""".strip()

chunks = fixed_size_chunks(sample, chunk_size=100, overlap=20)
for i, chunk in enumerate(chunks):
    print(f"Chunk {i}: {repr(chunk)}")
```

Output:
```text
Chunk 0: 'The drive shaft connects the transmission to the rear differential.\nProper torque is critical for'
Chunk 1: 'is critical for safe operation. Torque the drive shaft bolts\nto 65 ft-lb using a calibrated torq'
Chunk 2: 'using a calibrated torque wrench. Inspect the universal joints\nfor wear every 30,000 miles. Replac'
...
```

Notice the problem: chunk 0 cuts off mid-sentence. Chunk 1 picks up in the middle of a sentence. A retrieval system might return chunk 1 for a question about safe operation — but chunk 1 begins with "is critical for" which makes no sense without the preceding sentence.

Fixed-size chunking is fast and simple. It works reasonably well for structured documents where paragraphs are short and uniform (FAQ pages, log entries). It breaks down for prose and technical documentation.

## Chunk overlap

Overlap is a partial fix for the boundary problem. By repeating the end of each chunk at the start of the next, you reduce the chance of an answer being split between two non-overlapping chunks:

```python
# 200 characters per chunk, 50-character overlap
chunks = fixed_size_chunks(sample, chunk_size=200, overlap=50)
```

A typical overlap is 10–20% of the chunk size. Larger overlap increases the number of chunks (and therefore ingestion cost and index size) without proportional quality gains. The rule of thumb is: use the minimum overlap that prevents your most important answers from being cut.

<div class="callout info">
<strong>Overlap does not fix the mid-word problem.</strong> Fixed-size chunking still cuts at an arbitrary character position. The right fix is to respect natural text boundaries — which is what recursive splitting does.
</div>

## Sentence-based chunking

A better approach is to split on sentence boundaries, then group sentences into chunks of roughly the target size:

```python
import re

def sentence_chunks(text: str, max_chars: int = 400, overlap_sentences: int = 1) -> list[str]:
    # Split on sentence-ending punctuation followed by whitespace
    sentences = re.split(r'(?<=[.!?])\s+', text.strip())
    
    chunks = []
    current_chunk = []
    current_length = 0
    
    for sentence in sentences:
        if current_length + len(sentence) > max_chars and current_chunk:
            chunks.append(" ".join(current_chunk))
            # Keep last N sentences for overlap
            current_chunk = current_chunk[-overlap_sentences:]
            current_length = sum(len(s) for s in current_chunk)
        
        current_chunk.append(sentence)
        current_length += len(sentence)
    
    if current_chunk:
        chunks.append(" ".join(current_chunk))
    
    return chunks

chunks = sentence_chunks(sample, max_chars=300, overlap_sentences=1)
for i, chunk in enumerate(chunks):
    print(f"Chunk {i}:\n  {chunk}\n")
```

Sentence-based chunking guarantees that every chunk starts and ends at a sentence boundary. This makes chunks more natural to read and reduces the chance of the LLM receiving incomplete context.

The downside: sentence detection is imperfect. Abbreviations ("Dr.", "e.g.", "ft-lb") can confuse simple regex-based sentence splitters. The `nltk` and `spacy` libraries provide better sentence detection for high-accuracy requirements.

## Recursive text splitting

The approach used by most production RAG systems is **recursive text splitting**. Instead of splitting at fixed intervals or sentence boundaries alone, it tries a hierarchy of separators:

1. Paragraph breaks (`\n\n`)
2. Line breaks (`\n`)
3. Sentence ends (`.`, `?`, `!`)
4. Word boundaries (` `)
5. Individual characters (last resort)

If a section is larger than the target chunk size, it splits at the first separator type. If a subsection is still too large, it tries the next separator type. The result is chunks that respect document structure as much as possible.

LangChain provides a battle-tested implementation:

```python
from langchain_text_splitters import RecursiveCharacterTextSplitter

splitter = RecursiveCharacterTextSplitter(
    chunk_size=300,
    chunk_overlap=50,
    separators=["\n\n", "\n", ". ", "? ", "! ", " ", ""]
)

chunks = splitter.split_text(sample)
for i, chunk in enumerate(chunks):
    print(f"Chunk {i} ({len(chunk)} chars):\n  {chunk}\n")
```

The splitter respects your separators in order. A paragraph break is preferred over a sentence end, which is preferred over a word boundary. Characters are a last resort — they are only used when no other separator produces a chunk small enough.

For structured documents (HTML, Markdown, code), LangChain provides format-aware splitters that respect headers and code blocks:

```python
from langchain_text_splitters import MarkdownHeaderTextSplitter

# Splits Markdown at headers and preserves header context in each chunk
headers = [("#", "h1"), ("##", "h2"), ("###", "h3")]
md_splitter = MarkdownHeaderTextSplitter(headers_to_split_on=headers)
chunks = md_splitter.split_text(markdown_text)
```

<div class="callout good">
<strong>Default recommendation:</strong> use <code>RecursiveCharacterTextSplitter</code> with <code>chunk_size=512</code> tokens (roughly 2,000 characters), <code>chunk_overlap=100</code> characters (around 15%). This is the benchmark-validated default for general text documents. Adjust based on your content type.
</div>

## Choosing chunk size

The right chunk size depends on two things: your documents and your use case.

**Larger chunks** provide more context per retrieval but are noisier — the retrieved passage contains more irrelevant material. They are better for question-answering over prose where answers require multi-sentence context.

**Smaller chunks** are more precise but may lack context — a single sentence is rarely a complete answer. They are better for fact lookup over structured documents (product specs, legal clauses, FAQs).

A practical trade-offs table:

| Chunk size | Tokens | Best for |
|------------|--------|----------|
| Small | 100–200 | Structured documents, FAQ, code snippets |
| Medium | 300–512 | Technical documentation, articles, product guides |
| Large | 700–1,000 | Dense prose, legal documents, research papers |

The benchmark-validated starting point for general text is **512 tokens with 10–15% overlap**. This is where most production systems settle after initial tuning.

If you are not sure: start at 512 tokens, build the pipeline, run retrieval quality evaluations (covered in Lesson 33), and adjust.

<div class="callout info">
<strong>Chunk size in tokens vs characters:</strong> Embedding models measure input in tokens (roughly 4 characters = 1 token for English text). LangChain's <code>RecursiveCharacterTextSplitter</code> counts characters by default. To split by tokens, pass <code>length_function=len</code> and use a tokeniser-aware version, or multiply your target token count by ~4 to get a character equivalent.
</div>

## Attaching metadata to chunks

Every chunk should carry metadata: where it came from. When the LLM cites a source or when you debug a retrieval failure, you need to know which document and which section produced each chunk.

```python
from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_core.documents import Document

splitter = RecursiveCharacterTextSplitter(chunk_size=400, chunk_overlap=80)

raw_text = open("product_manual.txt").read()

# Wrap in a Document object with metadata
doc = Document(
    page_content=raw_text,
    metadata={
        "source": "product_manual.txt",
        "document_type": "manual",
        "version": "v3.2"
    }
)

chunks = splitter.split_documents([doc])
# Each chunk inherits the metadata automatically
print(chunks[0].metadata)
# {'source': 'product_manual.txt', 'document_type': 'manual', 'version': 'v3.2'}
```

Common metadata to attach: source filename, page number (for PDFs), section heading, URL (for web pages), timestamp of ingestion.

## What comes next

You can now split any document into well-formed chunks with appropriate metadata. The next step is storing those chunks as embeddings in a way that supports fast similarity search at scale. That is the job of a **vector database**, which is the topic of the next lesson.
