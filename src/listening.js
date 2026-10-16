// Persist only playback metadata, never credentials or temporary audio URLs.
export function sessionSnapshot({current,queue,position,shuffle,repeat,volume,muted},lookup) {
  const ids=[...new Set(queue)].filter(id=>typeof id==='string'&&lookup(id)).slice(0,200);
  if(current?.id&&!ids.includes(current.id))ids.unshift(current.id);
  const tracks=ids.map(lookup).filter(t=>t?.provider==='youtube').map(t=>({
    id:t.id,youtubeId:t.youtubeId,provider:'youtube',title:t.title,artist:t.artist,
    album:t.album,duration:t.duration,artwork:t.artwork,permalink:t.permalink
  }));
  return {currentId:current?.id||null,queue:ids,tracks,position:Number.isFinite(position)?Math.max(0,position):0,shuffle:Boolean(shuffle),repeat:Boolean(repeat),volume,muted:Boolean(muted)};
}
export function restoreSession(value,lookup) {
  if(!value||!Array.isArray(value.queue))return null;
  const queue=[...new Set(value.queue)].filter(id=>typeof id==='string'&&lookup(id)).slice(0,200);
  const current=lookup(value.currentId);if(!current)return null;
  if(!queue.includes(current.id))queue.unshift(current.id);
  return {current,queue,position:Number.isFinite(value.position)?Math.max(0,Math.min(value.position,current.duration||86400)):0,shuffle:value.shuffle===true,repeat:value.repeat===true,volume:Number.isFinite(value.volume)?Math.max(0,Math.min(1,value.volume)):.7,muted:value.muted===true};
}
export function enqueue(queue,id,currentId,next=false) {
  if(id===currentId)return [...queue];
  const result=queue.filter(item=>item!==id);
  result.splice(next?Math.max(0,result.indexOf(currentId)+1):result.length,0,id);
  return result;
}
export function moveQueue(queue,from,to) {
  const result=[...queue];
  if(!Number.isInteger(from)||!Number.isInteger(to)||from<0||to<0||from>=queue.length||to>=queue.length)return result;
  result.splice(to,0,result.splice(from,1)[0]);return result;
}
export function sleepExpired(timer,now=Date.now()) {return Number.isFinite(timer?.deadline)&&timer.deadline>0&&now>=timer.deadline;}
