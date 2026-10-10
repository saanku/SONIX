import './style.css';
import './music.css';
import { createIcons, Home, Search, Library, Heart, Plus, ArrowUpRight, ArrowLeft, ArrowRight, Play, Pause, SkipBack, SkipForward, Shuffle, Repeat, Volume2, VolumeX, ListMusic, X, Check, Music2, Upload, Headphones, ChevronDown, MoreHorizontal, Download, Globe2, User, LogOut, Disc3, Radio, CheckCircle2 } from 'lucide';
import { tracks as originals, mixes, artwork } from './catalog';
import { initialLibrary, safeLibrary, toggleFavorite, nextIndex, mergeLibraries } from './library';
import { saveAudio, loadAudio } from './storage';
import { configured, getClient, readCloud, writeCloud, cloudMessage } from './cloud';
import { createMusicClient, supportedProvider, providerName, safeWebUrl } from './music';
import { musicMarkup } from './music-view';

const icons={Home,Search,Library,Heart,Plus,ArrowUpRight,ArrowLeft,ArrowRight,Play,Pause,SkipBack,SkipForward,Shuffle,Repeat,Volume2,VolumeX,ListMusic,X,Check,Music2,Upload,Headphones,ChevronDown,MoreHorizontal,Download,Globe2,User,LogOut,Disc3,Radio,CheckCircle2};
const $=s=>document.querySelector(s);
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const icon=(name,extra='')=>`<i data-lucide="${name}" ${extra}></i>`;
const refreshIcons=()=>createIcons({icons,attrs:{'stroke-width':1.7}});
let library;try{library=safeLibrary(JSON.parse(localStorage.getItem('sonix-library')));}catch{library=initialLibrary();}
let view='home', activeFilter='All', selectedMix=null, query='', user=null, queue=originals.map(t=>t.id), current=null, shuffle=false, repeat=false, installPrompt=null, playbackToken=0;
let cloudTimer, searchTimer, toastTimer, objectUrl, cloudChain=Promise.resolve(), cloudLoading=false, cloudSynced=false;
let jamendoClientId=import.meta.env.VITE_JAMENDO_CLIENT_ID||'';try{jamendoClientId=localStorage.getItem('sonix-jamendo-client-id')||jamendoClientId;}catch{}
const music=createMusicClient({jamendoClientId}), musicRegistry=new Map();
let musicState={provider:'jamendo',query:'',tracks:[],status:'idle',error:''}, musicVersion=0;
const audio=new Audio();audio.preload='metadata';audio.volume=.7;
const allTracks=()=>[...originals,...library.tracks.filter(t=>!t.provider||supportedProvider(t.provider))];
const trackById=id=>allTracks().find(t=>t.id===id)||musicRegistry.get(id);
function registerMusicTracks(tracks){
 for(const t of tracks)musicRegistry.set(t.id,t);
 const keep=new Set([...queue,current?.id,...tracks.map(t=>t.id)]);
 for(const id of musicRegistry.keys()){if(musicRegistry.size<=300)break;if(!keep.has(id))musicRegistry.delete(id);}
}
function rememberMusic(id){const t=trackById(id);if(supportedProvider(t?.provider)&&!library.tracks.some(saved=>saved.id===id))library.tracks.push({...t});}
const time=s=>Number.isFinite(s)?`${Math.floor(s/60)}:${String(Math.floor(s%60)).padStart(2,'0')}`:'0:00';
function toast(message){$('#toast').textContent=message;$('#toast').classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('#toast').classList.remove('show'),4000);}
function persist(){try{localStorage.setItem('sonix-library',JSON.stringify(library));if(user)localStorage.setItem('sonix-library-owner',user.id);}catch{toast('Device storage is full. Your latest changes could not be saved.');}if(user&&!cloudLoading){clearTimeout(cloudTimer);const id=user.id;cloudTimer=setTimeout(()=>{if(user?.id!==id)return;const data=structuredClone(library);cloudChain=cloudChain.then(()=>writeCloud(id,data)).then(()=>{cloudSynced=true;updateAccount();}).catch(error=>{cloudSynced=false;updateAccount();toast(cloudMessage(error));});},600);}renderSidebar();}

