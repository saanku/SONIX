import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
import {mockAccount} from './auth-fixture.mjs';
const browser=await chromium.launch({headless:true,executablePath:process.env.BROWSER_EXECUTABLE||undefined});
try{
 const page=await browser.newPage({viewport:{width:390,height:844}}),errors=[];
 page.on('pageerror',e=>errors.push(e.message));await page.clock.install();
 const {requests}=await mockAccount(page);
 const base=process.env.SONIX_URL||'http://127.0.0.1:5173/';await page.goto(base);
 await page.locator('#entry-email').fill('first@example.com');await page.locator('#entry-password').fill('test-password-123');
 await page.route('**/auth/v1/token**',route=>route.fulfill({status:400,json:{code:'email_not_confirmed',msg:'Email not confirmed'}}));
 await page.locator('#entry-form [type=submit]').click();await page.locator('#confirmation-help').waitFor({state:'visible'});requests.length=0;await page.locator('#entry-email').fill('');
 const resend=page.locator('#resend-confirmation');await resend.click();assert.equal(requests.length,0);
 await page.locator('#entry-email').fill('first@example.com');await resend.click();
 await page.waitForFunction(()=>document.querySelector('#entry-message').textContent.includes('Confirmation requested'));
 assert.equal(requests.length,1);assert.equal(requests[0].type,'signup');assert.equal(requests[0].redirect,base);
 assert.ok(await resend.isDisabled());assert.equal(await page.locator('#app').isVisible(),false);
 await page.clock.fastForward(61000);assert.equal(await resend.isDisabled(),false);
 await page.route('**/auth/v1/resend**',route=>route.fulfill({status:429,json:{code:'over_email_send_rate_limit',msg:'Email rate limit exceeded'}}));
 await resend.click();await page.waitForFunction(()=>document.querySelector('#entry-message').textContent.includes('sending limit'));
 assert.ok(await resend.isDisabled());await page.clock.fastForward(61000);
 await page.route('**/auth/v1/resend**',route=>route.fulfill({status:400,json:{code:'email_address_not_authorized',msg:'Email address not authorized'}}));
 await resend.click();await page.waitForFunction(()=>document.querySelector('#entry-message').textContent.includes('configure email delivery'));
 assert.equal(await resend.isDisabled(),false);assert.equal(await page.locator('#app').isVisible(),false);
 assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));assert.deepEqual(errors,[]);
 console.log('Confirmation email checks passed: required email, resend request, cooldown, rate limit and SMTP errors.');
}finally{await browser.close();}
