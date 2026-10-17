import './style.css';
import {setupTheme} from './theme';
import './music.css';
import {createConnect} from './connect';
import {createDiscovery} from './discovery';
import { createIcons, Home, Search, Library, Heart, Plus, ArrowUpRight, ArrowLeft, ArrowRight, Play, Pause, SkipBack, SkipForward, Shuffle, Repeat, Volume2, VolumeX, ListMusic, X, Check, Music2, Upload, Headphones, ChevronDown, MoreHorizontal, Download, Globe2, User, LogOut, Disc3, Radio, CheckCircle2, Monitor } from 'lucide';
import { tracks as originals, mixes, artwork } from './catalog';
import { initialLibrary, safeLibrary, toggleFavorite, nextIndex, mergeLibraries } from './library';
import { saveAudio, loadAudio } from './storage';
import { configured, getClient, readCloud, writeCloud, cloudMessage } from './cloud';
import { createMusicClient, supportedProvider, providerName, safeWebUrl } from './music';
import { musicMarkup } from './music-view';
import { createPlayback } from './playback';
import { sessionSnapshot, restoreSession, enqueue, moveQueue, sleepExpired } from './listening';
import { setupFloatingPlayer } from './floating-player';
import './listening.css';
import { createAuthScreen } from './auth-screen';

const icons={Home,Search,Library,Heart,Plus,ArrowUpRight,ArrowLeft,ArrowRight,Play,Pause,SkipBack,SkipForward,Shuffle,Repeat,Volume2,VolumeX,ListMusic,X,Check,Music2,Upload,Headphones,ChevronDown,MoreHorizontal,Download,Globe2,User,LogOut,Disc3,Radio,CheckCircle2,Monitor};
const $=s=>document.querySelector(s);
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const icon=(name,extra='')=>`<i data-lucide="${name}" ${extra}></i>`;
const refreshIcons=()=>createIcons({icons,attrs:{'stroke-width':1.7}});
let library;try{library=safeLibrary(JSON.parse(localStorage.getItem('sonix-library')));}catch{library=initialLibrary();}
let view='home', activeFilter='All', selectedMix=null, query='', user=null, queue=originals.map(t=>t.id), current=null, shuffle=false, repeat=false, installPrompt=null, playbackToken=0;
let cloudTimer, searchTimer, toastTimer, objectUrl, cloudChain=Promise.resolve(), cloudLoading=false, cloudSynced=false;
let youtubeApiKey=import.meta.env.VITE_YOUTUBE_API_KEY||'';try{localStorage.removeItem('sonix-jamendo-client-id');youtubeApiKey=sessionStorage.getItem('sonix-youtube-api-key')||youtubeApiKey;}catch{}
const music=createMusicClient({youtubeApiKey}), musicRegistry=new Map();
let musicState={provider:'youtube',query:'',tracks:[],status:'idle',error:''}, musicVersion=0;
const audio=createPlayback(message=>toast(message));audio.volume=.7;
let resumePosition=0,lastSessionSave=0,sleepTimer=null,authVersion=0,openingAccount=null;
let recommendationVersion=0;
const authScreen=createAuthScreen({getClient,onSignedIn:enterAccount});
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
 <a class="brand" href="#home" aria-label="sanku inte lokham home"><img src="${import.meta.env.BASE_URL}icon.svg" alt=""/><b class="brand-name">sanku inte lokham</b><span>®</span></a>
 <div class="nav-label">YOUR DAILY SOUNDTRACK</div>
 <nav class="main-nav"><button data-view="home">${icon('home')}<span>Home</span></button><form id="sidebar-search-form" class="sidebar-search"><label for="sidebar-search">Search music</label><div><input id="sidebar-search" name="query" placeholder="Songs or artists" maxlength="120" minlength="2" required/><button type="submit" aria-label="Search">${icon('search')}</button></div></form><button data-view="music">${icon('radio')}<span>Full songs</span></button><button data-view="library">${icon('library')}<span>Your library</span></button></nav>
 <div class="sidebar-divider"></div>
 <div class="library-label">YOUR COLLECTION<button class="icon-button" data-action="create-playlist" aria-label="Create playlist">${icon('plus')}</button></div>
 <button class="side-liked" data-view="liked"><span class="liked-icon">${icon('heart')}</span><span>Liked songs<small id="like-count"></small></span></button>
 <div id="sidebar-playlists"></div>
 <button class="new-playlist" data-action="create-playlist">${icon('plus')}Create playlist</button>
 <div class="sidebar-bottom"><div class="little-wave">▂ ▅ ▃ ▇ ▅ ▂</div><strong>A space that sounds like you.</strong><p>Your music. Your mood. Your rules.</p><button data-action="import">${icon('upload')}Import your music</button></div>
 <button class="account" data-action="account"><span class="avatar">S</span><span id="account-label">Your personal space<small>Made for your ears only</small></span>${icon('chevron-down')}</button>
