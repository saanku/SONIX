import { createMusicBrainzHandler } from '../supabase/functions/musicbrainz/api.js';
export function musicbrainzPlugin(contact) {
  const handler = createMusicBrainzHandler({ contact });
  const install = server => { server.middlewares.use('/api/musicbrainz', async (req, res) => {
    const controller = new AbortController();
    req.on('aborted', () => controller.abort());
    try {
      const request = new Request(`http://localhost/api/musicbrainz${req.url?.startsWith('?') ? req.url : new URL(req.url || '/', 'http://localhost').search}`, { method: req.method, headers: { origin: req.headers.origin || '' }, signal: controller.signal });
      const response = await handler(request);
      res.writeHead(response.status, Object.fromEntries(response.headers));
      res.end(await response.text());
    } catch { res.writeHead(500, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ error: 'Search is temporarily unavailable.' })); }
  }); };
  return { name: 'sonix-musicbrainz', configureServer: install, configurePreviewServer: install };
}
