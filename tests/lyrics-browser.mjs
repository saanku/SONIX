import {chromium} from '@playwright/test';
import {readFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
const browser=await chromium.launch({headless:true,channel:'msedge'});
try{
 const page=await browser.newPage();
 await page.setContent('<div id="app"><button data-action="lyrics">Lyrics</button></div>');
 await page.addStyleTag({content:await readFile('src/lyrics.css','utf8')});
 await page.addScriptTag({content:(await readFile('src/lyrics.js','utf8')).replaceAll('export function','function')});
 await page.evaluate(()=>{
  window.track=null;window.transport=new EventTarget();transport.currentTime=0;transport.duration=180;transport.getAttribute=()=> 'test.mp3';
  window.fetch=async()=>({ok:true,json:async()=>[{trackName:'Test',artistName:'Artist',syncedLyrics:'[00:00]First\n[00:10]Second'}]});
  window.lyrics=createLyrics({audio:transport,getTrack:()=>track});
 });
 await page.click('[data-action="lyrics"]');
 assert.match(await page.locator('.lyrics-body').innerText(),/Play a song/);
 await page.evaluate(()=>{track={id:'one',title:'Test',artist:'Artist'};lyrics.update();});
 await page.waitForSelector('.lyrics-line');
 assert.equal(await page.locator('.lyrics-line.is-active').innerText(),'First');
 await page.locator('.lyrics-line').nth(1).click();
 assert.equal(await page.evaluate(()=>transport.currentTime),10);
 assert.equal(await page.locator('.lyrics-line.is-active').innerText(),'Second');
 await page.evaluate(()=>{fetch=async()=>{throw Error('offline');};track={id:'two',title:'Other',artist:'Artist'};lyrics.update();});
 await page.getByText('Try again',{exact:true}).waitFor();
 await page.keyboard.press('Escape');
 assert.equal(await page.locator('#lyrics-panel').isVisible(),false);
 console.log('Lyrics browser checks passed: empty state, synced lines, seek, track change, failure, close.');
}finally{await browser.close();}
