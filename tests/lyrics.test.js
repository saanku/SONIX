import test from 'node:test';
import assert from 'node:assert/strict';
import {parseLyrics,lyricsQuery} from '../src/lyrics.js';

test('LRC supports repeated timestamps, fractional seconds, offsets and instrumental gaps',()=>{
 assert.deepEqual(parseLyrics('[ar:Artist]\n[offset:500]\n[00:12.50][01:02.00]Hello\n[00:20.00]\n[00:99]invalid'),[{time:12,text:'Hello'},{time:19.5,text:''},{time:61.5,text:'Hello'}]);
});
test('plain lyrics do not become timed lines',()=>assert.deepEqual(parseLyrics('A line without timestamps'),[]));
test('YouTube and imported filename metadata is cleaned for matching',()=>{
 assert.deepEqual(lyricsQuery({title:'Artist - Song (Official Music Video)',artist:'Channel'}),{title:'Song',artist:'Artist'});
 assert.deepEqual(lyricsQuery({title:'Song',artist:'Artist - Topic'}),{title:'Song',artist:'Artist'});
 assert.deepEqual(lyricsQuery({title:'Song',artist:'Your music'}),{title:'Song',artist:''});
});
