declare global {
  interface Window { __FLOOPY_CONFIG__?: { FLOPPY_URL?: string; FLOPPY_TOKEN?: string } }
}
export function getConfig() {
  const config = window.__FLOOPY_CONFIG__;
  if (!config?.FLOPPY_URL || !config.FLOPPY_TOKEN) throw new Error('Configure FLOPPY_URL and FLOPPY_TOKEN, then restart the container. For development, set them in .env.local and restart Vite.');
  const url = new URL(config.FLOPPY_URL);
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.search || url.hash) throw new Error('FLOPPY_URL must be an HTTP(S) server URL without credentials, query, or fragment.');
  return {url:url.href.replace(/\/$/, ''),token:config.FLOPPY_TOKEN};
}
