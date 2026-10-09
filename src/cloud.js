let clientPromise;
export const configured = Boolean(import.meta.env.VITE_SUPABASE_URL && import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY);
export async function getClient() {
  if (!configured) return null;
  if (!clientPromise) clientPromise=import('@supabase/supabase-js').then(({createClient})=>createClient(import.meta.env.VITE_SUPABASE_URL,import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY));
  return clientPromise;
}
export function cloudMessage(error) {
  if(error?.code==='PGRST205'||error?.code==='42P01')return 'Signed in. Cloud library setup is pending; your music is saved on this device.';
  if(error?.code==='42501')return 'Cloud access is unavailable. Your library is saved on this device.';
  return 'Cloud sync is unavailable. Your library is saved on this device.';
}
export async function readCloud(userId) {const c=await getClient();const {data,error}=await c.from('libraries').select('data').eq('user_id',userId).maybeSingle();if(error)throw error;return data?.data;}
export async function writeCloud(userId, data) {const c=await getClient();const {error}=await c.from('libraries').upsert({user_id:userId,data,updated_at:new Date().toISOString()});if(error)throw error;}
