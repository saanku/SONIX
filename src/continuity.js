// Only the active device writes checkpoints. Followers never echo received state.
export function createContinuity({read,write,snapshot,apply,onStatus=()=>{},id=crypto.randomUUID(),interval=5000}){
 let user=null,epoch=0,owner=false,revision=null,timer,chain=Promise.resolve(),generation=0,lastState='';
 const stateKey=s=>JSON.stringify([s.currentId,s.position,s.paused,s.queue,s.manualQueue,s.shuffle,s.repeat]);
 function receive(value){
  if(!value||typeof value.revision!=='string'||value.revision===revision)return;
  revision=value.revision;owner=value.owner===id;lastState=stateKey(value);
  if(!owner)apply(value);
 }
 function task(work){const version=epoch,account=user,action=generation;const result=chain.then(async()=>{if(!account||version!==epoch||action!==generation)return;try{await work(account,()=>version===epoch&&action===generation);if(version===epoch)onStatus('synced');}catch{if(version===epoch)onStatus('offline');}});chain=result;return result;}
 function poll(){return task(async(account,valid)=>{
  const value=await read(account);if(!valid())return;receive(value);
  const state=snapshot();
  if(owner&&state&&stateKey(state)!==lastState){const saved=await write(account,{...state,owner:id,revision:crypto.randomUUID()},false);if(valid())receive(saved);}
 });}
 function publish(claim=false){
  if(!user||(!owner&&!claim))return Promise.resolve();
  const state=snapshot();if(!state)return Promise.resolve();
  if(claim){generation++;owner=true;}
  const value={...state,owner:id,revision:crypto.randomUUID()};
  return task(async(account,valid)=>{const saved=await write(account,value,claim);if(valid())receive(saved);});
 }
 function stop(){epoch++;generation++;clearInterval(timer);user=null;owner=false;revision=null;chain=Promise.resolve();}
 return {poll,publish,stop,get owner(){return owner;},async start(account){stop();user=account;await poll();if(user===account)timer=setInterval(poll,interval);}};
}
