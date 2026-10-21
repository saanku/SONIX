import {chromium,expect} from '@playwright/test';
import assert from 'node:assert/strict';
import {mockAccount,signIn,firstUser} from './auth-fixture.mjs';
const browser=await chromium.launch({headless:true,channel:process.env.BROWSER_EXECUTABLE?undefined:'msedge',executablePath:process.env.BROWSER_EXECUTABLE||undefined});
const libraries=new Map(),errors=[];
const base=process.env.SONIX_URL||'http://127.0.0.1:5173/';
async function device(mobile=false){
 const page=await browser.newPage({viewport:mobile?{width:390,height:844}:{width:1440,height:1000}});
 page.on('pageerror',e=>errors.push(e.message));await mockAccount(page,{libraries});
 await page.addInitScript(()=>{
  sessionStorage.setItem('sonix-youtube-api-key','test-key');
  window.YT={Player:class {
   constructor(id,options){this.options=options;this.state=2;this.id='';this.time=0;window.testPlayer=this;setTimeout(()=>options.events.onReady(),10);}
   getPlayerState(){return this.state;}getCurrentTime(){return this.time;}getDuration(){return 180;}getVideoData(){return {video_id:this.id};}
   setVolume(){}mute(){}unMute(){}
   change(state){this.state=state;this.options.events.onStateChange({data:state});}
   loadVideoById(v){this.id=v.videoId;this.time=v.startSeconds;this.change(1);}playVideo(){this.change(1);}pauseVideo(){this.change(2);}stopVideo(){this.change(2);}seekTo(t){this.time=t;}
  }};
 });
 await page.route('**/www.googleapis.com/youtube/v3/**',route=>{
  const search=new URL(route.request().url()).pathname.endsWith('/search');
  return route.fulfill({json:{items:['abcdefghijk','lmnopqrstuv'].map((id,i)=>({id:search?{videoId:id}:id,snippet:{title:`Song ${i+1}`,channelTitle:'Test artist'},contentDetails:{duration:'PT3M'},status:{embeddable:true}}))}});
 });
 await page.goto(base+'#music');return page;
}
try{
 const phone=await device(true);await signIn(phone);
 await phone.locator('[data-track="youtube:abcdefghijk"]').first().click();await phone.waitForFunction(()=>window.testPlayer?.state===1);
 await phone.locator('#seek').fill('40');await phone.locator('#seek').dispatchEvent('input');await phone.locator('#play-toggle').click();
 await expect.poll(()=>libraries.get(firstUser)?.playback?.position).toBe(72);
 const pc=await device();await signIn(pc);
 await expect(pc.locator('#player-title')).toHaveText('Song 1');await expect(pc.locator('#elapsed')).toHaveText('1:12');
 assert.equal(await pc.locator('#play-toggle').getAttribute('aria-label'),'Play');
 await pc.locator('#play-toggle').click();await pc.waitForFunction(()=>window.testPlayer?.state===1);
 assert.equal(await pc.evaluate(()=>testPlayer.time),72);
 // A new song on PC appears on the open phone, including its paused checkpoint.
 await pc.locator('[data-track="youtube:lmnopqrstuv"]').first().click();await pc.waitForFunction(()=>testPlayer.id==='lmnopqrstuv'&&testPlayer.state===1);
 await pc.locator('#seek').fill('50');await pc.locator('#seek').dispatchEvent('input');await pc.locator('#play-toggle').click();
 await expect.poll(()=>libraries.get(firstUser)?.playback?.position).toBe(90);
 await expect(phone.locator('#player-title')).toHaveText('Song 2',{timeout:15000});await expect(phone.locator('#elapsed')).toHaveText('1:30',{timeout:15000});
 // Resuming on phone takes over, and then resuming on PC stops the phone.
 await phone.locator('#play-toggle').click();await phone.waitForFunction(()=>testPlayer.state===1);assert.equal(await phone.evaluate(()=>testPlayer.time),90);
 await expect.poll(()=>libraries.get(firstUser)?.playback?.paused).toBe(false);
 await pc.locator('#play-toggle').click();await pc.waitForFunction(()=>testPlayer.state===1);
 await phone.waitForFunction(()=>testPlayer.state===2,{},{timeout:15000});
 const stranger=await device();await signIn(stranger,'second@example.com');await expect(stranger.locator('#player-title')).toHaveText('Your next favorite awaits');
 await pc.locator('#play-toggle').click();await expect.poll(()=>libraries.get(firstUser)?.playback?.paused).toBe(true);
 await pc.reload();await pc.locator('#app').waitFor({state:'visible'});await expect(pc.locator('#elapsed')).toHaveText('1:30');
 assert.deepEqual(errors,[]);
 console.log('Cross-device browser checks passed: cloud restore, pause position, track changes, takeover, reload, and account isolation.');
}finally{await browser.close();}
