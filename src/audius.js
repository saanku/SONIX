const API = 'https://api.audius.co/v1';
function httpsUrl(value) {
  try { const url = new URL(value); return url.protocol === 'https:' ? url.href : ''; } catch { return ''; }
}
export function normalizeAudiusTrack(track) {
  if (!track || !/^[a-zA-Z0-9]+$/.test(track.id || '') || !track.title || track.is_streamable !== true || track.is_stream_gated || track.is_available === false || track.is_delete || track.is_unlisted || track.access?.stream === false || track.access_authorities?.length || track.allowed_api_keys?.length) return null;
  const permalink = typeof track.permalink === 'string' && track.permalink.startsWith('/') && !track.permalink.startsWith('//') ? `https://audius.co${track.permalink}` : 'https://audius.co';
  return {
    id: `audius-${track.id}`, audiusId: track.id, provider: 'audius', source: 'Audius',
    title: String(track.title), artist: String(track.user?.name || track.user?.handle || 'Audius artist'),
    album: String(track.genre || 'Audius'), mood: String(track.mood || ''),
    duration: Number.isFinite(track.duration) && track.duration > 0 ? track.duration : 0,
    artwork: httpsUrl(track.artwork?.['480x480'] || track.artwork?.['150x150']),
    permalink, releaseDate: track.release_date || ''
  };
}
export function createAudiusClient({ apiKey = '', fetcher = fetch, now = Date.now } = {}) {
  const cache = new Map(), pending = new Map();
  function url(path, params = {}) {
    const result = new URL(`${API}${path}`);
    result.search = new URLSearchParams({ app_name: 'SONIX', ...params, ...(apiKey ? { api_key: apiKey } : {}) }).toString();
    return result.href;
  }
  async function load(path, params = {}, cached = true) {
    const key = url(path, params), hit = cache.get(key);
    if (cached && hit && now() - hit.time < 300000) return hit.value;
    if (pending.has(key)) return pending.get(key);
    const operation = (async () => {
      const response = await fetcher(key, { signal: AbortSignal.timeout(20000) });
      if (response.status === 429) throw new Error('Audius is busy. Please wait a moment and try again.');
      if (!response.ok) throw new Error(response.status === 404 ? 'This track is no longer available on Audius.' : 'Audius is temporarily unavailable. Please try again.');
      const body = await response.json();
      const raw = Array.isArray(body.data) ? body.data : body.data ? [body.data] : [];
      const value = { tracks: raw.map(normalizeAudiusTrack).filter(Boolean), received: raw.length };
      if (cached) { if (cache.size >= 30) cache.delete(cache.keys().next().value); cache.set(key, { time: now(), value }); }
      return value;
    })();
    pending.set(key, operation);
    try { return await operation; }
    catch (error) { if (error.name === 'TimeoutError') throw new Error('Audius took too long to respond. Please try again.'); if(error instanceof TypeError)throw new Error('Could not reach Audius. Check your connection and try again.'); throw error; }
    finally { pending.delete(key); }
  }
  return {
    trending: () => load('/tracks/trending', { limit: '24', time: 'week' }),
    search: query => {
      const q = query.trim();
      if (q.length < 2 || q.length > 120) return Promise.reject(new Error('Enter 2–120 characters to search Audius.'));
      return load('/tracks/search', { query: q, limit: '24' });
    },
    async resolve(track) {
      if (!/^[a-zA-Z0-9]+$/.test(track.audiusId || '')) throw new Error('This Audius track has an invalid identifier.');
      const result = await load(`/tracks/${track.audiusId}`, {}, false);
      if (!result.tracks.length) throw new Error('This track is no longer publicly streamable. Open it on Audius for availability.');
      return { track: result.tracks[0], url: url(`/tracks/${track.audiusId}/stream`) };
    }
  };
}
