---
layout: lesson
lesson_id: "0018"
chapter: 3
chapter_title: "Production AI Backends"
title: "FastAPI fundamentals for AI apps"
description: "30–40 min read · Hands-on coding"
prev: "P006-ch2-research-assistant.html"
prev_title: "Chapter 2 Project: Research Assistant"
next: "0019-pydantic-validation.html"
next_title: "Pydantic for input/output validation"
prereqs:
  - "[Lesson 4](0004-structured-outputs.html): Pydantic BaseModel — you will use it for request and response shapes"
  - "[Lesson 15](0015-agents-from-scratch.html): Chapter 2 complete — you have AI logic to wrap in an API"
  - "Basic familiarity with HTTP concepts: what a request is, what a response is, what a status code means"
assignment:
  article:
    title: "FastAPI: Modern Python Web APIs"
    url: "https://realpython.com/fastapi-python-web-apis/"
    author: "Real Python"
    time: "about 15 minutes (\"A Minimal Application\", \"Path Parameters\", \"Query Parameters\", and \"Request Body\" sections)"
    why: "Real Python's tutorials are practitioner-written, tested, and updated. This one walks through exactly the same concepts in a different order and with different examples — seeing the same ideas twice in different framings locks them in."
  task:
    description: "Build a `/classify` endpoint that joins your AI backend."
    steps:
      - "Start from the complete API example in this lesson (save it as `main.py`)"
      - "Define a `ClassifyRequest` model with a `text` field (string) and a `labels` field (list of strings — the categories to classify into)"
      - "Define a `ClassifyResponse` model with `label` (the chosen category, a string), `confidence` (a string: \"high\", \"medium\", or \"low\"), and `reasoning` (one sentence explaining the choice)"
      - "Implement `POST /classify` using the same dependency pattern. Use structured output (JSON mode or response_format from Lesson 4) to get the LLM to return valid JSON that matches your response model"
      - "Test it via the `/docs` UI: classify the text \"The server is returning 500 errors\" into labels [\"billing\", \"technical support\", \"feedback\"]"
    expected: "A response like `{\"label\": \"technical support\", \"confidence\": \"high\", \"reasoning\": \"The text describes a server error, which is a technical issue.\"}`"
    why: "Classification is one of the most common AI API patterns in production — support ticket routers, content moderators, and document categorizers all use this pattern. Implementing it now means you have the blueprint ready for Chapter 3's project."
knowledge_check:
  - q: "What is the difference between a path parameter, a query parameter, and a request body?"
    a: "A **path parameter** is part of the URL itself (e.g. `/conversations/{id}`). A **query parameter** comes after `?` in the URL (e.g. `?limit=10`). A **request body** is JSON data in the body of a POST/PUT request, defined as a Pydantic model."
    section: "#path-query-body"
    section_title: "Three ways to send data"
  - q: "What does declaring a `response_model` on an endpoint do?"
    a: "It documents the endpoint's output shape (shown in `/docs`) and — more importantly — **filters the response** so only the declared fields are sent to the caller. Internal fields not in the response model are stripped out automatically."
    section: "#response-models"
    section_title: "Response models"
  - q: "What HTTP status code should you return when the upstream LLM API is unavailable?"
    a: "**503 Service Unavailable** — this signals that your server is running but a dependency it relies on is down. 500 would mean your own code crashed; 503 correctly attributes the failure to the upstream service."
    section: "#error-handling"
    section_title: "Error handling"
  - q: "What problem does FastAPI's dependency injection solve for an AI backend?"
    a: "It allows shared resources — like an OpenAI client, database connection, or authentication check — to be constructed once and injected into any route that needs them, without re-creating them on every request or making them global variables. Dependencies can also raise exceptions (e.g. missing API key) before the route function runs."
    section: "#dependency-injection"
    section_title: "Dependency injection"
  - q: "Where does FastAPI get the schema for the `/docs` interactive API explorer?"
    a: "FastAPI generates the OpenAPI schema automatically from your route decorators and the Pydantic models you declare as request and response types. No extra work is needed — every model and route you define immediately appears in `/docs`."
    section: "#first-route"
    section_title: "Your first route"
