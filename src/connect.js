// Private account-scoped presence and acknowledged remote commands.
export function createConnect({getClient,getState,onCommand,onChange=()=>{},onError=()=>{},id=crypto.randomUUID(),name='This browser'}){
 let client,channel,userId,epoch=0,timer,online=false,devices=[],target=null,status='offline';
 const pending=new Map(),seen=new Set();
 const notify=()=>onChange({id,name,status,devices:devices.filter(d=>Date.now()-d.updated<20000),target});
 function clear(){
  ++epoch;clearInterval(timer);online=false;devices=[];target=null;status='offline';
  for(const p of pending.values()){clearTimeout(p.timer);p.reject(Error('Connect disconnected.'));}pending.clear();seen.clear();
  const old=channel;channel=null;if(old)client?.removeChannel(old);notify();
 }
 async function publish(){
  if(!online||!channel)return;
  try{await channel.track({id,name,updated:Date.now(),...getState()});}catch{}
 }
 function sync(){
  devices=Object.values(channel?.presenceState()||{}).flat().filter(d=>typeof d.id==='string'&&typeof d.name==='string'&&Number.isFinite(d.updated));
  if(target&&!devices.some(d=>d.id===target&&Date.now()-d.updated<20000)){target=null;onError('The connected device went offline. Choose a device again.');}
  notify();
 }
 async function start(nextUser){
  if(userId===nextUser&&channel)return;
  clear();userId=nextUser;if(!nextUser)return;
  const version=epoch;status='connecting';notify();
  try{
   client=await getClient();if(version!==epoch)return;if(!client)throw Error('Connect is not configured.');
   channel=client.channel(`connect:${nextUser}`,{config:{private:true,broadcast:{ack:true},presence:{key:id}}});
   const current=channel;
   current.on('presence',{event:'sync'},()=>{if(version===epoch)sync();});
   current.on('broadcast',{event:'ack'},({payload:p})=>{
    if(version!==epoch||p?.to!==id)return;const job=pending.get(p.request);
    if(!job||p.from!==job.target)return;pending.delete(p.request);clearTimeout(job.timer);
    if(p.error)job.reject(Error(p.error));else job.resolve();
   });
   current.on('broadcast',{event:'command'},async({payload:p})=>{
    if(version!==epoch||!online||p?.to!==id||typeof p.request!=='string'||!Number.isFinite(p.sent)||Math.abs(Date.now()-p.sent)>15000||seen.has(p.request))return;
    if(!devices.some(d=>d.id===p.from&&Date.now()-d.updated<20000))return;
    seen.add(p.request);if(seen.size>200)seen.delete(seen.values().next().value);
    let error;try{target=null;notify();await onCommand(p.command);}catch(e){error=e.message||'Playback could not start.';}
    if(version!==epoch)return;
    await current.send({type:'broadcast',event:'ack',payload:{to:p.from,from:id,request:p.request,error}});publish();
   });
   current.subscribe(async state=>{
    if(version!==epoch)return;
    online=state==='SUBSCRIBED';status=online?'online':state==='CHANNEL_ERROR'||state==='TIMED_OUT'?'unavailable':'connecting';
    if(online){await publish();clearInterval(timer);timer=setInterval(()=>{publish();sync();},5000);}
    else {devices=[];target=null;clearInterval(timer);}notify();
   });
  }catch{if(version===epoch){status='unavailable';notify();}}
 }
 return {
  start,stop(){userId=null;clear();},publish,
  get target(){return target;},
  select(value){if(value===id||!value){target=null;notify();return;}if(!online||!devices.some(d=>d.id===value&&Date.now()-d.updated<20000))throw Error('This device is no longer online.');target=value;notify();},
  async send(command){
   if(!online||!target)throw Error('Choose an online device first.');
   const to=target,request=crypto.randomUUID();
   return new Promise((resolve,reject)=>{
    const timer=setTimeout(()=>{pending.delete(request);reject(Error('The device did not respond. Keep the app open there and try again.'));},10000);
    pending.set(request,{resolve,reject,timer,target:to});
    channel.send({type:'broadcast',event:'command',payload:{to,from:id,request,sent:Date.now(),command}}).then(result=>{if(result!=='ok'&&pending.has(request)){pending.delete(request);clearTimeout(timer);reject(Error('Could not reach this device.'));}}).catch(()=>{if(pending.delete(request)){clearTimeout(timer);reject(Error('Could not reach this device.'));}});
   });
  }
 };
}
