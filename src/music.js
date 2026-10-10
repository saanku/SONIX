export const providerName = provider => provider === 'jamendo' ? 'Jamendo' : 'Internet Archive';
export const supportedProvider = provider => ['archive', 'jamendo'].includes(provider);
const text = value => Array.isArray(value) ? value.join(', ') : String(value || '');
const blocked = value => value === true || value === 1 || value === 'true' || value === '1';
const validArchiveId = id => /^[a-zA-Z0-9][a-zA-Z0-9_.-]{0,200}$/.test(id || '');
export function safeWebUrl(value) { try {const u=new URL(value);return u.protocol==='https:'?u.href:'';}catch{return '';}}
export function durationSeconds(value) {
  if (typeof value === 'string' && value.includes(':')) return value.split(':').reduce((total,part)=>total*60+(Number(part)||0),0);
  const n=Number(value);return Number.isFinite(n)&&n>0?n:0;
}
export function archiveCollection(item) {
  if(!validArchiveId(item?.identifier)||blocked(item['access-restricted-item']))return null;
  return {id:`archive:${item.identifier}`,archiveId:item.identifier,kind:'collection',provider:'archive',source:'Internet Archive',title:text(item.title)||item.identifier,artist:text(item.creator)||'Internet Archive collection',album:'Music collection',duration:0,artwork:`https://archive.org/services/img/${encodeURIComponent(item.identifier)}`,permalink:`https://archive.org/details/${encodeURIComponent(item.identifier)}`};
}
export function archiveTracks(data, id) {
  const m=data?.metadata;
  if(!validArchiveId(id)||!m||blocked(data.is_dark)||blocked(data.nodownload)||blocked(m.nodownload)||blocked(m['access-restricted-item'])||!['audio','etree'].includes(m.mediatype))return [];
  const seen=new Set();
  return (data.files||[]).filter(f=>typeof f.name==='string'&&/\.mp3$/i.test(f.name)&&!f.name.split('/').some(p=>p==='..'||p==='.')&&!blocked(f.private)&&!blocked(f.is_private)&&Number(f.size||1)>0).sort((a,b)=>(Number(a.track)||0)-(Number(b.track)||0)).flatMap(f=>{
    const key=f.original||f.name;if(seen.has(key))return [];seen.add(key);
    return [{id:`archive:${id}:${encodeURIComponent(f.name)}`,archiveId:id,fileName:f.name,provider:'archive',source:'Internet Archive',title:text(f.title)||f.name.replace(/\.mp3$/i,''),artist:text(f.artist||f.creator||m.creator)||'Internet Archive artist',album:text(f.album||m.title)||id,duration:durationSeconds(f.length),artwork:`https://archive.org/services/img/${encodeURIComponent(id)}`,permalink:`https://archive.org/details/${encodeURIComponent(id)}`,license:safeWebUrl(text(m.licenseurl).replace(/^http:/,'https:'))}];
  });
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
  async function metadata(id,fresh=false){if(!validArchiveId(id))throw Error('Invalid collection identifier.');return json(`https://archive.org/metadata/${encodeURIComponent(id)}`,fresh);}
  return {
    configured:provider=>provider!=='jamendo'||Boolean(clientId),
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
      if(provider!=='archive')throw Error('This music provider is no longer connected.');
      const escaped=q.replace(/([+\-&|!(){}\[\]^"~*?:\\/])/g,'\\$1');
      const filter='mediatype:audio AND (collection:netlabels OR collection:etree) AND NOT access-restricted-item:true';
      const queryText=q?`${filter} AND (title:"${escaped}" OR creator:"${escaped}" OR subject:"${escaped}")`:`${filter} AND (subject:music OR subject:ambient OR subject:electronic OR subject:jazz OR subject:rock)`;
      const url=new URL('https://archive.org/advancedsearch.php');url.search=new URLSearchParams({q:queryText,output:'json',rows:'24','fl[]':'identifier,title,creator','sort[]':'downloads desc'});
      const data=await json(url.href);return {tracks:(data.response?.docs||[]).map(archiveCollection).filter(Boolean)};
    },
    async expand(item){return {tracks:archiveTracks(await metadata(item.archiveId),item.archiveId)};},
    async resolve(track){
      if(track.provider==='archive'){
        const fresh=archiveTracks(await metadata(track.archiveId,true),track.archiveId).find(t=>t.fileName===track.fileName);
        if(!fresh)throw Error('This audio file is no longer publicly available.');
        return {track:fresh,url:`https://archive.org/download/${encodeURIComponent(track.archiveId)}/${track.fileName.split('/').map(encodeURIComponent).join('/')}`};
      }
      if(track.provider==='jamendo'){
        if(!/^\d+$/.test(track.jamendoId||''))throw Error('Invalid Jamendo track identifier.');
        const raw=(await jamendo({id:track.jamendoId},true)).results?.[0],fresh=jamendoTrack(raw);
        if(!fresh)throw Error('This track is no longer available on Jamendo.');return {track:fresh,url:safeWebUrl(raw.audio)};
      }
      throw Error('This music provider is no longer connected.');
    }
  };
}
