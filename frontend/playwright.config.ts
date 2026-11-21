import { fileURLToPath } from 'node:url'
import { defineConfig } from '@playwright/test'

const python = fileURLToPath(new URL('../.venv/Scripts/python.exe', import.meta.url))

export default defineConfig({
  testDir: './tests',
  workers: 1,
  use: {
    baseURL: 'http://127.0.0.1:18731',
    launchOptions: process.env.PLAYWRIGHT_BROWSER_PATH ? { executablePath: process.env.PLAYWRIGHT_BROWSER_PATH } : {},
  },
  webServer: [
    {
      command: process.env.SCAMSHIELD_TEST_BACKEND ?? '"' + python + '" -m uvicorn backend.app.main:app --app-dir .. --port 18730 --no-access-log',
      url: 'http://127.0.0.1:18730/api/health',
      env: {
        OPENROUTER_API_KEY: '', SAFE_BROWSING_API_KEY: '',
        SCAMSHIELD_ALLOWED_ORIGINS: 'http://127.0.0.1:18731',
      },
    },
    {
      command: 'npm run dev -- --host 127.0.0.1 --port 18731 --strictPort',
      url: 'http://127.0.0.1:18731',
      env: { SCAMSHIELD_API_TARGET: 'http://127.0.0.1:18730' },
    },
  ],
})