(() => {
 const channel=location.hash.slice(1);
 if(!/^[a-f0-9-]{36}$/.test(channel)||window.parent===window)return;
 let player,ready=false;
 const send=(type,data)=>parent.postMessage({channel,type,data},'*');
 const methods=new Set(['setVolume','mute','unMute','seekTo','playVideo','pauseVideo','stopVideo','loadVideoById']);
 addEventListener('message',event=>{
  // Only the containing native WebView can control this particular player.
  if(event.source!==parent||!['capacitor://localhost','https://localhost','null'].includes(event.origin)||event.data?.channel!==channel||!ready)return;
  const {method,args}=event.data;
  if(!methods.has(method)||!Array.isArray(args)||args.length>2)return;
  player[method](...args);
 });
 window.onYouTubeIframeAPIReady=()=>{
  player=new YT.Player('player',{width:'100%',height:'100%',playerVars:{playsinline:1,controls:1,origin:location.origin,widget_referrer:'https://io.github.saanku.sonix'},events:{
   onReady:()=>{ready=true;send('ready');},
   onStateChange:event=>send('state',event.data),
   onError:event=>send('error',event.data),onAutoplayBlocked:()=>send('blocked')
  }});
 };
 const script=document.createElement('script');script.src='https://www.youtube.com/iframe_api';script.onerror=()=>send('error',-1);document.head.append(script);
 setInterval(()=>{if(ready)send('snapshot',{state:player.getPlayerState(),time:player.getCurrentTime(),duration:player.getDuration(),id:player.getVideoData()?.video_id||''});},500);
})();
