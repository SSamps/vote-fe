import { defineConfig, mergeConfig } from 'vitest/config'
import viteConfig from './vite.config'

// Extend the existing Vite config so that the React plugin (JSX transform,
// CSS Modules, etc.) is available in tests too.
export default mergeConfig(
  viteConfig,
  defineConfig({
    test: {
      // Simulate a browser environment so React components can render
      environment: 'jsdom',
      // Runs before every test file — imports @testing-library/jest-dom
      // matchers (toBeInTheDocument, toBeDisabled, etc.)
      setupFiles: ['./src/test/setup.ts'],
    },
  }),
)
