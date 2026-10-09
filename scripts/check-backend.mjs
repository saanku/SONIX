import { readFile } from 'node:fs/promises';
const env = await readFile('.env.local','utf8');
const values=Object.fromEntries(env.split(/\r?\n/).filter(line=>line.includes('=')).map(line=>{const i=line.indexOf('=');return [line.slice(0,i),line.slice(i+1).trim()];}));
const base=values.VITE_SUPABASE_URL;
const headers={apikey:values.VITE_SUPABASE_PUBLISHABLE_KEY};
for (const [name,path] of [['Authentication','/auth/v1/settings'],['Library table','/rest/v1/libraries?select=user_id&limit=0']]) {
 try {
  const response=await fetch(base+path,{headers,signal:AbortSignal.timeout(15000)});
  const data=await response.json();
  if(name==='Authentication'&&response.ok) console.log(JSON.stringify({check:name,status:response.status,emailEnabled:data.external?.email,signupsDisabled:data.disable_signup,emailConfirmationRequired:!data.mailer_autoconfirm}));
  else console.log(JSON.stringify({check:name,status:response.status,code:data.code,message:data.message??(response.ok?'Reachable':data.msg)}));
 } catch(error) {console.log(JSON.stringify({check:name,error:error.message}));process.exitCode=1;}
}
