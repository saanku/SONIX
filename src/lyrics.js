export function parseLyrics(value='') {
  const lines=[];
  const offset=Number(value.match(/\[offset:([+-]?\d+)\]/i)?.[1]||0)/1000;
  for(const row of value.split(/\r?\n/)) {
    const stamps=[...row.matchAll(/\[(\d+):(\d{2}(?:\.\d+)?)\]/g)];
    const text=row.replace(/\[[^\]]*\]/g,'').trim();
    for(const stamp of stamps)if(Number(stamp[2])<60)lines.push({time:Math.max(0,Number(stamp[1])*60+Number(stamp[2])-offset),text});
  }
  return lines.sort((a,b)=>a.time-b.time);
}

export function lyricsQuery(track) {
  let title=String(track.title||'').replace(/\s*[\[(](?:official[^\])]*|lyrics?[^\])]*|audio|video|hd|4k)[\])]/gi,'').trim();
  let artist=String(track.artist||'').replace(/\s*-\s*Topic$/i,'').trim();
  if(title.includes(' - ')){const parts=title.split(' - ');artist=parts.shift().trim();title=parts.join(' - ').trim();}
  if(artist==='Your music')artist='';
  return {title,artist};
}

export function createLyrics({audio,getTrack,getPosition=()=>audio.currentTime}) {
  const panel=document.createElement('section');
  panel.id='lyrics-panel';panel.hidden=true;panel.setAttribute('aria-label','Song lyrics');
  panel.innerHTML='<header><div><small>NOW SINGING</small><h2>Lyrics</h2><p class="lyrics-artist"></p></div><button type="button" class="icon-button" aria-label="Close lyrics">✕</button></header><div class="lyrics-body"></div><footer><span class="lyrics-status" role="status"></span><a href="https://lrclib.net" target="_blank" rel="noopener noreferrer">Lyrics by LRCLIB</a></footer>';
  document.querySelector('#app').append(panel);
  const body=panel.querySelector('.lyrics-body'),status=panel.querySelector('.lyrics-status');
  const cache=new Map();let controller,trackId,lines=[],active=-1;
  const buttons=[...document.querySelectorAll('[data-action="lyrics"]')];
  function close(){panel.hidden=true;controller?.abort();trackId=undefined;buttons.forEach(b=>b.setAttribute('aria-pressed','false'));buttons.find(b=>b.getClientRects().length)?.focus();}
  panel.querySelector('header button').onclick=close;
  document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!panel.hidden)close();});
  function message(text,retry=false){body.replaceChildren();const p=document.createElement('p');p.className='lyrics-message';p.textContent=text;body.append(p);if(retry){const b=document.createElement('button');b.className='secondary';b.textContent='Try again';b.onclick=()=>{trackId=undefined;update();};body.append(b);}}
  function sync(){
    if(panel.hidden||!lines.length)return;
    const position=getPosition();let index=-1;
    for(let i=0;i<lines.length&&lines[i].time<=position;i++)index=i;
    if(index===active)return;active=index;
    [...body.children].forEach((el,i)=>{el.classList.toggle('is-active',i===index);el.classList.toggle('is-past',i<index);if(i===index)el.setAttribute('aria-current','true');else el.removeAttribute('aria-current');});
    const el=body.children[index];if(el)body.scrollTo({top:el.offsetTop-body.offsetTop-body.clientHeight*.35,behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'});
  }
  async function update(){
    if(panel.hidden)return;
    const track=getTrack();if(track&&track.id===trackId)return;
    controller?.abort();controller=new AbortController();const request=controller;trackId=track?.id;lines=[];active=-1;status.textContent='';body.scrollTop=0;
    panel.querySelector('h2').textContent=track?.title||'Lyrics';panel.querySelector('.lyrics-artist').textContent=track?.artist||'';
    if(!track){message('Play a song to see its lyrics.');return;}
    message('Finding lyrics…');const timer=setTimeout(()=>request.abort(),12000);
    try {
      let result=cache.get(track.id);
      if(!result){
        const {title,artist}=lyricsQuery(track);const params=new URLSearchParams({track_name:title});if(artist)params.set('artist_name',artist);
        const response=await fetch('https://lrclib.net/api/search?'+params,{signal:request.signal});
        if(!response.ok)throw Error('Lyrics service unavailable');
        const records=await response.json();
        const normalize=s=>String(s||'').toLowerCase().replace(/[^\p{L}\p{N}]/gu,'');
        const matches=records.filter(r=>normalize(r.trackName)===normalize(title)&&(!artist||normalize(r.artistName)===normalize(artist)));
        matches.sort((a,b)=>track.duration?Math.abs(a.duration-track.duration)-Math.abs(b.duration-track.duration):Number(Boolean(b.syncedLyrics))-Number(Boolean(a.syncedLyrics)));
        result=matches[0]||{};cache.set(track.id,result);if(cache.size>50)cache.delete(cache.keys().next().value);
      }
      if(request!==controller||panel.hidden)return;
      lines=parseLyrics(result.syncedLyrics||'');body.replaceChildren();
      if(result.instrumental){message('Instrumental — no lyrics to sing.');return;}
      if(lines.length){
        for(const line of lines){const b=document.createElement('button');b.className='lyrics-line';b.textContent=line.text||'♪';b.setAttribute('aria-label',`${line.text||'Instrumental break'} — seek to ${Math.floor(line.time/60)}:${String(Math.floor(line.time%60)).padStart(2,'0')}`);b.onclick=()=>{if(audio.getAttribute('src')&&Number.isFinite(audio.duration)&&audio.duration>0){audio.currentTime=Math.min(line.time,audio.duration);sync();}};body.append(b);}
        status.textContent='Synced lyrics · Click a line to seek';sync();
      }else if(result.plainLyrics){const p=document.createElement('p');p.className='lyrics-plain';p.textContent=result.plainLyrics;body.append(p);status.textContent='Lyrics · Timing unavailable';}
      else message('Lyrics aren’t available for this song yet. Imported files need an Artist - Song filename for the best match.');
    }catch{if(request===controller&&!panel.hidden)message('Couldn’t load lyrics. Check your connection and try again.',true);}
    finally{clearTimeout(timer);}
  }
  for(const b of buttons)b.addEventListener('click',()=>{if(!panel.hidden){close();return;}panel.hidden=false;buttons.forEach(el=>el.setAttribute('aria-pressed','true'));trackId=undefined;update();panel.querySelector('header button').focus();});
  audio.addEventListener('timeupdate',sync);
  return {update,close};
}
