import test from 'node:test';
import assert from 'node:assert/strict';
import { createMusicBrainzHandler } from '../supabase/functions/musicbrainz/api.js';
import { musicbrainzPlugin } from '../server/musicbrainz-plugin.js';
test('Vite hooks install middleware without returning a Connect app as a post-hook', () => {
 const registrations=[];
 const server={middlewares:{use:(...args)=>{registrations.push(args);return ()=>{throw Error('Connect app must not become post-hook');};}}};
 const plugin=musicbrainzPlugin('https://example.com');
 assert.equal(plugin.configureServer(server),undefined);
 assert.equal(plugin.configurePreviewServer(server),undefined);
 assert.equal(registrations.length,2);
 assert.equal(registrations[0][0],'/api/musicbrainz');
});
const id = '00000000-0000-0000-0000-000000000001';
const request = (q = 'hello', entity = 'recording') => new Request(`http://localhost/api/musicbrainz?q=${encodeURIComponent(q)}&entity=${entity}`);
test('rejects invalid entity and short input without contacting upstream', async () => {
 const h = createMusicBrainzHandler({ fetcher: () => {throw Error('must not fetch');} });
 assert.equal((await h(request('a'))).status,400);
 assert.equal((await h(request('hello','url'))).status,400);
});
test('normalizes recording metadata, identifies app, and caches duplicate requests', async () => {
 let calls=0;
 const h=createMusicBrainzHandler({ interval:0, contact:'https://example.com/sonix', fetcher:async (url, options)=>{
  calls++;assert.ok(options.headers['User-Agent'].includes('SONIX/1.0'));assert.equal(url.searchParams.get('query'),'recording:"hello"');
  return Response.json({count:1,recordings:[{id,title:'Hello','artist-credit':[{name:'An artist'}],releases:[{title:'An album'}]}]});
 }});
 const first=await (await h(request())).json();await h(request());
 assert.equal(calls,1);assert.equal(first.results[0].artist,'An artist');assert.equal(first.results[0].url,`https://musicbrainz.org/recording/${id}`);
});
test('retries busy responses, and a failed request does not poison the queue', async () => {
 let calls=0;const h=createMusicBrainzHandler({interval:0,sleep:async()=>{},fetcher:async()=>{calls++;return calls<=3?new Response('',{status:503}):Response.json({artists:[{id,name:'Artist',area:{name:'India'}}]});}});
 assert.equal((await h(request('artist','artist'))).status,503);
 const result=await (await h(request('artist','artist'))).json();assert.equal(result.results[0].artist,'India');
});
