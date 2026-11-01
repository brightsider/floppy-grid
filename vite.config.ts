import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
export default defineConfig(({mode}) => {
  const env = loadEnv(mode, process.cwd(), 'FLOPPY_');
  return {
    plugins: [react(), {
      name: 'dev-runtime-config',
      configureServer(server) {
        server.middlewares.use('/config.js', (_req, res) => {
          res.setHeader('Content-Type', 'application/javascript');
          res.setHeader('Cache-Control', 'no-store');
          res.end(`window.__FLOOPY_CONFIG__ = ${JSON.stringify({FLOPPY_URL:env.FLOPPY_URL || '', FLOPPY_TOKEN:env.FLOPPY_TOKEN || ''})};`);
        });
      },
    }, VitePWA({
      registerType:'autoUpdate',
      includeAssets:['apple-touch-icon.png'],
      manifest:{name:'Floopy Grid',short_name:'Floopy',description:'Your next episode, at a glance.',display:'standalone',start_url:'/',scope:'/',theme_color:'#101114',background_color:'#101114',icons:[{src:'/icon-192.png',sizes:'192x192',type:'image/png'},{src:'/icon-512.png',sizes:'512x512',type:'image/png',purpose:'any'},{src:'/icon-maskable.png',sizes:'512x512',type:'image/png',purpose:'maskable'}]},
      workbox:{globPatterns:['**/*.{js,css,html,png,svg,webmanifest}'],globIgnores:['**/config.js'],navigateFallbackDenylist:[/^\/api\//,/^\/config\.js$/,/^\/health$/],runtimeCaching:[]},
    })],
  };
});
