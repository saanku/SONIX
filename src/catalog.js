const base = import.meta.env.BASE_URL;
export const artwork = name => `${base}art/${name}.jpg`;
export const tracks = [
  { id:'night-drive', title:'After Hours', artist:'sanku inte lokham Originals', album:'Night Drive', mood:'Electronic', art:'night', duration:32, audio:'night', color:'#445168' },
  { id:'slow-mornings', title:'Golden Hour', artist:'sanku inte lokham Originals', album:'Slow Mornings', mood:'Chill', art:'sun', duration:32, audio:'sun', color:'#b17d42' },
  { id:'ocean-air', title:'Ocean Air', artist:'sanku inte lokham Originals', album:'Coastal State of Mind', mood:'Ambient', art:'ocean', duration:32, audio:'ocean', color:'#437c89' },
  { id:'city-lights', title:'Midnight Motion', artist:'sanku inte lokham Originals', album:'City Lights', mood:'Electronic', art:'city', duration:32, audio:'city', color:'#915d80' },
  { id:'quiet-mind', title:'A Little Space', artist:'sanku inte lokham Originals', album:'Quiet Mind', mood:'Focus', art:'forest', duration:32, audio:'forest', color:'#66806c' },
  { id:'on-repeat', title:'Daydream', artist:'sanku inte lokham Originals', album:'On Repeat', mood:'Chill', art:'flower', duration:32, audio:'flower', color:'#b47f82' }
].map(t=>({...t, artwork:artwork(t.art), url:`${base}audio/${t.audio}.wav`, source:'Original instrumental · 32 sec'}));
export const mixes = [
  {id:'night',name:'Night Drive',sub:'For the long way home.',art:'night',tag:'AFTER DARK',color:'#8892b8',tracks:['night-drive','city-lights','ocean-air']},
  {id:'sun',name:'Slow Mornings',sub:'A softer start to your day.',art:'sun',tag:'TAKE IT SLOW',color:'#e9b76d',tracks:['slow-mornings','on-repeat','quiet-mind']},
  {id:'ocean',name:'Coastal State',sub:'A breath of fresh air.',art:'ocean',tag:'DRIFT AWAY',color:'#8dc5c0',tracks:['ocean-air','quiet-mind','slow-mornings']},
  {id:'forest',name:'Deep Focus',sub:'Find your flow. Stay there.',art:'forest',tag:'IN THE ZONE',color:'#a8bb80',tracks:['quiet-mind','ocean-air','night-drive']},
  {id:'flower',name:'Indie Daydream',sub:'A little off the beaten path.',art:'flower',tag:'FEEL SOMETHING',color:'#f1a2b2',tracks:['on-repeat','slow-mornings','city-lights']}
];
