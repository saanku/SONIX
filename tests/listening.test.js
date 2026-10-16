import test from 'node:test';
import assert from 'node:assert/strict';
import {sessionSnapshot,restoreSession,enqueue,moveQueue,sleepExpired} from '../src/listening.js';
const tracks=[{id:'local',local:true,title:'Local',duration:30},{id:'youtube:abcdefghijk',youtubeId:'abcdefghijk',provider:'youtube',title:'Video',duration:180,url:'temporary',apiKey:'never-save'}];
const lookup=id=>tracks.find(t=>t.id===id);
test('Listening snapshot keeps metadata and position without temporary URLs or credentials',()=>{
 const snapshot=sessionSnapshot({current:tracks[1],queue:['local',tracks[1].id,'missing','local'],position:72,shuffle:true,repeat:false,volume:.4},lookup);
 assert.deepEqual(snapshot.queue,['local',tracks[1].id]);
 assert.equal(snapshot.tracks[0].url,undefined);assert.equal(snapshot.tracks[0].apiKey,undefined);
 const restored=restoreSession(snapshot,lookup);assert.equal(restored.position,72);assert.equal(restored.volume,.4);assert.equal(restored.shuffle,true);
});
test('Restore handles corrupt, stale and out-of-range session data',()=>{
 assert.equal(restoreSession(null,lookup),null);assert.equal(restoreSession({queue:[],currentId:'missing'},lookup),null);
 const restored=restoreSession({queue:['missing','local','local'],currentId:'local',position:-5,volume:20},lookup);
 assert.deepEqual(restored.queue,['local']);assert.equal(restored.position,0);assert.equal(restored.volume,1);
});
test('Play next moves an existing song after current without duplicates',()=>{
 assert.deepEqual(enqueue(['a','b','c'],'c','a',true),['a','c','b']);
 assert.deepEqual(enqueue(['a','b','c'],'b','a'),['a','c','b']);
 assert.deepEqual(enqueue(['a','b'],'a','a',true),['a','b']);
 assert.deepEqual(enqueue([],'b',null,true),['b']);
});
test('Queue movement preserves entries and rejects invalid positions',()=>{
 assert.deepEqual(moveQueue(['a','b','c'],2,0),['c','a','b']);
 assert.deepEqual(moveQueue(['a','b'],0,2),['a','b']);
 assert.deepEqual(moveQueue(['a','b'],NaN,1),['a','b']);
});
test('Sleep timer uses elapsed wall-clock time including suspended intervals',()=>{
 assert.equal(sleepExpired({deadline:100},99),false);assert.equal(sleepExpired({deadline:100},100),true);
 assert.equal(sleepExpired({deadline:100},10000),true);assert.equal(sleepExpired({endOfTrack:true},10000),false);assert.equal(sleepExpired(null),false);
});
