import { defineConfig } from 'vite';
export default defineConfig({build:{ssr:'server/index.ts',outDir:'server-dist',target:'node24',rollupOptions:{output:{entryFileNames:'index.mjs'}}}});
