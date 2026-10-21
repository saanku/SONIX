import test from 'node:test';
import assert from 'node:assert/strict';
import {createContinuity} from '../src/continuity.js';
import {patchCloudRecord} from '../src/cloud-record.js';

test('phone pause survives closing; PC resumes same song and position; accounts stay separate',async()=>{
 const records=new Map(),received={phone:[],pc:[],other:[]};
 const states={phone:{currentId:'song',position:42,paused:false,queue:['song','next']},pc:null,other:null};
 const device=id=>createContinuity({id,interval:1e8,read:async user=>records.get(user),write:async(user,value,claim)=>{if(claim||records.get(user)?.owner===value.owner)records.set(user,value);return records.get(user);},snapshot:()=>states[id],apply:value=>{received[id].push(value);states[id]={...value,paused:true};}});
 const phone=device('phone'),pc=device('pc'),other=device('other');
 try{
  await phone.start('a');await pc.start('a');await other.start('b');
  await phone.publish(true);await pc.poll();await other.poll();
  assert.equal(received.pc[0].position,42);assert.equal(received.other.length,0);
  states.phone={...states.phone,position:73,paused:true};await phone.publish();phone.stop();
  await pc.poll();assert.equal(states.pc.position,73);assert.deepEqual(states.pc.queue,['song','next']);
  states.pc.paused=false;await pc.publish(true);assert.equal(records.get('a').owner,'pc');
  await phone.start('a');assert.equal(states.phone.position,73);assert.equal(phone.owner,false);
  await phone.publish();assert.equal(records.get('a').owner,'pc');
  states.pc.position=90;await pc.poll();await phone.poll();assert.equal(states.phone.position,90);
  await pc.start('b');assert.equal(pc.owner,false);await pc.publish();assert.equal(records.has('b'),false);
 }finally{phone.stop();pc.stop();other.stop();}
});

test('late account reads cannot replace a newly selected local song or cross sign-out',async()=>{
 let resolve;let applied=0,writes=0;
 const c=createContinuity({id:'pc',interval:1e8,read:()=>new Promise(r=>resolve=r),write:async(u,s)=>{writes++;return s;},snapshot:()=>({currentId:'new',position:0}),apply:()=>applied++});
 try{
  const starting=c.start('a');await new Promise(r=>setImmediate(r));
  const claim=c.publish(true);resolve({owner:'phone',revision:'old',currentId:'old'});await starting;await claim;
  assert.equal(applied,0);assert.equal(writes,1);
  const polling=c.poll();await new Promise(r=>setImmediate(r));c.stop();resolve({owner:'phone',revision:'later'});await polling;assert.equal(applied,0);
 }finally{c.stop();}
});

test('failed writes are reported and a later poll retries the local checkpoint',async()=>{
 let saved,offline=true;const statuses=[];
 const c=createContinuity({id:'pc',interval:1e8,read:async()=>saved,write:async(u,s)=>{if(offline)throw Error('offline');saved=s;return s;},snapshot:()=>({currentId:'song',position:12,paused:true}),apply:()=>{},onStatus:s=>statuses.push(s)});
 try{await c.start('a');await c.publish(true);assert.equal(statuses.at(-1),'offline');offline=false;await c.poll();assert.equal(saved.position,12);assert.equal(statuses.at(-1),'synced');}finally{c.stop();}
});

test('optimistic library updates retry conflicts and preserve the concurrent playback checkpoint',async()=>{
 let row={data:{favorites:[],playback:{position:1}},updated_at:'2026-01-01T00:00:00.000Z'},conflict=true;
 const client={from(){let change,version;return {select(){return this;},eq(key,value){if(key==='updated_at')version=value;return this;},async maybeSingle(){return {data:structuredClone(row)};},update(value){change=value;return this;},then(resolve){if(conflict){conflict=false;row={data:{favorites:[],playback:{position:99}},updated_at:'2026-01-01T00:00:01.000Z'};}if(version!==row.updated_at)return resolve({data:[]});row=change;resolve({data:[{user_id:'a'}]});}};}};
 await patchCloudRecord(client,'a',old=>({...old,favorites:['liked']}));
 assert.deepEqual(row.data,{favorites:['liked'],playback:{position:99}});
});