$('#app').innerHTML=`
<aside class="sidebar">
 <a class="brand" href="#home" aria-label="SONIX home"><img src="${import.meta.env.BASE_URL}icon.svg" alt=""/>SONIX<span>®</span></a>
 <div class="nav-label">YOUR DAILY SOUNDTRACK</div>
 <nav class="main-nav"><button data-view="home">${icon('home')}<span>Home</span></button><button data-view="search">${icon('search')}<span>Search</span></button><button data-view="music">${icon('radio')}<span>Full songs</span></button><button data-view="library">${icon('library')}<span>Your library</span></button></nav>
 <div class="sidebar-divider"></div>
 <div class="library-label">YOUR COLLECTION<button class="icon-button" data-action="create-playlist" aria-label="Create playlist">${icon('plus')}</button></div>
 <button class="side-liked" data-view="liked"><span class="liked-icon">${icon('heart')}</span><span>Liked songs<small id="like-count"></small></span></button>
 <div id="sidebar-playlists"></div>
 <button class="new-playlist" data-action="create-playlist">${icon('plus')}Create playlist</button>
 <div class="sidebar-bottom"><div class="little-wave">▂ ▅ ▃ ▇ ▅ ▂</div><strong>A space that sounds like you.</strong><p>Your music. Your mood. Your rules.</p><button data-action="import">${icon('upload')}Import your music</button></div>
 <button class="account" data-action="account"><span class="avatar">S</span><span id="account-label">Your personal space<small>Made for your ears only</small></span>${icon('chevron-down')}</button>
</aside>
<div class="workspace"><header class="topbar"><div class="history-buttons"><button class="icon-button" data-action="back" aria-label="Go back">${icon('arrow-left')}</button><button class="icon-button" data-action="forward" aria-label="Go forward">${icon('arrow-right')}</button></div><label class="global-search">${icon('search')}<input id="search" placeholder="What do you want to listen to?" autocomplete="off" aria-label="Search music"/><kbd>/</kbd></label><div class="top-actions"><button class="install-button" data-action="install">${icon('download')}<span>Install app</span></button><button class="avatar" data-action="account" aria-label="Your account">S</button></div></header><main id="main" tabindex="-1"></main><footer class="page-footer"><span>SONIX<span class="green">®</span></span><p>A little less noise. A little more music.</p><span>MADE FOR YOU</span></footer></div>
<aside id="queue-panel" class="queue-panel" hidden></aside>
<div class="player"><div class="now-playing"><button class="now-art" data-action="now-playing" aria-label="Show current collection"><img id="player-art" src="${artwork('night')}" alt="Current track artwork"/></button><div class="now-meta"><strong id="player-title">Your next favorite awaits</strong><span id="player-artist">Pick a track. Find your flow.</span></div><button id="player-like" class="icon-button" data-action="like-current" aria-label="Like current song">${icon('heart')}</button></div><div class="transport"><div class="transport-buttons"><button id="shuffle" class="icon-button" data-action="shuffle" aria-label="Shuffle" aria-pressed="false">${icon('shuffle')}</button><button class="icon-button" data-action="previous" aria-label="Previous song">${icon('skip-back')}</button><button id="play-toggle" class="play-toggle" data-action="toggle" aria-label="Play">${icon('play')}</button><button class="icon-button" data-action="next" aria-label="Next song">${icon('skip-forward')}</button><button id="repeat" class="icon-button" data-action="repeat" aria-label="Repeat" aria-pressed="false">${icon('repeat')}</button></div><div class="progress"><span id="elapsed">0:00</span><input id="seek" type="range" min="0" max="100" value="0" step="0.1" aria-label="Seek position"/><span id="duration">0:00</span></div></div><div class="player-options"><span class="quality">PERSONAL MIX</span><button class="icon-button" data-action="queue" aria-label="Show queue">${icon('list-music')}</button><button class="icon-button" data-action="mute" id="mute" aria-label="Mute">${icon('volume-2')}</button><input id="volume" type="range" min="0" max="1" step="0.01" value="0.7" aria-label="Volume"/></div></div>
<nav class="mobile-nav"><button data-view="home">${icon('home')}Home</button><button data-view="search">${icon('search')}Search</button><button data-view="library">${icon('library')}Library</button><button data-action="account">${icon('user')}You</button></nav>
<dialog id="dialog"><button class="dialog-close icon-button" data-action="close-dialog" aria-label="Close">${icon('x')}</button><div id="dialog-content"></div></dialog><div id="toast" role="status" aria-live="polite"></div><input id="file-input" type="file" accept="audio/*,.mp3,.m4a,.wav,.flac,.ogg" multiple hidden/>`;