additional_resources:
  - title: "FastAPI documentation"
    url: "https://fastapi.tiangolo.com/"
    desc: "The official docs are unusually good; especially the tutorial section"
  - title: "Bigger Applications — Multiple Files"
    url: "https://fastapi.tiangolo.com/tutorial/bigger-applications/"
    desc: "The official guide to structuring a real FastAPI project with routers"
  - title: "Starlette documentation"
    url: "https://www.starlette.io/"
    desc: "FastAPI's HTTP layer; useful when you need features FastAPI doesn't directly expose"
---

## Motivation

Every AI system you built in Chapters 1 and 2 runs as a Python script — you type a command, it runs, it prints output. Real products don't work that way. A chatbot needs a web frontend that can call your AI logic over HTTP. An AI document processor needs to accept file uploads. A Slack bot needs a URL it can send messages to.

The bridge between your Python AI logic and the outside world is an HTTP API. FastAPI is the standard choice for AI engineers building in Python: it is fast, it is based on the type annotations you already know from Pydantic, and it generates interactive documentation automatically. Every major AI backend tutorial, course, and job posting assumes FastAPI fluency.

{% include prereqs.html %}

## What FastAPI is {#what-fastapi-is}

FastAPI is a Python library for building web APIs. You write Python functions, decorate them with route definitions (things like `@app.get("/chat")`), and FastAPI handles everything else: parsing the incoming HTTP request, validating the input, calling your function, and sending the response back as JSON.

Under the hood FastAPI is built on two other libraries: **Starlette** (handles HTTP) and **Pydantic** (handles validation). You have already used Pydantic to validate LLM outputs. FastAPI uses it for exactly the same purpose on every incoming request.

Install it with:

```bash
uv add fastapi uvicorn
```

**Uvicorn** is the server that runs your FastAPI application. FastAPI defines your routes; Uvicorn listens on a port and feeds it requests.

## Your first route {#first-route}

An API route is a URL path paired with an HTTP method (GET, POST, etc.) and a Python function that handles it. Here is the simplest possible FastAPI application:

```python
from fastapi import FastAPI

app = FastAPI(title="My AI API", version="1.0")

@app.get("/")
def root():
    return {"status": "ok"}
```

Run it:

```bash
uvicorn main:app --reload
```

The `--reload` flag restarts the server every time you save a file — essential during development. Visit `http://localhost:8000/` and you get back `{"status": "ok"}` as JSON. Visit `http://localhost:8000/docs` and FastAPI shows you an interactive UI where you can test every endpoint without writing any client code.

<div class="callout info">
<strong>The /docs page is not a bonus:</strong> it is the primary tool you use to test your API while building it. FastAPI generates it automatically from your route definitions and Pydantic models. Every endpoint you add appears there immediately.
</div>

## Three ways to send data to an endpoint {#path-query-body}

HTTP has three main ways to pass data to an API: in the URL path, as query parameters, or in the request body. FastAPI handles all three with function arguments.

### Path parameters

A path parameter is part of the URL itself. You declare it with curly braces in the route and as a function argument:

```python
@app.get("/conversations/{conversation_id}")
def get_conversation(conversation_id: str):
    # conversation_id comes from the URL
    return {"id": conversation_id, "messages": []}
```

Calling `GET /conversations/abc123` passes `"abc123"` as `conversation_id`. FastAPI validates the type — if you declare `conversation_id: int`, a non-integer in the URL returns a 422 error automatically.

### Query parameters

Query parameters appear after `?` in a URL. Any function parameter that is not in the path is treated as a query parameter:

```python
@app.get("/models")
def list_models(provider: str = "openai", limit: int = 10):
    # GET /models?provider=anthropic&limit=5
    return {"provider": provider, "limit": limit, "models": []}
```

### Request body

POST requests carry data in the body, not the URL. You define the body shape as a Pydantic model. FastAPI parses and validates the JSON body automatically:

```python
from pydantic import BaseModel

class ChatRequest(BaseModel):
    message: str
    model: str = "gpt-4o-mini"
    temperature: float = 0.7

@app.post("/chat")
def chat(request: ChatRequest):
    # request.message, request.model, request.temperature are all validated
    return {"reply": f"You said: {request.message}"}
```

If the caller sends `{"message": "hello"}`, FastAPI fills in the defaults for `model` and `temperature`. If the caller omits `message`, FastAPI returns a 422 error before your function is ever called.

## Response models {#response-models}

Just as you can define what comes *in*, you define what goes *out*. Declaring a response model serves two purposes: it documents your API, and it strips any internal fields you do not want to expose.

