// Optionele back-up naar een map op je eigen schijf (File System Access API, Chrome/Edge op desktop).
// De map-handle wordt in IndexedDB bewaard; na een herstart vraagt de browser één keer opnieuw om toestemming.

import { getMeta, setMeta } from './store.js';
import { slug } from './util.js';

const KEY = 'backupDir';
const MIN_INTERVAL = 2 * 60 * 1000;
let handle;
let lastWrite = 0;

export const folderSupported = () => typeof window !== 'undefined' && 'showDirectoryPicker' in window;

export async function getFolder() {
  if (handle === undefined) handle = (await getMeta(KEY)) || null;
  return handle;
}

export async function chooseFolder() {
  const h = await window.showDirectoryPicker({ mode: 'readwrite', id: 'filmatelier-backup' });
  await setMeta(KEY, h);
  handle = h;
  return h;
}

export async function forgetFolder() { await setMeta(KEY, null); handle = null; }

/** 'none' (geen map), 'granted', 'prompt' of 'denied'. Met request=true vraagt de browser om toestemming (vereist een klik). */
export async function folderPermission(request = false) {
  const h = await getFolder();
  if (!h) return 'none';
  const o = { mode: 'readwrite' };
  let s = await h.queryPermission(o);
  if (s !== 'granted' && request) s = await h.requestPermission(o);
  return s;
}

/** Schrijft het project als .json en het scenario als .fountain naar de map (hooguit eens per 2 minuten, tenzij force). */
export async function writeToFolder(p, { force = false } = {}) {
  if (!folderSupported()) return false;
  if (!force && Date.now() - lastWrite < MIN_INTERVAL) return false;
  const h = await getFolder();
  if (!h || (await h.queryPermission({ mode: 'readwrite' })) !== 'granted') return false;
  const base = slug(p.meta.title);
  const write = async (name, data) => {
    const f = await h.getFileHandle(name, { create: true });
    const w = await f.createWritable();
    await w.write(data);
    await w.close();
  };
  await write(`${base}.filmatelier.json`, JSON.stringify(p));
  if (p.script.text.trim()) await write(`${base}.fountain`, p.script.text);
  lastWrite = Date.now();
  return true;
}
