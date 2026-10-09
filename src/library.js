export const initialLibrary = () => ({ favorites: [], playlists: [], history: [], tracks: [] });
export function safeLibrary(value) {
  const empty = initialLibrary();
  if (!value || typeof value !== 'object') return empty;
  for (const key of Object.keys(empty)) if (Array.isArray(value[key])) empty[key] = value[key];
  empty.tracks = empty.tracks.filter(t => t && typeof t.id === 'string' && typeof t.title === 'string');
  empty.playlists = empty.playlists.filter(p => p && typeof p.id === 'string' && typeof p.name === 'string' && Array.isArray(p.tracks));
  empty.favorites = empty.favorites.filter(id => typeof id === 'string');
  empty.history = empty.history.filter(id => typeof id === 'string').slice(0, 50);
  return empty;
}
export function toggleFavorite(library, id) {
  library.favorites = library.favorites.includes(id) ? library.favorites.filter(x => x !== id) : [...library.favorites, id];
}
export function nextIndex(index, length, direction = 1, shuffle = false, random = Math.random) {
  if (!length) return -1;
  if (shuffle && length > 1) return (index + 1 + Math.floor(random() * (length - 1))) % length;
  return (index + direction + length) % length;
}
export function mergeLibraries(local, remote) {
  const a = safeLibrary(local), b = safeLibrary(remote);
  return { favorites: [...new Set([...b.favorites, ...a.favorites])], history: [...new Set([...a.history, ...b.history])].slice(0,50), tracks: [...new Map([...b.tracks,...a.tracks].map(t=>[t.id,t])).values()], playlists: [...new Map([...b.playlists,...a.playlists].map(p=>[p.id,p])).values()] };
}
