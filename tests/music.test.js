import test from 'node:test';
import assert from 'node:assert/strict';
import {createMusicClient,archiveTracks,archiveCollection,jamendoTrack,durationSeconds} from '../src/music.js';
const metadata={metadata:{mediatype:'audio',title:'Album',creator:'Artist'},files:[{name:'song one.mp3',title:'Song',length:'3:21',size:'5000'},{name:'private.mp3',private:'true'},{name:'../bad.mp3'},{name:'cover.jpg'}]};
test('Archive exposes playable public MP3s with stable identifiers and duration',()=>{const tracks=archiveTracks(metadata,'test-album');assert.equal(tracks.length,1);assert.equal(tracks[0].duration,201);assert.equal(tracks[0].url,undefined);assert.equal(tracks[0].provider,'archive');});
test('Archive rejects restricted and unavailable items',()=>{for(const value of [true,'true',1,'1']){assert.equal(archiveTracks({...metadata,is_dark:value},'test').length,0);assert.equal(archiveTracks({...metadata,metadata:{...metadata.metadata,'access-restricted-item':value}},'test').length,0);}assert.equal(archiveCollection({identifier:'../escape'}),null);assert.equal(archiveTracks({...metadata,nodownload:true},'test').length,0);});
test('Archive playback rechecks metadata and safely encodes file paths',async()=>{let calls=0;const c=createMusicClient({fetcher:async()=>{calls++;return Response.json(metadata);}});const track=archiveTracks(metadata,'test-album')[0];const first=await c.resolve(track);await c.resolve(track);assert.equal(calls,2);assert.equal(first.url,'https://archive.org/download/test-album/song%20one.mp3');});
test('Archive search caches requests and encodes user query',async()=>{let calls=0;const c=createMusicClient({fetcher:async url=>{calls++;const q=new URL(url).searchParams.get('q');assert.ok(q.includes('தமிழ்'));return Response.json({response:{docs:[{identifier:'music',title:'Collection',creator:['A','B']}]}});}});const result=await c.browse('archive','தமிழ் & music');await c.browse('archive','தமிழ் & music');assert.equal(calls,1);assert.equal(result.tracks[0].kind,'collection');assert.equal(result.tracks[0].artist,'A, B');});
test('Missing Jamendo client ID produces a setup error without a network call',async()=>{const c=createMusicClient({fetcher:()=>{throw Error('must not fetch');}});assert.equal(c.configured('jamendo'),false);await assert.rejects(()=>c.browse('jamendo'),/client ID/);});
test('Jamendo uses full audio field, includes public client ID and preserves attribution',async()=>{const raw={id:'123',name:'Song',artist_name:'Artist',duration:240,audio:'https://prod-1.storage.jamendo.com/audio.mp3',audiodownload:'https://example.com/download',license_ccurl:'http://creativecommons.org/licenses/by/4.0/'};const c=createMusicClient({jamendoClientId:'my-test-id',fetcher:async url=>{assert.equal(new URL(url).searchParams.get('client_id'),'my-test-id');return Response.json({headers:{status:'success'},results:[raw]});}});const [track]=(await c.browse('jamendo','chill')).tracks;assert.equal(track.duration,240);assert.equal(track.license,'https://creativecommons.org/licenses/by/4.0/');assert.equal(track.url,undefined);assert.equal((await c.resolve(track)).url,raw.audio);assert.equal(jamendoTrack({...raw,audio:'javascript:alert(1)'}),null);});
test('Invalid Jamendo credentials and removed providers are not silently accepted',async()=>{const c=createMusicClient({jamendoClientId:'invalid',fetcher:async()=>Response.json({headers:{status:'failed',error_message:'Invalid client ID'}})});await assert.rejects(()=>c.browse('jamendo'),/Invalid client ID/);await assert.rejects(()=>c.resolve({provider:'old-provider'}),/no longer connected/);});
test('Duration parsing handles numeric values and hours',()=>{assert.equal(durationSeconds('02:03:04'),7384);assert.equal(durationSeconds('201.2'),201.2);assert.equal(durationSeconds('unknown'),0);});
test('Jamendo pages include singles and albums, retain search, and stop at final page',async()=>{
 const requests=[];
 const c=createMusicClient({jamendoClientId:'test',fetcher:async url=>{
  const p=new URL(url).searchParams;requests.push(p);
  const offset=Number(p.get('offset'));
  return Response.json({headers:{status:'success',...(offset===0?{results_fullcount:50}:{})},results:Array.from({length:offset===0?48:2},(_,i)=>({id:String(offset+i+1),name:'Song',audio:'https://example.com/full.mp3'}))});
 }});
 const first=await c.browse('jamendo','chill');const next=await c.browse('jamendo','chill',{page:1});
 assert.equal(first.total,50);assert.equal(first.hasNext,true);assert.equal(next.hasNext,false);assert.equal(next.tracks[0].id,'jamendo:49');
 for(const p of requests){assert.equal(p.get('type'),'single albumtrack');assert.equal(p.get('search'),'chill');assert.equal(p.get('order'),'relevance');}
 assert.equal(requests[1].get('offset'),'48');assert.equal(requests[1].get('fullcount'),null);
 await c.browse('jamendo','',{sort:'newest'});assert.equal(requests[2].get('order'),'releasedate_desc');
 await assert.rejects(()=>c.browse('jamendo','',{page:-1}),/Invalid catalog page/);
});
test('Jamendo retries a transient empty result instead of caching an empty catalog page',async()=>{
 let calls=0;const c=createMusicClient({jamendoClientId:'test',fetcher:async()=>Response.json({headers:{status:'success'},results:++calls===1?[]:[{id:'1',name:'Recovered song',audio:'https://example.com/song.mp3'}]})});
 const result=await c.browse('jamendo');assert.equal(calls,2);assert.equal(result.tracks[0].title,'Recovered song');
});
