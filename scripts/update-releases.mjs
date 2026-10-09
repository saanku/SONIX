import { writeFile, mkdir } from 'node:fs/promises';
const today=new Date().toISOString().slice(0,10);
const from=new Date(Date.now()-14*86400000).toISOString().slice(0,10);
const query=`date:[${from} TO ${today}] AND status:official`;
const releases=new Map();
const contact=process.env.MUSICBRAINZ_CONTACT||'https://github.com/sonix-personal/sonix';
for(let offset=0;offset<300;offset+=100){
 if(offset)await new Promise(r=>setTimeout(r,1200));
 const url=`https://musicbrainz.org/ws/2/release/?query=${encodeURIComponent(query)}&fmt=json&limit=100&offset=${offset}`;
 let response;
 for(let attempt=0;attempt<3;attempt++){
  response=await fetch(url,{headers:{'User-Agent':`SONIX/1.0 (${contact})`,Accept:'application/json'},signal:AbortSignal.timeout(25000)});
  if(response.ok)break;
  if(response.status===429||response.status===503){await new Promise(r=>setTimeout(r,3000*(attempt+1)));continue;}
  throw Error(`MusicBrainz returned ${response.status}`);
 }
 if(!response.ok)throw Error(`MusicBrainz unavailable: ${response.status}`);
 const result=await response.json();
 for(const r of result.releases||[]){
  const key=r['release-group']?.id||r.id;
  if(!releases.has(key))releases.set(key,{id:r.id,title:r.title,artist:(r['artist-credit']||[]).map(a=>a.name+(a.joinphrase||'')).join(''),date:r.date||'',language:r['text-representation']?.language||'und',type:r['release-group']?.['primary-type']||'Release'});
 }
 if(offset+100>=result.count)break;
}
const sorted=[...releases.values()].sort((a,b)=>b.date.localeCompare(a.date));
await mkdir('public',{recursive:true});
await writeFile('public/releases.json',JSON.stringify({updatedAt:new Date().toISOString(),source:'MusicBrainz',window:{from,to:today},releases:sorted},null,2));
console.log(`Saved ${sorted.length} releases. This is a discovery sample, not an exhaustive global catalog.`);
