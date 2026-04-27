import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  base: '/puzzlekit-web/',
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: './src/test/setup.ts',
    css: true,
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
    exclude: ['tests/**'],
    coverage: {
      reporter: ['text', 'html'],
    },
  },
})
