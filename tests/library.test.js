import test from 'node:test';
import assert from 'node:assert/strict';
import { initialLibrary, safeLibrary, toggleFavorite, nextIndex, mergeLibraries } from '../src/library.js';
test('malformed device storage cannot break library lists',()=>{assert.deepEqual(safeLibrary(null),initialLibrary());assert.deepEqual(safeLibrary({favorites:[null,'a',3],tracks:[{},null],playlists:[{}]}).favorites,['a']);});
test('favorite toggles without duplicates',()=>{const lib=initialLibrary();toggleFavorite(lib,'a');assert.deepEqual(lib.favorites,['a']);toggleFavorite(lib,'a');assert.deepEqual(lib.favorites,[]);});
test('queue wraps and shuffled playback avoids current song',()=>{assert.equal(nextIndex(2,3),0);assert.equal(nextIndex(0,3,-1),2);assert.equal(nextIndex(0,0),-1);for(let i=0;i<3;i++)for(const r of [0,.3,.999])assert.notEqual(nextIndex(i,3,1,true,()=>r),i);});
test('sync merge keeps device imports and remote playlists without duplicates',()=>{const local={...initialLibrary(),favorites:['a'],tracks:[{id:'x',title:'Local'}]};const remote={...initialLibrary(),favorites:['a','b'],playlists:[{id:'p',name:'Cloud',tracks:['a']}]};const merged=mergeLibraries(local,remote);assert.deepEqual(merged.favorites,['a','b']);assert.equal(merged.tracks.length,1);assert.equal(merged.playlists[0].name,'Cloud');});
