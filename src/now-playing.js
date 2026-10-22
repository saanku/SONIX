export function createNowPlaying({getState,seek,action,artwork}){
 const panel=document.querySelector('#youtube-panel');
 const view=document.createElement('section');view.id='now-playing-sheet';view.hidden=true;view.setAttribute('role','dialog');view.setAttribute('aria-modal','true');view.setAttribute('aria-label','Now playing');
 view.innerHTML=`<div class="np-content"><header><button type="button" data-np="collapse" aria-label="Minimize player"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m5 9 7 7 7-7"/></svg></button><div><small>NOW PLAYING</small><span class="np-source"></span></div><button type="button" data-np="queue" aria-label="Open song queue">☷</button></header><div class="np-media"><img class="np-art" alt="Current song artwork"/><div class="np-video-slot" hidden></div></div><div class="np-meta"><div><h2></h2><p></p></div><button type="button" data-np="like-current" aria-label="Like song" aria-pressed="false">♡</button></div><div class="np-progress"><input type="range" min="0" max="100" step="0.1" value="0" aria-label="Seek in current song"/><div><span class="np-elapsed">0:00</span><span class="np-duration">0:00</span></div></div><div class="np-controls"><button type="button" data-np="shuffle" aria-label="Shuffle" aria-pressed="false">⤨</button><button type="button" data-np="previous" aria-label="Previous song">⏮</button><button type="button" class="np-play" data-np="toggle" aria-label="Play">▶</button><button type="button" data-np="next" aria-label="Next song">⏭</button><button type="button" data-np="repeat" aria-label="Repeat" aria-pressed="false">↻</button></div><footer><button type="button" data-np="connect">Devices</button><button type="button" data-np="lyrics">Lyrics</button></footer><p class="np-hint">Tap the down arrow to keep listening in the mini-player.</p></div>`;
 document.querySelector('#app').append(view);
 const slot=view.querySelector('.np-video-slot'),image=view.querySelector('.np-art'),slider=view.querySelector('input');
 let previousFocus,previousOverflow='',inertStates=[],savedStyle='',lastArt='',pointerY;
 const format=value=>{const s=Math.max(0,Number.isFinite(value)?value:0);return `${Math.floor(s/60)}:${String(Math.floor(s%60)).padStart(2,'0')}`;};
 function placeVideo(){
  if(view.hidden||slot.hidden)return;
  const r=slot.getBoundingClientRect();
  for(const [key,value] of Object.entries({left:r.left,top:r.top,width:r.width,height:r.height}))panel.style.setProperty('--np-'+key,value+'px');
 }
 function update(){
  if(view.hidden)return;
  const state=getState();if(!state.track){close();return;}
  const video=!panel.hidden&&!state.remote;
  panel.classList.toggle('is-expanded',video);slot.hidden=!video;image.hidden=video;
  view.classList.toggle('has-video',video);
  const src=state.track.artwork||artwork;if(src!==lastArt){image.src=src;lastArt=src;}
  view.querySelector('h2').textContent=state.track.title;
  view.querySelector('.np-meta p').textContent=state.track.artist||'';
  view.querySelector('.np-source').textContent=state.remote?'Playing on '+state.remote:video?'YouTube video':'Your music';
  view.querySelector('.np-elapsed').textContent=format(state.position);view.querySelector('.np-duration').textContent=format(state.duration);
  if(document.activeElement!==slider)slider.value=state.duration?Math.min(100,state.position/state.duration*100):0;
  slider.disabled=!(state.duration>0);slider.style.setProperty('--fill',slider.value+'%');
  const play=view.querySelector('.np-play');play.textContent=state.paused?'▶':'Ⅱ';play.setAttribute('aria-label',state.paused?'Play':'Pause');
  for(const [key,value] of Object.entries({'like-current':state.favorite,shuffle:state.shuffle,repeat:state.repeat})){
   const button=view.querySelector(`[data-np="${key}"]`);button.setAttribute('aria-pressed',Boolean(value));button.disabled=Boolean(state.remote);
  }
  view.querySelector('[data-np="like-current"]').textContent=state.favorite?'♥':'♡';placeVideo();
 }
 function open(){
  if(!getState().track||!view.hidden)return;
  previousFocus=document.activeElement;previousOverflow=document.body.style.overflow;savedStyle=panel.style.cssText;
  inertStates=[...document.querySelector('#app').children].filter(el=>el!==view&&el!==panel).map(el=>[el,el.inert]);
  inertStates.forEach(([el])=>el.inert=true);document.body.style.overflow='hidden';view.hidden=false;
  view.setAttribute('aria-owns','youtube-panel');update();view.querySelector('[data-np="collapse"]').focus({preventScroll:true});
 }
 function close(){
  if(view.hidden)return;
  view.hidden=true;view.removeAttribute('aria-owns');panel.classList.remove('is-expanded');panel.style.cssText=savedStyle;
  inertStates.forEach(([el,value])=>el.inert=value);inertStates=[];document.body.style.overflow=previousOverflow;
  previousFocus?.focus?.({preventScroll:true});window.dispatchEvent(new Event('resize'));
 }
 view.addEventListener('click',e=>{const button=e.target.closest('[data-np]');if(!button)return;const name=button.dataset.np;if(name==='collapse'){close();return;}if(['queue','lyrics','connect'].includes(name))close();action(name);update();});
 slider.addEventListener('input',()=>{seek(Number(slider.value)/100);slider.style.setProperty('--fill',slider.value+'%');update();});
 view.querySelector('header').addEventListener('pointerdown',e=>{if(!e.target.closest('button'))pointerY=e.clientY;});
 view.querySelector('header').addEventListener('pointerup',e=>{if(pointerY!==undefined&&e.clientY-pointerY>65)close();pointerY=undefined;});
 view.querySelector('header').addEventListener('pointercancel',()=>pointerY=undefined);
 document.addEventListener('keydown',e=>{
  if(view.hidden)return;
  if(e.key===' '&&e.target.closest('#now-playing-sheet button')){e.preventDefault();e.stopImmediatePropagation();e.target.closest('button').click();return;}
  if(e.key==='Escape'){e.preventDefault();e.stopImmediatePropagation();close();return;}
  if(e.key==='Tab'){
   const nodes=[...view.querySelectorAll('button:not(:disabled),input:not(:disabled)'),...(!slot.hidden?panel.querySelectorAll('button,iframe'):[])].filter(el=>el.getClientRects().length);
   const index=nodes.indexOf(document.activeElement);e.preventDefault();nodes[(index+(e.shiftKey?-1:1)+nodes.length)%nodes.length]?.focus();
  }
 },true);
 new ResizeObserver(placeVideo).observe(slot);view.addEventListener('scroll',placeVideo);window.addEventListener('resize',placeVideo);
 new MutationObserver(update).observe(panel,{attributes:true,attributeFilter:['hidden']});
 return {open,close,update};
}
