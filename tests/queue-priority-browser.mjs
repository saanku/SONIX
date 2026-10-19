import {mockAccount,signIn} from './auth-fixture.mjs';
import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
const browser=await chromium.launch({headless:true,executablePath:process.env.BROWSER_EXECUTABLE||undefined});
try {
 const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 await mockAccount(page);
 await page.clock.install();
 await page.addInitScript(()=>{
  sessionStorage.setItem('sonix-youtube-api-key','test-key');
  window.YT={Player:class {
   constructor(id,options){this.options=options;this.state=2;this.id='';this.time=0;window.testPlayer=this;const frame=document.createElement('iframe');frame.id=id;frame.title='Test YouTube player';document.getElementById(id).replaceWith(frame);setTimeout(()=>options.events.onReady(),50);}
   getPlayerState(){return this.state;} getCurrentTime(){return this.time;} getDuration(){return 180;} getVideoData(){return {video_id:this.id};}
   setVolume(){} mute(){} unMute(){}
   stateChange(state){this.state=state;this.options.events.onStateChange({data:state});}
   loadVideoById(value){this.id=value.videoId;this.time=value.startSeconds;this.stateChange(1);}
   playVideo(){this.stateChange(1);} pauseVideo(){this.stateChange(2);} stopVideo(){this.stateChange(2);} seekTo(time){this.time=time;}
  }};
 });
 const ids=['abcdefghijk','lmnopqrstuv','12345678901'];
 await page.route('**/www.googleapis.com/youtube/v3/**',async route=>{
  const url=new URL(route.request().url());
  const items=ids.map((id,i)=>({id:url.pathname.endsWith('/search')?{videoId:id}:id,snippet:{title:`Song ${i+1}`,channelTitle:'Test artist'},contentDetails:{duration:'PT3M'},status:{embeddable:true}}));
  await route.fulfill({json:{items}});
 });
 const base=process.env.SONIX_URL||'http://127.0.0.1:5173/';

 await page.goto(base+'#music');await signIn(page);
 await page.locator('[data-track="youtube:abcdefghijk"]').first().click();await page.waitForFunction(()=>window.testPlayer?.state===1);
 await page.locator('#shuffle').click();
 await page.getByRole('button',{name:'Queue options for Song 3',exact:true}).click();await page.getByRole('button',{name:'Add to queue',exact:true}).click();
 await page.evaluate(()=>window.testPlayer.stateChange(0));await page.waitForFunction(()=>window.testPlayer.id==='12345678901'&&window.testPlayer.state===1);
 await page.evaluate(()=>window.testPlayer.stateChange(0));await page.waitForFunction(()=>window.testPlayer.id==='lmnopqrstuv'&&window.testPlayer.state===1);
 await page.evaluate(()=>window.testPlayer.stateChange(0));await page.waitForFunction(()=>document.querySelector('#toast').textContent.includes('No new similar songs'));
 assert.equal(await page.evaluate(()=>window.testPlayer.id),'lmnopqrstuv');assert.deepEqual(errors,[]);
 console.log('Explicit queue priority with shuffle and no played-track loop passed.');
}finally{await browser.close();}
