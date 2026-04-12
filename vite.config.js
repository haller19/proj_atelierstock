// vite.config.js
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  base: '/atelier-stock/',   // ← デプロイ先に合わせて変更
  plugins: [react()],
})