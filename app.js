const $view = document.getElementById('view');
const $title = document.getElementById('title');
const $back = document.getElementById('back');
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const parseTags = (s) => [...new Set(s.split(',').map((t) => t.trim().toLowerCase()).filter(Boolean))];
const urls = [];
const photoURL = (b) => { if (!b) return ''; const u = URL.createObjectURL(b); urls.push(u); return u; };
const freeURLs = () => { while (urls.length) URL.revokeObjectURL(urls.pop()); };
const boxLink = (id) => location.origin + location.pathname + '#/box/' + id;

function setHeader(title, back) {
  $title.textContent = title;
  $back.hidden = !back;
  $back.onclick = () => { location.hash = back; };
}
function setTab(t) {
  document.querySelectorAll('nav a').forEach((a) => a.classList.toggle('on', a.dataset.tab === t));
}

// ---------- Views ----------
async function viewSearch() {
  setHeader('Find an item'); setTab('search');
  const [boxes, items] = await Promise.all([DB.all('boxes'), DB.all('items')]);
  const boxMap = new Map(boxes.map((b) => [b.id, b]));
  const tags = [...new Set(items.flatMap((i) => i.tags || []))].sort();
  let activeTag = null;
  $view.innerHTML = `<input id="q" type="search" placeholder="Search items, tags, notes…" autocomplete="off">
    <div id="tags"></div><div id="res"></div>`;
  const q = $view.querySelector('#q'), res = $view.querySelector('#res'), tagEl = $view.querySelector('#tags');
  function render() {
    tagEl.innerHTML = tags.map((t) => `<span class="chip ${t === activeTag ? 'on' : ''}" data-t="${esc(t)}">${esc(t)}</span>`).join('');
    const terms = q.value.toLowerCase().split(/\s+/).filter(Boolean);
    const hits = items.filter((i) => {
      if (activeTag && !(i.tags || []).includes(activeTag)) return false;
      const b = boxMap.get(i.boxId);
      const hay = [i.name, (i.tags || []).join(' '), i.notes, b && b.name].join(' ').toLowerCase();
      return terms.every((t) => hay.includes(t));
    });
    if (!items.length) { res.innerHTML = '<p class="empty">Nothing yet. Add a box in the Boxes tab, then add items to it.</p>'; return; }
    if (!terms.length && !activeTag) { res.innerHTML = `<p class="hint">${items.length} items in ${boxes.length} boxes. Type to search.</p>`; return; }
    res.innerHTML = hits.length ? hits.sort((a, b) => a.name.localeCompare(b.name)).map((i) => {
      const b = boxMap.get(i.boxId) || { name: '?', location: '' };
      return `<a class="card" href="#/box/${i.boxId}">
        ${i.photo ? `<img class="thumb" src="${photoURL(i.photo)}" alt="">` : ''}
        <div class="grow"><b>${esc(i.name)}</b>${i.qty > 1 ? ` ×${i.qty}` : ''}
        <div class="sub">📦 ${esc(b.name)}${b.location ? ' · ' + esc(b.location) : ''}</div></div></a>`;
    }).join('') : '<p class="empty">No matches.</p>';
  }
  q.oninput = () => { freeURLs(); render(); };
  tagEl.onclick = (e) => { const t = e.target.dataset.t; if (t) { activeTag = activeTag === t ? null : t; freeURLs(); render(); } };
  render(); q.focus();
}

async function viewBoxes() {
  setHeader('Boxes'); setTab('boxes');
  const [boxes, items] = await Promise.all([DB.all('boxes'), DB.all('items')]);
  const count = {}; items.forEach((i) => { count[i.boxId] = (count[i.boxId] || 0) + 1; });
  boxes.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
  $view.innerHTML = `<form id="f" class="noprint"><label>New box name</label>
    <input name="name" required placeholder="e.g. Box 12 – Camping"><label>Location</label>
    <input name="location" placeholder="e.g. Left shelf, top"><button class="pri fab">Add box</button></form>
    ${boxes.length ? boxes.map((b) => `<a class="card" href="#/box/${b.id}">
      ${b.photo ? `<img class="thumb" src="${photoURL(b.photo)}" alt="">` : '<span style="font-size:2rem">📦</span>'}
      <div class="grow"><b>${esc(b.name)}</b><div class="sub">${esc(b.location)}${b.location ? ' · ' : ''}${count[b.id] || 0} items</div></div></a>`).join('') : '<p class="empty">No boxes yet.</p>'}`;
  $view.querySelector('#f').onsubmit = async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const b = { id: DB.uid(), name: fd.get('name').trim(), location: fd.get('location').trim(), notes: '' };
    await DB.put('boxes', b);
    location.hash = '#/label/' + b.id;
  };
}

