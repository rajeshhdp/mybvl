// Tiny IndexedDB wrapper. Stores: boxes, items. Photos are Blobs.
const DB = (() => {
  let dbp;
  function open() {
    if (dbp) return dbp;
    dbp = new Promise((res, rej) => {
      const r = indexedDB.open('garage-boxes', 1);
      r.onupgradeneeded = () => {
        const d = r.result;
        d.createObjectStore('boxes', { keyPath: 'id' });
        const it = d.createObjectStore('items', { keyPath: 'id' });
        it.createIndex('boxId', 'boxId');
      };
      r.onsuccess = () => res(r.result);
      r.onerror = () => rej(r.error);
    });
    return dbp;
  }
  async function tx(store, mode, fn) {
    const d = await open();
    return new Promise((res, rej) => {
      const t = d.transaction(store, mode);
      const out = fn(t.objectStore(store));
      t.oncomplete = () => res(out instanceof IDBRequest ? out.result : out);
      t.onerror = () => rej(t.error);
    });
  }
  const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  return {
    uid,
    all: (store) => tx(store, 'readonly', (s) => s.getAll()),
    get: (store, id) => tx(store, 'readonly', (s) => s.get(id)),
    put: (store, obj) => tx(store, 'readwrite', (s) => s.put(obj)),
    del: (store, id) => tx(store, 'readwrite', (s) => s.delete(id)),
    clear: async () => { await tx('boxes', 'readwrite', (s) => s.clear()); await tx('items', 'readwrite', (s) => s.clear()); },
    async deleteBox(id) {
      const items = (await this.all('items')).filter((i) => i.boxId === id);
      for (const i of items) await this.del('items', i.id);
      await this.del('boxes', id);
    },
  };
})();

// Downscale an image File to a JPEG Blob (max 800px) to save space.
function shrinkImage(file, max = 800) {
  return new Promise((res, rej) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const k = Math.min(1, max / Math.max(img.width, img.height));
      const c = document.createElement('canvas');
      c.width = Math.round(img.width * k);
      c.height = Math.round(img.height * k);
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(url);
      c.toBlob((b) => (b ? res(b) : rej(new Error('encode failed'))), 'image/jpeg', 0.75);
    };
    img.onerror = () => { URL.revokeObjectURL(url); rej(new Error('bad image')); };
    img.src = url;
  });
}

const blobToDataURL = (b) => new Promise((res) => { const r = new FileReader(); r.onload = () => res(r.result); r.readAsDataURL(b); });
const dataURLToBlob = (u) => fetch(u).then((r) => r.blob());
