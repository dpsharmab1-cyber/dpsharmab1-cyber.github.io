// Autosave to IndexedDB (images included), plus open / save .frame files.

const DB = 'frame-studio';
const STORE = 'files';

function openDB() {
  return new Promise((res, rej) => {
    const r = indexedDB.open(DB, 1);
    r.onupgradeneeded = () => r.result.createObjectStore(STORE);
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  });
}

async function tx(mode, fn) {
  const db = await openDB();
  return new Promise((res, rej) => {
    const t = db.transaction(STORE, mode);
    const out = fn(t.objectStore(STORE));
    t.oncomplete = () => res(out && 'result' in out ? out.result : undefined);
    t.onerror = () => rej(t.error);
  });
}

export const loadLocal = () => tx('readonly', (s) => s.get('current')).catch(() => null);
export const saveLocal = (doc) => tx('readwrite', (s) => s.put(JSON.parse(JSON.stringify(doc)), 'current')).catch(() => {});

let timer = null;
export function autosave(doc, onSaved) {
  clearTimeout(timer);
  timer = setTimeout(async () => { await saveLocal(doc); onSaved?.(); }, 700);
}

export function pickFile(accept) {
  return new Promise((res) => {
    const i = document.createElement('input');
    i.type = 'file';
    i.accept = accept;
    i.multiple = accept.startsWith('image');
    i.onchange = () => res([...i.files]);
    i.click();
  });
}

export const readText = (f) => f.text();
export function readDataURL(f) {
  return new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = rej; r.readAsDataURL(f); });
}

export function imageSize(src) {
  return new Promise((res) => {
    const img = new Image();
    img.onload = () => res({ w: img.naturalWidth || 300, h: img.naturalHeight || 200 });
    img.onerror = () => res({ w: 300, h: 200 });
    img.src = src;
  });
}

// Big photos are scaled down so files stay light.
export async function shrinkImage(dataURL, max = 2400) {
  if (/^data:image\/(svg|gif)/.test(dataURL)) return dataURL;
  const { w, h } = await imageSize(dataURL);
  if (Math.max(w, h) <= max && dataURL.length < 1.5e6) return dataURL;
  const k = Math.min(1, max / Math.max(w, h));
  const c = document.createElement('canvas');
  c.width = Math.round(w * k); c.height = Math.round(h * k);
  const img = new Image();
  await new Promise((r) => { img.onload = r; img.src = dataURL; });
  c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
  const png = /^data:image\/png/.test(dataURL);
  return c.toDataURL(png ? 'image/png' : 'image/jpeg', 0.88);
}