async function viewBox(id) {
  const box = await DB.get('boxes', id);
  if (!box) { $view.innerHTML = '<p class="empty">Box not found on this device.</p>'; setHeader('Not found', '#/boxes'); return; }
  setHeader(box.name, '#/boxes'); setTab('boxes');
  const items = (await DB.all('items')).filter((i) => i.boxId === id).sort((a, b) => a.name.localeCompare(b.name));
  $view.innerHTML = `<p class="hint">${esc(box.location) || 'No location set'} · ${items.length} items
    · <a href="#/boxedit/${id}">Edit box</a> · <a href="#/label/${id}">QR label</a></p>
    ${box.photo ? `<img src="${photoURL(box.photo)}" alt="" style="width:100%;border-radius:12px">` : ''}
    <form id="f" class="row noprint" style="margin:12px 0"><input name="name" required placeholder="Add item, press Enter" autocomplete="off">
    <button class="pri">Add</button></form>
    ${items.map((i) => `<div class="card" data-id="${i.id}">
      ${i.photo ? `<img class="thumb" src="${photoURL(i.photo)}" alt="">` : ''}
      <a class="grow" href="#/item/${i.id}" style="color:inherit;text-decoration:none"><b>${esc(i.name)}</b>
      <div>${(i.tags || []).map((t) => `<span class="chip">${esc(t)}</span>`).join('')}</div></a>
      <div class="qty"><button data-d="-1">−</button><span>${i.qty}</span><button data-d="1">+</button></div></div>`).join('')
      || '<p class="empty">Empty. Add the first item above.</p>'}`;
  const f = $view.querySelector('#f');
  f.onsubmit = async (e) => {
    e.preventDefault();
    const name = new FormData(f).get('name').trim();
    if (!name) return;
    await DB.put('items', { id: DB.uid(), boxId: id, name, qty: 1, tags: [], notes: '' });
    freeURLs(); await viewBox(id);
    $view.querySelector('#f input').focus();
  };
  $view.onclick = async (e) => {
    const d = e.target.dataset.d; if (!d) return;
    const iid = e.target.closest('.card').dataset.id;
    const it = await DB.get('items', iid);
    it.qty = Math.max(0, it.qty + Number(d));
    await DB.put('items', it);
    e.target.closest('.qty').querySelector('span').textContent = it.qty;
  };
}

async function viewBoxEdit(id) {
  const box = await DB.get('boxes', id);
  if (!box) return;
  setHeader('Edit box', '#/box/' + id); setTab('boxes');
  let photo = box.photo;
  $view.innerHTML = `<form id="f"><label>Name</label><input name="name" required value="${esc(box.name)}">
    <label>Location</label><input name="location" value="${esc(box.location)}">
    <label>Notes</label><textarea name="notes" rows="3">${esc(box.notes)}</textarea>
    <label>Photo of box</label><input type="file" id="ph" accept="image/*" capture="environment">
    <button class="pri fab">Save</button></form>
    <button class="danger fab" id="del">Delete box and its items</button>`;
  $view.querySelector('#ph').onchange = async (e) => { if (e.target.files[0]) photo = await shrinkImage(e.target.files[0]); };
  $view.querySelector('#f').onsubmit = async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    await DB.put('boxes', { ...box, name: fd.get('name').trim(), location: fd.get('location').trim(), notes: fd.get('notes'), photo });
    location.hash = '#/box/' + id;
  };
  $view.querySelector('#del').onclick = async () => {
    if (confirm('Delete this box and all items in it?')) { await DB.deleteBox(id); location.hash = '#/boxes'; }
  };
}