</aside>
<div class="workspace"><header class="topbar"><div class="history-buttons"><button class="icon-button" data-action="back" aria-label="Go back">${icon('arrow-left')}</button><button class="icon-button" data-action="forward" aria-label="Go forward">${icon('arrow-right')}</button></div><div class="top-actions"><button class="icon-button" data-action="connect" aria-label="Connect to a device" title="Connect to a device">${icon('monitor')}</button><button class="icon-button theme-toggle" data-theme-toggle aria-label="Switch to light mode" title="Switch to light mode">&#9728;</button><button class="icon-button" data-action="queue" aria-label="Open queue" title="Queue">${icon('list-music')}</button><button class="sleep-button" data-action="sleep" aria-label="Sleep timer" title="Sleep timer"><span aria-hidden="true">&#9687;</span><span id="sleep-label">Sleep</span></button><button class="install-button" data-action="install">${icon('download')}<span>Install app</span></button><button class="avatar" data-action="account" aria-label="Your account">S</button></div></header><main id="main" tabindex="-1"></main><footer class="page-footer"><span>sanku inte lokham<span class="green">®</span></span><p>A little less noise. A little more music.</p><span>MADE FOR YOU</span></footer></div>
<section id="youtube-panel" hidden aria-label="YouTube video player"><div class="video-toolbar"><button id="video-drag" aria-label="Move video player" title="Drag to move, or use arrow keys">&#10303; <span>YouTube &middot; drag to move</span></button><button class="icon-button" data-action="reset-video" aria-label="Reset video position" title="Reset position">&#8600;</button><button class="icon-button" data-action="close-video" aria-label="Pause and hide video" title="Pause and hide video">${icon('x')}</button></div><div class="video-frame"><div id="youtube-player"></div></div></section>
<aside id="queue-panel" class="queue-panel" hidden></aside>
<div class="player"><div class="now-playing"><button class="now-art" data-action="now-playing" aria-label="Show current collection"><img id="player-art" src="${artwork('night')}" alt="Current track artwork"/></button><div class="now-meta"><strong id="player-title">Your next favorite awaits</strong><span id="player-artist">Pick a track. Find your flow.</span></div><button id="player-like" class="icon-button" data-action="like-current" aria-label="Like current song">${icon('heart')}</button></div><div class="transport"><div class="transport-buttons"><button id="shuffle" class="icon-button" data-action="shuffle" aria-label="Shuffle" aria-pressed="false">${icon('shuffle')}</button><button class="icon-button" data-action="previous" aria-label="Previous song">${icon('skip-back')}</button><button id="play-toggle" class="play-toggle" data-action="toggle" aria-label="Play">${icon('play')}</button><button class="icon-button" data-action="next" aria-label="Next song">${icon('skip-forward')}</button><button id="repeat" class="icon-button" data-action="repeat" aria-label="Repeat" aria-pressed="false">${icon('repeat')}</button></div><div class="progress"><span id="elapsed">0:00</span><input id="seek" type="range" min="0" max="100" value="0" step="0.1" aria-label="Seek position"/><span id="duration">0:00</span></div></div><div class="player-options"><span class="quality">PERSONAL MIX</span><button class="icon-button" data-action="queue" aria-label="Show queue">${icon('list-music')}</button><button class="icon-button" data-action="mute" id="mute" aria-label="Mute">${icon('volume-2')}</button><input id="volume" type="range" min="0" max="1" step="0.01" value="0.7" aria-label="Volume"/></div></div>
<nav class="mobile-nav"><button data-view="home">${icon('home')}Home</button><button data-view="search">${icon('search')}Search</button><button data-view="library">${icon('library')}Library</button><button data-action="account">${icon('user')}You</button></nav>
<dialog id="dialog"><button class="dialog-close icon-button" data-action="close-dialog" aria-label="Close">${icon('x')}</button><div id="dialog-content"></div></dialog><div id="toast" role="status" aria-live="polite"></div><input id="file-input" type="file" accept="audio/*,.mp3,.m4a,.wav,.flac,.ogg" multiple hidden/>`;

setupTheme();

let connectState={devices:[],status:'offline',target:null};
const connect=createConnect({getClient,name:(/Android|iPhone|iPad/i.test(navigator.userAgent)?'Phone / tablet':'Computer')+' ? '+(/Edg/.test(navigator.userAgent)?'Edge':/Firefox/.test(navigator.userAgent)?'Firefox':/Chrome/.test(navigator.userAgent)?'Chrome':'Safari'),
 getState:()=>({title:current?.title||'',artist:current?.artist||'',artwork:current?.artwork||'',duration:Number.isFinite(audio.duration)?audio.duration:0,paused:audio.paused,position:Math.floor(audio.currentTime||0)}),
 onError:toast,onChange:state=>{connectState=state;document.querySelectorAll('[data-action="connect"]').forEach(b=>{b.classList.toggle('active',Boolean(state.target));b.title=state.target?'Controlling '+(state.devices.find(d=>d.id===state.target)?.name||'device'):'Connect to a device';});if($('#dialog').open&&$('#connect-devices'))renderConnect();updatePlayer();},
 onCommand:async command=>{
  if(!user||!command||typeof command.type!=='string')throw Error('Invalid playback command.');
  if(command.type==='play'){
   const tracks=(Array.isArray(command.tracks)?command.tracks:[]).slice(0,100).map(t=>{
    if(t?.provider==='youtube'&&/^[\w-]{11}$/.test(t.youtubeId||'')&&t.id==='youtube:'+t.youtubeId)return {id:t.id,youtubeId:t.youtubeId,provider:'youtube',source:'YouTube',title:String(t.title||'YouTube song').slice(0,200),artist:String(t.artist||'YouTube').slice(0,100),artwork:safeWebUrl(t.artwork),permalink:'https://www.youtube.com/watch?v='+t.youtubeId,duration:0};
    return originals.find(original=>original.id===t?.id);
   }).filter(Boolean);
   if(!tracks.some(t=>t.id===command.id))throw Error('This song is unavailable on this device.');
   registerMusicTracks(tracks);await playTrack(command.id,tracks.map(t=>t.id));
  }else if(command.type==='toggle')toggle();
  else if(command.type==='next')step(1);
  else if(command.type==='previous')step(-1);
  else if(command.type==='pause')audio.pause();
  else if(command.type==='volume'&&Number.isFinite(command.value)){audio.volume=Math.max(0,Math.min(1,command.value));$('#volume').value=audio.volume;}
  else if(command.type==='seek'&&Number.isFinite(command.value)&&Number.isFinite(audio.duration))audio.currentTime=Math.max(0,Math.min(1,command.value))*audio.duration;
  else throw Error('Unsupported playback command.');
 }});
for(const event of ['play','pause','ended'])audio.addEventListener(event,()=>connect.publish());
async function remoteCommand(command){try{await connect.send(command);return true;}catch(error){toast(error.message);return false;}}
function renderConnect(){
 const remote=connectState.devices.find(d=>d.id===connectState.target);
 $('#dialog-content').innerHTML=`<div id="connect-devices"><span class="eyebrow">YOUR MUSIC, YOUR DEVICES</span><h2>Connect</h2><p>${connectState.status==='online'?'Choose where your music plays.':connectState.status==='unavailable'?'Device connection is unavailable. Supabase Connect setup or a network check is needed.':'Connecting to your account?'}</p><div class="dialog-playlists"><button class="secondary" data-connect-device="">This device ${connectState.target?'':' ? Selected'}</button>${connectState.devices.filter(d=>d.id!==connectState.id).map(d=>`<button class="secondary" data-connect-device="${esc(d.id)}">${esc(d.name)}${d.id===connectState.target?' ? Connected':''}<small>${esc(d.title||'Ready to play')}${d.title?(d.paused?' ? Paused':' ? Playing'):''}</small></button>`).join('')}</div>${connectState.status==='online'&&connectState.devices.length<2?'<p>No other devices online. Open this app and sign into the same account on your other device.</p>':''}${remote?`<p>Playing on ${esc(remote.name)}: ${esc(remote.title||'Choose a song')}</p><div class="dialog-playlists"><button class="secondary" data-action="previous">Previous</button><button class="primary" data-action="toggle">${remote.paused?'Play':'Pause'}</button><button class="secondary" data-action="next">Next</button></div>`:''}<p class="muted">Keep the app open on the receiving device. Its browser may need a tap on Play first. Imported files stay on their original device.</p></div>`;
}
const discovery=createDiscovery({music,registerMusicTracks,playTrack,esc,artwork,active:()=>Boolean(user)&&['home','music'].includes(view)});

function renderSidebar(){
 $('#like-count').textContent=`${library.favorites.length} songs`;
 $('#sidebar-playlists').innerHTML=library.playlists.map(p=>`<button class="side-playlist" data-playlist="${esc(p.id)}"><span>${icon('list-music')}</span><span>${esc(p.name)}<small>Playlist · ${p.tracks.length} songs</small></span></button>`).join('');refreshIcons();
}
function sectionHead(eyebrow,title,action='',label='View all'){return `<div class="section-heading"><div><span class="eyebrow">${eyebrow}</span><h2>${title}</h2></div>${action?`<button class="text-button" data-action="${action}">${label}${icon('arrow-right')}</button>`:''}</div>`;}
function mixCard(m){return `<button class="mix-card" data-mix="${m.id}"><div class="mix-art"><img loading="lazy" src="${artwork(m.art)}" alt="${esc(m.name)} cover"/><div class="cover-brand">sanku inte lokham / SELECTS</div><span class="cover-tag">${m.tag}</span><strong style="color:${m.color}">${esc(m.name)}</strong><span class="card-play">${icon('play')}</span></div><h3>${m.name}</h3><p>${m.sub}</p></button>`;}
function trackRows(list){return list.length?`<div class="track-table"><div class="track-table-head"><span>#</span><span>TITLE</span><span>ALBUM</span><span>TIME</span><span></span></div>${list.map((t,i)=>`<div class="track-row ${current?.id===t.id?'is-current':''}"><button class="track-number" data-track="${esc(t.id)}" aria-label="Play ${esc(t.title)}"><span>${current?.id===t.id?'♫':String(i+1).padStart(2,'0')}</span>${icon('play')}</button><button class="track-info" data-track="${esc(t.id)}"><img loading="lazy" src="${esc(t.artwork||artwork('flower'))}" alt=""/><span><strong>${esc(t.title)}</strong><small>${esc(t.artist)}</small></span></button><span class="track-album">${esc(t.album||'Your uploads')}</span><span class="track-duration">${time(t.duration)}</span><div class="track-actions"><button class="icon-button track-menu" data-queue-menu="${esc(t.id)}" aria-label="Queue options for ${esc(t.title)}">${icon('more-horizontal')}</button><button class="icon-button ${library.favorites.includes(t.id)?'active':''}" data-like="${esc(t.id)}" aria-label="${library.favorites.includes(t.id)?'Unlike':'Like'} ${esc(t.title)}">${icon('heart')}</button><button class="icon-button" data-add="${esc(t.id)}" aria-label="Add ${esc(t.title)} to playlist">${icon('plus')}</button></div></div>`).join('')}</div>`:`<div class="empty-state">${icon('headphones')}<h3>Your soundtrack starts here</h3><p>Import your music or explore sanku inte lokham Originals to add songs.</p><button class="primary" data-action="import">${icon('upload')}Import music</button></div>`;}
function render(){
 const keepSearchFocus=document.activeElement?.matches('#music-form input');
 const main=$('#main');
 document.querySelectorAll('[data-view]').forEach(b=>b.classList.toggle('selected',b.dataset.view===view));
 if(view==='home'){
 const visible=activeFilter==='All'?mixes:mixes.filter(m=>m.tracks.some(id=>trackById(id)?.mood===activeFilter));
 main.innerHTML=`<div class="greeting"><div><span class="eyebrow">YOUR WORLD, ON REPEAT</span><h1>Find your next feeling<span class="green">.</span></h1><p>A soundtrack for wherever the day takes you.</p></div><span class="date-pill">${icon('radio')}Tuned in to you</span></div>
 <div class="filter-row">${['All','Chill','Electronic','Focus','Ambient'].map(f=>`<button class="chip ${activeFilter===f?'chosen':''}" data-filter="${f}">${f}</button>`).join('')}<button class="language-link" data-view="music">${icon('globe-2')}Full songs${icon('arrow-up-right')}</button></div>
 <section class="hero"><img class="hero-photo" src="${artwork('hero')}" alt="Atmospheric concert lights over a crowd" fetchpriority="high"/><div class="hero-shade"></div><div class="hero-copy"><span class="hero-label"><span></span>THE sanku inte lokham EDIT</span><h2>Lose yourself.<br/>Find your sound.</h2><p>Late nights. Open roads. Just you and the music.<br/>Meet the mix that gets you.</p><div class="hero-actions"><button class="primary" data-action="play-featured">${icon('play')}Play the mix</button><button class="secondary" data-mix="night">Explore mix${icon('arrow-up-right')}</button></div></div><div class="hero-caption"><span>01 / 05</span><div><i></i><i></i><i></i><i></i><i></i></div><span>CURATED FOR YOUR EVERYDAY</span></div><span class="hero-vertical">PRESS PLAY. STAY A WHILE.</span></section>
 <section>${sectionHead('GOOD MUSIC. NO GUESSWORK.','Made for your mood','all-mixes','Explore all')}<div class="mix-grid">${visible.map(mixCard).join('')}</div></section>
 <section class="lower-grid"><div>${sectionHead('A LITTLE DISCOVERY','In heavy rotation','originals','View all')}${trackRows(originals.slice(0,4))}</div><div class="discovery-card"><span class="eyebrow">NO BORDERS. JUST MUSIC.</span><div class="globe-art">${icon('globe-2')}<span>ALL<br/>TOGETHER.</span></div><h3>A world worth listening to.</h3><p>Full tracks from independent artists.<br/>Your next discovery is out there.</p><button class="text-button" data-view="music">Explore full songs${icon('arrow-up-right')}</button></div></section>
 ${library.history.length?`<section>${sectionHead('WELCOME BACK','Recently played')}${trackRows(library.history.map(trackById).filter(Boolean).slice(0,4))}</section>`:''}`;
 }else if(view==='search'){
 const results=allTracks().filter(t=>`${t.title} ${t.artist} ${t.album} ${t.mood||''}`.toLowerCase().includes(query.toLowerCase()));
 main.innerHTML=`<div class="page-heading"><span class="eyebrow">FOLLOW YOUR CURIOSITY</span><h1>${query?`Results for “${esc(query)}”`:'Find your sound.'}</h1><p>Search your songs, artists, albums, and moods.</p></div>${trackRows(results)}<section>${sectionHead('TAKE A DIFFERENT ROUTE','Browse your moods')}<div class="mix-grid">${mixes.map(mixCard).join('')}</div></section>`;
 }else if(view==='library'||view==='liked'||view==='originals'||view==='mix'||view==='playlist'){
 let title='Your library',label='ALL YOUR FAVORITES, IN ONE PLACE',description='A collection that is completely you.',list=allTracks(),art='flower';
 if(view==='liked'){title='Liked songs';list=library.favorites.map(trackById).filter(Boolean);label='SAVED WITH LOVE';description='The ones you keep coming back to.';art='sun';}
 if(view==='originals'){title='sanku inte lokham Originals';label='EXCLUSIVELY IN YOUR SPACE';description='Six original instrumental sketches. Made for exploring sanku inte lokham.';art='city';list=originals;}
 if(view==='mix'){const m=mixes.find(m=>m.id===selectedMix)||mixes[0];title=m.name;description=m.sub;label='sanku inte lokham SELECTS · CURATED MIX';list=m.tracks.map(trackById).filter(Boolean);art=m.art;}
 if(view==='playlist'){const p=library.playlists.find(p=>p.id===selectedMix);title=p?.name||'Playlist';label='YOUR PERSONAL PLAYLIST';description='Every track, a little more you.';list=(p?.tracks||[]).map(trackById).filter(Boolean);}
 main.innerHTML=`<section class="collection-hero"><img src="${artwork(art)}" alt=""/><div><span class="eyebrow">${label}</span><h1>${esc(title)}</h1><p>${description}</p><span class="collection-count">sanku inte lokham <span>•</span> ${list.length} songs</span></div></section><div class="collection-actions"><button class="primary" data-action="play-view" ${list.length?'':'disabled'}>${icon('play')}Play${list.length?' collection':''}</button><button class="secondary" data-action="import">${icon('upload')}Import music</button>${view==='playlist'?`<button class="icon-button" data-action="edit-playlist" aria-label="Edit playlist">${icon('more-horizontal')}</button>`:''}<span>YOUR MUSIC, YOUR WAY</span></div>${trackRows(list)}${view==='library'?`<section>${sectionHead('MAKE IT YOURS','Your playlists','create-playlist','Create playlist')}<div class="playlist-grid">${library.playlists.map(p=>`<button data-playlist="${esc(p.id)}" class="playlist-tile">${icon('list-music')}<h3>${esc(p.name)}</h3><p>${p.tracks.length} songs</p></button>`).join('')}<button class="playlist-tile new" data-action="create-playlist">${icon('plus')}<h3>A new kind of mood</h3><p>Create a playlist</p></button></div></section>`:''}`;
 main.dataset.tracks=JSON.stringify(list.map(t=>t.id));
 }else if(view==='music'){
 main.innerHTML=`<div class="page-heading"><span class="eyebrow">YOUTUBE MUSIC</span><h1>Full songs. Fresh discoveries<span class="green">.</span></h1><p>Explore the YouTube catalog, stream full tracks, and save your favorites.</p></div>`;
 }
 if(['home','search','music'].includes(view))renderMusic();
 if(view==='home'&&current)main.insertAdjacentHTML('afterbegin',continueMarkup());
 refreshIcons();updatePlayer();if(keepSearchFocus)$('#music-form input')?.focus();
}
function renderMusic(){
 if(!user)return;
 discovery.mount();
 let section=$('#music-section');if(!section){section=document.createElement('section');section.id='music-section';section.className='music-section';const anchor=view==='home'?$('#main .hero'):$('#main .page-heading');anchor?.insertAdjacentElement('afterend',section);}
 const discoverySection=$('#language-discovery');if(discoverySection)section.before(discoverySection);
 const old=section.querySelector('input'),draft=old?.value,focused=document.activeElement===old;
 section.innerHTML=musicMarkup({state:musicState,view,query,configured:music.configured('youtube'),sectionHead,icon,esc,time,artwork,trackRows,favorites:library.favorites});
 if(draft!==undefined&&section.querySelector('input'))section.querySelector('input').value=draft;
 if(focused)section.querySelector('input')?.focus();refreshIcons();
 if(musicState.status==='idle'&&music.configured(musicState.provider))loadMusic('');
}
async function loadMusic(q='',page=0,sort=musicState.sort||'popular'){
 const token=++musicVersion,provider=musicState.provider;musicState={provider,query:q,page,sort,total:page?musicState.total:null,tracks:[],status:'loading',error:''};if(['home','search','music'].includes(view))renderMusic();
 try{const result=await music.browse(provider,q,{page,sort});if(token!==musicVersion)return;registerMusicTracks(result.tracks);musicState={...musicState,...result,total:result.total??musicState.total,status:'ready'};}
 catch(error){if(token!==musicVersion)return;musicState.status='error';musicState.error=error.message;}
 if(['home','search','music'].includes(view))renderMusic();
}
function navigate(next,id){view=next;selectedMix=id||null;const hash=`#${next}${id?'/'+encodeURIComponent(id):''}`;if(location.hash!==hash)location.hash=hash;render();window.scrollTo({top:0,behavior:'instant'});}
window.addEventListener('hashchange',()=>{const [next,id]=location.hash.slice(1).split('/');view=['discover','audius'].includes(next)?'music':['home','search','library','liked','originals','mix','playlist','music'].includes(next)?next:'home';try{selectedMix=id?decodeURIComponent(id):null;}catch{selectedMix=null;}render();});
function updatePlayer(){
 const remote=connectState.devices.find(d=>d.id===connectState.target);
 $('#player-like').disabled=Boolean(remote);$('#shuffle').disabled=Boolean(remote);$('#repeat').disabled=Boolean(remote);
 if(remote){
  $('#player-title').textContent=remote.title||'Choose a song';$('#player-artist').textContent='On '+remote.name;
  $('#player-art').src=safeWebUrl(remote.artwork)||artwork('night');
  $('#play-toggle').innerHTML=icon(remote.paused?'play':'pause');$('#play-toggle').setAttribute('aria-label',remote.paused?'Play':'Pause');
  $('#elapsed').textContent=time(remote.position);$('#duration').textContent=time(remote.duration);
  const percent=remote.duration?Math.min(100,remote.position/remote.duration*100):0;$('#seek').value=percent;$('#seek').style.setProperty('--fill',percent+'%');refreshIcons();return;
 }
 $('#play-toggle').innerHTML=icon(audio.paused?'play':'pause');$('#play-toggle').setAttribute('aria-label',audio.paused?'Play':'Pause');
 if(!current){$('#player-title').textContent='Your next favorite awaits';$('#player-artist').textContent='Pick a track. Find your flow.';$('#player-art').src=artwork('night');$('#player-like').classList.remove('active');$('#elapsed').textContent='0:00';$('#duration').textContent='0:00';$('#seek').value=0;$('#seek').style.setProperty('--fill','0%');}
 if(current){$('#player-title').textContent=current.title;$('#player-artist').innerHTML=esc(current.artist)+(supportedProvider(current.provider)?` · <a href="${esc(safeWebUrl(current.permalink))}" target="_blank" rel="noopener noreferrer">${esc(providerName(current.provider))} ↗</a>${safeWebUrl(current.license)?` | <a href="${esc(safeWebUrl(current.license))}" target="_blank" rel="noopener noreferrer">License</a>`:''}`:'');$('#player-art').src=current.artwork||artwork('flower');$('#player-like').classList.toggle('active',library.favorites.includes(current.id));}
 if(view==='home'&&current&&!$('.continue-card'))$('#main').insertAdjacentHTML('afterbegin',continueMarkup());
 const card=$('.continue-card');if(card&&current){card.querySelector('strong').textContent=current.title;card.querySelector('img').src=current.artwork||artwork('flower');card.querySelector('[data-resume-artist]').textContent=current.artist;}
 const resume=$('[data-action="continue"]');if(resume){resume.innerHTML=icon(audio.paused?'play':'pause')+'<span>'+(audio.paused?'Resume':'Pause')+'</span>';const position=$('#resume-time');if(position)position.textContent=time(resumePosition);}
 $('#shuffle').classList.toggle('active',shuffle);$('#shuffle').setAttribute('aria-pressed',shuffle);$('#repeat').classList.toggle('active',repeat);$('#repeat').setAttribute('aria-pressed',repeat);refreshIcons();
}
async function playTrack(id,newQueue,startAt=0){
 if(!user)return;
 if(connect.target){
  const track=trackById(id);if(!track||track.local){toast('Imported files can only play on the device that has them.');return;}
  const tracks=[...new Set([...(newQueue||queue),id])].map(trackById).filter(t=>t&&!t.local).slice(0,100);
  if(!tracks.some(t=>t.id===id))tracks[tracks.length-1]=track;
  audio.pause();if(await remoteCommand({type:'play',id,tracks}))toast('Song sent to your connected device');return;
 }
 const t=trackById(id);if(!t)return;saveSession();const token=++playbackToken;
 if(newQueue)queue=[...new Set(newQueue)].filter(trackById);if(!queue.includes(id))queue.push(id);
 audio.pause();audio.removeAttribute('src');audio.load();if(objectUrl){URL.revokeObjectURL(objectUrl);objectUrl=null;}
 current=t;resumePosition=startAt;updatePlayer();$('#player-artist').textContent='Loading audio…';$('#elapsed').textContent='0:00';$('#duration').textContent=time(t.duration);$('#seek').value=0;$('#seek').style.setProperty('--fill','0%');
 try{
 let url=t.url;if(supportedProvider(t.provider)){const resolved=await music.resolve(t);if(token!==playbackToken)return;Object.assign(t,resolved.track);url=resolved.url;}if(t.local){const file=await loadAudio(id);if(token!==playbackToken)return;if(!file)throw Error('This audio file is stored on another device. Import it on this device to play.');objectUrl=URL.createObjectURL(file);url=objectUrl;}
 if(!url)throw Error('No playable audio is available.');if(token!==playbackToken)return;audio.src=url;await audio.play(startAt);if(token!==playbackToken)return;
 rememberMusic(id);library.history=[id,...library.history.filter(x=>x!==id)].slice(0,50);persist();saveSession();updatePlayer();
 document.querySelectorAll('.track-row').forEach(row=>row.classList.toggle('is-current',row.querySelector('[data-track]')?.dataset.track===id));
 if('mediaSession' in navigator){navigator.mediaSession.metadata=new MediaMetadata({title:t.title,artist:t.artist,album:t.album,artwork:[{src:new URL(t.artwork||artwork('flower'),location.href).href,sizes:'640x640',type:'image/jpeg'}]});}
 }catch(e){if(token!==playbackToken)return;toast(supportedProvider(t.provider)?e.message||'This service could not play the track. Please try another.':e.message?.includes('another device')?e.message:'Could not play this file. Try another track or supported audio format.');updatePlayer();}
 renderQueue();
}
async function continueWithSimilar(){
 if(!current||!user)return;
 const index=queue.indexOf(current.id);
 if(index>=0&&index<queue.length-1){step(1);return;}
 const source=current,token=playbackToken,version=++recommendationVersion,queued=queue.join('|');
 const valid=()=>user&&current===source&&token===playbackToken&&version===recommendationVersion&&queued===queue.join('|')&&!sleepExpired(sleepTimer);
 try{
  let candidates;
  if(source.provider==='youtube'){
   toast('Finding a similar song...');
   const query=(source.artist.replace(/\s*-?\s*Topic$/i,'')+' '+source.title.replace(/\([^)]*\)|\[[^\]]*\]/g,'')+' music').slice(0,120);
   candidates=(await music.browse('youtube',query)).tracks;
  }else candidates=allTracks().filter(t=>t.id!==source.id&&(t.artist===source.artist||(source.mood&&t.mood===source.mood)));
  if(!valid())return;
  const excluded=new Set([source.id,...queue,...library.history.slice(0,10)]);
  const next=candidates.find(t=>!excluded.has(t.id));
  if(!next){toast('No new similar songs found. Choose another song to continue.');return;}
  registerMusicTracks([next]);queue.push(next.id);await playTrack(next.id);toast('Playing a similar song');
 }catch(error){if(valid())toast(error.message||'Could not find a similar song. Choose a song to continue.');}
}
function step(direction){if(connect.target){remoteCommand({type:direction===1?'next':'previous'});return;}const idx=nextIndex(queue.indexOf(current?.id),queue.length,direction,shuffle&&direction===1);if(idx>=0)playTrack(queue[idx]);}
function toggle(){if(!user)return;if(connect.target){remoteCommand({type:'toggle'});return;}if(!current)playTrack(queue[0]||originals[0].id);else if(audio.paused&&!audio.getAttribute('src'))playTrack(current.id,undefined,resumePosition);else if(audio.paused)audio.play().catch(()=>toast('Playback unavailable. Select a track to try again.'));else audio.pause();}
audio.addEventListener('play',()=>{if(checkSleep())return;updatePlayer();saveSession();});audio.addEventListener('pause',()=>{++recommendationVersion;updatePlayer();saveSession();});audio.addEventListener('ended',()=>{if(sleepTimer?.endOfTrack){finishSleep();return;}if(repeat){audio.currentTime=0;audio.play().catch(()=>toast('Tap play to continue.'));}else continueWithSimilar();});
audio.addEventListener('timeupdate',()=>{if(connect.target||!audio.getAttribute('src'))return;if(audio.duration>0)resumePosition=audio.currentTime;if(Date.now()-lastSessionSave>5000)saveSession();$('#elapsed').textContent=time(audio.currentTime);$('#duration').textContent=time(audio.duration);const percent=audio.duration?audio.currentTime/audio.duration*100:0;$('#seek').value=percent;$('#seek').style.setProperty('--fill',`${percent}%`);});
audio.addEventListener('error',()=>{if(audio.getAttribute('src'))toast('Audio could not load. Check your connection or import the file again.');});
$('#seek').addEventListener('input',e=>{if(connect.target){remoteCommand({type:'seek',value:Number(e.target.value)/100});return;}if(Number.isFinite(audio.duration))audio.currentTime=Number(e.target.value)/100*audio.duration;});
$('#volume').addEventListener('input',e=>{if(connect.target){remoteCommand({type:'volume',value:Number(e.target.value)});return;}audio.volume=Number(e.target.value);audio.muted=false;$('#mute').innerHTML=icon(audio.volume?'volume-2':'volume-x');refreshIcons();saveSession();});
function renderQueue(){
 const panel=$('#queue-panel');if(panel.hidden)return;
 panel.innerHTML=`<div class="section-heading"><h2>Your queue</h2><button class="icon-button" data-action="queue" aria-label="Close queue">${icon('x')}</button></div><p class="muted">Drag songs to reorder, or use the arrow buttons.</p><button class="text-button" data-action="clear-queue" ${queue.length<2?'disabled':''}>Clear other songs</button><div class="queue-list">${queue.map(trackById).filter(Boolean).map((t,i)=>`<div class="queue-item ${current?.id===t.id?'active':''}" data-queue-index="${i}" draggable="true"><button class="queue-track" data-track="${esc(t.id)}"><img src="${esc(t.artwork||artwork('flower'))}" alt=""/><span><strong>${esc(t.title)}</strong><small>${current?.id===t.id?'Now playing &middot; ':''}${esc(t.artist)}</small></span></button><div class="queue-item-actions"><button data-move-queue="${i}" data-direction="-1" aria-label="Move ${esc(t.title)} up" ${i===0?'disabled':''}>&uarr;</button><button data-move-queue="${i}" data-direction="1" aria-label="Move ${esc(t.title)} down" ${i===queue.length-1?'disabled':''}>&darr;</button><button data-remove-queue="${esc(t.id)}" aria-label="Remove ${esc(t.title)} from queue" ${current?.id===t.id?'disabled':''}>${icon('x')}</button></div></div>`).join('')}</div>`;
 refreshIcons();
}
function openDialog(content){$('#dialog-content').innerHTML=content;refreshIcons();if(!$('#dialog').open)$('#dialog').showModal();}
function playlistDialog(trackId){if(trackId){openDialog(`<span class="eyebrow">KEEP THE GOOD ONES CLOSE</span><h2>Add to playlist</h2><div class="dialog-playlists">${library.playlists.map(p=>`<button class="secondary" data-save-track="${esc(trackId)}" data-target="${esc(p.id)}">${icon('list-music')}${esc(p.name)}</button>`).join('')}</div><button class="primary" data-action="new-for-track" data-id="${esc(trackId)}">${icon('plus')}New playlist</button>`);}else createPlaylistForm();}
function createPlaylistForm(trackId=''){openDialog(`<span class="eyebrow">A MIX THAT IS ALL YOU</span><h2>Create a playlist</h2><form id="playlist-form" data-track-id="${esc(trackId)}"><label>Playlist name<input name="name" placeholder="Sunday state of mind" maxlength="80" required autofocus/></label><button class="primary" type="submit">${icon('plus')}Create playlist</button></form>`);}
function accountDialog(){
 if(!user){authScreen.show();return;}
 openDialog(`<span class="eyebrow">YOUR PERSONAL SPACE</span><h2>Your account</h2><p>${esc(user.email)}</p><div class="info-box">${icon('check-circle-2')}${cloudSynced?'Your library is synced':'Saved on this device; cloud sync pending'}</div><button class="secondary" data-action="sync">${icon('check')}Sync library now</button><button class="secondary" data-action="logout">${icon('log-out')}Sign out</button>`);
}

