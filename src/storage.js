const request = indexedDB.open('sonix-audio', 1);
request.onupgradeneeded = () => request.result.createObjectStore('files');
const ready = new Promise((resolve, reject) => {request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);});
export async function saveAudio(id, file) {const db=await ready;return new Promise((resolve,reject)=>{const tx=db.transaction('files','readwrite');tx.objectStore('files').put(file,id);tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);});}
export async function loadAudio(id) {const db=await ready;return new Promise((resolve,reject)=>{const r=db.transaction('files').objectStore('files').get(id);r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});}
