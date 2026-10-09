const entities = new Set(['recording', 'artist', 'release-group']);
const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'apikey, authorization, content-type', 'Access-Control-Allow-Methods': 'GET, OPTIONS' };
export function createMusicBrainzHandler({ fetcher = fetch, now = Date.now, sleep = ms => new Promise(r => setTimeout(r, ms)), contact = '', interval = 1100 } = {}) {
  const cache = new Map();
  let chain = Promise.resolve(), lastRequest = 0;
  const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });
  return async request => {
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
    if (request.method !== 'GET') return json({ error: 'Use GET to search.' }, 405);
    const params = new URL(request.url).searchParams;
    const entity = params.get('entity') || 'recording';
    const query = (params.get('q') || '').trim();
    if (!entities.has(entity) || query.length < 2 || query.length > 120) return json({ error: 'Choose songs, artists, or albums and enter 2–120 characters.' }, 400);
    const key = `${entity}:${query.toLocaleLowerCase()}`;
    const cached = cache.get(key);
    if (cached && now() - cached.time < 900000) return json(cached.data);
    const job = chain.then(async () => {
      const hit = cache.get(key);
      if (hit && now() - hit.time < 900000) return hit.data;
      const escaped = query.replace(/([+\-&|!(){}\[\]^"~*?:\\/])/g, '\\$1');
      const field = { recording: 'recording', artist: 'artist', 'release-group': 'releasegroup' }[entity];
      const url = new URL(`https://musicbrainz.org/ws/2/${entity}/`);
      url.search = new URLSearchParams({ query: `${field}:"${escaped}"`, fmt: 'json', limit: '24' }).toString();
      let response;
      for (let attempt = 0; attempt < 3; attempt++) {
        await sleep(Math.max(0, interval - (now() - lastRequest)));
        lastRequest = now();
        response = await fetcher(url, { headers: { Accept: 'application/json', 'User-Agent': `SONIX/1.0 (${contact || request.headers.get('origin') || 'personal music library'})` }, signal: AbortSignal.timeout(12000) });
        if (response.ok) break;
        if (![429, 503].includes(response.status)) throw new Error('MusicBrainz search is unavailable. Please try again shortly.');
        if (attempt < 2) await sleep(1500 * (attempt + 1));
      }
      if (!response.ok) throw new Error('MusicBrainz is busy. Please try again in a moment.');
      const data = await response.json();
      const source = data[{ recording: 'recordings', artist: 'artists', 'release-group': 'release-groups' }[entity]] || [];
      const results = source.filter(item => /^[a-f0-9-]{36}$/i.test(item.id)).map(item => ({
        id: item.id, title: item.title || item.name,
        artist: entity === 'artist' ? [item.type, item.area?.name, item.disambiguation].filter(Boolean).join(' · ') : (item['artist-credit'] || []).map(a => (a.name || a.artist?.name || '') + (a.joinphrase || '')).join(''),
        album: item.releases?.[0]?.title || '', date: item['first-release-date'] || '',
        type: entity === 'artist' ? 'Artist' : entity === 'recording' ? 'Song' : item['primary-type'] || 'Album',
        url: `https://musicbrainz.org/${entity}/${item.id}`
      }));
      const body = { results, total: Number(data.count) || results.length, source: 'MusicBrainz' };
      if (cache.size >= 100) cache.delete(cache.keys().next().value);
      cache.set(key, { time: now(), data: body });
      return body;
    });
    chain = job.catch(() => {});
    try { return json(await job); } catch (error) { return json({ error: error.name === 'TimeoutError' ? 'Search timed out. Please try again.' : error.message }, 503); }
  };
}