```python
class ChatResponse(BaseModel):
    reply: str
    model_used: str
    tokens_used: int

@app.post("/chat", response_model=ChatResponse)
def chat(request: ChatRequest):
    # Even if this function returns extra fields, FastAPI
    # filters them out — only reply, model_used, tokens_used are sent.
    return {
        "reply": "Hello!",
        "model_used": request.model,
        "tokens_used": 42,
        "internal_debug": "this will be stripped",
    }
```

In production, your database objects or internal state may contain fields like passwords, internal IDs, or debugging info. Response models guarantee those never leak into API responses.

## Error handling {#error-handling}

When something goes wrong, you raise an `HTTPException`. FastAPI catches it and sends a properly structured JSON error response with the right HTTP status code:

```python
from fastapi import HTTPException

@app.get("/conversations/{conversation_id}")
def get_conversation(conversation_id: str):
    conversation = db.get(conversation_id)   # imaginary DB lookup
    if conversation is None:
        raise HTTPException(status_code=404, detail="Conversation not found")
    return conversation
```

The most important status codes for an AI API:

| Code | Meaning | When to use |
|---|---|---|
| 200 | OK | Successful response (default for GET) |
| 201 | Created | A new resource was created (POST that creates data) |
| 400 | Bad Request | Caller sent invalid input (FastAPI returns this for Pydantic failures) |
| 401 | Unauthorized | Missing or invalid API key |
| 404 | Not Found | The requested resource does not exist |
| 422 | Unprocessable Entity | FastAPI validation failure (wrong types, missing fields) |
| 429 | Too Many Requests | Rate limit exceeded |
| 500 | Internal Server Error | Unhandled exception in your code |
| 503 | Service Unavailable | Upstream dependency (LLM API) is down |

### Handling LLM API errors

The LLM providers throw their own exceptions. You should catch them and convert them into meaningful HTTP responses:

```python
import openai
from fastapi import HTTPException

@app.post("/chat", response_model=ChatResponse)
def chat(request: ChatRequest):
    try:
        response = client.chat.completions.create(
            model=request.model,
            messages=[{"role": "user", "content": request.message}],
        )
        return ChatResponse(
            reply=response.choices[0].message.content,
            model_used=request.model,
            tokens_used=response.usage.total_tokens,
        )
    except openai.RateLimitError:
        raise HTTPException(status_code=429, detail="OpenAI rate limit exceeded. Try again shortly.")
    except openai.AuthenticationError:
        raise HTTPException(status_code=401, detail="Invalid OpenAI API key.")
    except openai.APIError as e:
        raise HTTPException(status_code=503, detail=f"OpenAI API error: {str(e)}")
```

## Dependency injection {#dependency-injection}

FastAPI's dependency injection system solves a problem that every AI backend faces: some things (like the OpenAI client, a database connection, or authentication) need to be shared across every endpoint without being re-created on every request.

A **dependency** is a function that FastAPI calls automatically before your route function, and passes the result in as a parameter:

```python
from fastapi import Depends
import os
from openai import OpenAI
from dotenv import load_dotenv

load_dotenv()

def get_openai_client() -> OpenAI:
    """Dependency: provides a configured OpenAI client."""
    api_key = os.getenv("OPENAI_API_KEY")
    if not api_key:
        raise HTTPException(status_code=500, detail="OPENAI_API_KEY not configured")
    return OpenAI(api_key=api_key)

@app.post("/chat", response_model=ChatResponse)
def chat(
    request: ChatRequest,
    client: OpenAI = Depends(get_openai_client),  # ← injected automatically
):
    response = client.chat.completions.create(
        model=request.model,
        messages=[{"role": "user", "content": request.message}],
    )
    return ChatResponse(
        reply=response.choices[0].message.content,
        model_used=request.model,
        tokens_used=response.usage.total_tokens,
    )
```

FastAPI calls `get_openai_client()` before calling `chat()`, and passes the resulting client in. If the dependency raises an exception (like the missing API key above), FastAPI returns the error before your route function runs.

Dependencies can depend on other dependencies. A common pattern is an authentication dependency that checks a bearer token and returns the authenticated user, which is then used by any endpoint that needs it:

```python
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials

security = HTTPBearer()

def require_api_key(
    credentials: HTTPAuthorizationCredentials = Depends(security)
) -> str:
    token = credentials.credentials
    if token != os.getenv("API_SECRET_KEY"):
        raise HTTPException(status_code=401, detail="Invalid API key")
    return token

@app.post("/chat", response_model=ChatResponse)
def chat(
    request: ChatRequest,
    client: OpenAI = Depends(get_openai_client),
    _: str = Depends(require_api_key),          # enforces auth, result ignored
):
    ...
```

