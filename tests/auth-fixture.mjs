export const firstUser='11111111-1111-4111-8111-111111111111';
export const secondUser='22222222-2222-4222-8222-222222222222';
const versionsByLibrary=new WeakMap();
export async function mockAccount(page,{confirmSignup=true,libraries=new Map()}={}) {
  if(!versionsByLibrary.has(libraries))versionsByLibrary.set(libraries,new Map());
  const versions=versionsByLibrary.get(libraries),requests=[];let active;
  const user=email=>({id:email.startsWith('second')?secondUser:firstUser,aud:'authenticated',role:'authenticated',email,email_confirmed_at:new Date().toISOString(),app_metadata:{provider:'email',providers:['email']},user_metadata:{},created_at:new Date().toISOString()});
  const session=u=>{const exp=Math.floor(Date.now()/1000)+3600;const encode=value=>Buffer.from(JSON.stringify(value)).toString('base64url');return {access_token:encode({alg:'HS256',typ:'JWT'})+'.'+encode({sub:u.id,aud:'authenticated',role:'authenticated',exp})+'.test-signature',refresh_token:'test-refresh',expires_in:3600,expires_at:exp,token_type:'bearer',user:u};};
  const headers={'access-control-allow-origin':'*','access-control-allow-headers':'*'};
  await page.route('**/auth/v1/**',async route=>{
    const request=route.request(),path=new URL(request.url()).pathname;
    if(request.method()==='OPTIONS'){await route.fulfill({status:204,headers});return;}
    let body={};try{body=request.postDataJSON()||{};}catch{}
    requests.push({path,email:body.email,type:body.type,redirect:new URL(request.url()).searchParams.get('redirect_to')});
    if(path.endsWith('/token')){
      if(body.password==='wrong-password'){await route.fulfill({status:400,headers,json:{error:'invalid_grant',error_description:'Invalid login credentials'}});return;}
      active=user(body.email||active?.email||'first@example.com');await route.fulfill({headers,json:session(active)});return;
    }
    if(path.endsWith('/signup')){const created=user(body.email);await route.fulfill({headers,json:confirmSignup?created:session(created)});return;}
    if(path.endsWith('/resend')){await route.fulfill({headers,json:{}});return;}
    if(path.endsWith('/logout')){active=null;await route.fulfill({status:204,headers});return;}
    if(path.endsWith('/user')){await route.fulfill({headers,json:active||user('first@example.com')});return;}
    await route.fulfill({headers,json:{}});
  });
  await page.route('**/rest/v1/libraries**',async route=>{
    const request=route.request(),url=new URL(request.url());
    if(request.method()==='OPTIONS'){await route.fulfill({status:204,headers});return;}
    if(request.method()==='POST'){
      const row=request.postDataJSON();if(libraries.has(row.user_id)&&!request.headers().prefer?.includes('resolution=merge-duplicates')){await route.fulfill({status:409,headers,json:{code:'23505'}});return;}
      libraries.set(row.user_id,row.data);versions.set(row.user_id,row.updated_at);await route.fulfill({status:201,headers,json:[]});
    }else{
      const id=url.searchParams.get('user_id')?.replace(/^eq\./,'');
      if(request.method()==='PATCH'){
        if(!libraries.has(id)||url.searchParams.get('updated_at')!=='eq.'+versions.get(id)){await route.fulfill({headers,json:[]});return;}
        const row=request.postDataJSON();libraries.set(id,row.data);versions.set(id,row.updated_at);await route.fulfill({headers,json:[{user_id:id}]});return;
      }
      await route.fulfill({headers,json:libraries.has(id)?[{data:libraries.get(id),updated_at:versions.get(id)}]:[]});
    }
  });
  return {libraries,requests};
}
export async function signIn(page,email='first@example.com'){
  await page.locator('#entry-email').fill(email);await page.locator('#entry-password').fill('test-password-123');
  await page.locator('#entry-form [type="submit"]').click();await page.locator('#app').waitFor({state:'visible'});
}
