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
 const searches=[];page.on('request',r=>{if(r.url().includes('/youtube/v3/search'))searches.push(new URL(r.url()));});
 await page.goto(base+'#music');await signIn(page);
 const root=page.locator('#language-discovery');await root.getByRole('button',{name:'Play trending now',exact:true}).waitFor();
 await page.waitForFunction(()=>!document.querySelector('#language-discovery [role=status]').textContent);
 for(const [name,code] of [['English','en'],['Hindi','hi'],['Tamil','ta'],['Malayalam','ml']]){
  await root.getByRole('button',{name,exact:true}).click();
  await page.waitForFunction(()=>!document.querySelector('#language-discovery [role=status]').textContent);
  assert.ok(searches.some(u=>u.searchParams.get('relevanceLanguage')===code&&u.searchParams.get('order')==='viewCount'&&u.searchParams.has('publishedAfter')));
 }
 await root.getByRole('button',{name:'Play artist mix',exact:true}).click();await page.waitForFunction(()=>window.testPlayer?.state===1);
 await page.getByRole('button',{name:'Open queue',exact:true}).click();assert.equal(await page.locator('.queue-track').count(),3);
 await page.getByRole('button',{name:'Close queue',exact:true}).click();
 const before=searches.length;await page.clock.fastForward(3660000);
 await page.waitForFunction(()=>!document.querySelector('#language-discovery [role=status]').textContent);
 assert.ok(searches.length>before);
 await page.setViewportSize({width:320,height:740});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
 await mkdir('test-results',{recursive:true});await page.getByRole('button',{name:'Pause and hide video',exact:true}).click();await root.scrollIntoViewIfNeeded();await page.screenshot({path:'test-results/discovery-mobile.png'});
 assert.deepEqual(errors,[]);console.log('Language playlists passed: four languages, recent popular filters, artist queue, hourly refresh, mobile layout.');
}finally{await browser.close();}
