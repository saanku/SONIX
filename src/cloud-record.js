// Optimistic updates keep library edits and playback checkpoints from overwriting each other.
export async function patchCloudRecord(client,userId,patch) {
 for(let attempt=0;attempt<5;attempt++){
  const {data:row,error}=await client.from('libraries').select('data,updated_at').eq('user_id',userId).maybeSingle();
  if(error)throw error;
  const data=patch(row?.data||{});if(data===null)return row?.data;
  const updated_at=new Date(Math.max(Date.now(),Date.parse(row?.updated_at||'')+1||0)).toISOString();
  if(row){
   const result=await client.from('libraries').update({data,updated_at}).eq('user_id',userId).eq('updated_at',row.updated_at).select('user_id');
   if(result.error)throw result.error;if(result.data?.length)return data;
  }else{
   const result=await client.from('libraries').insert({user_id:userId,data,updated_at});
   if(!result.error)return data;if(result.error.code!=='23505')throw result.error;
  }
 }
 throw Error('Cloud changed during sync. Please retry.');
}
