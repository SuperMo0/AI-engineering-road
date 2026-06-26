# AI Engineering Curriculum Resources

The trusted-source library. All assignment articles must come from this list.
When a lesson's assignment article is not here, add it before writing the lesson.

---

## aihero.dev — Primary source (Matt Pocock / AI Hero)

High-quality practitioner articles from someone with 10+ years AI experience and 50+ client builds. These are the primary assignment sources for this curriculum. Use them in the lessons mapped below.

| Article | URL | Use in lesson |
|---------|-----|---------------|
| What Is an AI Engineer? | https://www.aihero.dev/what-is-an-ai-engineer | `0001` (intro / motivation section) |
| What Are LLMs Used For? | https://www.aihero.dev/what-are-llms-used-for | `0002` (assignment) |
| What Is an LLM? | https://www.aihero.dev/what-is-an-llm | `0002` (assignment) |
| How To Choose an LLM | https://www.aihero.dev/how-to-choose-an-llm | `0007` (assignment — Anthropic vs OpenAI lesson) |
| The AI Engineer Mindset | https://www.aihero.dev/the-ai-engineer-mindset | `0006` or `0008` (Staircase of Complexity) |
| What Are Evals? | https://www.aihero.dev/what-are-evals | `0033` (assignment — evals lesson) |
| How To Improve Your LLM-Powered App (17 techniques) | https://www.aihero.dev/how-to-improve-your-llm-powered-app | `0008` Ch2 opener (Staircase), referenced across Ch1-Ch5 |
| Vercel AI SDK Tutorial series | https://www.aihero.dev/vercel-ai-sdk-tutorial | See "Vercel AI SDK" section below |

---

## Vercel AI SDK

The Vercel AI SDK is a TypeScript/JavaScript library for building AI applications. **It is not the primary stack for this curriculum** (our curriculum is Python-first). However, it is worth knowing because:

1. Many real-world AI products use it (it's TypeScript-native, so popular in web apps).
2. It is an excellent reference for what good structured output, streaming, and tool-calling APIs look like.
3. Some learners will use it in their own projects.

**Decision:** Do not teach the Vercel AI SDK as a core topic. Mention it as an alternative in the Additional Resources of relevant lessons (0004 structured outputs, 0012 tool calling). Do NOT put it in Assignment items — keep assignments Python-focused.

Specific aihero.dev articles that reference the Vercel AI SDK:
- System Prompts with Vercel AI SDK → Additional Resources in `0003` or `0005`
- Structured Outputs with Vercel AI SDK → Additional Resources in `0004`
- Tool Calls with Vercel AI SDK → Additional Resources in `0012`

---

## Chapter 1 resources

### Dev environment & setup
- uv documentation — https://docs.astral.sh/uv/ (Additional Resources `0001`)
- python-dotenv — https://pypi.org/project/python-dotenv/ (Additional Resources `0001`)

### Open models / Ollama / Hugging Face (lesson `0047`)
- Ollama model library — https://ollama.com/library (Additional Resources `0047`)
- Ollama on GitHub — https://github.com/ollama/ollama (Additional Resources `0047`)
- Hugging Face Models — https://huggingface.co/models (Additional Resources `0047`)
- Transformers quick tour — https://huggingface.co/docs/transformers/quicktour (Additional Resources `0047`)
- Open LLM Leaderboard Space — https://huggingface.co/spaces/open-llm-leaderboard/open_llm_leaderboard (Additional Resources `0047`)
- **Assignment article used:** Open LLM Leaderboard v2 blog post — https://huggingface.co/blog/open-llm-leaderboard-v2 — **verify this URL is live before publishing** (Assignment `0047`)

### OpenAI API
- OpenAI Python SDK — https://github.com/openai/openai-python (Additional Resources `0002`)
- OpenAI Cookbook — https://cookbook.openai.com/ (Additional Resources across Ch1)

### Anthropic API
- Anthropic Python SDK — https://github.com/anthropics/anthropic-sdk-python (Additional Resources `0007`)

### Prompt engineering
- Prompt engineering is hard to assign a single canonical article for. Prefer aihero.dev articles over official docs.
- Anthropic Prompt Library — https://docs.anthropic.com/en/prompt-library/library (Additional Resources `0005`)

---

## Chapter 2 resources

### 17 Techniques article
- Full article: https://www.aihero.dev/how-to-improve-your-llm-powered-app
  - Assign the section on LLM chaining in `0011`
  - Assign the section on agentic loops in `0013`
  - Assign the Staircase overview in `0008`

### Agents
- Anthropic's Building Effective Agents — https://www.anthropic.com/engineering/building-effective-agents (Additional Resources `0013`, `0014`)

### Frameworks
- LangGraph documentation — https://langchain-ai.github.io/langgraph/ (Additional Resources `0015`)
- CrewAI documentation — https://docs.crewai.com/ (Additional Resources `0015`)
- PydanticAI documentation — https://ai.pydantic.dev/ (Additional Resources `0016`)

### Visual workflow tools (`0048`)
- n8n vs Zapier comparison — https://blog.n8n.io/n8n-vs-zapier/ (Assignment article `0048` — **verify URL is live before publishing**)
- n8n AI nodes docs — https://docs.n8n.io/integrations/builtin/cluster-nodes/root-nodes/n8n-nodes-langchain/ (Additional Resources `0048`)
- n8n self-hosting guide — https://docs.n8n.io/hosting/ (Additional Resources `0048`)
- Zapier AI help — https://help.zapier.com/hc/en-us/categories/22022023-AI (Additional Resources `0048`)

---

## Chapter 3 resources

### FastAPI
- FastAPI documentation — https://fastapi.tiangolo.com/ (Additional Resources `0018`)
- "FastAPI Tutorial" by Real Python — find and add URL (Assignment `0018`)

### Docker
- Play With Docker — https://labs.play-with-docker.com/ (Assignment coding task `0021`)

---

## Chapter 4 resources

### RAG
- Anthropic Contextual Retrieval — https://www.anthropic.com/news/contextual-retrieval (Additional Resources `0029`)
- Pinecone chunking guide — https://www.pinecone.io/learn/chunking-strategies/ (Assignment `0025`)
- Evaluating chunking strategies (research paper) — https://research.trychroma.com/evaluating-chunking (Additional Resources `0025`)

### Embeddings
- OpenAI embeddings guide — https://platform.openai.com/docs/guides/embeddings (Additional Resources `0024`)

---

## Chapter 5 resources

### Evals
- RAGAS — https://docs.ragas.io/ (Additional Resources `0033`)
- aihero.dev: What Are Evals? — https://www.aihero.dev/what-are-evals (Assignment `0033`)

### Observability
- Langfuse documentation — https://langfuse.com/docs (Additional Resources `0032`)

---

## Wisdom (Communities)

- r/LocalLLaMA — active AI engineering community on Reddit
- Hugging Face Discord — active community for AI practitioners
- AI Engineer community — https://www.aiengineers.io/

---

## Gaps to fill

- Need a strong assignment article for `0003` (conversations/chat history) — not official docs
- Need a strong assignment article for `0009` (cognitive architecture / system design) — look for practitioner blog posts
- Need a strong assignment article for FastAPI basics (`0018`) from Real Python or similar
- Need a strong article for `0032` Langfuse that isn't just their own docs
