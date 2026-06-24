---
layout: lesson
lesson_id: "0001"
chapter: 1
chapter_title: "Foundations of AI Engineering"
title: "Setting up your AI engineering environment"
description: "30–40 min read · Hands-on setup"
prev: null
prev_title: null
next: "0002-openai-api-basics.html"
next_title: "Your first LLM API call — how OpenAI works"
prereqs:
  - "You can open a terminal and run basic commands (`cd`, `ls`, `mkdir`)"
  - "You have Python 3.10 or later installed (`python3 --version` to check)"
  - "You have Git installed (`git --version` to check)"
  - "No AI or machine learning knowledge required"
assignment:
  article:
    title: "What Is an AI Engineer?"
    url: "https://www.aihero.dev/what-is-an-ai-engineer"
    author: "Matt Pocock (aihero.dev)"
    time: "about 10 minutes"
    why: "This is the best single article for understanding what AI engineers actually do, why the role is distinct from data scientists and ML engineers, and what a typical day looks like. Read it before your first API call."
  task:
    description: "Set up a real AI project using uv."
    steps:
      - "Install uv if you have not already (`curl -LsSf https://astral.sh/uv/install.sh | sh`)"
      - "Create a project: `uv init ai-foundations && cd ai-foundations`"
      - "Add the packages: `uv add openai python-dotenv`"
      - "Create a `.gitignore` containing `.env` and `.venv/`"
      - "Create a `.env` file with `OPENAI_API_KEY=sk-placeholder` (a fake key is fine for now)"
      - "Edit `main.py` to load the `.env` file and print a confirmation"
      - "Run it: `uv run main.py`"
    expected: "`Environment ready. Key starts with: sk-plac...`"
    why: "This verifies that your environment, package installation, and .env loading all work before you make your first real API call in the next lesson."
knowledge_check:
  - q: "What does a virtual environment do, and why does an AI project need one?"
    a: "A virtual environment is an isolated box of Python packages that belongs to one project only. Different projects can need different versions of the same package — without isolation, they conflict. uv creates and manages this automatically when you run `uv add` or `uv run`."
    section: "#virtual-environments"
    section_title: "Virtual environments"
  - q: "What is an API key, and what does it represent financially?"
    a: "An API key is a long random string that acts as both a password and a billing account identifier for an LLM service. Anyone who has your key can run requests that are charged to your account — a leaked key is like a lost credit card."
    section: "#api-keys"
    section_title: "API keys"
  - q: "Why should an API key never appear directly in your source code?"
    a: "Code gets committed to git, and git history is permanent and easy to scan. Even a private repository can be accidentally made public, forked, or cloned. The key must live only in `.env`, which is excluded from version control via `.gitignore`."
    section: "#api-keys"
    section_title: "API keys"
  - q: "What is the purpose of a `.env.example` file?"
    a: "Since `.env` is excluded from git, a `.env.example` file is committed in its place. It shows which environment variables are needed and what format they take, without containing any real values. New developers copy it to `.env` and fill in their own keys."
    section: "#env-files"
    section_title: ".env files and python-dotenv"
  - q: "What command do you use to run a Python script in a uv project, and why not just `python main.py`?"
    a: "Use `uv run main.py`. Running `python main.py` directly might use a different Python installation that does not have your project's packages installed. `uv run` guarantees the correct virtual environment is used every time."
    section: "#uv"
    section_title: "uv"
additional_resources:
  - title: "uv documentation"
    url: "https://docs.astral.sh/uv/"
    desc: "Full reference for all uv commands; useful when you need features beyond the basics (workspaces, scripts, tool management)"
  - title: "python-dotenv on PyPI"
    url: "https://pypi.org/project/python-dotenv/"
    desc: "Documents additional options like `load_dotenv(override=True)` and loading from a custom path"
---

## Motivation

Every real AI engineering job starts the same way: clone the repo, get the environment running, and make your first API call before lunch. But AI projects have a subtle trap that catches developers new to the field — the API keys. A leaked OpenAI key left in a git commit can rack up hundreds of dollars in charges within hours. Professional AI engineers are paranoid about key security from day one, and they use specific tooling to stay safe.

This lesson sets you up the right way. By the end you will have a project structure that any AI engineering team would recognise, managed by the same tooling used in production codebases.

