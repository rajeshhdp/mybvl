// QR scanning: native BarcodeDetector when present, else vendored jsQR.
const Scanner = (() => {
  let stream = null, raf = 0, running = false, detector = null;
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d', { willReadFrequently: true });

  function nativeDetector() {
    if (detector !== null) return detector;
    try { detector = 'BarcodeDetector' in window ? new BarcodeDetector({ formats: ['qr_code'] }) : false; } catch { detector = false; }
    return detector;
  }

  // Decode a drawable (video, img, canvas) -> string or null
  async function decode(src, w, h) {
    const det = nativeDetector();
    if (det) {
      try { const r = await det.detect(src); if (r.length) return r[0].rawValue; } catch { /* fall through to jsQR */ }
    }
    if (!window.jsQR) return null;
    canvas.width = w; canvas.height = h;
    ctx.drawImage(src, 0, 0, w, h);
    const r = jsQR(ctx.getImageData(0, 0, w, h).data, w, h, { inversionAttempts: 'attemptBoth' });
    return r ? r.data : null;
  }

  async function decodeFile(file) {
    const url = URL.createObjectURL(file);
    try {
      const img = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = () => rej(new Error('bad image')); i.src = url; });
      const k = Math.min(1, 1200 / Math.max(img.width, img.height));
      return await decode(img, Math.round(img.width * k), Math.round(img.height * k));
    } finally { URL.revokeObjectURL(url); }
  }

  async function start(video, onResult) {
    stop();
    stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio: false });
    video.srcObject = stream;
    video.setAttribute('playsinline', '');
    await video.play();
    running = true;
    let last = 0, busy = false;
    const tick = async (t) => {
      if (!running) return;
      if (!busy && t - last > 150 && video.videoWidth) {
        busy = true; last = t;
        const k = Math.min(1, 640 / video.videoWidth);
        const text = await decode(video, Math.round(video.videoWidth * k), Math.round(video.videoHeight * k)).catch(() => null);
        busy = false;
        if (text && running) onResult(text);
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
  }

  function stop() {
    running = false;
    cancelAnimationFrame(raf);
    if (stream) { stream.getTracks().forEach((t) => t.stop()); stream = null; }
  }

  // Pull a box id out of scanned text (URL with #/box/<id> from any origin, or "box:<id>").
  function parseBoxId(text) {
    const m = String(text).match(/#\/box\/([A-Za-z0-9]+)/) || String(text).match(/^box:([A-Za-z0-9]+)$/);
    return m ? m[1] : null;
  }

  return { start, stop, decode, decodeFile, parseBoxId };
})();
window.addEventListener('pagehide', () => Scanner.stop());