async function viewItem(id) {
  const it = await DB.get('items', id);
  if (!it) return;
  const boxes = (await DB.all('boxes')).sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
  setHeader('Edit item', '#/box/' + it.boxId); setTab('boxes');
  let photo = it.photo;
  $view.innerHTML = `<form id="f"><label>Name</label><input name="name" required value="${esc(it.name)}">
    <label>Quantity</label><input name="qty" type="number" min="0" value="${it.qty}">
    <label>Tags (comma separated, e.g. tools, camping)</label><input name="tags" value="${esc((it.tags || []).join(', '))}">
    <label>Notes</label><textarea name="notes" rows="3">${esc(it.notes)}</textarea>
    <label>Move to box</label><select name="boxId" style="width:100%;padding:12px;margin:4px 0 10px">
    ${boxes.map((b) => `<option value="${b.id}" ${b.id === it.boxId ? 'selected' : ''}>${esc(b.name)}</option>`).join('')}</select>
    ${it.photo ? `<img src="${photoURL(it.photo)}" alt="" style="width:100%;border-radius:12px">` : ''}
    <label>Photo</label><input type="file" id="ph" accept="image/*" capture="environment">
    <button class="pri fab">Save</button></form>
    <button class="danger fab" id="del">Delete item</button>`;
  $view.querySelector('#ph').onchange = async (e) => { if (e.target.files[0]) photo = await shrinkImage(e.target.files[0]); };
  $view.querySelector('#f').onsubmit = async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    await DB.put('items', { ...it, name: fd.get('name').trim(), qty: Math.max(0, parseInt(fd.get('qty'), 10) || 0),
      tags: parseTags(fd.get('tags')), notes: fd.get('notes'), boxId: fd.get('boxId'), photo });
    location.hash = '#/box/' + fd.get('boxId');
  };
  $view.querySelector('#del').onclick = async () => {
    if (confirm('Delete this item?')) { await DB.del('items', id); location.hash = '#/box/' + it.boxId; }
  };
}

// Draw a printable label: QR code + box name + location. Returns a canvas.
function makeLabelCanvas(box) {
  const W = 600, H = 720, QR = 480;
  const c = document.createElement('canvas'); c.width = W; c.height = H;
  const g = c.getContext('2d');
  g.fillStyle = '#fff'; g.fillRect(0, 0, W, H);
  const qr = qrcode(0, 'M'); qr.addData(boxLink(box.id)); qr.make();
  const n = qr.getModuleCount(), quiet = 2, cell = Math.floor(QR / (n + quiet * 2));
  const size = cell * (n + quiet * 2), ox = Math.round((W - size) / 2), oy = 30;
  g.fillStyle = '#000';
  for (let r = 0; r < n; r++) for (let col = 0; col < n; col++) if (qr.isDark(r, col)) g.fillRect(ox + (col + quiet) * cell, oy + (r + quiet) * cell, cell, cell);
  const fit = (text, max, start, weight) => {
    let px = start;
    do { g.font = `${weight} ${px}px system-ui, sans-serif`; px -= 2; } while (g.measureText(text).width > max && px > 14);
  };
  g.textAlign = 'center'; g.textBaseline = 'alphabetic'; g.fillStyle = '#000';
  fit(box.name, W - 60, 72, 700); g.fillText(box.name, W / 2, oy + size + 80);
  if (box.location) { fit(box.location, W - 60, 36, 400); g.fillStyle = '#444'; g.fillText(box.location, W / 2, oy + size + 130); }
  g.strokeStyle = '#999'; g.setLineDash([8, 6]); g.lineWidth = 2; g.strokeRect(4, 4, W - 8, H - 8);
  return c;
}
const canvasBlob = (c) => new Promise((res) => c.toBlob(res, 'image/png'));
const fileSafe = (s) => s.replace(/[^\w\-]+/g, '_').replace(/^_+|_+$/g, '') || 'box';

async function viewLabel(id) {
  const box = await DB.get('boxes', id);
  if (!box) { $view.innerHTML = '<p class="empty">Box not found on this device.</p>'; setHeader('Not found', '#/boxes'); return; }
  setHeader('QR label', '#/box/' + id); setTab('boxes');
  const canvas = makeLabelCanvas(box);
  const blob = await canvasBlob(canvas);
  const file = new File([blob], fileSafe(box.name) + '-qr.png', { type: 'image/png' });
  const canShare = !!(navigator.canShare && navigator.canShare({ files: [file] }));
  $view.innerHTML = `<p class="hint noprint">Label for <b>${esc(box.name)}</b>. Save or print it and stick it on the box.</p>
    <div class="label single"><img id="lbl" src="${photoURL(blob)}" alt="QR label for ${esc(box.name)}"></div>
    <div class="noprint"><button class="pri fab" id="sv">Save image</button>
    ${canShare ? '<button class="fab" id="sh">Share…</button>' : ''}
    <button class="fab" id="pr">Print</button>
    <a class="card" href="#/box/${id}" style="justify-content:center">Add items to this box →</a></div>`;
  $view.querySelector('#sv').onclick = () => {
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = file.name; a.click();
  };
  const sh = $view.querySelector('#sh');
  if (sh) sh.onclick = () => navigator.share({ files: [file], title: box.name }).catch(() => {});
  $view.querySelector('#pr').onclick = () => window.print();
}

