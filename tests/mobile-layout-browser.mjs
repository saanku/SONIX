import {chromium,expect} from '@playwright/test';
import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
import {mockAccount,signIn} from './auth-fixture.mjs';
const browser=await chromium.launch({headless:true,channel:process.env.BROWSER_EXECUTABLE?undefined:'msedge',executablePath:process.env.BROWSER_EXECUTABLE||undefined});
try{
 const page=await browser.newPage({viewport:{width:390,height:844}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await mockAccount(page);await page.addInitScript(()=>{
  sessionStorage.setItem('sonix-youtube-api-key','test-key');localStorage.setItem('sonix-theme','dark');
  window.YT={Player:class{constructor(id,options){this.options=options;this.state=2;this.id='';this.time=0;setTimeout(()=>options.events.onReady(),10);}getPlayerState(){return this.state;}getCurrentTime(){return this.time;}getDuration(){return 180;}getVideoData(){return {video_id:this.id};}setVolume(){}mute(){}unMute(){}change(s){this.state=s;this.options.events.onStateChange({data:s});}loadVideoById(v){this.id=v.videoId;this.time=v.startSeconds;this.change(1);}playVideo(){this.change(1);}pauseVideo(){this.change(2);}stopVideo(){this.change(2);}seekTo(t){this.time=t;}}};
 });
 await page.route('**/www.googleapis.com/youtube/v3/**',route=>{const search=new URL(route.request().url()).pathname.endsWith('/search');return route.fulfill({json:{items:['abcdefghijk','lmnopqrstuv','12345678901'].map((id,i)=>({id:search?{videoId:id}:id,snippet:{title:['A beautiful song with a very long name','Evening lights','Your next favorite'][i],channelTitle:'An artist with a long name'},contentDetails:{duration:'PT3M'},status:{embeddable:true}}))}});});
 await page.route('**/lrclib.net/**',route=>route.fulfill({json:[]}));
 await page.goto(process.env.SONIX_URL||'http://127.0.0.1:5173/');await signIn(page);
 await mkdir('test-results',{recursive:true});
 for(const width of [320,360,390,430,680]){
  await page.setViewportSize({width,height:844});
  for(const view of ['home','search','library']){
   await page.locator(`.mobile-nav [data-view="${view}"]`).click();
   assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`${view} fits ${width}px`);
   const player=await page.locator('.player').boundingBox(),nav=await page.locator('.mobile-nav').boundingBox();
   assert.ok(player.x>=0&&player.x+player.width<=width&&player.y+player.height<=nav.y,`Player fits above nav at ${width}`);
   const buttons=await page.locator('.top-actions button:visible').evaluateAll(nodes=>nodes.map(n=>{const r=n.getBoundingClientRect();return {x:r.x,right:r.right};}));
   assert.ok(buttons.every((b,i)=>b.x>=0&&b.right<=width&&(!i||b.x>=buttons[i-1].right)),`Header controls align at ${width}`);
  }
 }
 await page.setViewportSize({width:390,height:844});await page.locator('.mobile-nav [data-view="home"]').click();
 await page.screenshot({path:'test-results/mobile-home.png'});
 await page.locator('[data-music-track]').first().click();await expect(page.locator('#play-toggle')).toHaveAttribute('aria-label','Pause');
 await page.locator('[data-action="close-video"]').click();await page.locator('.mobile-player-lyrics').click();await expect(page.locator('#lyrics-panel')).toBeVisible();
 await page.getByRole('button',{name:'Close lyrics',exact:true}).click();
 await page.getByRole('button',{name:'More player options'}).click();await page.getByRole('button',{name:'Your queue',exact:true}).click();await expect(page.locator('#queue-panel')).toBeVisible();
 await page.getByRole('button',{name:'Close queue',exact:true}).click();
 await page.locator('.mobile-nav [data-view="search"]').click();await page.locator('#music-form input').fill('Evening');await page.locator('#music-form [type="submit"]').click();
 await page.locator('.track-row').first().waitFor();await page.screenshot({path:'test-results/mobile-search.png'});
 await page.locator('.track-menu').first().click();await expect(page.getByRole('button',{name:'Add to playlist',exact:true})).toBeVisible();await page.locator('.dialog-close').click();
 await page.locator('.top-actions .theme-toggle').click();await page.screenshot({path:'test-results/mobile-light.png'});
 await page.setViewportSize({width:1440,height:1000});await expect(page.locator('.sidebar')).toBeVisible();await expect(page.locator('.mobile-tools-toggle')).toBeHidden();
 assert.deepEqual(errors,[]);console.log('Mobile layout checks passed: 320–680px, navigation, player controls, search, song menu, themes, and desktop visibility.');
}finally{await browser.close();}
