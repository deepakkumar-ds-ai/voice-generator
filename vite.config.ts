import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  base: '/voice-generator/',
  plugins: [react()],
  optimizeDeps: {
    exclude: ['pocket-tts-js'],
  },
})
