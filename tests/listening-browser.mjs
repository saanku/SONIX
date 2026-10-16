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
 await page.goto(base+'#music');
 await signIn(page);
 await page.locator('[data-track="youtube:abcdefghijk"]').first().click();
 await page.waitForFunction(()=>window.testPlayer?.state===1);
 assert.equal(await page.locator('#youtube-panel').isVisible(),true);
 const frame=await page.locator('#youtube-player').boundingBox();assert.ok(frame.width>=200&&frame.height>=200&&frame.width<=320);
 const initialHandle=await page.locator('#video-drag').boundingBox();
 await page.mouse.move(initialHandle.x+20,initialHandle.y+15);await page.mouse.down();await page.mouse.move(330,125,{steps:5});await page.mouse.up();
 // Play next, reorder, remove, then select from the edited queue.
 await page.getByRole('button',{name:'Queue options for Song 3',exact:true}).click();
 await page.getByRole('button',{name:'Play next',exact:true}).click();
 await page.getByRole('button',{name:'Open queue',exact:true}).click();
 const queueIds=()=>page.locator('.queue-track').evaluateAll(nodes=>nodes.map(n=>n.dataset.track));
 assert.deepEqual(await queueIds(),[ids[0],ids[2],ids[1]].map(id=>'youtube:'+id));
 await page.getByRole('button',{name:'Move Song 2 up',exact:true}).click();
 assert.deepEqual(await queueIds(),ids.map(id=>'youtube:'+id));
 await page.locator('[data-queue-index="2"]').dragTo(page.locator('[data-queue-index="1"]'));
 assert.deepEqual(await queueIds(),[ids[0],ids[2],ids[1]].map(id=>'youtube:'+id));
 await page.getByRole('button',{name:'Remove Song 3 from queue',exact:true}).click();
 await page.locator('.queue-track[data-track="youtube:lmnopqrstuv"]').click();
 await page.waitForFunction(()=>window.testPlayer.id==='lmnopqrstuv');
 assert.equal((await queueIds()).length,2);
 await page.getByRole('button',{name:'Close queue',exact:true}).click();
 await page.locator('#seek').fill('40');await page.locator('#seek').dispatchEvent('input');
 await page.locator('#play-toggle').click();
 assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('sonix-session-11111111-1111-4111-8111-111111111111')).position),72);
 // Reload restores position and queue without starting playback.
 await page.goto(base+'#home');await page.reload();
 await page.locator('.continue-card').waitFor();
 assert.equal(await page.locator('#play-toggle').getAttribute('aria-label'),'Play');
 assert.equal(await page.locator('#resume-time').textContent(),'1:12');
 await page.getByRole('button',{name:'Resume',exact:true}).click();
 await page.waitForFunction(()=>window.testPlayer?.state===1);
 assert.equal(await page.evaluate(()=>window.testPlayer.time),72);
 // Drag, keyboard move, pause/hide, resume, and viewport clamping.
 let before=await page.locator('#youtube-panel').boundingBox();
 const handle=await page.locator('#video-drag').boundingBox();
 await page.mouse.move(handle.x+30,handle.y+15);await page.mouse.down();await page.mouse.move(handle.x-100,handle.y-100,{steps:5});await page.mouse.up();
 let after=await page.locator('#youtube-panel').boundingBox();assert.ok(after.x<before.x&&after.y<before.y);
 await page.locator('#video-drag').focus();await page.keyboard.press('ArrowLeft');
 assert.ok((await page.locator('#youtube-panel').boundingBox()).x<after.x);
 await page.getByRole('button',{name:'Pause and hide video',exact:true}).click();
 assert.equal(await page.locator('#youtube-panel').isVisible(),false);assert.equal(await page.evaluate(()=>window.testPlayer.state),2);
 await page.locator('#play-toggle').click();await page.waitForFunction(()=>window.testPlayer.state===1);
 await page.setViewportSize({width:390,height:844});
 after=await page.locator('#youtube-panel').boundingBox();assert.ok(after.x>=0&&after.x+after.width<=390&&after.y>=0&&after.y+after.height<712);
 assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
 await page.getByRole('button',{name:'Reset video position',exact:true}).click();
 // Custom timer expires even if the browser skips timer ticks; it can be cancelled.
 await page.getByRole('button',{name:'Sleep timer',exact:true}).click();
 await page.locator('#sleep-form input').fill('1');await page.getByRole('button',{name:'Set timer',exact:true}).click();
 await page.clock.fastForward(61000);
 assert.equal(await page.evaluate(()=>window.testPlayer.state),2);
 assert.equal(await page.locator('#sleep-label').textContent(),'Sleep');
 await page.getByRole('button',{name:'Sleep timer',exact:true}).click();await page.getByRole('button',{name:'15 min',exact:true}).click();
 await page.getByRole('button',{name:'Sleep timer',exact:true}).click();await page.getByRole('button',{name:'Cancel timer',exact:true}).click();
 assert.equal(await page.evaluate(()=>localStorage.getItem('sonix-sleep-11111111-1111-4111-8111-111111111111')),null);
 await page.locator('#play-toggle').click();await page.getByRole('button',{name:'Sleep timer',exact:true}).click();
 await page.getByRole('button',{name:'At end of this song',exact:true}).click();
 await page.evaluate(()=>window.testPlayer.stateChange(0));assert.equal(await page.evaluate(()=>window.testPlayer.state),2);
 assert.equal(await page.locator('#player-title').textContent(),'Song 2');
 // A seek back to the beginning replaces the previously saved position.
 await page.locator('#seek').fill('0');await page.locator('#seek').dispatchEvent('input');
 await page.evaluate(()=>document.dispatchEvent(new Event('visibilitychange')));
 assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('sonix-session-11111111-1111-4111-8111-111111111111')).position),0);
 await page.getByRole('button',{name:'Open queue',exact:true}).click();await page.getByRole('button',{name:'Clear other songs',exact:true}).click();
 assert.deepEqual(await queueIds(),['youtube:lmnopqrstuv']);
 await page.getByRole('button',{name:'Close queue',exact:true}).click();
 await mkdir('test-results',{recursive:true});await page.screenshot({path:'test-results/listening-mobile.png',fullPage:true});
 assert.deepEqual(errors,[]);
 console.log('Listening browser checks passed: resume, editable queue, draggable player, mobile layout, sleep expiry/cancellation/end-of-song.');
} finally {await browser.close();}
