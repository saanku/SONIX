import test from 'node:test';
import assert from 'node:assert/strict';
import {createCleanViews} from '../src/clean-views.js';
const esc=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const views=createCleanViews({esc,icon:name=>`<svg data-icon="${name}"></svg>`,artwork:name=>`/art/${name}.jpg`,trackById:()=>null});
const library={favorites:['one'],history:[],playlists:[{id:'a',name:'Zulu',tracks:[]},{id:'b',name:'Alpha',tracks:[]}]};
test('Library search and sorting only show saved playlists and liked songs',()=>{
 const all=views.library(library,{sort:'name'});
 assert.ok(all.indexOf('>Alpha<')<all.indexOf('>Zulu<'));
 const filtered=views.library(library,{query:'ZUL'});
 assert.match(filtered,/>Zulu</);assert.doesNotMatch(filtered,/>Alpha<|>Liked songs</);
 assert.match(views.library(library,{query:'missing'}),/No playlists match/);
});
test('Playlist names and search values are escaped in the new views',()=>{
 const name='<img src=x onerror=alert(1)>';
 const markup=views.library({...library,playlists:[{id:'"onclick="bad',name,tracks:[]}]});
 assert.doesNotMatch(markup,/<img src=x|data-playlist=""onclick/);
 assert.match(markup,/&lt;img/);
 const search=views.search('" onfocus="bad',[],()=> '');
 assert.match(search,/value="&quot; onfocus=&quot;bad"/);
});
test('Home filters and empty Search offer distinct working destinations',()=>{
 assert.doesNotMatch(views.home(library,'Music'),/class="quick-access"/);
 assert.doesNotMatch(views.home(library,'Playlists'),/id="music-section"/);
 const search=views.search('',[],()=> '');
 assert.equal((search.match(/id="music-form"/g)||[]).length,1);
 assert.match(search,/data-browse-query="Malayalam songs"/);
 assert.doesNotMatch(search,/id="music-section"/);
});