document.addEventListener('click',async e=>{
 const b=e.target.closest('button,[data-view]');if(!b)return;
 if(b.dataset.view){navigate(b.dataset.view);return;}
 if(b.dataset.mix){navigate('mix',b.dataset.mix);return;}if(b.dataset.playlist){navigate('playlist',b.dataset.playlist);return;}
 if(b.dataset.musicTrack){playTrack(b.dataset.musicTrack,musicState.tracks.map(t=>t.id));return;}
 if(b.dataset.track){const list=$('#main').dataset.tracks;playTrack(b.dataset.track,b.closest('#queue-panel')?undefined:b.closest('#music-section')?musicState.tracks.map(t=>t.id):list&&['mix','playlist','liked','library','originals'].includes(view)?JSON.parse(list):undefined);return;}
 if(b.dataset.like){rememberMusic(b.dataset.like);toggleFavorite(library,b.dataset.like);persist();render();return;}
 if(b.dataset.add){rememberMusic(b.dataset.add);persist();playlistDialog(b.dataset.add);return;}
 if(b.dataset.filter){activeFilter=b.dataset.filter;render();return;}
 if(b.dataset.saveTrack){const p=library.playlists.find(p=>p.id===b.dataset.target);if(p&&!p.tracks.includes(b.dataset.saveTrack))p.tracks.push(b.dataset.saveTrack);persist();$('#dialog').close();toast('Added to your playlist');if(view==='playlist')render();return;}
 if(b.dataset.queueMenu){const t=trackById(b.dataset.queueMenu);if(t)openDialog(`<h2>Queue options</h2><p>${esc(t.title)}</p><div class="dialog-playlists"><button class="secondary" data-enqueue="${esc(t.id)}" data-next="true">Play next</button><button class="secondary" data-enqueue="${esc(t.id)}">Add to queue</button></div>`);return;}
 if(b.dataset.enqueue){const id=b.dataset.enqueue;rememberMusic(id);queue=enqueue(queue,id,current?.id,b.dataset.next==='true');persist();saveSession();renderQueue();$('#dialog').close();toast(b.dataset.next?'Added to play next':'Added to queue');return;}
 if(b.dataset.moveQueue!==undefined){const from=Number(b.dataset.moveQueue);queue=moveQueue(queue,from,from+Number(b.dataset.direction));saveSession();renderQueue();return;}
 if(b.dataset.removeQueue){if(b.dataset.removeQueue!==current?.id)queue=queue.filter(id=>id!==b.dataset.removeQueue);saveSession();renderQueue();return;}
 if(b.dataset.sleepMinutes){setSleep({deadline:Date.now()+Number(b.dataset.sleepMinutes)*60000});return;}
 if(b.hasAttribute('data-connect-device')){try{const previous=connect.target;if(previous&&previous!==b.dataset.connectDevice)await remoteCommand({type:'pause'});connect.select(b.dataset.connectDevice);if(connect.target)audio.pause();renderConnect();}catch(error){toast(error.message);}return;}
 const a=b.dataset.action;
 if(a==='connect'){openDialog('<div id="connect-devices"></div>');renderConnect();}

 if(a==='continue')toggle();
 if(a==='sleep')sleepDialog();
 if(a==='sleep-end')setSleep({endOfTrack:true});
 if(a==='sleep-cancel')setSleep(null);
 if(a==='clear-queue'){queue=current?[current.id]:[];saveSession();renderQueue();}
 if(a==='close-video'){++playbackToken;audio.pause();$('#youtube-panel').hidden=true;updatePlayer();saveSession();$('#play-toggle').focus();}
 if(a==='reset-video')floatingPlayer.reset();
 if(a==='toggle')toggle();if(a==='next')step(1);if(a==='previous'){if(audio.currentTime>3)audio.currentTime=0;else step(-1);}
 if(a==='shuffle'){shuffle=!shuffle;updatePlayer();saveSession();}if(a==='repeat'){repeat=!repeat;updatePlayer();saveSession();}
 if(a==='like-current'&&current){rememberMusic(current.id);toggleFavorite(library,current.id);persist();render();}
 if(a==='browse-music')navigate('music');if(a==='music-trending'){const input=$('#music-form input');if(input)input.value='';loadMusic('');}if(a==='music-retry')loadMusic(musicState.query,musicState.page||0);
 if(a==='music-next'||a==='music-previous'){if(musicState.status==='loading')return;await loadMusic(musicState.query,Math.max(0,(musicState.page||0)+(a==='music-next'?1:-1)));$('#music-section')?.scrollIntoView({block:'start'});}
 if(a==='connect-youtube')openDialog(`<span class="eyebrow">YOUTUBE MUSIC</span><h2>Connect your music catalog.</h2><p>Enter your YouTube Data API v3 key. It stays in this browser tab for the session. Restrict the key to your website in Google Cloud.</p><form id="youtube-form"><label>YouTube API key<input type="password" name="apiKey" value="${esc(youtubeApiKey)}" required maxlength="100" autocomplete="off"/></label><button class="primary" type="submit">Connect YouTube</button></form><p><a href="https://console.cloud.google.com/apis/library/youtube.googleapis.com" target="_blank" rel="noopener noreferrer">Enable YouTube Data API v3</a></p>`);
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
 if(a==='install'){if(installPrompt){await installPrompt.prompt();installPrompt=null;}else openDialog(`<span class="eyebrow">TAKE YOUR SOUND WITH YOU</span><h2>sanku inte lokham, one tap away.</h2><p><strong>iPhone:</strong> Open sanku inte lokham in Safari, tap Share, then Add to Home Screen.</p><p><strong>Android:</strong> Open sanku inte lokham in Chrome, then choose Install app or Add to Home screen from the menu.</p><p class="muted">Installation requires a hosted HTTPS address. Imported audio stays on the device where you added it.</p>`);}
 if(a==='edit-playlist'){const p=library.playlists.find(p=>p.id===selectedMix);if(p)openDialog(`<h2>Edit playlist</h2><form id="edit-playlist-form"><label>Name<input name="name" maxlength="80" value="${esc(p.name)}" required/></label><button class="primary" type="submit">Save changes</button></form><div class="dialog-playlists">${p.tracks.map(trackById).filter(Boolean).map(t=>`<button class="secondary" data-remove-track="${esc(t.id)}">${icon('x')}Remove ${esc(t.title)}</button>`).join('')}</div><button class="danger" data-action="delete-playlist">Delete playlist</button>`);}
 if(b.dataset.removeTrack){const p=library.playlists.find(p=>p.id===selectedMix);p.tracks=p.tracks.filter(id=>id!==b.dataset.removeTrack);persist();b.remove();render();}
 if(a==='delete-playlist'){openDialog(`<h2>Delete this playlist?</h2><p>Your songs will stay in your library.</p><button class="danger" data-action="confirm-delete">Delete playlist</button><button class="secondary" data-action="close-dialog">Keep playlist</button>`);}
 if(a==='confirm-delete'){library.playlists=library.playlists.filter(p=>p.id!==selectedMix);persist();$('#dialog').close();navigate('library');}
 if(a==='sync'){try{await syncAccount();toast('Library synced');}catch(error){toast(cloudMessage(error));}}
 if(a==='logout'){
  if(!user)return;clearTimeout(cloudTimer);await cloudChain;
  const id=user.id;let backedUp=false;
  try{await writeCloud(id,library);}catch{try{localStorage.setItem(`sonix-library-backup-${id}`,JSON.stringify(library));backedUp=true;}catch{toast('Could not preserve unsynced changes. Free device storage before signing out.');return;}}
  const c=await getClient();const {error}=await c.auth.signOut();if(error){toast('Could not sign out. Try again.');return;}
  leaveAccount(backedUp?'Signed out. Your unsynced changes are kept for your next sign-in.':'You are signed out. See you again soon.');
 }
});
document.addEventListener('change',e=>{if(e.target.id==='music-sort')loadMusic(musicState.query,0,e.target.value);});
document.addEventListener('submit',async e=>{
 if(e.target.id==='sleep-form'){e.preventDefault();const minutes=Number(new FormData(e.target).get('minutes'));if(Number.isInteger(minutes)&&minutes>=1&&minutes<=180)setSleep({deadline:Date.now()+minutes*60000});return;}
 if(e.target.id==='youtube-form'){e.preventDefault();const value=String(new FormData(e.target).get('apiKey')).trim();if(!/^[A-Za-z0-9_-]{4,100}$/.test(value)){toast('Enter a valid YouTube API key.');return;}youtubeApiKey=value;try{sessionStorage.setItem('sonix-youtube-api-key',value);}catch{}music.setYoutubeApiKey(value);$('#dialog').close();loadMusic('');return;}
 if(['music-form','sidebar-search-form'].includes(e.target.id)){e.preventDefault();const q=String(new FormData(e.target).get('query')).trim();if(q.length>=2){query=q;navigate('search');loadMusic(q);}return;}
 if(e.target.id==='playlist-form'){e.preventDefault();const name=new FormData(e.target).get('name').trim();if(!name)return;const p={id:crypto.randomUUID(),name,tracks:e.target.dataset.trackId?[e.target.dataset.trackId]:[]};library.playlists.push(p);persist();$('#dialog').close();navigate('playlist',p.id);toast('Your new playlist is ready');}
 if(e.target.id==='edit-playlist-form'){e.preventDefault();const name=new FormData(e.target).get('name').trim();if(!name)return;library.playlists.find(p=>p.id===selectedMix).name=name;persist();$('#dialog').close();render();}

});

