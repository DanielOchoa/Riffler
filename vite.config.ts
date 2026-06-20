import { defineConfig } from 'vite'

// Relative base so one build serves from anywhere: the apex custom domain
// (https://riffler.online/), the GitHub Pages project subpath fallback
// (https://danielochoa.github.io/Riffler/), and the root in `npm run dev` /
// `npm run preview`. Safe because routing is hash-only (no nested URL paths).
// The custom domain itself is claimed by public/CNAME (copied to dist/ root).
export default defineConfig({
  base: './',
})
