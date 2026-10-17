import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
import {mockAccount,signIn} from './auth-fixture.mjs';
const browser=await chromium.launch({headless:true,executablePath:process.env.BROWSER_EXECUTABLE});
const base=process.env.SONIX_URL||'http://127.0.0.1:5176/';
try{
 const page=await browser.newPage({viewport:{width:390,height:844}});
 const {requests}=await mockAccount(page);await page.goto(base);
 await page.locator('[data-auth-mode=forgot]').click();
 await page.locator('#entry-form [type=submit]').click();assert.equal(requests.length,0);
 await page.locator('#entry-email').fill('first@example.com');
 await page.locator('#entry-form [type=submit]').click();
 await page.getByText('If an account exists for this email,',{exact:false}).waitFor();
 assert.ok(requests.some(r=>r.path.endsWith('/recover')&&r.email==='first@example.com'&&r.redirect===base));
 await page.locator('.auth-tabs [data-auth-mode=signin]').click();await signIn(page);
 const session=await page.evaluate(()=>JSON.parse(localStorage.getItem(Object.keys(localStorage).find(k=>k.startsWith('sb-')&&k.endsWith('-auth-token')))));
 const recovery=await browser.newPage({viewport:{width:390,height:844}});await mockAccount(recovery);
 let updated;await recovery.route('**/auth/v1/user',async route=>{
  if(route.request().method()==='PUT')updated=route.request().postDataJSON();
  await route.fulfill({json:session.user});
 });
 await recovery.goto(base+'#'+new URLSearchParams({access_token:session.access_token,refresh_token:session.refresh_token,expires_in:'3600',token_type:'bearer',type:'recovery'}));
 await recovery.getByText('Set a new password.',{exact:true}).waitFor();
 assert.equal(await recovery.locator('#app').isVisible(),false);
 await recovery.locator('#entry-password').fill('new-password-123');await recovery.locator('#entry-confirm').fill('different-password');
 await recovery.locator('#entry-form [type=submit]').click();await recovery.getByText('Your passwords do not match.',{exact:true}).waitFor();assert.equal(updated,undefined);
 await recovery.locator('#entry-confirm').fill('new-password-123');await recovery.locator('#entry-form [type=submit]').click();
 await recovery.locator('#app').waitFor({state:'visible'});assert.equal(updated.password,'new-password-123');
 assert.ok(await recovery.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
 console.log('Password recovery passed: email request, recovery callback, mismatch validation, password update, mobile layout.');
}finally{await browser.close();}
