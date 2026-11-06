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
    location.hash = '#/box/' + b.id;
  };
}

async function viewBox(id) {
  const box = await DB.get('boxes', id);
  if (!box) { $view.innerHTML = '<p class="empty">Box not found on this device.</p>'; setHeader('Not found', '#/boxes'); return; }
  setHeader(box.name, '#/boxes'); setTab('boxes');
  const items = (await DB.all('items')).filter((i) => i.boxId === id).sort((a, b) => a.name.localeCompare(b.name));
  $view.innerHTML = `<p class="hint">${esc(box.location) || 'No location set'} · ${items.length} items
    · <a href="#/boxedit/${id}">Edit box</a></p>
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

async function viewLabels() {
  setHeader('QR labels'); setTab('labels');
  const boxes = (await DB.all('boxes')).sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
  if (!boxes.length) { $view.innerHTML = '<p class="empty">Add boxes first.</p>'; return; }
  $view.innerHTML = `<p class="hint noprint">Print, cut out and stick one on each box. Scanning it with this phone opens the box contents.</p>
    <button class="pri fab noprint" onclick="window.print()">Print labels</button><div class="labels">
    ${boxes.map((b) => {
      const qr = qrcode(0, 'M'); qr.addData(boxLink(b.id)); qr.make();
      return `<div class="label">${qr.createSvgTag({ cellSize: 4, margin: 2, scalable: true })}<b>${esc(b.name)}</b><span>${esc(b.location)}</span></div>`;
    }).join('')}</div>`;
}

async function viewBackup() {
  setHeader('Backup'); setTab('backup');
  $view.innerHTML = `<p>Your data lives only on this device. Export a backup regularly (and before clearing browser data).</p>
    <button class="pri fab" id="ex">Export backup (.json)</button>
    <label>Import backup (replaces current data)</label><input type="file" id="im" accept="application/json">`;
  $view.querySelector('#ex').onclick = async () => {
    const enc = async (o) => (o.photo ? { ...o, photo: await blobToDataURL(o.photo) } : o);
    const data = { version: 1, boxes: await Promise.all((await DB.all('boxes')).map(enc)), items: await Promise.all((await DB.all('items')).map(enc)) };
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([JSON.stringify(data)], { type: 'application/json' }));
    a.download = 'garage-boxes-' + new Date().toISOString().slice(0, 10) + '.json';
    a.click();
  };
  $view.querySelector('#im').onchange = async (e) => {
    const file = e.target.files[0]; if (!file) return;
    try {
      const data = JSON.parse(await file.text());
      if (!Array.isArray(data.boxes) || !Array.isArray(data.items)) throw new Error('bad format');
      if (!confirm('Replace all current data with this backup?')) return;
      const dec = async (o) => (typeof o.photo === 'string' ? { ...o, photo: await dataURLToBlob(o.photo) } : o);
      const boxes = await Promise.all(data.boxes.map(dec)), items = await Promise.all(data.items.map(dec));
      await DB.clear();
      for (const b of boxes) await DB.put('boxes', b);
      for (const i of items) await DB.put('items', i);
      alert('Imported ' + boxes.length + ' boxes, ' + items.length + ' items.');
      location.hash = '#/boxes';
    } catch (err) { alert('Could not import: ' + err.message); }
  };
}

// ---------- Router ----------
async function route() {
  freeURLs(); $view.onclick = null;
  const [, p, id] = (location.hash || '#/').split('/');
  try {
    if (p === 'box') await viewBox(id);
    else if (p === 'boxedit') await viewBoxEdit(id);
    else if (p === 'item') await viewItem(id);
    else if (p === 'boxes') await viewBoxes();
    else if (p === 'labels') await viewLabels();
    else if (p === 'backup') await viewBackup();
    else await viewSearch();
  } catch (e) { $view.innerHTML = '<p class="empty">Something went wrong: ' + esc(e.message) + '</p>'; }
}
window.addEventListener('hashchange', route);
route();
if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});
