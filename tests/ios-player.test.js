import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

test('iOS player bridge accepts only its parent and channel and limits commands',()=>{
 const channel='12345678-1234-1234-1234-123456789abc',messages=[],calls=[];
 const parent={postMessage:message=>messages.push(message)};
 let receive,options,tick;
 const context={location:{hash:'#'+channel,origin:'https://saanku.github.io'},parent,
  document:{createElement:()=>({}),head:{append(){}}},
  addEventListener:(_,callback)=>receive=callback,setInterval:callback=>tick=callback,
  YT:{Player:function(id,config){options=config;return {playVideo:()=>calls.push('play'),getPlayerState:()=>1,getCurrentTime:()=>15,getDuration:()=>180,getVideoData:()=>({video_id:'abcdefghijk'})};}}};
 context.window=context;
 vm.runInNewContext(readFileSync('public/ios-player.js','utf8'),context);
 context.onYouTubeIframeAPIReady();
 const command={source:parent,origin:'capacitor://localhost',data:{channel,method:'playVideo',args:[]}};
 receive(command);assert.equal(calls.length,0,'commands wait for player readiness');
 options.events.onReady();assert.equal(messages[0].type,'ready');
 for(const invalid of [{...command,source:{}},{...command,origin:'https://evil.example'},
  {...command,data:{...command.data,channel:'wrong'}},{...command,data:{...command.data,method:'constructor'}},
  {...command,data:{...command.data,args:'invalid'}}])receive(invalid);
 assert.equal(calls.length,0,'untrusted commands are ignored');
 receive(command);assert.equal(calls.length,1);
 receive({...command,origin:'https://localhost'});assert.equal(calls.length,2,'Android WebView can control playback');
 receive({...command,origin:'https://localhost.evil.example'});assert.equal(calls.length,2,'lookalike origins are rejected');
 tick();assert.equal(messages.at(-1).data.id,'abcdefghijk');
 assert.equal(messages.at(-1).data.time,15);
});
