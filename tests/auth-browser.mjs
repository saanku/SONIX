import {chromium,expect} from '@playwright/test';
import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
import {mockAccount,signIn,firstUser,secondUser} from './auth-fixture.mjs';
const browser=await chromium.launch({headless:true,executablePath:process.env.BROWSER_EXECUTABLE||undefined});
try{
 const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[],youtube=[];
 const mock=await mockAccount(page);page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/www.googleapis.com/youtube/v3/**',async route=>{youtube.push(1);await route.fulfill({json:{items:[]}});});
 await page.goto(process.env.SONIX_URL||'http://127.0.0.1:5173/');
 await page.locator('#entry-form [type="submit"]:enabled').waitFor();
 assert.equal(await page.locator('#app').isVisible(),false);assert.equal(youtube.length,0);
 await mkdir('test-results',{recursive:true});
 await page.screenshot({path:'test-results/login-desktop.png',fullPage:true});
 for(const width of [320,390,430,768]){
  await page.setViewportSize({width,height:844});
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`Login fits ${width}px`);
 }
 await page.setViewportSize({width:390,height:844});await page.screenshot({path:'test-results/login-mobile.png',fullPage:true});
 await page.locator('.auth-tabs [data-auth-mode="signup"]').click();
 await page.locator('#entry-name').fill('First Listener');await page.locator('#entry-email').fill('first@example.com');
 await page.locator('#entry-password').fill('test-password-123');await page.locator('#entry-confirm').fill('mismatch');
 await page.locator('#entry-form [type="submit"]').click();
 assert.match(await page.locator('#entry-message').textContent(),/do not match/);assert.equal(mock.requests.length,0);
 await page.locator('#entry-confirm').fill('test-password-123');
 await page.screenshot({path:'test-results/signup-mobile.png',fullPage:true});
 await page.locator('#entry-form [type="submit"]').click();
 await page.waitForFunction(()=>document.querySelector('#entry-message').textContent.includes('Check your email'));
 assert.equal(await page.locator('#app').isVisible(),false);
 await page.locator('#entry-password').fill('wrong-password');await page.locator('#entry-form [type="submit"]').click();
 await page.waitForFunction(()=>document.querySelector('#entry-message').classList.contains('error'));
 assert.equal(await page.locator('#app').isVisible(),false);
 await signIn(page);
 await page.setViewportSize({width:1440,height:1000});
 await page.getByRole('button',{name:'Play the mix',exact:true}).click();
 await page.waitForFunction(()=>document.querySelector('#elapsed').textContent!=='0:00');
 await page.getByRole('button',{name:'Like current song',exact:true}).click();
 await expect.poll(()=>mock.libraries.get(firstUser)?.favorites.includes('night-drive')).toBe(true);
 await page.locator('.new-playlist').click();await page.locator('#playlist-form input').fill('My saved songs');await page.locator('#playlist-form [type="submit"]').click();
 await expect.poll(()=>mock.libraries.get(firstUser)?.playlists[0]?.name).toBe('My saved songs');
 await page.reload();await page.locator('#app').waitFor({state:'visible'});
 assert.equal(await page.locator('#auth-root').isVisible(),false);
 assert.equal(await page.locator('#main h1').textContent(),'My saved songs');
 await page.locator('.top-actions [data-action="account"]').click();await page.getByRole('button',{name:'Sign out',exact:true}).click();
 await page.locator('#auth-root').waitFor({state:'visible'});assert.equal(await page.locator('#app').isVisible(),false);
 await signIn(page,'second@example.com');
 assert.deepEqual(mock.libraries.get(secondUser).favorites,[]);assert.deepEqual(mock.libraries.get(secondUser).playlists,[]);
 assert.equal(await page.locator('#player-title').textContent(),'Your next favorite awaits');
 await page.locator('.main-nav [data-view="home"]').click();
 for(const width of [320,360,390,430,768]){
  await page.setViewportSize({width,height:844});
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`App fits ${width}px`);
 }
 await page.setViewportSize({width:390,height:844});await page.screenshot({path:'test-results/signed-in-mobile.png',fullPage:true});
 assert.deepEqual(errors,[]);
 console.log('Auth checks passed: responsive login/signup, confirmation, errors, persistent session, cloud saves, logout and account isolation.');
}finally{await browser.close();}
