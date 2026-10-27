// Shared, data-backed layouts for the three main destinations.
export const browseCategories = [
  ['Malayalam', 'Malayalam songs', 'forest', '#176a53'],
  ['English', 'English pop songs', 'city', '#ae246f'],
  ['Hindi', 'Hindi songs', 'sun', '#b94d13'],
  ['Tamil', 'Tamil songs', 'flower', '#7244a7'],
  ['Hip-hop', 'hip hop songs', 'night', '#324a87'],
  ['Chill', 'chill music', 'ocean', '#167d8d'],
  ['Focus', 'instrumental focus music', 'forest', '#735a40'],
  ['Electronic', 'electronic music', 'city', '#9333b8']
];

export function createCleanViews({esc, icon, artwork, trackById}) {
  const likedCover = () => `<span class="saved-cover liked-cover">${icon('heart')}</span>`;
  const cover = playlist => {
    const track = playlist.tracks.map(trackById).find(t => t?.artwork);
    return track ? `<img class="saved-cover" src="${esc(track.artwork)}" alt="" loading="lazy"/>`
      : `<span class="saved-cover playlist-cover">${icon('list-music')}</span>`;
  };
  const playlistRow = p => `<button class="saved-row" data-playlist="${esc(p.id)}">${cover(p)}<span><strong>${esc(p.name)}</strong><small>Playlist · ${p.tracks.length} ${p.tracks.length === 1 ? 'song' : 'songs'}</small></span></button>`;
  const likedRow = library => `<button class="saved-row" data-view="liked">${likedCover()}<span><strong>Liked songs</strong><small><span class="saved-pin">♥</span> Playlist · ${library.favorites.length} ${library.favorites.length === 1 ? 'song' : 'songs'}</small></span></button>`;
  function browse() {
    return `<section class="browse-section" aria-label="Browse music"><h2>Browse all</h2><div class="browse-grid">${browseCategories.map(([name, query, art, color]) => `<button class="browse-tile" data-browse-query="${esc(query)}" style="--tile-color:${color}"><strong>${name}</strong><img src="${artwork(art)}" alt="" loading="lazy"/></button>`).join('')}</div></section>`;
  }
  function home(library, filter) {
    const recent = library.history.map(trackById).filter(Boolean).slice(0,8);
    return `<div class="home-heading"><h1>Home</h1></div><div class="home-filters" role="group" aria-label="Home content">${['All','Music','Playlists'].map(value => `<button class="chip ${filter===value?'chosen':''}" data-home-filter="${value}" aria-pressed="${filter===value}">${value}</button>`).join('')}</div>
      ${filter!=='Music'?`<section class="quick-access" aria-label="Your shortcuts">${likedRow(library)}${library.playlists.slice(-7).reverse().map(playlistRow).join('')}${!library.playlists.length?`<button class="saved-row" data-view="library"><span class="saved-cover playlist-cover">${icon('library')}</span><span><strong>Your playlists</strong><small>Make room for your favorites</small></span></button>`:''}</section>`:''}
      ${filter!=='Playlists'?`${recent.length?`<section class="recent-section"><h2>Recently played</h2><div class="album-rail">${recent.map(t=>`<button class="album-card" data-track="${esc(t.id)}"><img src="${esc(t.artwork||artwork('flower'))}" alt="" loading="lazy"/><strong>${esc(t.title)}</strong><small>${esc(t.artist)}</small></button>`).join('')}</div></section>`:''}<section id="language-discovery"></section><section id="music-section" class="music-section"></section>`:`<p class="quiet-note">Your saved playlists, all in one place. Manage them in <button class="text-button" data-view="library">Your library</button>.</p>`}`;
  }
  function library(library, {query='',sort='recent',layout='list'}={}) {
    let playlists=library.playlists.filter(p=>p.name.toLocaleLowerCase().includes(query.toLocaleLowerCase()));
    if(sort==='name')playlists=[...playlists].sort((a,b)=>a.name.localeCompare(b.name));
    else playlists=[...playlists].reverse();
    const showLiked='liked songs'.includes(query.toLocaleLowerCase());
    return `<div class="page-heading clean-page-heading"><h1>Your library</h1><button class="icon-button desktop-create" data-action="create-playlist" aria-label="Create playlist">${icon('plus')}</button></div>
      <div class="library-tools"><label class="library-search">${icon('search')}<input id="library-filter" value="${esc(query)}" placeholder="Find a playlist" aria-label="Find a saved playlist" maxlength="120"/></label></div>
      <div class="library-sort"><label><span class="sr-only">Sort playlists</span><select id="library-sort"><option value="recent" ${sort==='recent'?'selected':''}>Recently added</option><option value="name" ${sort==='name'?'selected':''}>Name</option></select></label><button class="icon-button" data-action="library-layout" aria-label="${layout==='list'?'Show grid':'Show list'}" aria-pressed="${layout==='grid'}">${icon(layout==='list'?'layout-grid':'list-music')}</button></div>
      <section class="saved-library ${layout==='grid'?'saved-library-grid':''}" aria-label="Saved playlists">${showLiked?likedRow(library):''}${playlists.map(playlistRow).join('')}</section>
      ${!showLiked&&!playlists.length?'<p class="quiet-note" role="status">No playlists match your search.</p>':''}
      ${!query&&!library.playlists.length?'<p class="quiet-note">Your playlists will appear here. Use Create to make your first one.</p>':''}`;
  }
  function search(query, localTracks, trackRows) {
    return `<div class="page-heading clean-page-heading"><h1>Search</h1></div>
      <form id="music-form" class="clean-search-form" role="search"><label class="clean-search-field">${icon('search')}<input name="query" type="search" aria-label="Search songs or artists" placeholder="What do you want to listen to?" value="${esc(query)}" minlength="2" maxlength="120" required enterkeyhint="search"/></label><button type="submit" class="search-submit" aria-label="Search">${icon('arrow-right')}</button></form>
      ${query?`<section id="music-section" class="music-section"></section>${localTracks.length?`<section class="local-results"><h2>In your collection</h2>${trackRows(localTracks)}</section>`:''}`:browse()}`;
  }
  return {home,library,search};
}