function renderSidebar(){
 $('#like-count').textContent=`${library.favorites.length} songs`;
 $('#sidebar-playlists').innerHTML=library.playlists.map(p=>`<button class="side-playlist" data-playlist="${esc(p.id)}"><span>${icon('list-music')}</span><span>${esc(p.name)}<small>Playlist · ${p.tracks.length} songs</small></span></button>`).join('');refreshIcons();
}
function sectionHead(eyebrow,title,action='',label='View all'){return `<div class="section-heading"><div><span class="eyebrow">${eyebrow}</span><h2>${title}</h2></div>${action?`<button class="text-button" data-action="${action}">${label}${icon('arrow-right')}</button>`:''}</div>`;}
function mixCard(m){return `<button class="mix-card" data-mix="${m.id}"><div class="mix-art"><img loading="lazy" src="${artwork(m.art)}" alt="${esc(m.name)} cover"/><div class="cover-brand">SONIX / SELECTS</div><span class="cover-tag">${m.tag}</span><strong style="color:${m.color}">${esc(m.name)}</strong><span class="card-play">${icon('play')}</span></div><h3>${m.name}</h3><p>${m.sub}</p></button>`;}
function trackRows(list){return list.length?`<div class="track-table"><div class="track-table-head"><span>#</span><span>TITLE</span><span>ALBUM</span><span>TIME</span><span></span></div>${list.map((t,i)=>`<div class="track-row ${current?.id===t.id?'is-current':''}"><button class="track-number" data-track="${esc(t.id)}" aria-label="Play ${esc(t.title)}"><span>${current?.id===t.id?'♫':String(i+1).padStart(2,'0')}</span>${icon('play')}</button><button class="track-info" data-track="${esc(t.id)}"><img loading="lazy" src="${esc(t.artwork||artwork('flower'))}" alt=""/><span><strong>${esc(t.title)}</strong><small>${esc(t.artist)}</small></span></button><span class="track-album">${esc(t.album||'Your uploads')}</span><span class="track-duration">${time(t.duration)}</span><div class="track-actions"><button class="icon-button ${library.favorites.includes(t.id)?'active':''}" data-like="${esc(t.id)}" aria-label="${library.favorites.includes(t.id)?'Unlike':'Like'} ${esc(t.title)}">${icon('heart')}</button><button class="icon-button" data-add="${esc(t.id)}" aria-label="Add ${esc(t.title)} to playlist">${icon('plus')}</button></div></div>`).join('')}</div>`:`<div class="empty-state">${icon('headphones')}<h3>Your soundtrack starts here</h3><p>Import your music or explore SONIX Originals to add songs.</p><button class="primary" data-action="import">${icon('upload')}Import music</button></div>`;}
function render(){
 const main=$('#main');
 document.querySelectorAll('[data-view]').forEach(b=>b.classList.toggle('selected',b.dataset.view===view));
 if(view==='home'){
 const visible=activeFilter==='All'?mixes:mixes.filter(m=>m.tracks.some(id=>trackById(id)?.mood===activeFilter));
 main.innerHTML=`<div class="greeting"><div><span class="eyebrow">YOUR WORLD, ON REPEAT</span><h1>Find your next feeling<span class="green">.</span></h1><p>A soundtrack for wherever the day takes you.</p></div><span class="date-pill">${icon('radio')}Tuned in to you</span></div>
 <div class="filter-row">${['All','Chill','Electronic','Focus','Ambient'].map(f=>`<button class="chip ${activeFilter===f?'chosen':''}" data-filter="${f}">${f}</button>`).join('')}<button class="language-link" data-view="music">${icon('globe-2')}Full songs${icon('arrow-up-right')}</button></div>
 <section class="hero"><img class="hero-photo" src="${artwork('hero')}" alt="Atmospheric concert lights over a crowd" fetchpriority="high"/><div class="hero-shade"></div><div class="hero-copy"><span class="hero-label"><span></span>THE SONIX EDIT</span><h2>Lose yourself.<br/>Find your sound.</h2><p>Late nights. Open roads. Just you and the music.<br/>Meet the mix that gets you.</p><div class="hero-actions"><button class="primary" data-action="play-featured">${icon('play')}Play the mix</button><button class="secondary" data-mix="night">Explore mix${icon('arrow-up-right')}</button></div></div><div class="hero-caption"><span>01 / 05</span><div><i></i><i></i><i></i><i></i><i></i></div><span>CURATED FOR YOUR EVERYDAY</span></div><span class="hero-vertical">PRESS PLAY. STAY A WHILE.</span></section>
 <section>${sectionHead('GOOD MUSIC. NO GUESSWORK.','Made for your mood','all-mixes','Explore all')}<div class="mix-grid">${visible.map(mixCard).join('')}</div></section>
 <section class="lower-grid"><div>${sectionHead('A LITTLE DISCOVERY','In heavy rotation','originals','View all')}${trackRows(originals.slice(0,4))}</div><div class="discovery-card"><span class="eyebrow">NO BORDERS. JUST MUSIC.</span><div class="globe-art">${icon('globe-2')}<span>ALL<br/>TOGETHER.</span></div><h3>A world worth listening to.</h3><p>Full tracks from independent artists.<br/>Your next discovery is out there.</p><button class="text-button" data-view="music">Explore full songs${icon('arrow-up-right')}</button></div></section>
 ${library.history.length?`<section>${sectionHead('WELCOME BACK','Recently played')}${trackRows(library.history.map(trackById).filter(Boolean).slice(0,4))}</section>`:''}`;
 }else if(view==='search'){
 const results=allTracks().filter(t=>`${t.title} ${t.artist} ${t.album} ${t.mood||''}`.toLowerCase().includes(query.toLowerCase()));
 main.innerHTML=`<div class="page-heading"><span class="eyebrow">FOLLOW YOUR CURIOSITY</span><h1>${query?`Results for “${esc(query)}”`:'Find your sound.'}</h1><p>Search your songs, artists, albums, and moods.</p></div>${trackRows(results)}<section>${sectionHead('TAKE A DIFFERENT ROUTE','Browse your moods')}<div class="mix-grid">${mixes.map(mixCard).join('')}</div></section>`;
 }else if(view==='library'||view==='liked'||view==='originals'||view==='mix'||view==='playlist'){
 let title='Your library',label='ALL YOUR FAVORITES, IN ONE PLACE',description='A collection that is completely you.',list=allTracks(),art='flower';
 if(view==='liked'){title='Liked songs';list=library.favorites.map(trackById).filter(Boolean);label='SAVED WITH LOVE';description='The ones you keep coming back to.';art='sun';}
 if(view==='originals'){title='SONIX Originals';label='EXCLUSIVELY IN YOUR SPACE';description='Six original instrumental sketches. Made for exploring SONIX.';art='city';list=originals;}
 if(view==='mix'){const m=mixes.find(m=>m.id===selectedMix)||mixes[0];title=m.name;description=m.sub;label='SONIX SELECTS · CURATED MIX';list=m.tracks.map(trackById).filter(Boolean);art=m.art;}
 if(view==='playlist'){const p=library.playlists.find(p=>p.id===selectedMix);title=p?.name||'Playlist';label='YOUR PERSONAL PLAYLIST';description='Every track, a little more you.';list=(p?.tracks||[]).map(trackById).filter(Boolean);}
 main.innerHTML=`<section class="collection-hero"><img src="${artwork(art)}" alt=""/><div><span class="eyebrow">${label}</span><h1>${esc(title)}</h1><p>${description}</p><span class="collection-count">SONIX <span>•</span> ${list.length} songs</span></div></section><div class="collection-actions"><button class="primary" data-action="play-view" ${list.length?'':'disabled'}>${icon('play')}Play${list.length?' collection':''}</button><button class="secondary" data-action="import">${icon('upload')}Import music</button>${view==='playlist'?`<button class="icon-button" data-action="edit-playlist" aria-label="Edit playlist">${icon('more-horizontal')}</button>`:''}<span>YOUR MUSIC, YOUR WAY</span></div>${trackRows(list)}${view==='library'?`<section>${sectionHead('MAKE IT YOURS','Your playlists','create-playlist','Create playlist')}<div class="playlist-grid">${library.playlists.map(p=>`<button data-playlist="${esc(p.id)}" class="playlist-tile">${icon('list-music')}<h3>${esc(p.name)}</h3><p>${p.tracks.length} songs</p></button>`).join('')}<button class="playlist-tile new" data-action="create-playlist">${icon('plus')}<h3>A new kind of mood</h3><p>Create a playlist</p></button></div></section>`:''}`;
 main.dataset.tracks=JSON.stringify(list.map(t=>t.id));
 }else if(view==='music'){
 main.innerHTML=`<div class="page-heading"><span class="eyebrow">JAMENDO MUSIC</span><h1>Full songs. Fresh discoveries<span class="green">.</span></h1><p>Explore the Jamendo catalog, stream full tracks, and save your favorites.</p></div>`;
 }
 if(['home','search','music'].includes(view))renderMusic();
 refreshIcons();updatePlayer();
}
function renderMusic(){
 let section=$('#music-section');if(!section){section=document.createElement('section');section.id='music-section';section.className='music-section';const anchor=view==='home'?$('#main .hero'):$('#main .page-heading');anchor?.insertAdjacentElement('afterend',section);}
 const old=section.querySelector('input'),draft=old?.value,focused=document.activeElement===old;
 section.innerHTML=musicMarkup({state:musicState,view,query,configured:music.configured('jamendo'),sectionHead,icon,esc,time,artwork,trackRows,favorites:library.favorites});
 if(draft!==undefined&&section.querySelector('input'))section.querySelector('input').value=draft;
 if(focused)section.querySelector('input')?.focus();refreshIcons();
 if(musicState.status==='idle'&&music.configured(musicState.provider))loadMusic('');
}
async function loadMusic(q='',page=0,sort=musicState.sort||'popular'){
 const token=++musicVersion,provider=musicState.provider;musicState={provider,query:q,page,sort,total:page?musicState.total:null,tracks:[],status:'loading',error:''};if(['home','search','music'].includes(view))renderMusic();
 try{const result=await music.browse(provider,q,{page,sort});if(token!==musicVersion)return;if(provider==='jamendo'&&!result.tracks.length&&Number.isFinite(musicState.total)&&page*48<musicState.total)throw Error('Jamendo returned an empty page. Please try again.');registerMusicTracks(result.tracks);musicState={...musicState,...result,total:result.total??musicState.total,status:'ready'};}
 catch(error){if(token!==musicVersion)return;musicState.status='error';musicState.error=error.message;}
 if(['home','search','music'].includes(view))renderMusic();
}
function navigate(next,id){view=next;selectedMix=id||null;const hash=`#${next}${id?'/'+encodeURIComponent(id):''}`;if(location.hash!==hash)location.hash=hash;render();window.scrollTo({top:0,behavior:'instant'});}
window.addEventListener('hashchange',()=>{const [next,id]=location.hash.slice(1).split('/');view=['discover','audius'].includes(next)?'music':['home','search','library','liked','originals','mix','playlist','music'].includes(next)?next:'home';try{selectedMix=id?decodeURIComponent(id):null;}catch{selectedMix=null;}render();});
function updatePlayer(){
 $('#play-toggle').innerHTML=icon(audio.paused?'play':'pause');$('#play-toggle').setAttribute('aria-label',audio.paused?'Play':'Pause');
 if(current){$('#player-title').textContent=current.title;$('#player-artist').innerHTML=esc(current.artist)+(supportedProvider(current.provider)?` · <a href="${esc(safeWebUrl(current.permalink))}" target="_blank" rel="noopener noreferrer">${esc(providerName(current.provider))} ↗</a>${safeWebUrl(current.license)?` | <a href="${esc(safeWebUrl(current.license))}" target="_blank" rel="noopener noreferrer">License</a>`:''}`:'');$('#player-art').src=current.artwork||artwork('flower');$('#player-like').classList.toggle('active',library.favorites.includes(current.id));}
 $('#shuffle').classList.toggle('active',shuffle);$('#shuffle').setAttribute('aria-pressed',shuffle);$('#repeat').classList.toggle('active',repeat);$('#repeat').setAttribute('aria-pressed',repeat);refreshIcons();
}
async function playTrack(id,newQueue){
 const t=trackById(id);if(!t)return;const token=++playbackToken;
 if(newQueue)queue=newQueue;if(!queue.includes(id))queue=allTracks().map(t=>t.id);
 audio.pause();audio.removeAttribute('src');audio.load();if(objectUrl){URL.revokeObjectURL(objectUrl);objectUrl=null;}
 current=t;updatePlayer();$('#player-artist').textContent='Loading audio…';$('#elapsed').textContent='0:00';$('#duration').textContent=time(t.duration);$('#seek').value=0;$('#seek').style.setProperty('--fill','0%');
 try{
 let url=t.url;if(supportedProvider(t.provider)){const resolved=await music.resolve(t);if(token!==playbackToken)return;Object.assign(t,resolved.track);url=resolved.url;}if(t.local){const file=await loadAudio(id);if(token!==playbackToken)return;if(!file)throw Error('This audio file is stored on another device. Import it on this device to play.');objectUrl=URL.createObjectURL(file);url=objectUrl;}
 if(!url)throw Error('No playable audio is available.');if(token!==playbackToken)return;audio.src=url;await audio.play();if(token!==playbackToken)return;
 rememberMusic(id);library.history=[id,...library.history.filter(x=>x!==id)].slice(0,50);persist();updatePlayer();
 document.querySelectorAll('.track-row').forEach(row=>row.classList.toggle('is-current',row.querySelector('[data-track]')?.dataset.track===id));
 if('mediaSession' in navigator){navigator.mediaSession.metadata=new MediaMetadata({title:t.title,artist:t.artist,album:t.album,artwork:[{src:new URL(t.artwork||artwork('flower'),location.href).href,sizes:'640x640',type:'image/jpeg'}]});}
 }catch(e){if(token!==playbackToken)return;toast(supportedProvider(t.provider)?e.message||'This service could not play the track. Please try another.':e.message?.includes('another device')?e.message:'Could not play this file. Try another track or supported audio format.');updatePlayer();}
 renderQueue();
}
function step(direction){const idx=nextIndex(queue.indexOf(current?.id),queue.length,direction,shuffle&&direction===1);if(idx>=0)playTrack(queue[idx]);}
function toggle(){if(!current)playTrack(queue[0]||originals[0].id);else if(audio.paused&&!audio.getAttribute('src'))playTrack(current.id);else if(audio.paused)audio.play().catch(()=>toast('Playback unavailable. Select a track to try again.'));else audio.pause();}
audio.addEventListener('play',updatePlayer);audio.addEventListener('pause',updatePlayer);audio.addEventListener('ended',()=>{if(repeat){audio.currentTime=0;audio.play().catch(()=>toast('Tap play to continue.'));}else step(1);});
audio.addEventListener('timeupdate',()=>{$('#elapsed').textContent=time(audio.currentTime);$('#duration').textContent=time(audio.duration);const percent=audio.duration?audio.currentTime/audio.duration*100:0;$('#seek').value=percent;$('#seek').style.setProperty('--fill',`${percent}%`);});
audio.addEventListener('error',()=>{if(audio.getAttribute('src'))toast('Audio could not load. Check your connection or import the file again.');});
$('#seek').addEventListener('input',e=>{if(Number.isFinite(audio.duration))audio.currentTime=Number(e.target.value)/100*audio.duration;});
$('#volume').addEventListener('input',e=>{audio.volume=Number(e.target.value);audio.muted=false;$('#mute').innerHTML=icon(audio.volume?'volume-2':'volume-x');refreshIcons();});
function renderQueue(){const panel=$('#queue-panel');if(panel.hidden)return;panel.innerHTML=`<div class="section-heading"><h2>Up next</h2><button class="icon-button" data-action="queue" aria-label="Close queue">${icon('x')}</button></div><p class="muted">Your listening session</p>${queue.map(trackById).filter(Boolean).map(t=>`<button class="queue-track ${current?.id===t.id?'active':''}" data-track="${esc(t.id)}"><img src="${esc(t.artwork||artwork('flower'))}" alt=""/><span><strong>${esc(t.title)}</strong><small>${esc(t.artist)}</small></span>${icon(current?.id===t.id&&!audio.paused?'volume-2':'play')}</button>`).join('')}`;refreshIcons();}
function openDialog(content){$('#dialog-content').innerHTML=content;refreshIcons();if(!$('#dialog').open)$('#dialog').showModal();}
function playlistDialog(trackId){if(trackId){openDialog(`<span class="eyebrow">KEEP THE GOOD ONES CLOSE</span><h2>Add to playlist</h2><div class="dialog-playlists">${library.playlists.map(p=>`<button class="secondary" data-save-track="${esc(trackId)}" data-target="${esc(p.id)}">${icon('list-music')}${esc(p.name)}</button>`).join('')}</div><button class="primary" data-action="new-for-track" data-id="${esc(trackId)}">${icon('plus')}New playlist</button>`);}else createPlaylistForm();}
function createPlaylistForm(trackId=''){openDialog(`<span class="eyebrow">A MIX THAT IS ALL YOU</span><h2>Create a playlist</h2><form id="playlist-form" data-track-id="${esc(trackId)}"><label>Playlist name<input name="name" placeholder="Sunday state of mind" maxlength="80" required autofocus/></label><button class="primary" type="submit">${icon('plus')}Create playlist</button></form>`);}
function accountDialog(){if(!configured){openDialog(`<span class="eyebrow">YOUR PERSONAL SPACE</span><h2>Make yourself at home.</h2><p>Your playlists and favorites are saved on this device. Import audio to build your own collection.</p><div class="info-box">${icon('check-circle-2')}Device library is ready</div><p class="muted">Cross-device sign-in will be available once your SONIX cloud is connected.</p><button class="primary" data-action="import">${icon('upload')}Import your music</button>`);return;}
 if(user){openDialog(`<span class="eyebrow">CONNECTED TO YOUR WORLD</span><h2>Your account</h2><p>${esc(user.email)}</p><button class="secondary" data-action="sync">${icon('check')}Sync library now</button><button class="secondary" data-action="logout">${icon('log-out')}Sign out</button>`);return;}
 openDialog(`<span class="eyebrow">YOUR MUSIC, EVERYWHERE</span><h2>Welcome to your space.</h2><p>Sign in to sync playlists and favorites across your devices.</p><form id="auth-form"><label>Email<input type="email" name="email" autocomplete="email" required/></label><label>Password<input type="password" name="password" minlength="8" autocomplete="current-password" required/></label><p id="auth-message" role="status"></p><div class="auth-actions"><button class="primary" type="submit" name="mode" value="signin">Sign in${icon('arrow-right')}</button><button class="secondary" type="submit" name="mode" value="signup">Create account</button></div></form>`);
}
document.addEventListener('click',async e=>{
 const b=e.target.closest('button,[data-view]');if(!b)return;
 if(b.dataset.view){navigate(b.dataset.view);if(b.dataset.view==='search')$('#search').focus();return;}
 if(b.dataset.mix){navigate('mix',b.dataset.mix);return;}if(b.dataset.playlist){navigate('playlist',b.dataset.playlist);return;}
 if(b.dataset.musicTrack){playTrack(b.dataset.musicTrack,musicState.tracks.map(t=>t.id));return;}
 if(b.dataset.track){const list=$('#main').dataset.tracks;playTrack(b.dataset.track,b.closest('#music-section')?musicState.tracks.map(t=>t.id):list&&['mix','playlist','liked','library','originals'].includes(view)?JSON.parse(list):undefined);return;}
 if(b.dataset.like){rememberMusic(b.dataset.like);toggleFavorite(library,b.dataset.like);persist();render();return;}
 if(b.dataset.add){rememberMusic(b.dataset.add);persist();playlistDialog(b.dataset.add);return;}
 if(b.dataset.filter){activeFilter=b.dataset.filter;render();return;}
 if(b.dataset.saveTrack){const p=library.playlists.find(p=>p.id===b.dataset.target);if(p&&!p.tracks.includes(b.dataset.saveTrack))p.tracks.push(b.dataset.saveTrack);persist();$('#dialog').close();toast('Added to your playlist');if(view==='playlist')render();return;}
 const a=b.dataset.action;
 if(a==='toggle')toggle();if(a==='next')step(1);if(a==='previous'){if(audio.currentTime>3)audio.currentTime=0;else step(-1);}
 if(a==='shuffle'){shuffle=!shuffle;updatePlayer();}if(a==='repeat'){repeat=!repeat;updatePlayer();}
 if(a==='like-current'&&current){rememberMusic(current.id);toggleFavorite(library,current.id);persist();render();}
 if(a==='browse-music')navigate('music');if(a==='music-trending'){const input=$('#music-form input');if(input)input.value='';loadMusic('');}if(a==='music-retry')loadMusic(musicState.query,musicState.page||0);
 if(a==='music-next'||a==='music-previous'){if(musicState.status==='loading')return;await loadMusic(musicState.query,Math.max(0,(musicState.page||0)+(a==='music-next'?1:-1)));$('#music-section')?.scrollIntoView({block:'start'});}
 if(a==='connect-jamendo')openDialog(`<span class="eyebrow">JAMENDO MUSIC</span><h2>Connect your music catalog.</h2><p>Enter the public client ID for your own Jamendo developer app. This stays on this device.</p><form id="jamendo-form"><label>Jamendo client ID<input name="clientId" value="${esc(jamendoClientId)}" required maxlength="100" autocomplete="off"/></label><button class="primary" type="submit">Connect Jamendo</button></form><p><a href="https://devportal.jamendo.com/" target="_blank" rel="noopener noreferrer">Create your app on Jamendo</a></p>`);
 if(a==='play-featured')playTrack('night-drive',mixes[0].tracks);
 if(a==='play-view'){const ids=JSON.parse($('#main').dataset.tracks||'[]');if(ids.length)playTrack(ids[0],ids);}
 if(a==='all-mixes'){activeFilter='All';navigate('home');document.querySelector('.mix-grid')?.scrollIntoView({behavior:'smooth',block:'center'});}
 if(a==='originals')navigate('originals');
 if(a==='now-playing'&&current)navigate(supportedProvider(current.provider)?'music':current.local?'library':'originals');
 if(a==='back')history.back();if(a==='forward')history.forward();
 if(a==='queue'){$('#queue-panel').hidden=!$('#queue-panel').hidden;renderQueue();}
 if(a==='mute'){audio.muted=!audio.muted;$('#mute').innerHTML=icon(audio.muted?'volume-x':'volume-2');refreshIcons();}
 if(a==='create-playlist')playlistDialog();if(a==='new-for-track')createPlaylistForm(b.dataset.id);
 if(a==='close-dialog')$('#dialog').close();
 if(a==='import'){$('#dialog').close();$('#file-input').click();}
 if(a==='account')accountDialog();
 if(a==='install'){if(installPrompt){await installPrompt.prompt();installPrompt=null;}else openDialog(`<span class="eyebrow">TAKE YOUR SOUND WITH YOU</span><h2>SONIX, one tap away.</h2><p><strong>iPhone:</strong> Open SONIX in Safari, tap Share, then Add to Home Screen.</p><p><strong>Android:</strong> Open SONIX in Chrome, then choose Install app or Add to Home screen from the menu.</p><p class="muted">Installation requires a hosted HTTPS address. Imported audio stays on the device where you added it.</p>`);}
 if(a==='edit-playlist'){const p=library.playlists.find(p=>p.id===selectedMix);if(p)openDialog(`<h2>Edit playlist</h2><form id="edit-playlist-form"><label>Name<input name="name" maxlength="80" value="${esc(p.name)}" required/></label><button class="primary" type="submit">Save changes</button></form><div class="dialog-playlists">${p.tracks.map(trackById).filter(Boolean).map(t=>`<button class="secondary" data-remove-track="${esc(t.id)}">${icon('x')}Remove ${esc(t.title)}</button>`).join('')}</div><button class="danger" data-action="delete-playlist">Delete playlist</button>`);}
 if(b.dataset.removeTrack){const p=library.playlists.find(p=>p.id===selectedMix);p.tracks=p.tracks.filter(id=>id!==b.dataset.removeTrack);persist();b.remove();render();}
 if(a==='delete-playlist'){openDialog(`<h2>Delete this playlist?</h2><p>Your songs will stay in your library.</p><button class="danger" data-action="confirm-delete">Delete playlist</button><button class="secondary" data-action="close-dialog">Keep playlist</button>`);}
 if(a==='confirm-delete'){library.playlists=library.playlists.filter(p=>p.id!==selectedMix);persist();$('#dialog').close();navigate('library');}
 if(a==='sync'){try{await syncAccount();toast('Library synced');}catch(error){toast(cloudMessage(error));}}
 if(a==='logout'){clearTimeout(cloudTimer);await cloudChain;let backedUp=false;try{await writeCloud(user.id,library);}catch{try{localStorage.setItem(`sonix-library-backup-${user.id}`,JSON.stringify(library));backedUp=true;}catch{toast('Could not preserve unsynced changes. Free device storage before signing out.');return;}}const c=await getClient();const {error}=await c.auth.signOut();if(error){toast('Could not sign out. Try again.');return;}user=null;cloudSynced=false;library=initialLibrary();localStorage.removeItem('sonix-library');localStorage.removeItem('sonix-library-owner');updateAccount();renderSidebar();render();$('#dialog').close();toast(backedUp?'Signed out. Unsynced changes are kept for your next sign-in.':'Signed out');}
});
document.addEventListener('change',e=>{if(e.target.id==='music-sort')loadMusic(musicState.query,0,e.target.value);});
document.addEventListener('submit',async e=>{
 if(e.target.id==='jamendo-form'){e.preventDefault();const value=String(new FormData(e.target).get('clientId')).trim();if(!/^[A-Za-z0-9_-]{4,100}$/.test(value)){toast('Enter a valid Jamendo client ID, not a URL or client secret.');return;}jamendoClientId=value;localStorage.setItem('sonix-jamendo-client-id',value);music.setJamendoClientId(value);$('#dialog').close();loadMusic('');return;}
 if(e.target.id==='music-form'){e.preventDefault();const q=String(new FormData(e.target).get('query')).trim();if(q.length>=2)loadMusic(q);return;}
 if(e.target.id==='playlist-form'){e.preventDefault();const name=new FormData(e.target).get('name').trim();if(!name)return;const p={id:crypto.randomUUID(),name,tracks:e.target.dataset.trackId?[e.target.dataset.trackId]:[]};library.playlists.push(p);persist();$('#dialog').close();navigate('playlist',p.id);toast('Your new playlist is ready');}
 if(e.target.id==='edit-playlist-form'){e.preventDefault();const name=new FormData(e.target).get('name').trim();if(!name)return;library.playlists.find(p=>p.id===selectedMix).name=name;persist();$('#dialog').close();render();}
 if(e.target.id==='auth-form'){e.preventDefault();const form=e.target;const data=new FormData(form);const mode=e.submitter?.value;form.querySelectorAll('button').forEach(b=>b.disabled=true);try{const c=await getClient();const payload={email:data.get('email').trim(),password:data.get('password')};const {data:result,error}=mode==='signup'?await c.auth.signUp({...payload,options:{emailRedirectTo:location.origin+location.pathname}}):await c.auth.signInWithPassword(payload);if(error)throw error;if(result.session){user=result.session.user;updateAccount();$('#dialog').close();try{await syncAccount();toast('Welcome to your space');}catch(error){toast(cloudMessage(error));}}else $('#auth-message').textContent='Check your email to confirm your account, then sign in.';}catch(err){const message=form.querySelector('#auth-message');if(message)message.textContent=err.message;}finally{form.querySelectorAll('button').forEach(b=>b.disabled=false);}}
});
$('#search').addEventListener('input',e=>{query=e.target.value;clearTimeout(searchTimer);searchTimer=setTimeout(()=>navigate('search'),120);});
document.addEventListener('error',e=>{if(e.target instanceof HTMLImageElement&&e.target.closest('#music-section')&&e.target.src.startsWith('https://'))e.target.src=artwork('flower');},true);
$('#file-input').addEventListener('change',async e=>{const files=[...e.target.files];let count=0;for(const file of files){if(!file.type.startsWith('audio/')&&!/\.(mp3|wav|m4a|ogg|flac)$/i.test(file.name))continue;const id=`local-${file.name}-${file.size}-${file.lastModified}`;try{await saveAudio(id,file);if(!library.tracks.some(t=>t.id===id))library.tracks.push({id,title:file.name.replace(/\.[^.]+$/,''),artist:'Your music',album:'Imported collection',artwork:artwork('flower'),local:true,duration:0});count++;}catch{toast('Could not save audio. Device storage may be full.');break;}}persist();navigate('library');toast(`${count} ${count===1?'track':'tracks'} imported to this device`);e.target.value='';});
document.addEventListener('keydown',e=>{if(['INPUT','TEXTAREA','SELECT'].includes(e.target.tagName)||$('#dialog').open)return;if(e.key===' '){e.preventDefault();toggle();}if(e.key==='/'){e.preventDefault();$('#search').focus();}if(e.key==='Escape')$('#queue-panel').hidden=true;});
$('#dialog').addEventListener('click',e=>{if(e.target===$('#dialog'))$('#dialog').close();});
window.addEventListener('beforeinstallprompt',e=>{e.preventDefault();installPrompt=e;});
if('mediaSession' in navigator){for(const [action,fn] of Object.entries({play:()=>audio.play(),pause:()=>audio.pause(),previoustrack:()=>step(-1),nexttrack:()=>step(1),seekto:d=>{if(Number.isFinite(audio.duration))audio.currentTime=d.seekTime;}})){try{navigator.mediaSession.setActionHandler(action,fn);}catch{}}}
function updateAccount(){$('#account-label').innerHTML=user?`${esc(user.email?.split('@')[0])}<small>${cloudSynced?'Personal cloud connected':'Signed in · sync pending'}</small>`:'Your personal space<small>Made for your ears only</small>';}
async function syncAccount(){if(!user)return;cloudLoading=true;cloudSynced=false;clearTimeout(cloudTimer);try{await cloudChain;const owner=localStorage.getItem('sonix-library-owner');if(owner&&owner!==user.id){localStorage.setItem(`sonix-library-backup-${owner}`,JSON.stringify(library));library=initialLibrary();}const backup=localStorage.getItem(`sonix-library-backup-${user.id}`);if(backup){try{library=mergeLibraries(library,JSON.parse(backup));}catch{}}persist();const remote=await readCloud(user.id);library=mergeLibraries(library,remote);persist();await writeCloud(user.id,library);localStorage.removeItem(`sonix-library-backup-${user.id}`);cloudSynced=true;}finally{cloudLoading=false;updateAccount();render();}}
async function initCloud(){try{const c=await getClient();if(!c)return;const {data,error}=await c.auth.getSession();if(error)throw error;user=data.session?.user||null;updateAccount();if(user)await syncAccount();c.auth.onAuthStateChange((event,session)=>{if(event==='TOKEN_REFRESHED'){user=session?.user||null;updateAccount();}});}catch(error){cloudSynced=false;updateAccount();toast(cloudMessage(error));}}
let [initialView,initialId]=location.hash.slice(1).split('/');if(['discover','audius'].includes(initialView))initialView='music';if(['home','search','library','liked','originals','mix','playlist','music'].includes(initialView)){view=initialView;try{selectedMix=decodeURIComponent(initialId||'');}catch{}}
renderSidebar();render();initCloud();
if('serviceWorker' in navigator&&import.meta.env.PROD)window.addEventListener('load',()=>navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`).catch(()=>{}));
