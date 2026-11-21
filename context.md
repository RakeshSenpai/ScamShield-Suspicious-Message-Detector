# ScamShield development context

## Project overview

ScamShield is an India-focused hackathon app that turns messy evidence of suspicious messages and cyber fraud into an explainable assessment, protective steps and a reviewable incident summary. The intended audience is people with limited cybersecurity experience. The initial workspace contained only an existing `.env`.

## Architecture and stack

- **Frontend:** React 19, TypeScript, Vite, Tailwind CSS, React Router, Lucide, React Hook Form, Zod, ESLint and Playwright.
- **Backend:** Python 3.13, FastAPI, Pydantic, Uvicorn, httpx, python-dotenv, python-multipart, Pillow, tldextract, fpdf2, uharfbuzz and pytest.
- Vite forwards same-site `/api` calls to the backend. The React app holds incident and checklist state in context until the page reloads. Language preference uses localStorage. The app has no database.
- Browser routes are `/`, `/analyze`, `/emergency`, `/report`, `/resources`, and a catch-all 404. The homepage and analysis page use the same scan composer. The composer retains text, URL and a screenshot while switching input modes.

## Directory and file map

- `backend/app/main.py` contains the FastAPI app, request guards, HTTP contracts and route handlers.
- `backend/app/config.py` loads the project-root environment file and reads provider and browser-origin settings.
- `backend/app/schemas.py` defines findings, model context, verified link data and incident fields.
- `backend/app/rules.py` contains deterministic patterns with stable rule IDs, local negation handling and best-effort redaction.
- `backend/app/urls.py` parses submitted URLs, detects structural warning signs and queries the fixed Google endpoint for eligible links.
- `backend/app/ai.py` handles OpenRouter requests, role separation, timeouts and structured response validation.
- `backend/app/detection.py` normalizes screenshots, merges rule/URL/AI findings and determines the final label.
- `backend/app/report.py` builds paginated PDFs with HarfBuzz shaping and bundled, OFL-licensed fonts in `backend/fonts/`.
- `backend/tests/test_app.py` tests deterministic rules, evidence fusion, API validation, unavailable integrations, image validation, prompt-injection handling with a mocked transcript, and PDF generation. `backend/tests/live_provider.py` is the opt-in live smoke test.
- `frontend/src/main.tsx` defines navigation and scan, result, emergency, and report workflows. `api.ts` handles transport and downloads. `i18n.ts`, `resources.tsx`, and `resourceTranslations.ts` contain translations and safety topics. `styles.css` defines the layout and visual design.
- `frontend/tests/workflows.spec.ts` exercises actual UI and API workflows in Chromium. `frontend/playwright.config.ts` runs independent local test servers with integrations disabled. `frontend/vite.config.ts` sets the same-origin proxy.

## Hybrid detection

1. Validate length, explicit URL and image inputs. Pillow decodes still PNG, JPEG and WebP images up to 5 MB and 16 megapixels. Images are re-encoded without source metadata before provider submission.
2. When configured, the model returns a Pydantic-validated context with category, explanation, requested action, sender claims, supporting and reassuring evidence, tactics, missing details, impact, actions and limitations. The prompt requests a transcript for image inputs and treats embedded instructions as untrusted. The model receives no tools. A transcript is model-generated evidence.
3. Run deterministic rules on submitted text and available screenshot transcript. Rules cover coercive deadlines, account and KYC threats, credential requests, advance fees, investments, recruitment, software installation and authority claims. Pattern-local negation prevents many ordinary safety warnings from triggering. Findings include rule ID, evidence, category and severity. Repeated mentions fail to add independent rule categories.
4. Parse the explicit URL and extract HTTP(S) or www links from text and transcript. Inspect up to eight unique strings with an offline public suffix snapshot. Inspect IP hosts, credentials, punycode, selected homoglyphs, shorteners, unusual ports and a fixed brand-domain mapping. No submitted URL is fetched. External lookup is limited to eligible URLs directly provided in text or the URL field. A no-match result preserves uncertainty.
5. A threat-list match or a strong non-URL rule yields high risk. Distinct medium rule categories, or a medium category supported by a strong model interpretation, also yield high risk. One medium category, a high URL warning, or AI-only concern yields medium. Vague evidence or an unreadable screenshot without other input yields insufficient information. Low apparent risk indicates few remaining concerns, including some weak signals with a reassuring explanation. The UI surfaces disagreement and unavailable components. No probability or accuracy number is exposed.

