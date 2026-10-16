export function setupFloatingPlayer(panel,handle) {
  let saved,drag;
  try{saved=JSON.parse(localStorage.getItem('sonix-player-position'));}catch{}
  function place(x,y){
    const rect=panel.getBoundingClientRect();
    const bottom=document.querySelector('.player').getBoundingClientRect().top;
    const left=Math.max(8,Math.min(Number(x)||8,innerWidth-rect.width-8));
    const top=Math.max(8,Math.min(Number(y)||8,Math.min(innerHeight,bottom)-rect.height-8));
    Object.assign(panel.style,{left:left+'px',top:top+'px',right:'auto',bottom:'auto'});
    return {x:left,y:top};
  }
  function fit(){if(panel.hidden)return;const rect=panel.getBoundingClientRect();saved=place(saved?.x??rect.x,saved?.y??rect.y);}
  function persist(){try{localStorage.setItem('sonix-player-position',JSON.stringify(saved));}catch{}}
  handle.addEventListener('pointerdown',e=>{
    if(e.button!==0)return;const rect=panel.getBoundingClientRect();
    drag={x:e.clientX-rect.x,y:e.clientY-rect.y};handle.setPointerCapture(e.pointerId);e.preventDefault();
  });
  handle.addEventListener('pointermove',e=>{if(drag)saved=place(e.clientX-drag.x,e.clientY-drag.y);});
  const end=()=>{if(drag){drag=null;persist();}};
  handle.addEventListener('pointerup',end);handle.addEventListener('pointercancel',end);
  handle.addEventListener('keydown',e=>{
    const delta={ArrowLeft:[-20,0],ArrowRight:[20,0],ArrowUp:[0,-20],ArrowDown:[0,20]}[e.key];
    if(!delta)return;e.preventDefault();const rect=panel.getBoundingClientRect();saved=place(rect.x+delta[0],rect.y+delta[1]);persist();
  });
  new MutationObserver(fit).observe(panel,{attributes:true,attributeFilter:['hidden']});
  window.addEventListener('resize',fit);
  return {reset(){saved=null;panel.removeAttribute('style');fit();persist();}};
}
