---
layout: lesson
lesson_id: "0029"
chapter: 4
chapter_title: "RAG & Vector Search"
title: "Vector databases — storing and searching embeddings"
description: "30–40 min read · Hands-on coding"
prev: "0028-chunking.html"
prev_title: "Chunking strategies — splitting documents for retrieval"
next: "P010-pdf-qa.html"
next_title: "Build a PDF Q&A system"
prereqs:
  - "[Lesson 27](0027-embeddings.html): Embeddings — you need to know what a vector is before you can store one"
  - "[Lesson 28](0028-chunking.html): Chunking — you need chunks to store"
  - "[Lesson 22](0022-postgres-sqlalchemy.html): PostgreSQL and SQLAlchemy — useful for understanding how pgvector extends a database you already know"
assignment:
  article:
    title: "What Is a Vector Database?"
    url: "https://www.pinecone.io/learn/vector-database/"
    author: "Pinecone"
    time: "15 min"
    why: "This is the canonical explanation of how vector databases differ from relational databases and why that difference matters. It covers approximate nearest-neighbour algorithms (the trick that makes million-scale search fast) in accessible terms — the vocabulary will help you make informed choices between the databases in this lesson."
  task:
    description: "Build a minimal vector store with Chroma and query it."
    steps:
      - "Install chromadb: `uv add chromadb openai`"
      - "Create `chroma_demo.py`. Create a persistent Chroma collection called `docs`."
      - "Add five short text passages about different topics (e.g., two about Python, one about cooking, one about finance, one about travel)"
      - "Query the collection with 'How do I write a function in Python?' and print the top 2 results with their distance scores"
      - "Query with 'Best places to visit in Europe' and print the top 2 results"
    expected: "Two queries, each returning the two most relevant passages. The Python queries should return Python passages; the travel query should return the travel passage."
    why: "Every RAG system in this chapter uses a vector database. Working through Chroma by hand — inserting documents, embedding them, querying — removes the abstraction. When you use LlamaIndex in Lesson 49, you will know exactly what it is doing under the hood."
knowledge_check:
  - q: "What is the difference between a regular database and a vector database?"
    a: "A regular database answers queries like 'find rows where column = value' — exact matches and ranges. A vector database answers queries like 'find the N rows whose stored vectors are closest to this query vector' — similarity search over high-dimensional numbers. The search algorithm is different (approximate nearest-neighbour rather than a B-tree index scan), and the data model is different (vectors rather than rows)."
    section: "#what-a-vector-database-is"
    section_title: "What a vector database is"
  - q: "What is ANN search and why is it used instead of exact search?"
    a: "ANN stands for Approximate Nearest Neighbour. Exact nearest-neighbour search (comparing a query vector to every stored vector) is O(n) — it slows linearly as your collection grows. ANN algorithms build an index structure (HNSW, IVF) that lets them skip most comparisons and find the nearest neighbours in sub-linear time. The trade-off is a small accuracy loss, but in practice ANN results are 95–99% as accurate as exact search and orders of magnitude faster at scale."
    section: "#how-vector-search-works"
    section_title: "How vector search works"
  - q: "Which vector database would you choose for a local development prototype, and which for a large-scale production deployment?"
    a: "**Local development:** Chroma — it runs in-process or as a local server, needs no infrastructure, and stores vectors in a local file. Zero configuration. **Large-scale production:** Managed options like Pinecone, Weaviate, or Qdrant handle replication, scaling, and backups. If you are already on PostgreSQL, pgvector avoids adding a new service. The right choice depends on your scale, existing infrastructure, and operational preferences."
    section: "#choosing-a-vector-database"
    section_title: "Choosing a vector database"
  - q: "What is pgvector and when would you use it?"
    a: "pgvector is a PostgreSQL extension that adds a vector data type and similarity search operators to a regular Postgres database. You would use it when you already run PostgreSQL in production (for your application data) and want to avoid adding a separate vector database service. It handles millions of vectors well and integrates naturally with your existing SQL queries, permissions, and backups."
    section: "#pgvector"
    section_title: "pgvector — vector search inside PostgreSQL"
additional_resources:
  - title: "Chroma documentation"
    url: "https://docs.trychroma.com/"
    desc: "Full API reference for ChromaDB including collections, embeddings, metadata filtering, and persistent storage"
  - title: "LanceDB documentation"
    url: "https://lancedb.github.io/lancedb/"
    desc: "Developer-friendly embedded vector database with a columnar storage format — good for larger local datasets"
  - title: "pgvector on GitHub"
    url: "https://github.com/pgvector/pgvector"
    desc: "Source, installation instructions, and index type comparisons (HNSW vs IVF) for pgvector"
  - title: "Anthropic: Contextual Retrieval"
    url: "https://www.anthropic.com/news/contextual-retrieval"
    desc: "How Anthropic improved retrieval quality in their own RAG systems — useful context before Lesson 32"
  - title: "Vector database comparison (Qdrant blog)"
    url: "https://qdrant.tech/articles/vector-database-benchmark/"
    desc: "Benchmarks comparing Qdrant, Weaviate, Pinecone, and Chroma on speed and recall"
---

