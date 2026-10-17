import './discovery.css';
export const languages={
 ml:{name:'Malayalam',artists:['Sushin Shyam','Sithara Krishnakumar','Vijay Yesudas','KS Harisankar']},
 en:{name:'English',artists:['The Weeknd','Taylor Swift','Dua Lipa','Ed Sheeran']},
 hi:{name:'Hindi',artists:['Arijit Singh','Shreya Ghoshal','Vishal Mishra','Sunidhi Chauhan']},
 ta:{name:'Tamil',artists:['Anirudh Ravichander','A R Rahman','Sid Sriram','Dhee']}
};
export function interleave(groups){
 const seen=new Set(),result=[];
 for(let i=0;i<Math.max(0,...groups.map(g=>g.length));i++)for(const group of groups){const track=group[i];if(track&&!seen.has(track.id)){seen.add(track.id);result.push(track);}}
 return result.slice(0,24);
}
export function createDiscovery({music,registerMusicTracks,playTrack,esc,artwork,active}){
 const cache=new Map(),pending=new Set();let language='ml';
 try{const saved=localStorage.getItem('sonix-discovery-language');if(languages[saved])language=saved;}catch{}
 const ttl=3600000;
 function render(){
  const root=document.querySelector('#language-discovery');if(!root)return;
  const config=languages[language],data=cache.get(language);
  root.innerHTML=`<div class="section-heading"><div><span class="eyebrow">A WORLD OF MUSIC</span><h2>Your daily soundtrack</h2></div></div><div class="discovery-languages" role="group" aria-label="Music language">${Object.entries(languages).map(([code,l])=>`<button class="chip ${code===language?'chosen':''}" data-language="${code}" aria-pressed="${code===language}">${l.name}</button>`).join('')}</div><p class="discovery-note">Refreshes hourly while you browse. Trending picks are popular YouTube music uploads from the last 30 days.</p>${data?.updated?`<p class="discovery-note">Updated ${new Date(data.updated).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'})}</p>`:''}<p role="status">${pending.has(language)?'Refreshing your playlists…':data?.error?esc(data.error):''}</p>${data?.error?'<button class="secondary" data-discovery-retry>Try again</button>':''}<div class="discovery-playlists">${['trending','artists'].map(kind=>{
   const tracks=data?.[kind]||[],title=kind==='trending'?'Trending now':'Artist mix';
   return `<article class="discovery-playlist"><div class="discovery-heading"><img src="${esc(tracks[0]?.artwork||artwork(kind==='trending'?'sun':'night'))}" alt=""/><div><span class="eyebrow">${config.name}</span><h3>${title}</h3><p>${kind==='artists'?esc(data?.artistsLabel||'A rotating blend of artists'):'Popular recent releases'}</p><button class="primary" data-discovery-play="${kind}" ${tracks.length?'':'disabled'}>Play ${title.toLowerCase()}</button></div></div>${!tracks.length&&!pending.has(language)&&!data?.error?'<p>No songs found. Try another language.</p>':''}<div class="discovery-tracks">${tracks.slice(0,5).map((t,i)=>`<button data-discovery-song="${i}" data-discovery-kind="${kind}"><img loading="lazy" src="${esc(t.artwork||artwork('flower'))}" alt=""/><span><strong>${esc(t.title)}</strong><small>${esc(t.artist)}</small></span><span aria-hidden="true">▶</span></button>`).join('')}</div>${tracks.length?`<p class="discovery-note">${tracks.length} songs in this mix</p>`:''}</article>`;
  }).join('')}</div>`;
 }
 async function load(){
  const code=language,previous=cache.get(code);
  if(!active()||!music.configured('youtube')||pending.has(code)||(previous&&Date.now()-previous.checked<ttl))return;
  pending.add(code);render();
  try{
   const config=languages[code],offset=Math.floor(Date.now()/86400000)%config.artists.length;
   const artists=[config.artists[offset],config.artists[(offset+1)%config.artists.length]];
   const results=await Promise.allSettled([
    music.discovery({query:config.name+' songs',language:code,trending:true}),
    ...artists.map(artist=>music.discovery({query:artist+' '+config.name+' songs',language:code}))
   ]);
   const errors=results.filter(r=>r.status==='rejected');
   const trending=results[0].status==='fulfilled'?results[0].value:previous?.trending||[];
   const artistTracks=interleave(results.slice(1).filter(r=>r.status==='fulfilled').map(r=>r.value));
   const mixed=artistTracks.length?artistTracks:previous?.artists||[];
   registerMusicTracks([...trending,...mixed]);
   cache.set(code,{trending,artists:mixed,artistsLabel:artists.join(' · '),updated:errors.length?previous?.updated:Date.now(),checked:Date.now(),error:errors.length?'Some playlists could not refresh. '+errors[0].reason.message:''});
  }finally{pending.delete(code);if(active())render();}
 }
 function mount(){
  if(!active()){document.querySelector('#language-discovery')?.remove();return;}
  if(!document.querySelector('#language-discovery')){
   const section=document.createElement('section');section.id='language-discovery';
   const anchor=document.querySelector('#main .hero')||document.querySelector('#main .page-heading');anchor?.insertAdjacentElement('afterend',section);
  }
  render();load();
 }
 document.addEventListener('click',event=>{
  const button=event.target.closest('#language-discovery button');if(!button||!active())return;
  if(button.dataset.language){language=button.dataset.language;try{localStorage.setItem('sonix-discovery-language',language);}catch{}render();load();return;}
  if(button.hasAttribute('data-discovery-retry')){const data=cache.get(language);if(data)data.checked=0;load();return;}
  const kind=button.dataset.discoveryPlay||button.dataset.discoveryKind,tracks=cache.get(language)?.[kind];
  if(tracks?.length){registerMusicTracks(tracks);playTrack(tracks[Number(button.dataset.discoverySong||0)].id,tracks.map(t=>t.id));}
 });
 setInterval(()=>{if(!document.hidden&&active())load();},60000);
 document.addEventListener('visibilitychange',()=>{if(!document.hidden&&active())load();});
 return {mount};
}
