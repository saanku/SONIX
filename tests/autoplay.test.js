import test from 'node:test';
import assert from 'node:assert/strict';
import {unheard,similarQuery} from '../src/autoplay.js';
test('autoplay excludes played IDs and alternative uploads of the same title',()=>{
 const played=[{id:'one',title:'Night Drive (Official Video)'}];
 assert.deepEqual(unheard([{id:'one',title:'Renamed'},{id:'two',title:'Night Drive [Official Audio]'},{id:'three',title:'New Journey'}],played).map(t=>t.id),['three']);
});
test('similarity uses known genre without searching for another copy of the song',()=>{
 const query=similarQuery({title:'Night Drive',artist:'Artist - Topic',genre:'jazz'});
 assert.ok(query.includes('jazz'));assert.ok(query.includes('Artist'));assert.equal(query.includes('Night Drive'),false);
});
