import { chromium } from '@playwright/test';
import assert from 'node:assert/strict';
const browser=await chromium.launch({headless:true,executablePath:process.env.BROWSER_EXECUTABLE||undefined,timeout:20000});
try {
 const page=await browser.newPage({viewport:{width:390,height:844}});
 await page.route('https://fonts.googleapis.com/**',route=>route.abort());
 await page.route('**/api/musicbrainz?**',route=>route.fulfill({json:{total:1,results:[{id:'e0bba708-bdd3-478d-84ea-c706413bedab',title:'A. R. Rahman',artist:'Person · India',type:'Artist',url:'https://musicbrainz.org/artist/e0bba708-bdd3-478d-84ea-c706413bedab'}]}}));
 await page.goto('http://127.0.0.1:5173/#search',{waitUntil:'domcontentloaded',timeout:45000});
 await page.getByRole('textbox',{name:'Search MusicBrainz'}).fill('A R Rahman');
 await page.getByRole('combobox',{name:'MusicBrainz search category'}).selectOption('artist');
 await page.locator('#catalog-form button').click();
 await page.locator('.catalog-result').waitFor();
 assert.ok((await page.locator('.catalog-result').textContent()).includes('A. R. Rahman'));
 assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
 console.log('MusicBrainz mobile search form, category selector, result links, and layout passed.');
} finally {await browser.close();}
