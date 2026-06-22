import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    // Fall back to index.html for unknown routes (so React Router handles them on refresh)
    historyApiFallback: true,
  },
})