// Shared transport for local audio and a visible YouTube embed.
export function createPlayback(onError) {
  const local=new Audio(),events=new EventTarget();
  let player,ready,videoId='',generation=0,volume=.7,muted=false;
  local.preload='metadata';
  for(const type of ['play','pause','ended','timeupdate','error'])local.addEventListener(type,()=>{if(!videoId)events.dispatchEvent(new Event(type));});
  function emit(type){events.dispatchEvent(new Event(type));}
  async function youtube(){
    if(ready)return ready;
    ready=new Promise((resolve,reject)=>{
      const timer=setTimeout(()=>{ready=null;reject(Error('YouTube player could not load. Check your connection and try again.'));},25000);
      const setup=()=>{
        player=new window.YT.Player('youtube-player',{width:'480',height:'270',playerVars:{playsinline:1,origin:location.origin},events:{
          onReady:()=>{clearTimeout(timer);resolve(player);},
          onStateChange:e=>{if(videoId){if(e.data===1&&document.querySelector('#youtube-panel').hidden){player.pauseVideo();return;}emit('timeupdate');if(e.data===1)emit('play');if(e.data===2)emit('pause');if(e.data===0)emit('ended');}},
          onError:()=>{if(videoId){onError('This video cannot play here. Use its YouTube link or choose another video.');emit('pause');}},
          onAutoplayBlocked:()=>onError('Press Play in the YouTube player to start this video.')
        }});
      };
      if(window.YT?.Player)setup();
      else{window.onYouTubeIframeAPIReady=setup;const script=document.createElement('script');script.src='https://www.youtube.com/iframe_api';script.onerror=()=>{clearTimeout(timer);ready=null;reject(Error('Could not load the YouTube player.'));};document.head.append(script);}
    });
    return ready;
  }
  setInterval(()=>{if(videoId&&player?.getCurrentTime)emit('timeupdate');},500);
  return {
    addEventListener:(...args)=>events.addEventListener(...args),
    get paused(){return videoId?document.querySelector('#youtube-panel')?.hidden||player?.getPlayerState?.()!==1:local.paused;},
    get currentTime(){return videoId?(player?.getVideoData?.().video_id===videoId?player?.getCurrentTime?.()||0:0):local.currentTime;},
    set currentTime(value){if(videoId)player?.seekTo?.(value,true);else local.currentTime=value;},
    get duration(){return videoId?(player?.getVideoData?.().video_id===videoId?player?.getDuration?.()||0:0):local.duration;},
    get volume(){return volume;},
    set volume(value){volume=value;local.volume=value;player?.setVolume?.(value*100);},
    get muted(){return muted;},
    set muted(value){muted=value;local.muted=value;if(value)player?.mute?.();else player?.unMute?.();},
    set src(value){if(value.startsWith('youtube:'))videoId=value.slice(8);else{videoId='';local.src=value;}},
    getAttribute(name){return name==='src'&&videoId?'youtube:'+videoId:local.getAttribute(name);},
    removeAttribute(name){generation++;videoId='';local.removeAttribute(name);player?.stopVideo?.();const panel=document.querySelector('#youtube-panel');if(panel)panel.hidden=true;},
    load(){local.load();},
    pause(){generation++;if(videoId)player?.pauseVideo?.();else local.pause();},
    async play(startAt=0){
      if(!videoId){
        const version=generation;
        if(startAt>0){const seek=()=>{if(version===generation)local.currentTime=Math.min(startAt,Number.isFinite(local.duration)?Math.max(0,local.duration-.1):startAt);};if(local.readyState>=1)seek();else local.addEventListener('loadedmetadata',seek,{once:true});}
        return local.play();
      }
      const id=videoId,version=generation,panel=document.querySelector('#youtube-panel');panel.hidden=false;
      const yt=await youtube();if(version!==generation||id!==videoId)return;
      yt.setVolume(volume*100);if(muted)yt.mute();else yt.unMute();
      if(yt.getVideoData?.().video_id===id){if(startAt>0)yt.seekTo(startAt,true);yt.playVideo();}else yt.loadVideoById({videoId:id,startSeconds:startAt});
    }
  };
}