{% include prereqs.html %}

## What makes an AI project different

You have probably built Python projects before — a web scraper, a Flask API, a CLI tool. Those projects depend on packages you install, and they run on your computer. AI engineering projects share all of that, but they add one new ingredient: every interesting thing happens through an external service.

When your code calls an AI model like GPT-4o or Claude, it is not running anything locally. It is sending a message over the internet to a company's servers, which run the model and send back a reply. This works like a web API — the same way a weather app fetches a forecast or a maps app gets directions. The request goes out, the response comes back.

That means every AI engineering project needs three things that a typical Python project might not:

1. **Packages** — libraries that know how to talk to AI service APIs (like `openai` or `anthropic`)
2. **API keys** — secret credentials that prove you are an authorised user and let the provider charge you
3. **Isolation** — a clean environment so your project's packages do not conflict with other Python projects on your machine

Setting these up correctly is not optional busywork. It is the difference between a project that works reliably and one that mysteriously breaks when you switch computers, and the difference between a secure codebase and an expensive leak.

## uv — the tool that replaces pip, venv, and virtualenv

Python has had many package managers over the years: `pip`, `virtualenv`, `pipenv`, `poetry`, and others. Each solved some problems but created new ones. The Python ecosystem has recently settled on a new standard: **uv**.

uv is a single command-line tool that handles everything — creating projects, managing virtual environments, installing packages, and locking dependency versions. It is dramatically faster than pip (written in Rust rather than Python) and has become the standard in new AI engineering projects in 2025–2026. If you look at a modern AI engineering codebase on GitHub, it likely has a `uv.lock` file at the root.

### Installing uv

Open your terminal and run the official installer. On macOS and Linux:

```bash
curl -LsSf https://astral.sh/uv/install.sh | sh
```

On Windows (PowerShell):

```powershell
powershell -ExecutionPolicy ByPass -c "irm https://astral.sh/uv/install.ps1 | iex"
```

After installation, restart your terminal and check it worked:

```bash
uv --version
```

You should see something like `uv 0.5.x` or higher.

### Creating a new project

The `uv init` command creates a fresh project folder with a standard Python layout:

```bash
uv init my-ai-project
cd my-ai-project
```

This creates a folder containing `pyproject.toml` (the project configuration file), a `.python-version` file pinning the Python version, and a skeleton `main.py`. Nothing is installed yet.

### Adding packages

Instead of `pip install`, you use `uv add`. This installs the package, records it in `pyproject.toml`, and creates a lock file that pins the exact versions so your project is reproducible:

```bash
uv add openai python-dotenv
```

uv automatically creates and manages a virtual environment for you — you do not need to run `python -m venv` separately.

### Running code

Run your scripts with `uv run` instead of `python`. This ensures the code runs inside the project's virtual environment, using exactly the packages you installed:

```bash
uv run main.py
```

## Virtual environments — why they matter {#virtual-environments}

When you install a Python package, it goes somewhere on your computer. If two different projects need different versions of the same package — say, one needs `openai` version 1.0 and another needs version 2.0 — they will fight over the same installation and one of them will break.

A **virtual environment** is an isolated copy of Python and its packages that belongs to one project only. Think of it as a separate box: packages inside the box do not interfere with packages in any other box, and nothing accidentally leaks between projects.

When you run `uv add` or `uv run`, uv handles the virtual environment silently. The environment lives in a hidden `.venv/` folder inside your project. You never need to activate or deactivate it manually.

<div class="callout info">
<strong>One rule: always use <code>uv run</code></strong>. If you run <code>python main.py</code> directly, Python might use a different installation that does not have your packages. <code>uv run main.py</code> always uses the right environment.
</div>

## Project folder structure

A professional AI project is not just a pile of scripts. It has a clear layout that separates configuration from code, keeps secrets out of the source tree, and makes it obvious where everything lives.

Here is the structure you will use throughout this curriculum:

```text
my-ai-project/
├── .env              ← secret API keys (never committed to git)
├── .env.example      ← template showing what keys are needed (safe to commit)
├── .gitignore        ← tells git what to ignore (includes .env)
├── pyproject.toml    ← project metadata and dependencies (managed by uv)
├── uv.lock           ← exact dependency versions (committed to git)
├── main.py           ← your main script
└── src/              ← larger projects split code into modules here
    └── __init__.py
```