async function viewLabels() {
  setHeader('QR labels'); setTab('labels');
  const boxes = (await DB.all('boxes')).sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
  if (!boxes.length) { $view.innerHTML = '<p class="empty">Add boxes first.</p>'; return; }
  const imgs = await Promise.all(boxes.map(async (b) => photoURL(await canvasBlob(makeLabelCanvas(b)))));
  $view.innerHTML = `<p class="hint noprint">Print, cut out and stick one on each box. Tap a label to save it on its own.</p>
    <button class="pri fab noprint" onclick="window.print()">Print all labels</button><div class="labels">
    ${boxes.map((b, i) => `<a class="label" href="#/label/${b.id}"><img src="${imgs[i]}" alt="QR label for ${esc(b.name)}"></a>`).join('')}</div>`;
}

async function viewScan() {
  setHeader('Scan a box'); setTab('scan');
  $view.innerHTML = `<div id="cam"><video id="v" muted playsinline></video></div>
    <p class="hint" id="smsg" role="status">Point the camera at a box's QR label.</p>
    <div id="sfall" hidden><label>Or take/choose a photo of the label</label>
    <input type="file" id="sfile" accept="image/*" capture="environment">
    <a class="card" href="#/boxes" style="justify-content:center">Browse boxes instead</a></div>`;
  const msg = (t) => { $view.querySelector('#smsg').textContent = t; };
  let busy = false, lastBad = 0;
  const handle = async (text) => {
    if (busy) return;
    const id = Scanner.parseBoxId(text);
    if (!id) { if (Date.now() - lastBad > 2000) { lastBad = Date.now(); msg('That QR code is not a box label. Keep scanning…'); } return; }
    busy = true;
    if (await DB.get('boxes', id)) { Scanner.stop(); location.hash = '#/box/' + id; return; }
    msg("That box isn't in this device's data. If you added it on another device, restore a backup (Backup tab).");
    setTimeout(() => { busy = false; }, 2500);
  };
  const fall = (why) => { $view.querySelector('#cam').hidden = true; $view.querySelector('#sfall').hidden = false; msg(why); };
  $view.querySelector('#sfile').onchange = async (e) => {
    const f = e.target.files[0]; if (!f) return;
    msg('Reading…');
    try {
      const text = await Scanner.decodeFile(f);
      if (!text) { msg('No QR code found in that photo. Try again closer and in good light.'); return; }
      busy = false; await handle(text);
    } catch { msg('Could not read that image.'); }
  };
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) { fall('Camera is not available here (needs HTTPS).'); return; }
  try { await Scanner.start($view.querySelector('#v'), handle); }
  catch (e) { fall('Camera unavailable: ' + (e.name === 'NotAllowedError' ? 'permission was denied.' : e.message)); }
}

async function buildBackup() {
  const enc = async (o) => (o.photo ? { ...o, photo: await blobToDataURL(o.photo) } : o);
  return JSON.stringify({
    version: 1,
    boxes: await Promise.all((await DB.all('boxes')).map(enc)),
    items: await Promise.all((await DB.all('items')).map(enc)),
  });
}

async function restoreBackup(text) {
  const data = JSON.parse(text);
  if (!Array.isArray(data.boxes) || !Array.isArray(data.items)) throw new Error('bad format');
  const dec = async (o) => (typeof o.photo === 'string' ? { ...o, photo: await dataURLToBlob(o.photo) } : o);
  const boxes = await Promise.all(data.boxes.map(dec)), items = await Promise.all(data.items.map(dec));
  await DB.clear();
  for (const b of boxes) await DB.put('boxes', b);
  for (const i of items) await DB.put('items', i);
  return { boxes: boxes.length, items: items.length };
}

const backupName = () => 'garage-boxes-' + new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-') + '.json';

