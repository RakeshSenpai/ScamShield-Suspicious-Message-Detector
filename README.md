# ScamShield

ScamShield checks suspicious messages, screenshots and links for fraud indicators. It combines deterministic patterns, contextual analysis through the configured OpenRouter model, and optional independent URL reputation checks. It includes India-specific emergency guidance, a checklist, an editable incident report, PDF export, and safety resources in English, Hindi and Assamese.

## Run locally on Windows

The project already has a Python 3.13 virtual environment in this workspace. For a fresh checkout use standard Windows CPython 3.13 and Node.js 22.12+ or 24.

```powershell
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r backend/requirements.txt
npm.cmd --prefix frontend ci
```

Create `.env` from `.env.example` when starting from a fresh checkout. Keep the existing `.env` in this workspace. The production browser bundle never receives server credentials.

Set `OPENROUTER_API_KEY`, `OPENROUTER_BASE_URL`, and `OPENROUTER_MODEL` to enable AI. The configured model needs chat completions with JSON responses and image inputs for screenshots. The supplied OpenRouter credentials returned HTTP 401 during live verification. A working OpenRouter key is required to demonstrate successful AI analysis. [OpenRouter chat completions](https://openrouter.ai/docs/api/api-reference/chat/send-chat-completion-request)

Set `SAFE_BROWSING_API_KEY` to enable Google Safe Browsing v4 lookups for eligible noncommercial use. Lookup sends eligible URLs to Google. The app skips URLs containing query strings, fragments, user information, or IP literals, and URLs derived exclusively from an AI transcript. [Google Safe Browsing Lookup API](https://developers.google.com/safe-browsing/v4/lookup-api)

Start the API and frontend in separate PowerShell terminals at the project root.

```powershell
.\.venv\Scripts\python.exe -m uvicorn backend.app.main:app --host 127.0.0.1 --port 8765 --no-access-log
```

```powershell
npm.cmd --prefix frontend run dev -- --host 127.0.0.1 --strictPort
```

Open [ScamShield](http://127.0.0.1:5173). The frontend proxies `/api` to port 8765. Set `SCAMSHIELD_API_TARGET` in the frontend terminal to change that target. For custom browser origins, set the comma-separated `SCAMSHIELD_ALLOWED_ORIGINS` on the backend. To preview the production frontend locally, run `npm.cmd --prefix frontend run build` followed by `npm.cmd --prefix frontend run preview` while the API is running.

## Verify

```powershell
.\.venv\Scripts\python.exe -m pytest -q
npm.cmd --prefix frontend run lint
npm.cmd --prefix frontend run build
$env:PLAYWRIGHT_BROWSER_PATH = 'C:\Program Files\Google\Chrome\Application\chrome.exe'
npm.cmd --prefix frontend test
.\.venv\Scripts\python.exe -m backend.tests.live_provider
```

The production build includes TypeScript checking. Playwright uses isolated local ports and disables paid integrations. The optional live test sends three synthetic inputs to the configured provider and reports only outcome metadata. Use `npx playwright install chromium` from `frontend` if you prefer Playwright’s Chromium to installed Chrome.

## Privacy and reliability

Evidence stays in memory during the workflow. Only the language setting is persisted in the browser. Text and normalized screenshots can be sent to OpenRouter, and eligible URLs can be sent to Google when configured. Remove credentials and unnecessary identifiers before submitting. Text redaction is best-effort and screenshot pixels are sent to the model. The rule engine is heuristic and primarily English. Screenshot rule checks depend on a model-produced transcript and can miss text or misread it. Unsupported characters outside the bundled Latin, Devanagari and Bengali/Assamese font coverage may not render in PDFs.

ScamShield does not fetch submitted links. Reports are local downloads and include a disclaimer. For financial cyber fraud in India use 1930 or the National Cybercrime Reporting Portal. Use Chakshu to report suspected fraudulent communications. [National Cybercrime Reporting Portal](https://cybercrime.gov.in/) · [Sanchar Saathi](https://sancharsaathi.gov.in/)

See [context.md](context.md) for the architecture, risk policy, API contracts, tests, and current status.
