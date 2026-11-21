import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwind from '@tailwindcss/vite'

const target = process.env.SCAMSHIELD_API_TARGET ?? 'http://127.0.0.1:8765'

export default defineConfig({
  plugins: [react(), tailwind()],
  server: {
    allowedHosts: ['you-neil-lows-length.trycloudflare.com', 'main-comparisons-arabia-prayers.trycloudflare.com'],
    proxy: { '/api': target },
  },
  preview: { proxy: { '/api': target } },
})