import test from 'node:test';
import assert from 'node:assert/strict';
import { createAudiusClient, normalizeAudiusTrack } from '../src/audius.js';
const track={id:'abc123',title:'A full song',user:{name:'An artist'},duration:240,is_streamable:true,is_stream_gated:false,artwork:{'480x480':'https://example.com/art.jpg'},stream:{url:'https://example.com/expiring-signature'},permalink:'/artist/a-full-song'};
test('Audius metadata preserves full duration but never persists signed stream URLs',()=>{
 const result=normalizeAudiusTrack(track);assert.equal(result.id,'audius-abc123');assert.equal(result.duration,240);assert.equal(result.permalink,'https://audius.co/artist/a-full-song');assert.equal(result.url,undefined);assert.equal(result.stream,undefined);
});
test('Audius excludes gated, unavailable, restricted, and preview-only tracks',()=>{
 for(const fields of [{is_streamable:false},{is_stream_gated:true},{is_available:false},{access:{stream:false}},{access_authorities:['authority']},{allowed_api_keys:['other-app']},{is_delete:true},{is_unlisted:true}])assert.equal(normalizeAudiusTrack({...track,...fields}),null);
 assert.equal(normalizeAudiusTrack({...track,id:'../../anything'}),null);
});
test('Audius caches metadata and keeps user text encoded as one query value',async()=>{
 let calls=0;const client=createAudiusClient({fetcher:async value=>{calls++;assert.equal(new URL(value).searchParams.get('query'),'தமிழ் & chill');return Response.json({data:[track]});}});
 await client.search('தமிழ் & chill');await client.search('தமிழ் & chill');assert.equal(calls,1);
});
test('Audius resolves availability again on every play, and refuses newly gated tracks',async()=>{
 let calls=0;const client=createAudiusClient({fetcher:async()=>Response.json({data:{...track,is_stream_gated:++calls>1}})});
 const result=await client.resolve(normalizeAudiusTrack(track));assert.ok(result.url.includes('/tracks/abc123/stream'));assert.ok(!result.url.includes('preview'));
 await assert.rejects(()=>client.resolve(normalizeAudiusTrack(track)),/no longer publicly streamable/);
});
test('Audius recovers after upstream errors without caching failed requests',async()=>{
 let calls=0;const client=createAudiusClient({fetcher:async()=>++calls===1?new Response('',{status:429}):Response.json({data:[track]})});
 await assert.rejects(()=>client.trending(),/busy/);assert.equal((await client.trending()).tracks.length,1);
});