The two most important files to understand right now are `.env` and `.gitignore`.

## API keys — your credentials for LLM services {#api-keys}

To call an LLM — like GPT-4o from OpenAI or Claude from Anthropic — your code needs to identify itself to the provider's servers. It does this with an **API key**: a long random string that acts like a password combined with a billing account number.

API keys look like this:

```text
sk-proj-AbCdEfGhIjKlMnOpQrStUvWxYz1234567890AbCdEfGh...
```

When you send a request to OpenAI's API, you include this key in the request header. OpenAI's servers see the key, verify it is real, and charge any usage to your account. This means a leaked key is equivalent to leaving your credit card on a public table — anyone who finds it can run requests at your expense.

### The security rules, non-negotiably

1. **Never put an API key directly in your code.** Not even for testing. Not even for five minutes.
2. **Never commit an API key to git.** Once it is in a commit, even a private one, it is compromised — git history is forever and easy to scan.
3. **Rotate a key immediately if it leaks.** Go to the provider's dashboard and delete it, then create a new one.

The safe way to handle keys is to store them in a `.env` file and load them into your code at runtime. That way the key is never in the source code itself.

## .env files and python-dotenv {#env-files}

A **.env file** is a plain text file, placed in your project root, that contains environment variables — name-value pairs your code can read at runtime. It is never checked into git.

A `.env` file looks like this:

```text
OPENAI_API_KEY=sk-proj-your-real-key-here
ANTHROPIC_API_KEY=sk-ant-your-real-key-here
```

The `python-dotenv` package reads this file and loads those values into your program's environment, where your code can retrieve them using `os.getenv()`.

Here is the complete pattern — the exact same one used in every project in this curriculum:

```python
import os
from dotenv import load_dotenv

# Load the .env file. Must be called before any os.getenv() calls.
load_dotenv()

# Retrieve the key. Returns None if the variable is not set.
api_key = os.getenv("OPENAI_API_KEY")

if not api_key:
    raise ValueError("OPENAI_API_KEY is not set. Add it to your .env file.")

print(f"Key loaded. Starts with: {api_key[:8]}...")
```

The `load_dotenv()` call reads the `.env` file and populates environment variables. Then `os.getenv("OPENAI_API_KEY")` reads that variable. The key never appears in your source code.

### The .env.example file

Since `.env` is excluded from git, a new developer cloning your project would not know what keys they need. The solution is to commit a **.env.example** file — a template that shows the variable names but contains no real values:

```text
OPENAI_API_KEY=your-key-here
ANTHROPIC_API_KEY=your-key-here
```

When someone clones the project, they copy `.env.example` to `.env` and fill in their own keys.

### The .gitignore file

Git must be told explicitly to ignore `.env`. The `.gitignore` file is a list of filenames and patterns that git will never track. At minimum, your AI projects need:

```text
# .gitignore
.env
.venv/
__pycache__/
*.pyc
.DS_Store
```

Add `.env` to `.gitignore` *before* you create the `.env` file. That prevents any chance of accidentally staging it.

<div class="callout warn">
<strong>If you accidentally commit a real API key:</strong> delete the key in the provider's dashboard immediately (do not just delete the file — the key is in git history). Generate a new key. Then clean the history or at minimum treat the old key as permanently compromised.
</div>

## Putting it all together

Here is the complete setup sequence for every new AI project you will start in this curriculum. Run this once and your environment is professional-grade:

```bash
# 1. Create the project
uv init my-ai-project
cd my-ai-project

# 2. Install the packages you need
uv add openai python-dotenv

# 3. Create .gitignore BEFORE creating .env
cat > .gitignore << 'EOF'
.env
.venv/
__pycache__/
*.pyc
.DS_Store
EOF

# 4. Create .env with your real key
echo "OPENAI_API_KEY=sk-your-real-key-here" > .env

# 5. Create .env.example as the template
echo "OPENAI_API_KEY=your-key-here" > .env.example

# 6. Initialise git
git init
git add .
git commit -m "Initial project setup"
```

Notice that `.env` is never added to git — only `.env.example` is. The `uv.lock` and `pyproject.toml` are committed so anyone who clones the repo can run `uv sync` to reproduce the exact same packages.
