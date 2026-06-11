import { defineConfig } from 'vite'

// Relative base so the build works under the GitHub Pages subpath
// (https://danielochoa.github.io/Riffler/) without hardcoding the repo name,
// while still serving from the root in `npm run dev` / `npm run preview`.
// Safe here because routing is hash-only (no nested URL paths).
export default defineConfig({
  base: './',
})
