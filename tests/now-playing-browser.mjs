import {chromium,expect} from '@playwright/test';
import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
import {mockAccount,signIn} from './auth-fixture.mjs';
const browser=await chromium.launch({headless:true,channel:'msedge'});
try{
 const page=await browser.newPage({viewport:{width:390,height:844}}),errors=[];page.on('pageerror',e=>errors.push(e.message));await mockAccount(page);
 await page.addInitScript(()=>{
  sessionStorage.setItem('sonix-youtube-api-key','test-key');localStorage.setItem('sonix-theme','dark');window.playerCreations=0;
  window.YT={Player:class{
   constructor(id,options){this.options=options;this.state=2;this.id='';this.time=0;window.testPlayer=this;window.playerCreations++;const frame=document.createElement('iframe');frame.id=id;frame.title='Test video';document.getElementById(id).replaceWith(frame);window.originalFrame=frame;setTimeout(()=>options.events.onReady(),10);}
   getPlayerState(){return this.state;}getCurrentTime(){return this.time;}getDuration(){return 180;}getVideoData(){return {video_id:this.id};}setVolume(){}mute(){}unMute(){}
   change(s){this.state=s;this.options.events.onStateChange({data:s});}loadVideoById(v){this.id=v.videoId;this.time=v.startSeconds;this.change(1);}playVideo(){this.change(1);}pauseVideo(){this.change(2);}stopVideo(){this.change(2);}seekTo(t){this.time=t;}
  }};
 });
 await page.route('**/www.googleapis.com/youtube/v3/**',route=>{const search=new URL(route.request().url()).pathname.endsWith('/search');return route.fulfill({json:{items:['abcdefghijk','lmnopqrstuv'].map((id,i)=>({id:search?{videoId:id}:id,snippet:{title:`Evening song ${i+1}`,channelTitle:'Test artist'},contentDetails:{duration:'PT3M'},status:{embeddable:true}}))}});});
 await page.route('**/fonts.googleapis.com/**',route=>route.abort());
 await page.goto((process.env.SONIX_URL||'http://127.0.0.1:5173/')+'#music',{waitUntil:'domcontentloaded',timeout:60000});await signIn(page);await page.locator('.track-info[data-track="youtube:abcdefghijk"]').first().click();await page.waitForFunction(()=>testPlayer.state===1);
 await page.locator('#seek').fill('35');await page.locator('#seek').dispatchEvent('input');
 await page.locator('.now-art').click();await expect(page.locator('#now-playing-sheet')).toBeVisible();
 assert.ok(Math.abs(await page.evaluate(()=>testPlayer.time)-63)<.01);assert.equal(await page.evaluate(()=>testPlayer.state),1);
 await expect(page.locator('#now-playing-sheet h2')).toHaveText('Evening song 1');
 for(const width of [320,390,1440]){
  await page.setViewportSize({width,height:844});
  await expect.poll(async()=>{const frame=await page.locator('#youtube-player').boundingBox();return frame.width>=200&&frame.height>=200&&frame.x>=0&&frame.x+frame.width<=width;}).toBe(true);
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
 }
 await page.setViewportSize({width:390,height:844});await mkdir('test-results',{recursive:true});await page.screenshot({path:'test-results/expanded-player.png'});
 await page.locator('.np-progress input').fill('50');await page.locator('.np-progress input').dispatchEvent('input');assert.equal(await page.evaluate(()=>testPlayer.time),90);
 await page.getByRole('button',{name:'Minimize player',exact:true}).click();await expect(page.locator('#now-playing-sheet')).toBeHidden();
 assert.equal(await page.evaluate(()=>testPlayer.state),1);assert.equal(await page.evaluate(()=>testPlayer.time),90);assert.equal(await page.evaluate(()=>originalFrame===document.querySelector('#youtube-player')&&playerCreations===1),true);
 await page.locator('.now-meta').click();await page.keyboard.press('Escape');await expect(page.locator('#now-playing-sheet')).toBeHidden();assert.equal(await page.locator('.player').evaluate(el=>el.inert),false);
 await page.getByRole('button',{name:'Expand video player'}).click();await page.locator('[data-np="toggle"]').click();assert.equal(await page.evaluate(()=>testPlayer.state),2);await page.locator('[data-np="toggle"]').click();assert.equal(await page.evaluate(()=>testPlayer.state),1);
 await page.locator('[data-np="next"]').click();await expect(page.locator('#now-playing-sheet h2')).toHaveText('Evening song 2');
 await page.locator('[data-np="queue"]').click();await expect(page.locator('#queue-panel')).toBeVisible();await expect(page.locator('#now-playing-sheet')).toBeHidden();
 assert.deepEqual(errors,[]);console.log('Expanded player checks passed: same iframe, uninterrupted expand/collapse, mobile/desktop sizing, seek, pause, next, Escape, queue and focus restoration.');
}finally{await browser.close();}
