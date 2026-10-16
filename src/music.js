export const providerName = provider => provider === 'youtube' ? 'YouTube' : '';
export const supportedProvider = provider => provider === 'youtube';
export function safeWebUrl(value) { try {const u=new URL(value);return u.protocol==='https:'?u.href:'';}catch{return '';}}
export function durationSeconds(value) {
  const iso=typeof value==='string'&&value.match(/^P(?:(\d+)D)?T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+(?:\.\d+)?)S)?$/);
  if(iso)return Number(iso[1]||0)*86400+Number(iso[2]||0)*3600+Number(iso[3]||0)*60+Number(iso[4]||0);
  if(typeof value==='string'&&value.includes(':'))return value.split(':').reduce((n,p)=>n*60+(Number(p)||0),0);
  return Number.isFinite(Number(value))&&Number(value)>0?Number(value):0;
}
export function youtubeTrack(t) {
  const id=typeof t?.id==='string'?t.id:t?.id?.videoId,s=t?.snippet;
  if(!/^[\w-]{11}$/.test(id||'')||!s?.title||t.status?.embeddable===false)return null;
  return {id:'youtube:'+id,youtubeId:id,provider:'youtube',source:'YouTube',title:s.title,artist:s.channelTitle||'YouTube',album:'YouTube',duration:durationSeconds(t.contentDetails?.duration),artwork:safeWebUrl(s.thumbnails?.high?.url||s.thumbnails?.medium?.url||s.thumbnails?.default?.url),permalink:'https://www.youtube.com/watch?v='+id};
}
export function createMusicClient({youtubeApiKey='',fetcher=fetch,now=Date.now}={}) {
  let key=youtubeApiKey.trim();const cache=new Map(),pages=new Map();
  async function request(endpoint,params){
    if(!key)throw Error('Add your YouTube Data API v3 key to search music.');
    const url=new URL('https://www.googleapis.com/youtube/v3/'+endpoint);url.search=new URLSearchParams({...params,key});
    const hit=cache.get(url.href);if(hit&&now()-hit.time<300000)return hit.data;
    try{
      const response=await fetcher(url.href,{signal:AbortSignal.timeout(25000),credentials:'omit',cache:'no-store'});
      const data=await response.json();
      if(!response.ok||data.error){const reason=data.error?.errors?.[0]?.reason;throw Error(['quotaExceeded','dailyLimitExceeded'].includes(reason)?'YouTube API quota is exhausted. Try again after the quota resets.':response.status===400||response.status===403?'YouTube rejected the request. Check your API key, API enablement, and website restrictions.':'YouTube is unavailable. Please try again.');}
      if(cache.size>=30)cache.delete(cache.keys().next().value);cache.set(url.href,{time:now(),data});return data;
    }catch(error){if(error.name==='TimeoutError')throw Error('YouTube took too long to respond. Try again.');if(error instanceof TypeError)throw Error('Could not reach YouTube. Check your connection.');throw error;}
  }
  return {
    configured:provider=>provider==='youtube'&&Boolean(key),
    setYoutubeApiKey(value){key=value.trim();cache.clear();pages.clear();},
    async browse(provider,query='',{page=0,sort='popular'}={}){
      if(!supportedProvider(provider))throw Error('This music provider is no longer connected.');
      const q=query.trim();if(q.length>120)throw Error('Use no more than 120 characters.');
      if(!Number.isSafeInteger(page)||page<0)throw Error('Invalid catalog page.');
      const signature=JSON.stringify([q,sort]);if(page===0)pages.set(signature,['']);
      const tokens=pages.get(signature);if(tokens?.[page]===undefined)throw Error('Open the previous catalog page first.');
      const data=await request('search',{part:'snippet',type:'video',videoCategoryId:'10',videoEmbeddable:'true',videoSyndicated:'true',maxResults:'48',q:q||'music',order:q?'relevance':({popular:'viewCount',newest:'date',name:'title'}[sort]||'relevance'),...(tokens[page]?{pageToken:tokens[page]}:{})});
      const ids=(data.items||[]).map(youtubeTrack).filter(Boolean).map(t=>t.youtubeId);
      const details=ids.length?await request('videos',{part:'snippet,contentDetails,status',id:ids.join(',')}):{items:[]};
      if(data.nextPageToken)tokens[page+1]=data.nextPageToken;else tokens.length=page+1;
      return {tracks:(details.items||[]).map(youtubeTrack).filter(Boolean),page,hasNext:Boolean(data.nextPageToken),total:null};
    },
    async resolve(track){if(!supportedProvider(track.provider)||! /^[\w-]{11}$/.test(track.youtubeId||''))throw Error('Invalid YouTube video.');return {track,url:'youtube:'+track.youtubeId};}
  };
}
