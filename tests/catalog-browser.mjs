import {mockAccount,signIn} from './auth-fixture.mjs';
import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
const browser=await chromium.launch({headless:true,executablePath:process.env.BROWSER_EXECUTABLE||undefined});
try {
 const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[],requests=[];
 page.on('pageerror',e=>errors.push(e.message));
 await mockAccount(page);
 await page.route('**/www.googleapis.com/youtube/v3/**',async route=>{
  const url=new URL(route.request().url());requests.push(url);
  const id=url.searchParams.get('pageToken')?'lmnopqrstuv':'abcdefghijk';
  const item={id,snippet:{title:'Test song',channelTitle:'Test artist'},contentDetails:{duration:'PT3M'},status:{embeddable:true}};
  await route.fulfill({json:url.pathname.endsWith('/search')?{items:[{...item,id:{videoId:id}}],...(url.searchParams.has('pageToken')?{}:{nextPageToken:'second'})}:{items:[{...item,id:url.searchParams.get('id')}]}});
 });
 await page.goto((process.env.SONIX_URL||'http://127.0.0.1:5173/')+'#music');
 await signIn(page);
 await page.getByRole('button',{name:/^(Add|Change) API key$/}).click();
 await page.locator('[name="apiKey"]').fill('test-browser-key');
 await page.getByRole('button',{name:'Connect YouTube',exact:true}).click();
 await page.locator('[data-track="youtube:abcdefghijk"]').first().waitFor();
 await page.getByRole('button',{name:'Next page',exact:true}).click();
 await page.locator('[data-track="youtube:lmnopqrstuv"]').first().waitFor();
 assert.ok(await page.getByRole('button',{name:'Next page',exact:true}).isDisabled());
 await page.getByRole('button',{name:'Previous page',exact:true}).click();
 await page.locator('[data-track="youtube:abcdefghijk"]').first().waitFor();
 await page.locator('[data-like="youtube:abcdefghijk"]').click();
 assert.ok(await page.evaluate(()=>JSON.parse(localStorage.getItem('sonix-library')).favorites.includes('youtube:abcdefghijk')));
 await page.locator('#music-form input').fill('piano');
 await page.locator('#music-form button[type="submit"]').click();
 await page.waitForFunction(()=>document.querySelector('.catalog-status')?.textContent==='');
 assert.ok(requests.some(u=>u.searchParams.get('q')==='piano'));
 await page.setViewportSize({width:390,height:844});
 assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
 assert.deepEqual(errors,[]);
 console.log('YouTube catalog browser checks passed');
} finally {await browser.close();}