document.addEventListener('error',e=>{if(e.target instanceof HTMLImageElement&&e.target.closest('#music-section')&&e.target.src.startsWith('https://'))e.target.src=artwork('flower');},true);
$('#file-input').addEventListener('change',async e=>{const files=[...e.target.files];let count=0;for(const file of files){if(!file.type.startsWith('audio/')&&!/\.(mp3|wav|m4a|ogg|flac)$/i.test(file.name))continue;const id=`local-${file.name}-${file.size}-${file.lastModified}`;try{await saveAudio(id,file);if(!library.tracks.some(t=>t.id===id))library.tracks.push({id,title:file.name.replace(/\.[^.]+$/,''),artist:'Your music',album:'Imported collection',artwork:artwork('flower'),local:true,duration:0});count++;}catch{toast('Could not save audio. Device storage may be full.');break;}}persist();navigate('library');toast(`${count} ${count===1?'track':'tracks'} imported to this device`);e.target.value='';});
document.addEventListener('keydown',e=>{if(!user)return;if(['INPUT','TEXTAREA','SELECT'].includes(e.target.tagName)||$('#dialog').open)return;if(e.key===' '){e.preventDefault();toggle();}if(e.key==='/'){e.preventDefault();navigate('search');(matchMedia('(max-width:680px)').matches?$('#music-form input'):$('#sidebar-search'))?.focus();}if(e.key==='Escape')$('#queue-panel').hidden=true;});
$('#dialog').addEventListener('click',e=>{if(e.target===$('#dialog'))$('#dialog').close();});
window.addEventListener('beforeinstallprompt',e=>{e.preventDefault();installPrompt=e;});
if('mediaSession' in navigator){for(const [action,fn] of Object.entries({play:()=>{if(audio.paused)toggle();},pause:()=>audio.pause(),previoustrack:()=>step(-1),nexttrack:()=>step(1),seekto:d=>{if(Number.isFinite(audio.duration))audio.currentTime=d.seekTime;}})){try{navigator.mediaSession.setActionHandler(action,fn);}catch{}}}
function updateAccount(){$('#account-label').innerHTML=user?`${esc(user.email?.split('@')[0])}<small>${cloudSynced?'Personal cloud connected':'Signed in · sync pending'}</small>`:'Your personal space<small>Made for your ears only</small>';}
async function syncAccount(){
 if(!user)return;const id=user.id;cloudLoading=true;cloudSynced=false;clearTimeout(cloudTimer);
 try{
  await cloudChain;if(user?.id!==id)return;
  const owner=localStorage.getItem('sonix-library-owner');
  if(owner&&owner!==id){localStorage.setItem(`sonix-library-backup-${owner}`,JSON.stringify(library));library=initialLibrary();}
  const backup=localStorage.getItem(`sonix-library-backup-${id}`);if(backup){try{library=mergeLibraries(library,JSON.parse(backup));}catch{}}
  persist();const remote=await readCloud(id);if(user?.id!==id)return;
  library=mergeLibraries(library,remote);persist();await writeCloud(id,library);if(user?.id!==id)return;
  localStorage.removeItem(`sonix-library-backup-${id}`);cloudSynced=true;
 }finally{if(user?.id===id){cloudLoading=false;updateAccount();render();}}
}
function listeningKey(name){return user?`sonix-${name}-${user.id}`:`sonix-${name}`;}
function leaveAccount(message='Sign in to return to your music.'){
 connect.stop();
 ++authVersion;openingAccount=null;clearTimeout(cloudTimer);saveSession();
 if(user){try{localStorage.setItem(`sonix-library-backup-${user.id}`,JSON.stringify(library));}catch{}}
 audio.pause();++playbackToken;audio.removeAttribute('src');current=null;queue=originals.map(t=>t.id);resumePosition=0;sleepTimer=null;
 user=null;cloudSynced=false;cloudLoading=false;library=initialLibrary();musicRegistry.clear();
 musicState={provider:'youtube',query:'',tracks:[],status:'idle',error:''};++musicVersion;
 try{localStorage.removeItem('sonix-library');localStorage.removeItem('sonix-library-owner');}catch{}
 $('#dialog').close();$('#queue-panel').hidden=true;view='home';selectedMix=null;location.hash='#home';authScreen.show('signin',message);updateAccount();updatePlayer();updateSleepLabel();
}
async function enterAccount(session){
 const id=session?.user?.id;if(!id)return;
 if(openingAccount?.id===id)return openingAccount.promise;
 if(user?.id===id&&!$('#app').hidden){user=session.user;updateAccount();return;}
 if(user&&user.id!==id)leaveAccount();
 const version=++authVersion;user=session.user;authScreen.loading('Loading your library...');
 try{const owner=localStorage.getItem('sonix-library-owner');if(!owner||owner===id){for(const name of ['session','sleep']){const legacy=localStorage.getItem(`sonix-${name}`);if(legacy&&!localStorage.getItem(listeningKey(name)))localStorage.setItem(listeningKey(name),legacy);localStorage.removeItem(`sonix-${name}`);}}}catch{}
 const promise=(async()=>{
  let warning='';
  try{await syncAccount();}catch(error){warning=cloudMessage(error);}
  if(version!==authVersion||user?.id!==id)return;
  restoreListening();connect.start(id);updateAccount();renderSidebar();render();updateSleepLabel();authScreen.hide();
  if(warning)toast(warning);$('#main').focus({preventScroll:true});
 })();
 openingAccount={id,promise};try{await promise;}finally{if(openingAccount?.promise===promise)openingAccount=null;}
}
async function initCloud(){
 let recovering=new URLSearchParams(location.hash.slice(1)).get("type")==="recovery";
 authScreen.loading();
 try{
  const c=await getClient();if(!c){authScreen.error('Account sign-in is not configured yet. Please try again later.');return;}
  c.auth.onAuthStateChange((event,session)=>{
   if(event==='PASSWORD_RECOVERY'){recovering=true;authScreen.show('reset');return;}
   if(event==='INITIAL_SESSION')return;
   if(event==='TOKEN_REFRESHED'){if(user?.id===session?.user?.id){user=session.user;updateAccount();}return;}
   if(event==='SIGNED_OUT')setTimeout(()=>leaveAccount(),0);
   if(event==='SIGNED_IN'&&!recovering)setTimeout(()=>enterAccount(session).catch(()=>authScreen.error('Could not open your account. Please try signing in again.')),0);
  });
  const {data,error}=await c.auth.getSession();if(error)throw error;
  if(recovering&&data.session)authScreen.show('reset');else if(data.session)await enterAccount(data.session);else authScreen.show('signin',recovering?'This reset link is invalid or expired. Request a new one using Forgot password.':'');
 }catch{authScreen.error('Could not connect to your account. Check your connection and try signing in.');}
}
let [initialView,initialId]=location.hash.slice(1).split('/');if(['discover','audius'].includes(initialView))initialView='music';if(['home','search','library','liked','originals','mix','playlist','music'].includes(initialView)){view=initialView;try{selectedMix=decodeURIComponent(initialId||'');}catch{}}
function continueMarkup(){return `<section class="continue-card"><img src="${esc(current.artwork||artwork('flower'))}" alt=""/><div><span class="eyebrow">CONTINUE LISTENING</span><strong>${esc(current.title)}</strong><p><span data-resume-artist>${esc(current.artist)}</span> &middot; <span id="resume-time">${time(resumePosition)}</span> into your song</p></div><button class="primary" data-action="continue">${icon(audio.paused?'play':'pause')}<span>${audio.paused?'Resume':'Pause'}</span></button></section>`;}
function saveSession(){
 if(!user||!current)return;
 if(audio.getAttribute('src')&&audio.duration>0)resumePosition=audio.currentTime;
 const snapshot=sessionSnapshot({current,queue,position:resumePosition,shuffle,repeat,volume:audio.volume,muted:audio.muted},trackById);
 try{localStorage.setItem(listeningKey('session'),JSON.stringify(snapshot));}catch{}
 lastSessionSave=Date.now();
}
function restoreListening(){
 try{
  const saved=JSON.parse(localStorage.getItem(listeningKey('session')));
  for(const t of (Array.isArray(saved?.tracks)?saved.tracks:[]).slice(0,200)){
   if(t?.provider==='youtube'&&/^[\w-]{11}$/.test(t.youtubeId||'')&&t.id===`youtube:${t.youtubeId}`&&typeof t.title==='string')musicRegistry.set(t.id,{...t,artwork:safeWebUrl(t.artwork),permalink:`https://www.youtube.com/watch?v=${t.youtubeId}`});
  }
  const restored=restoreSession(saved,trackById);
  if(restored){({current,queue,shuffle,repeat}=restored);resumePosition=restored.position;audio.volume=restored.volume;audio.muted=restored.muted;$('#volume').value=audio.volume;$('#seek').value=current.duration?resumePosition/current.duration*100:0;$('#seek').style.setProperty('--fill',String($('#seek').value)+'%');$('#elapsed').textContent=time(resumePosition);$('#duration').textContent=time(current.duration);}
  const timer=JSON.parse(localStorage.getItem(listeningKey('sleep')));
  if(timer?.endOfTrack===true)sleepTimer={endOfTrack:true};else if(Number.isFinite(timer?.deadline)&&timer.deadline>Date.now()&&timer.deadline<=Date.now()+180*60000)sleepTimer={deadline:timer.deadline};
 }catch{}
}
function sleepDialog(){openDialog(`<span class="eyebrow">WIND DOWN</span><h2>Sleep timer</h2><p id="sleep-status">${sleepDescription()}</p><div class="sleep-presets">${[15,30,45,60].map(m=>`<button class="secondary" data-sleep-minutes="${m}">${m} min</button>`).join('')}</div><button class="secondary" data-action="sleep-end">At end of this song</button><form id="sleep-form"><label>Custom minutes (1–180)<input name="minutes" type="number" min="1" max="180" step="1" value="20" required/></label><button class="primary" type="submit">Set timer</button></form>${sleepTimer?'<button class="text-button" data-action="sleep-cancel">Cancel timer</button>':''}<p>Playback pauses when the timer ends. Keep sanku inte lokham open for the timer to run on time.</p>`);}
function sleepDescription(){return sleepTimer?.endOfTrack?'Playback will pause at the end of this song.':sleepTimer?.deadline?`Pausing in ${time(Math.max(0,Math.ceil((sleepTimer.deadline-Date.now())/1000)))}.`:'Choose when to pause your music.';}
function setSleep(timer){sleepTimer=timer;try{if(timer)localStorage.setItem(listeningKey('sleep'),JSON.stringify(timer));else localStorage.removeItem(listeningKey('sleep'));}catch{}updateSleepLabel();$('#dialog').close();toast(timer?'Sleep timer set':'Sleep timer cancelled');}
function updateSleepLabel(){const label=$('#sleep-label');label.textContent=sleepTimer?.endOfTrack?'End of song':sleepTimer?.deadline?time(Math.max(0,Math.ceil((sleepTimer.deadline-Date.now())/1000))):'Sleep';label.closest('button').classList.toggle('active',Boolean(sleepTimer));const status=$('#sleep-status');if(status)status.textContent=sleepDescription();}
function finishSleep(){sleepTimer=null;try{localStorage.removeItem(listeningKey('sleep'));}catch{}++playbackToken;audio.pause();saveSession();updatePlayer();updateSleepLabel();toast('Sleep timer finished. Playback paused.');}
function checkSleep(){if(!sleepExpired(sleepTimer))return false;finishSleep();return true;}
setInterval(()=>{checkSleep();updateSleepLabel();},1000);
window.addEventListener('pagehide',saveSession);
document.addEventListener('visibilitychange',()=>{saveSession();checkSleep();});
let draggedQueue=null;
$('#queue-panel').addEventListener('dragstart',e=>{const row=e.target.closest('[data-queue-index]');if(!row)return;draggedQueue=Number(row.dataset.queueIndex);e.dataTransfer.setData('text/plain',String(draggedQueue));e.dataTransfer.effectAllowed='move';});
$('#queue-panel').addEventListener('dragover',e=>{if(draggedQueue!==null&&e.target.closest('[data-queue-index]')){e.preventDefault();e.dataTransfer.dropEffect='move';}});
$('#queue-panel').addEventListener('drop',e=>{const row=e.target.closest('[data-queue-index]');if(draggedQueue===null||!row)return;e.preventDefault();queue=moveQueue(queue,draggedQueue,Number(row.dataset.queueIndex));draggedQueue=null;saveSession();renderQueue();});
$('#queue-panel').addEventListener('dragend',()=>{draggedQueue=null;});
const floatingPlayer=setupFloatingPlayer($('#youtube-panel'),$('#video-drag'));
renderSidebar();render();initCloud();updateSleepLabel();
if('serviceWorker' in navigator&&import.meta.env.PROD){
 let reloading=false;const wasControlled=Boolean(navigator.serviceWorker.controller);
 navigator.serviceWorker.addEventListener('controllerchange',()=>{if(wasControlled&&!reloading){reloading=true;saveSession();location.reload();}});
 window.addEventListener('load',async()=>{
  try{const registration=await navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`,{updateViaCache:'none'});await registration.update();
   document.addEventListener('visibilitychange',()=>{if(!document.hidden)registration.update().catch(()=>{});});
  }catch{}
 });
}
