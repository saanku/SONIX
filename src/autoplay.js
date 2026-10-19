export function songIdentity(track){
 return String(track?.title||'').normalize('NFKC').toLowerCase()
  .replace(/\([^)]*\)|\[[^\]]*\]/g,' ')
  .replace(/\b(official|music video|lyric video|lyrics|lyrical|audio|video|hd|4k|remastered)\b/g,' ')
  .replace(/[^\p{L}\p{N}]+/gu,' ').trim();
}
export function unheard(candidates,played){
 const ids=new Set(played.filter(Boolean).map(t=>t.id));
 const titles=new Set(played.filter(Boolean).map(songIdentity).filter(Boolean));
 return candidates.filter(t=>t&&!ids.has(t.id)&&!titles.has(songIdentity(t)));
}
export function similarQuery(track){
 const text=track.title||'';
 const style=track.genre||track.mood||text.match(/\b(lofi|jazz|rock|pop|hip hop|classical|ambient|electronic|chill|folk|metal|dance)\b/i)?.[0]||'';
 const language=/[\u0d00-\u0d7f]/.test(text)?'Malayalam':/[\u0b80-\u0bff]/.test(text)?'Tamil':/[\u0900-\u097f]/.test(text)?'Hindi':'';
 return `${track.artist.replace(/\s*-?\s*Topic$/i,'')} ${language} ${style} songs`.trim().slice(0,120);
}
