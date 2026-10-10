export const providerName = provider => provider === 'jamendo' ? 'Jamendo' : '';
export const supportedProvider = provider => provider === 'jamendo';
const text = value => Array.isArray(value) ? value.join(', ') : String(value || '');
export function safeWebUrl(value) { try {const u=new URL(value);return u.protocol==='https:'?u.href:'';}catch{return '';}}
export function durationSeconds(value) {
  if (typeof value === 'string' && value.includes(':')) return value.split(':').reduce((total,part)=>total*60+(Number(part)||0),0);
  const n=Number(value);return Number.isFinite(n)&&n>0?n:0;
}
export function jamendoTrack(t) {
  if(!t||!/^\d+$/.test(String(t.id))||!t.name||!safeWebUrl(t.audio))return null;
  return {id:`jamendo:${t.id}`,jamendoId:String(t.id),provider:'jamendo',source:'Jamendo',title:text(t.name),artist:text(t.artist_name)||'Jamendo artist',album:text(t.album_name)||'Jamendo',duration:durationSeconds(t.duration),artwork:safeWebUrl(t.image||t.album_image),permalink:`https://www.jamendo.com/track/${t.id}`,license:safeWebUrl(text(t.license_ccurl).replace(/^http:/,'https:'))};
}
export function createMusicClient({jamendoClientId='',fetcher=fetch,now=Date.now}={}) {
  const cache=new Map(),pending=new Map();
  let clientId=jamendoClientId.trim();
  async function json(url,fresh=false) {
    const hit=cache.get(url);if(!fresh&&hit&&now()-hit.time<300000)return hit.data;
    if(pending.has(url))return pending.get(url);
    const promise=(async()=>{
      const response=await fetcher(url,{signal:AbortSignal.timeout(25000),credentials:'omit',cache:'no-store'});
      if(!response.ok)throw Error(response.status===429?'This music service is busy. Please try again shortly.':'This music service is unavailable. Please try again.');
      const data=await response.json();if(data.error)throw Error('This collection is currently unavailable.');
      if(cache.size>=30)cache.delete(cache.keys().next().value);if(!fresh&&(!data.headers||(data.headers.status==='success'&&data.results?.length)))cache.set(url,{time:now(),data});return data;
    })();pending.set(url,promise);
    try{return await promise;}catch(error){if(error.name==='TimeoutError')throw Error('The music service took too long to respond. Please try again.');if(error instanceof TypeError)throw Error('Could not reach the music service. Check your connection.');throw error;}finally{pending.delete(url);}
  }
  async function jamendo(params={},fresh=false) {
    if(!clientId)throw Error('Jamendo needs your API client ID. Connect your Jamendo app to start listening.');
    const url=new URL('https://api.jamendo.com/v3.0/tracks/');url.search=new URLSearchParams({client_id:clientId,format:'json',limit:'48',type:'single albumtrack',audioformat:'mp32',imagesize:'300',...params});
    let data=await json(url.href,fresh);if(data.headers?.status==='success'&&!data.results?.length)data=await json(url.href,true);if(data.headers?.status!=='success')throw Error(data.headers?.error_message||'Jamendo rejected the request. Check your client ID.');return data;
  }
  return {
    configured:provider=>provider==='jamendo'&&Boolean(clientId),
    setJamendoClientId(value){clientId=value.trim();cache.clear();},
    async browse(provider,query='',{page=0,sort='popular'}={}) {
      const q=query.trim();if(q.length>120)throw Error('Use no more than 120 characters.');
      if(provider==='jamendo'){
        if(!Number.isSafeInteger(page)||page<0)throw Error('Invalid catalog page.');
        const order=q?'relevance':({popular:'popularity_total',newest:'releasedate_desc',name:'name',catalog:'id_asc'}[sort]||'popularity_total');
        const data=await jamendo({...(q?{search:q}:{}),order,offset:String(page*48),...(page===0?{fullcount:'true'}:{})});
        const rows=data.results||[],count=Number(data.headers?.results_fullcount);
        return {tracks:rows.map(jamendoTrack).filter(Boolean),page,hasNext:rows.length===48,total:Number.isFinite(count)?count:null};
      }
      throw Error('This music provider is no longer connected.');
    },
    async resolve(track){
      if(track.provider==='jamendo'){
        if(!/^\d+$/.test(track.jamendoId||''))throw Error('Invalid Jamendo track identifier.');
        const raw=(await jamendo({id:track.jamendoId},true)).results?.[0],fresh=jamendoTrack(raw);
        if(!fresh)throw Error('This track is no longer available on Jamendo.');return {track:fresh,url:safeWebUrl(raw.audio)};
      }
      throw Error('This music provider is no longer connected.');
    }
  };
}
