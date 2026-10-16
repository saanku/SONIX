import test from 'node:test';
import assert from 'node:assert/strict';
import {createMusicClient,youtubeTrack,durationSeconds,supportedProvider,safeWebUrl} from '../src/music.js';
const video=(id='abcdefghijk')=>({id,snippet:{title:'Song',channelTitle:'Artist',thumbnails:{high:{url:'https://example.com/art.jpg'}}},contentDetails:{duration:'PT3M12S'},status:{embeddable:true}});
test('YouTube metadata validates IDs, embeds, URLs, and durations',()=>{
 assert.equal(youtubeTrack(video()).duration,192);
 assert.equal(youtubeTrack({...video(),status:{embeddable:false}}),null);
 assert.equal(youtubeTrack(video('bad')),null);
 assert.equal(safeWebUrl('javascript:alert(1)'),'');
 assert.equal(durationSeconds('PT1H2M3S'),3723);
 assert.equal(supportedProvider('jamendo'),false);
});
test('Missing key makes no network requests',async()=>{
 const c=createMusicClient({fetcher:()=>assert.fail('Unexpected request')});
 assert.equal(c.configured('youtube'),false);
 await assert.rejects(()=>c.browse('youtube'),/API v3 key/);
});
test('Search uses page tokens, details and cache; changing key clears state',async()=>{
 const requests=[];
 const c=createMusicClient({youtubeApiKey:'test-key',fetcher:async url=>{
  const u=new URL(url);requests.push(u);
  return Response.json(u.pathname.endsWith('/search')?{items:[{...video(),id:{videoId:'abcdefghijk'}}],...(u.searchParams.has('pageToken')?{}:{nextPageToken:'page-two'})}:{items:[video()]});
 }});
 const first=await c.browse('youtube','music');assert.equal(first.hasNext,true);assert.equal(first.tracks[0].duration,192);
 const second=await c.browse('youtube','music',{page:1});assert.equal(second.hasNext,false);
 assert.equal(requests[2].searchParams.get('pageToken'),'page-two');
 assert.equal(requests[0].searchParams.get('videoEmbeddable'),'true');
 assert.equal(requests[0].searchParams.get('type'),'video');
 await c.browse('youtube','music');assert.equal(requests.length,3);
 c.setYoutubeApiKey('new-key');await c.browse('youtube','music');assert.equal(requests.length,5);
 await assert.rejects(()=>c.browse('youtube','music',{page:3}),/previous/);
 await assert.rejects(()=>c.browse('youtube','music',{page:-1}),/Invalid/);
});
test('Quota errors and rejected credentials are actionable without disclosing keys',async()=>{
 for(const [reason,message] of [['quotaExceeded',/quota/],['keyInvalid',/API key/]]){
  const c=createMusicClient({youtubeApiKey:'private-test-key',fetcher:async()=>Response.json({error:{errors:[{reason}]}},{status:403})});
  await assert.rejects(()=>c.browse('youtube'),e=>message.test(e.message)&&!e.message.includes('private-test-key'));
 }
});
test('Playback resolves only valid YouTube identifiers',async()=>{
 const c=createMusicClient();assert.equal((await c.resolve(youtubeTrack(video()))).url,'youtube:abcdefghijk');
 await assert.rejects(()=>c.resolve({provider:'youtube',youtubeId:'../bad'}),/Invalid/);
});