## AI integration

The OpenRouter-compatible adapter uses `OPENROUTER_API_KEY`, `OPENROUTER_BASE_URL` and `OPENROUTER_MODEL`. The server posts to `/chat/completions` with JSON-object output and optional base64 JPEG image content. The configuration preserves the user's model. Explanations follow the requested language, and evidence excerpts remain verbatim where possible. Unknown fields stay empty. Timeouts, HTTP failures, invalid JSON and schema mismatches produce an unavailable status. The rule engine still runs. The configured provider returned HTTP 401 on the live text, image, and incident checks.

## API

| Method and path | Input and output |
| --- | --- |
| `GET /api/health` | Returns a process health status. |
| `GET /api/capabilities` | Returns rules availability and whether AI or reputation are configured. These flags do not guarantee authentication or reachability. |
| `POST /api/analyze` | Multipart `text`, `url`, `image`, and `language`. Returns the typed assessment with risk, rule and AI results, URLs, limitations and actions. |
| `POST /api/verify-url` | JSON `url`. Returns host, registrable domain, structural findings and threat status. |
| `POST /api/emergency/analyze` | JSON `description` and `language`. Returns extraction status and editable incident fields. Provider failure preserves the submitted description for manual review. |
| `POST /api/reports/generate` | JSON `incident`, `confirmed` and optional `language`. Returns an attachment with PDF bytes after review. |

Malformed input returns 400 or 422, excessive bodies 413, missing lengths 411, disallowed browser origins 403, and rate-limited external-analysis routes 429. Provider failures appear in typed partial results. Configured external calls are bounded by timeouts and a process-local concurrency limit.

## Emergency support, reporting and resources

Urgent guidance and the checklist render before incident intake. Emergency guidance directs users to their bank or payment provider through official channels and provides links for 1930 and the National Cybercrime Reporting Portal. Incident extraction proposes details but the user edits and previews them before consenting to PDF generation. Reports contain a UTC timestamp, reviewed details, unknown fields, reporting resources and the required disclaimer. PDF titles follow the selected language. PDF field labels and the legally neutral disclaimer are in English. The ten safety topics support text search, filtering and all three interface languages.

## Security and privacy

Provider secrets stay server-side. The app stores no evidence in a database and does not render submitted URLs as clickable links. React escapes untrusted content. The origin allowlist defaults to the local Vite origins. FastAPI bounds uploads and request sizes and applies a local process-wide rate limit. Use a same-origin reverse proxy and deployment rate controls for shared use. External providers may process submitted text or screenshots. Regex redaction is best-effort and users must remove credentials from the source material. The source PDF fonts cover Latin, Devanagari and Bengali/Assamese. The site is independent of authorities and financial institutions.

## Setup and testing

Windows setup and exact launch commands are in README.md. The bundled MSYS Python could not build a Pydantic dependency, so a project-local CPython 3.13 runtime was installed and used to rebuild `.venv`. No preexisting app or dependency metadata was overwritten. The preexisting configuration was kept. Frontend builds use Vite's native config loader to avoid esbuild directory traversal blocked by the Windows sandbox.

Run `.\.venv\Scripts\python.exe -m pytest -q`, `npm.cmd --prefix frontend run lint`, `npm.cmd --prefix frontend run build`, and the Playwright commands in the README. Use `.\.venv\Scripts\python.exe -m backend.tests.live_provider` for a synthetic provider check. The Google integration has no configured key here. Live verification of successful OpenRouter responses requires valid authentication.

The final pytest run passed 21 tests. All eight Playwright tests passed in installed Chrome, including real browser-to-API communication, invalid upload handling, clipboard and summary downloads, emergency report editing, PDF export, and layout checks at 360, 390, 768, 1024 and 1440 px. ESLint and the TypeScript/Vite production build passed. Poppler rendering was visually checked on both pages of synthetic reports with Hindi and Assamese titles, mixed-script details, and a long chronology.

## Current limitations and next steps

The rule engine's coverage is primarily English, and local URL brand matching is intentionally limited. Emergency translations are app translations and should receive native-speaker review for public deployment. Screenshots require an image-capable provider for content extraction. Only local structure checks are available for URLs extracted solely from screenshots. The public-suffix snapshot is refreshed by updating the Python dependency. For a full integration demo, validate the OpenRouter key and configure a separate Google API key if independent reputation is needed. No hosting or live public deployment was requested.