async function viewBackup() {
  setHeader('Backup'); setTab('backup');
  const last = Number(Drive.store.get('gb-last-backup')) || 0;
  const days = last ? Math.floor((Date.now() - last) / 86400000) : null;
  const lastTxt = last ? `Last backup: ${new Date(last).toLocaleString()}` + (days > 30 ? ` (${days} days ago, time for a new one)` : '') : 'No backup made yet.';
  $view.innerHTML = `<p>Your data lives only on this device. ${esc(lastTxt)}</p>
    <h3>Google Drive</h3>
    <label>Google OAuth client ID (one-time setup, see README)</label>
    <input id="cid" placeholder="123456-abc.apps.googleusercontent.com" value="${esc(Drive.clientId())}" autocomplete="off">
    <button class="pri fab" id="dbk">Back up to Drive</button>
    <button class="fab" id="drs">Restore from Drive</button>
    <div id="dlist"></div><p class="hint" id="dmsg" role="status"></p>
    <h3>File</h3>
    <button class="fab" id="ex">Export backup (.json)</button>
    <label>Import backup file (replaces current data)</label><input type="file" id="im" accept="application/json">`;
  const msg = (t) => { $view.querySelector('#dmsg').textContent = t; };
  const cid = $view.querySelector('#cid');
  cid.onchange = () => Drive.setClientId(cid.value);
  const markBackedUp = () => Drive.store.set('gb-last-backup', String(Date.now()));

  $view.querySelector('#dbk').onclick = async () => {
    Drive.setClientId(cid.value);
    try {
      msg('Signing in…');
      await Drive.signIn();
      msg('Uploading…');
      const f = await Drive.upload(backupName(), await buildBackup());
      markBackedUp(); msg('Saved to Google Drive as ' + f.name);
    } catch (e) { msg('Backup failed: ' + e.message); }
  };

  $view.querySelector('#drs').onclick = async () => {
    Drive.setClientId(cid.value);
    const box = $view.querySelector('#dlist');
    try {
      msg('Signing in…');
      await Drive.signIn();
      const files = await Drive.list();
      if (!files.length) { box.innerHTML = ''; msg('No backups found in Drive yet.'); return; }
      msg('Pick a backup to restore (replaces current data):');
      box.innerHTML = files.map((f) => `<button class="fab" data-id="${esc(f.id)}">${esc(new Date(f.createdTime).toLocaleString())}</button>`).join('');
      box.onclick = async (e) => {
        const id = e.target.dataset.id; if (!id) return;
        if (!confirm('Replace all current data with this backup?')) return;
        try {
          msg('Restoring…');
          const r = await restoreBackup(await Drive.download(id));
          alert('Restored ' + r.boxes + ' boxes, ' + r.items + ' items.');
          location.hash = '#/boxes';
        } catch (err) { msg('Restore failed: ' + err.message); }
      };
    } catch (e) { msg('Could not list backups: ' + e.message); }
  };

  $view.querySelector('#ex').onclick = async () => {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([await buildBackup()], { type: 'application/json' }));
    a.download = backupName();
    a.click();
    markBackedUp();
  };
  $view.querySelector('#im').onchange = async (e) => {
    const file = e.target.files[0]; if (!file) return;
    try {
      const text = await file.text();
      const d = JSON.parse(text);
      if (!Array.isArray(d.boxes) || !Array.isArray(d.items)) throw new Error('bad format');
      if (!confirm('Replace all current data with this backup?')) return;
      const r = await restoreBackup(text);
      alert('Imported ' + r.boxes + ' boxes, ' + r.items + ' items.');
      location.hash = '#/boxes';
    } catch (err) { alert('Could not import: ' + err.message); }
  };
}

// ---------- Router ----------
async function route() {
  Scanner.stop(); freeURLs(); $view.onclick = null;
  const [, p, id] = (location.hash || '#/').split('/');
  try {
    if (p === 'box') await viewBox(id);
    else if (p === 'boxedit') await viewBoxEdit(id);
    else if (p === 'item') await viewItem(id);
    else if (p === 'boxes') await viewBoxes();
    else if (p === 'labels') await viewLabels();
    else if (p === 'label') await viewLabel(id);
    else if (p === 'scan') await viewScan();
    else if (p === 'backup') await viewBackup();
    else await viewSearch();
  } catch (e) { $view.innerHTML = '<p class="empty">Something went wrong: ' + esc(e.message) + '</p>'; }
}
window.addEventListener('hashchange', route);
route();
if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});
