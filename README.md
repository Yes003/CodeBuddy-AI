# CodeBuddy AI: Your Personal AI Coding Mentor

CodeBuddy AI is a web app for beginner programmers. Paste your code, pick what you want to learn, and get a plain-language explanation, a bug check, a cleaner version, test ideas, or a mini-lesson.

It reads your code. It never runs it.

## Problem statement

Beginners often get stuck on code they cannot read or errors they cannot explain, and many AI answers are too advanced or too confident. CodeBuddy AI explains code in simple words, says honestly when it is unsure, and shows what to learn next.

## Key features

| Feature | What you get |
|---|---|
| **Explain my code** | What it does, step-by-step flow, purpose of variables and functions, expected output when it can be worked out, key concepts |
| **Find bugs** | Syntax, logic, runtime and unsafe-pattern issues, each with the code location, an explanation, a fix, and a label: *certain from reading* or *suspected* |
| **Improve my code** | A cleaner version with the same behavior, each change explained, and a **Copy corrected code** button |
| **Generate test cases** | Normal, boundary and invalid inputs, expected results when they can be determined, and why each test matters |
| **Beginner learning mode** | Hard concepts in simple words, a glossary, small examples, and what to learn next |
| **Analysis history** | Your recent analyses for this browser session (cleared when the tab closes), with a Clear button |
| **Code editor** | Syntax highlighting, language selector (Python, C, C++, Java, JavaScript), Load example, Copy code, Clear code |
| **Demo mode** | With no API key, the app runs with clearly labelled sample responses instead of pretending to analyze |

## Technology stack

- **Frontend:** HTML5, CSS3, vanilla JavaScript, highlight.js (with a small built-in fallback highlighter if the CDN is unreachable)
- **Backend:** Python 3.10+, Flask
- **AI:** OpenAI API via the official Python SDK, `python-dotenv` for configuration
- **Tools:** Visual Studio Code, Git, GitHub

## Project structure

```
CodeBuddy-AI/
├── app.py                  Flask app: routes, validation, rate limit, security headers
├── requirements.txt
├── .env.example            Copy to .env and add your key
├── .gitignore
├── README.md
├── TESTING.md              Manual test checklist
├── services/
│   └── ai_service.py       Prompts, OpenAI call, response cleanup, demo mode
├── templates/
│   └── index.html          Landing page, dashboard, about
├── static/
│   ├── css/style.css
│   └── js/app.js
├── tests/
│   └── test_app.py         Automated backend tests
└── docs/
    └── DEMO_SCRIPT.md      A 3-minute hackathon demo plan
```

## Architecture and workflow

```
Browser (index.html + app.js)
   │  POST /api/analyze  { code, language, mode }
   ▼
Flask route (app.py)  ── validates size, language, mode, rate limit
   ▼
ai_service.analyze_code()
   ├─ no API key  → demo_result()  (sample response, labelled DEMO)
   └─ API key set → build prompt → OpenAI → parse JSON → normalize
   ▼
{ "success": true, "data": {...}, "meta": {...} }   or   { "success": false, "error": {...} }
```

- The API key lives only in the server's `.env`. The browser never sees it.
- Submitted code is sent to the model as delimited, untrusted data. The system prompt tells the model not to follow instructions found in the code, not to invent output, and never to claim it ran anything.
- The server never executes, evaluates, or imports submitted code.

### API

| Method | Path | Purpose |
|---|---|---|
| GET | `/` | The web app |
| GET | `/api/health` | Status, demo mode flag, limits |
| POST | `/api/analyze` | Body: `{"code": "...", "language": "python", "mode": "explain"}` |

`language`: `python`, `c`, `cpp`, `java`, `javascript`. `mode`: `explain`, `bugs`, `improve`, `tests`, `learn`.

## Installation (Windows)

You need **Python 3.10 or newer** (check with `python --version`) and optionally an [OpenAI API key](https://platform.openai.com/api-keys).

### 1. Open the project folder in a terminal

In VS Code: open the `CodeBuddy-AI` folder, then **Terminal → New Terminal**. Or, in Command Prompt:

```bat
cd path\to\CodeBuddy-AI
```

### 2. Create and activate a virtual environment

Command Prompt:

```bat
python -m venv venv
venv\Scripts\activate
```

PowerShell:

```powershell
python -m venv venv
venv\Scripts\Activate.ps1
```

If PowerShell says scripts are disabled, run this once, then activate again:

```powershell
Set-ExecutionPolicy -Scope CurrentUser RemoteSigned
```

You should see `(venv)` at the start of your prompt.

### 3. Install dependencies

```bat
pip install -r requirements.txt
```

### 4. Configure your API key

```bat
copy .env.example .env
notepad .env
```

Replace `your_openai_api_key_here` with your real key, save, and close. **Skip this step to try the app in demo mode.**

### 5. Run the app

```bat
python app.py
```

Open **http://127.0.0.1:5000** in your browser. The terminal tells you whether you are in `LIVE AI` or `DEMO MODE`.

### Run the automated tests

```bat
python -m unittest discover -s tests -v
```

## Security notes

- `.env` is listed in `.gitignore`. Never commit a real key. If you ever do, revoke it at platform.openai.com and create a new one.
- No key or secret appears in any frontend file (the test suite checks this).
- Requests are limited to 64 KB, code to 10,000 characters, and each client to 20 requests per minute.
- Errors shown to users never include stack traces or secrets. The server logs only the mode, language, and code length, never the code or the key.
- AI text is rendered with safe DOM methods (no HTML injection), and the server sends a Content-Security-Policy.
- History is stored in `sessionStorage` (this tab only). Do not paste passwords or secrets into any code analyzer.
- Keep `FLASK_DEBUG=0` unless you are developing locally. Debug mode shows stack traces.
- The AI can be wrong. Treat its output as a mentor's suggestion, and always run and test code yourself.

## Screenshots

Add your own screenshots to a `docs/screenshots/` folder and link them here:

```md
![Landing page](docs/screenshots/landing.png)
![Dashboard](docs/screenshots/dashboard.png)
```

## Publishing to GitHub

First, create an empty repository on github.com (no README, no .gitignore, no license) named `CodeBuddy-AI`.

```bat
git init
git add .
git status
```

Check that `.env` does **not** appear in the `git status` list. Then:

```bat
git commit -m "Initial commit: CodeBuddy AI"
git branch -M main
git remote add origin https://github.com/YOUR-USERNAME/CodeBuddy-AI.git
git push -u origin main
```

If Git asks you to sign in, use your GitHub login in the browser window that opens (or a personal access token as the password).

## Future enhancements

- Streaming responses so results appear as they are written
- More languages (TypeScript, Go, Rust) and a "explain this error message" mode
- Optional sandboxed code execution in an isolated container (never on the app server)
- Saved lessons and progress tracking with user accounts
- Line-by-line annotations inside the editor
- Support for other AI providers

## Contributing

1. Fork the repository and create a branch: `git checkout -b feature/my-change`
2. Make your change and run `python -m unittest discover -s tests`
3. Commit with a clear message and push your branch
4. Open a pull request describing what changed and why

Please never include real API keys, and keep the code beginner-friendly.

## License

MIT. See [LICENSE](LICENSE).
