import test from 'node:test';
import assert from 'node:assert/strict';
import {createConnect} from '../src/connect.js';

function broker(){
 const channels=[];
 function sync(topic){for(const c of channels.filter(c=>c.topic===topic))c.handlers.presence?.({});}
 return {channels,client:{
  channel(topic,options){
   assert.equal(options.config.private,true);
   const c={topic,options,handlers:{},data:null,
    on(type,filter,fn){this.handlers[type==='presence'?'presence':filter.event]=fn;return this;},
    subscribe(fn){this.callback=fn;queueMicrotask(()=>fn('SUBSCRIBED'));return this;},
    async track(data){this.data=data;sync(topic);return 'ok';},
    presenceState(){return Object.fromEntries(channels.filter(x=>x.topic===topic&&x.data).map(x=>[x.data.id,[x.data]]));},
    async send(message){for(const other of channels.filter(x=>x.topic===topic&&x!==c))await other.handlers[message.event]?.({payload:message.payload});return 'ok';}
   };channels.push(c);return c;
  },
  removeChannel(c){channels.splice(channels.indexOf(c),1);sync(c.topic);}
 }};
}
test('Connect isolates accounts, discovers devices and acknowledges targeted playback',async()=>{
 const {client,channels}=broker(),commands=[],otherCommands=[];let phoneState;
 const phone=createConnect({getClient:async()=>client,getState:()=>({paused:true}),onCommand:()=>{},onChange:s=>phoneState=s,id:'phone',name:'Phone'});
 const pc=createConnect({getClient:async()=>client,getState:()=>({paused:false,title:'Song'}),onCommand:c=>commands.push(c),id:'pc',name:'Computer'});
 const stranger=createConnect({getClient:async()=>client,getState:()=>({}),onCommand:c=>otherCommands.push(c),id:'stranger'});
 try{
  await phone.start('account-a');await pc.start('account-a');await stranger.start('account-b');await new Promise(r=>setImmediate(r));
  assert.equal(phoneState.devices.length,2);assert.throws(()=>phone.select('stranger'));
  phone.select('pc');await phone.send({type:'play',id:'youtube:abcdefghijk'});
  assert.equal(commands.length,1);assert.equal(otherCommands.length,0);
  const receiver=channels.find(c=>c.options.config.presence.key==='pc');
  await receiver.handlers.command({payload:{to:'pc',from:'phone',request:'expired',sent:Date.now()-60000,command:{type:'next'}}});assert.equal(commands.length,1);
  pc.stop();assert.equal(phone.target,null);assert.equal(phoneState.devices.length,1);
  await phone.start('account-b');await new Promise(r=>setImmediate(r));assert.ok(phoneState.devices.some(d=>d.id==='stranger'));
 }finally{phone.stop();pc.stop();stranger.stop();}
});
test('Connect reports receiver errors and denied private subscriptions',async()=>{
 const {client,channels}=broker();let state;
 const a=createConnect({getClient:async()=>client,getState:()=>({}),onCommand:()=>{},onChange:s=>state=s,id:'a'});
 const b=createConnect({getClient:async()=>client,getState:()=>({}),onCommand:()=>{throw Error('Unavailable song');},id:'b'});
 try{await a.start('user');await b.start('user');await new Promise(r=>setImmediate(r));a.select('b');await assert.rejects(a.send({type:'play'}),/Unavailable song/);channels[0].callback('CHANNEL_ERROR');assert.equal(state.status,'unavailable');assert.equal(a.target,null);}
 finally{a.stop();b.stop();}
});
