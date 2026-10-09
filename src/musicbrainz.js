let controller;
export async function searchMusicBrainz(query, entity) {
  controller?.abort();
  controller = new AbortController();
  const activeController = controller;
  const base = import.meta.env.VITE_MUSICBRAINZ_ENDPOINT || (import.meta.env.DEV ? '/api/musicbrainz' : `${import.meta.env.VITE_SUPABASE_URL || ''}/functions/v1/musicbrainz`);
  const url = new URL(base, location.origin);
  url.searchParams.set('q', query); url.searchParams.set('entity', entity);
  const timer = setTimeout(() => activeController.abort(), 45000);
  try {
    const response = await fetch(url, { headers: import.meta.env.DEV ? {} : { apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || '' }, signal: activeController.signal });
    if (!response.headers.get('content-type')?.includes('application/json')) throw new Error('Catalog search is not available on this deployment yet. Your local library is still available.');
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'MusicBrainz search is unavailable. Please try again later.');
    return data;
  } finally { clearTimeout(timer); }
}
