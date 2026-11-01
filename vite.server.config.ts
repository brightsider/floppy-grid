import { defineConfig } from 'vite';
export default defineConfig({build:{ssr:'server/index.ts',outDir:'server-dist',target:'node22',rollupOptions:{output:{entryFileNames:'index.mjs'}}}});