## Motivation

In Lesson 27 you built a working retrieval system with a plain Python list. It searched five documents perfectly. Now imagine doing the same thing for 10 million documents. Comparing the query vector to every stored vector — one by one — would take seconds per query. At production traffic levels, that is not acceptable.

A **vector database** solves this. It stores embeddings in a specialised index that makes similarity search fast — sub-millisecond at millions of documents. It also handles persistence, metadata filtering, batched ingestion, and concurrent access. It is the backbone of every production RAG system.

{% include prereqs.html %}

## What a vector database is

A vector database is a database specialised for storing and searching high-dimensional numeric vectors.

A traditional relational database stores rows and columns. You query it with conditions: `WHERE user_id = 42`, `WHERE price < 100`. The search algorithms (B-tree indexes, hash indexes) are optimised for exact matches and range queries.

A vector database stores vectors. You query it by providing a vector and asking: "return the N stored vectors most similar to this one." There is no exact match — you are searching by proximity, not by equality.

This is a fundamentally different operation. The algorithms required (approximate nearest-neighbour search) are purpose-built for high-dimensional spaces, and they do not exist in traditional databases.

The most common use case is RAG: store your document chunk embeddings in a vector database, then query it with a user's question embedding at runtime.

## How vector search works

When you insert a vector into a vector database, the database builds an index — a data structure designed to make future similarity queries fast.

The most widely used index type is **HNSW** (Hierarchical Navigable Small World). Without going into the graph theory, HNSW organises vectors into a layered graph where nearby vectors (in semantic space) are connected to each other. When you query, the search navigates the graph, skipping large portions of the vector space to arrive at the nearest neighbours in sub-linear time.

This is **approximate** nearest-neighbour (ANN) search. It skips some comparisons to go fast, which means it might occasionally miss the single closest vector. In practice the accuracy (called recall) is 95–99%: for a query that should return document A as the closest match, ANN will return document A the vast majority of the time.

The trade-off is controlled by an index parameter — higher recall means more comparisons and slower queries. For RAG, recall of 95–99% is sufficient because you are returning the top 3–10 documents, not looking for one exact match.

## Chroma — the local-development default

**Chroma** is an open-source vector database that runs in-process inside your Python application or as a local server. There is no infrastructure to provision, no Docker image to pull. It stores vectors in a local directory and is ready to use in five lines of code.

```python
import chromadb
from openai import OpenAI

# Connect to a local persistent database (creates ./chroma_db if it doesn't exist)
client = chromadb.PersistentClient(path="./chroma_db")

# Create a collection (like a table in a relational database)
collection = client.get_or_create_collection(
    name="docs",
    metadata={"hnsw:space": "cosine"}  # use cosine distance
)
```

Adding documents: Chroma can call an embedding function automatically, or you can pass pre-computed embeddings. The simplest approach uses Chroma's built-in OpenAI embedding function:

```python
from chromadb.utils import embedding_functions

openai_ef = embedding_functions.OpenAIEmbeddingFunction(
    model_name="text-embedding-3-small"
)

collection = client.get_or_create_collection(
    name="docs",
    embedding_function=openai_ef,
    metadata={"hnsw:space": "cosine"}
)

# Add documents — Chroma calls the embedding function automatically
collection.add(
    documents=[
        "Python functions are defined with the def keyword.",
        "Python lists support indexing, slicing, and negative indexing.",
        "FastAPI is an async web framework for Python.",
        "Compound interest is calculated as P*(1+r/n)^(nt).",
        "The best pizza in Naples uses San Marzano tomatoes.",
    ],
    ids=["doc1", "doc2", "doc3", "doc4", "doc5"],
    metadatas=[
        {"topic": "python", "source": "python_guide.txt"},
        {"topic": "python", "source": "python_guide.txt"},
        {"topic": "python", "source": "fastapi_docs.txt"},
        {"topic": "finance", "source": "finance_basics.txt"},
        {"topic": "food", "source": "italy_guide.txt"},
    ]
)

print(f"Collection size: {collection.count()}")  # 5
```

Querying — find the most relevant documents for a question:

```python
results = collection.query(
    query_texts=["How do I write a reusable function?"],
    n_results=2
)

for doc, distance in zip(results["documents"][0], results["distances"][0]):
    print(f"[{distance:.4f}] {doc}")
```

Output:
```text
[0.1823] Python functions are defined with the def keyword.
[0.4102] Python lists support indexing, slicing, and negative indexing.
```

Lower distance = more similar (Chroma returns distance, not similarity, so lower is better when using cosine distance).

You can also filter by metadata before searching — useful when your collection contains documents from multiple sources:

```python
# Only search within Python documents
results = collection.query(
    query_texts=["How do I define a function?"],
    n_results=2,
    where={"topic": "python"}  # metadata filter
)
```

<div class="callout info">
<strong>Chroma persists automatically</strong> when you use <code>PersistentClient</code>. The database is stored in the directory you specify. On the next run, calling <code>get_or_create_collection</code> returns the existing collection with all its documents intact — no re-ingestion required.
</div>

## LanceDB — embedded, no server needed