## A complete AI API {#putting-it-together}

Here is a production-shaped FastAPI application with `/chat` and `/summarize` endpoints — the kind of API you would build to back a chatbot or document tool:

```python
import os
from fastapi import FastAPI, HTTPException, Depends
from pydantic import BaseModel, Field
from openai import OpenAI
import openai
from dotenv import load_dotenv

load_dotenv()

app = FastAPI(title="AI Backend API", version="1.0.0")


# ── Models ─────────────────────────────────────────────────────────────

class ChatRequest(BaseModel):
    message: str = Field(..., min_length=1, max_length=4000)
    model: str = Field(default="gpt-4o-mini")
    temperature: float = Field(default=0.7, ge=0.0, le=2.0)

class ChatResponse(BaseModel):
    reply: str
    model_used: str
    tokens_used: int

class SummarizeRequest(BaseModel):
    text: str = Field(..., min_length=10, max_length=50000)
    max_words: int = Field(default=150, ge=50, le=500)

class SummarizeResponse(BaseModel):
    summary: str
    original_word_count: int
    summary_word_count: int


# ── Dependencies ────────────────────────────────────────────────────────

def get_client() -> OpenAI:
    key = os.getenv("OPENAI_API_KEY")
    if not key:
        raise HTTPException(status_code=500, detail="OPENAI_API_KEY not set")
    return OpenAI(api_key=key)


# ── Routes ──────────────────────────────────────────────────────────────

@app.get("/health")
def health():
    return {"status": "ok"}

@app.post("/chat", response_model=ChatResponse)
def chat(req: ChatRequest, client: OpenAI = Depends(get_client)):
    try:
        resp = client.chat.completions.create(
            model=req.model,
            temperature=req.temperature,
            messages=[{"role": "user", "content": req.message}],
        )
    except openai.RateLimitError:
        raise HTTPException(429, "Rate limit exceeded")
    except openai.APIError as e:
        raise HTTPException(503, f"LLM API error: {e}")

    return ChatResponse(
        reply=resp.choices[0].message.content,
        model_used=req.model,
        tokens_used=resp.usage.total_tokens,
    )

@app.post("/summarize", response_model=SummarizeResponse)
def summarize(req: SummarizeRequest, client: OpenAI = Depends(get_client)):
    prompt = (
        f"Summarize the following text in at most {req.max_words} words. "
        "Be concise and preserve the key points.\n\n"
        f"<text>\n{req.text}\n</text>"
    )
    try:
        resp = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[{"role": "user", "content": prompt}],
        )
    except openai.APIError as e:
        raise HTTPException(503, f"LLM API error: {e}")

    summary = resp.choices[0].message.content
    return SummarizeResponse(
        summary=summary,
        original_word_count=len(req.text.split()),
        summary_word_count=len(summary.split()),
    )
```

Run this and open `http://localhost:8000/docs`. You will see both endpoints with their full schemas, and you can test them interactively right from the browser.

## Project structure for a real AI backend {#project-structure}

As your API grows, you need to stop putting everything in one file. The standard FastAPI project structure for an AI backend:

```
my_ai_api/
├── main.py              # app = FastAPI(), includes routers
├── routers/
│   ├── chat.py          # /chat endpoints
│   ├── summarize.py     # /summarize endpoints
│   └── health.py        # /health endpoint
├── models/
│   ├── requests.py      # Pydantic request models
│   └── responses.py     # Pydantic response models
├── dependencies.py      # get_client(), require_api_key(), etc.
├── .env                 # API keys (never commit this)
└── requirements.txt     # or pyproject.toml with uv
```

You use FastAPI's `APIRouter` to split routes across files:

```python
# routers/chat.py
from fastapi import APIRouter, Depends
from openai import OpenAI
from models.requests import ChatRequest
from models.responses import ChatResponse
from dependencies import get_client

router = APIRouter(prefix="/chat", tags=["chat"])

@router.post("/", response_model=ChatResponse)
def chat(req: ChatRequest, client: OpenAI = Depends(get_client)):
    ...

# main.py
from fastapi import FastAPI
from routers import chat, summarize, health

app = FastAPI()
app.include_router(chat.router)
app.include_router(summarize.router)
app.include_router(health.router)
```
