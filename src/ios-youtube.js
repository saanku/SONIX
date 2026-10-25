import {websiteURL} from './platform';

// A hosted player supplies the HTTPS referrer required by YouTube. The app
// stays bundled locally; only this visible player frame uses the hosted page.
export function createIOSYouTubePlayer(events){
 const frame=document.createElement('iframe');
 const channel=crypto.randomUUID();
 const url=new URL('ios-player.html',websiteURL);url.hash=channel;
 frame.id='youtube-player';frame.title='YouTube player';frame.src=url.href;
 frame.allow='autoplay; encrypted-media; fullscreen; picture-in-picture';
 frame.allowFullscreen=true;frame.referrerPolicy='strict-origin-when-cross-origin';
 frame.style.cssText='width:100%;height:100%;border:0';
 let snapshot={state:-1,time:0,duration:0,id:''},ready=false;
 const pending=[];
 function send(method,args=[]){
  if(!ready){pending.push([method,args]);return;}
  frame.contentWindow.postMessage({channel,method,args},url.origin);
 }
 const player={
  getPlayerState:()=>snapshot.state,getCurrentTime:()=>snapshot.time,
  getDuration:()=>snapshot.duration,getVideoData:()=>({video_id:snapshot.id}),
  setVolume:value=>send('setVolume',[value]),mute:()=>send('mute'),unMute:()=>send('unMute'),
  seekTo:(value,ahead)=>send('seekTo',[value,ahead]),playVideo:()=>send('playVideo'),
  pauseVideo:()=>send('pauseVideo'),stopVideo:()=>send('stopVideo'),
  loadVideoById:value=>send('loadVideoById',[value])
 };
 window.addEventListener('message',event=>{
  if(event.source!==frame.contentWindow||event.origin!==url.origin||event.data?.channel!==channel)return;
  const {type,data}=event.data;
  if(type==='ready'&&!ready){ready=true;for(const [method,args]of pending.splice(0))send(method,args);events.onReady({target:player});}
  if(type==='snapshot'&&data){snapshot=data;}
  if(type==='state'){snapshot.state=data;events.onStateChange({data,target:player});}
  if(type==='error')events.onError({data,target:player});
  if(type==='blocked')events.onAutoplayBlocked();
 });
 document.querySelector('#youtube-player').replaceWith(frame);
 return player;
}