**LanceDB** is a newer alternative to Chroma with a columnar storage format (Lance) designed for analytical queries over large vector collections. It runs embedded in your Python process — no server — and stores data in a local directory or cloud storage (S3, GCS).

```python
import lancedb
import pandas as pd

db = lancedb.connect("./lance_db")

# Insert documents with pre-computed embeddings
data = [
    {"text": "Python functions are defined with def.", "vector": embed("Python functions are defined with def.")},
    {"text": "Compound interest uses P*(1+r/n)^(nt).", "vector": embed("Compound interest uses P*(1+r/n)^(nt).")},
]

table = db.create_table("docs", data=data)

# Query
query_embedding = embed("How do I write a function?")
results = table.search(query_embedding).limit(2).to_pandas()
print(results[["text", "_distance"]])
```

LanceDB handles larger local datasets well and integrates natively with pandas and PyArrow, which makes it convenient if your ingestion pipeline involves data frames.

## pgvector — vector search inside PostgreSQL

If you already run PostgreSQL for your application data (as you did in Chapter 3), **pgvector** adds a vector column type and similarity search operators. You get vector search without adding a new service to your stack.

**Installation** (the extension must be installed in your Postgres instance):

```sql
CREATE EXTENSION vector;
```

With Docker Compose, use the official pgvector image:

```yaml
# docker-compose.yml
services:
  db:
    image: pgvector/pgvector:pg16
    environment:
      POSTGRES_DB: mydb
      POSTGRES_USER: myuser
      POSTGRES_PASSWORD: mypassword
```

**Creating a table** with a vector column:

```sql
CREATE TABLE document_chunks (
    id          SERIAL PRIMARY KEY,
    content     TEXT NOT NULL,
    source      TEXT,
    embedding   vector(1536)    -- 1536 dimensions for text-embedding-3-small
);

-- Create an HNSW index for fast approximate search
CREATE INDEX ON document_chunks USING hnsw (embedding vector_cosine_ops);
```

**Inserting and querying** from Python using psycopg2:

```python
import psycopg2
from psycopg2.extras import execute_values
from openai import OpenAI

client = OpenAI()

def embed(text: str) -> list[float]:
    return client.embeddings.create(
        model="text-embedding-3-small", input=text
    ).data[0].embedding

# Insert a document chunk
conn = psycopg2.connect("postgresql://myuser:mypassword@localhost/mydb")
cur = conn.cursor()

chunk_text = "Python functions are defined with the def keyword."
embedding = embed(chunk_text)

cur.execute(
    "INSERT INTO document_chunks (content, source, embedding) VALUES (%s, %s, %s)",
    (chunk_text, "python_guide.txt", embedding)
)
conn.commit()

# Query — find the 3 most similar chunks
query_embedding = embed("How do I define a reusable function?")

cur.execute("""
    SELECT content, source,
           1 - (embedding <=> %s::vector) AS similarity
    FROM document_chunks
    ORDER BY embedding <=> %s::vector
    LIMIT 3
""", (query_embedding, query_embedding))

for row in cur.fetchall():
    print(f"[{row[2]:.4f}] {row[0]} (from {row[1]})")
```

The `<=>` operator is cosine distance (0 = identical, 2 = opposite). Subtracting from 1 gives cosine similarity.

## Managed vector databases

For large-scale production deployments, managed cloud vector databases remove operational burden: no infrastructure to provision, automatic scaling, built-in backups, and SLAs.

| Database | Self-hosted | Managed | Notes |
|----------|-------------|---------|-------|
| **Chroma** | ✓ | ✗ | Local dev; client-server mode for staging |
| **LanceDB** | ✓ | ✓ (LanceDB Cloud) | Good for serverless / edge deployments |
| **pgvector** | ✓ (your Postgres) | ✓ (Supabase, Neon) | Best when already on Postgres |
| **Qdrant** | ✓ | ✓ | Fast, rich filtering, active development |
| **Weaviate** | ✓ | ✓ | Strong GraphQL API; popular in enterprise |
| **Pinecone** | ✗ | ✓ only | Simplest managed option; serverless pricing |

## Choosing a vector database

For the projects in this chapter:
- Use **Chroma** — it requires no configuration, runs locally, and persists between sessions. It is the right choice for learning and prototyping.

For production:
- Already running Postgres? Add **pgvector** — one `CREATE EXTENSION` and you avoid a new service.
- No Postgres, moderate scale (<10M vectors)? **Qdrant** or **Chroma** in client-server mode are solid choices.
- Very large scale or need serverless? **Pinecone** or **Weaviate** managed.
- Working offline or need embedded storage? **LanceDB**.

The switching cost between vector databases is low — the API changes but the concept (insert vectors, query by similarity) is identical. Start simple, switch when you have a concrete reason.

## What comes next

You now have all three foundational pieces of RAG:
1. **Embeddings** — convert text to vectors (Lesson 27)
2. **Chunking** — split documents into retrievable units (Lesson 28)
3. **Vector database** — store and search vectors at scale (this lesson)

The next page is your first project: build a PDF Q&A system by combining all three. You will load a real PDF, chunk it, embed every chunk, store them in Chroma, and answer questions from the command line.
