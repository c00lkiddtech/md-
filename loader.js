// Serves the Godot engine's fetch() / AudioWorklet.addModule() calls from data/*.js so it runs from file://
(() => {
  const FILES = {"index.wasm": {"chunks": 12, "size": 37406162, "type": "application/wasm"}, "index.pck": {"chunks": 40, "size": 124873836, "type": "application/octet-stream"}, "index.audio.worklet.js": {"chunks": 1, "size": 7298, "type": "text/javascript"}, "index.audio.position.worklet.js": {"chunks": 1, "size": 2973, "type": "text/javascript"}};  // name -> {chunks, size, type}
  const parts = new Map(), done = new Map();
  window.__chunk = (name, i, b64) => {
    const bin = atob(b64); const b = new Uint8Array(bin.length);
    for (let k = 0; k < bin.length; k++) b[k] = bin.charCodeAt(k);
    parts.get(name)[i] = b;
  };
  const script = (src) => new Promise((res, rej) => {
    const s = document.createElement('script'); s.src = src;
    s.onload = () => { s.remove(); res(); }; s.onerror = () => { s.remove(); rej(new Error('missing ' + src)); };
    document.head.appendChild(s);
  });
  const load = (name) => {
    if (!done.has(name)) {
      const f = FILES[name]; parts.set(name, new Array(f.chunks));
      done.set(name, (async () => {
        for (let i = 0; i < f.chunks; i++) await script(`data/${name}-${String(i).padStart(2, '0')}.js`);
        const all = new Uint8Array(f.size); let o = 0;
        for (const b of parts.get(name)) { all.set(b, o); o += b.length; }
        parts.delete(name); return all;
      })());
    }
    return done.get(name);
  };
  const nameOf = (url) => { const n = String(url).split(/[?#]/)[0].split('/').pop(); return FILES[n] ? n : null; };
  const realFetch = window.fetch.bind(window);
  window.fetch = (url, opts) => {
    const n = nameOf(typeof url === 'string' ? url : url?.url);
    if (!n) return realFetch(url, opts);
    return load(n).then((b) => {
      // the .pck is only read once; let its bytes go after this
      if (n.endsWith('.pck')) done.delete(n);
      return new Response(b, { status: 200, headers: { 'Content-Type': FILES[n].type, 'Content-Length': String(b.length) } });
    });
  };
  if (window.AudioWorklet) {
    const add = AudioWorklet.prototype.addModule;
    AudioWorklet.prototype.addModule = function (url, o) {
      const n = nameOf(url); if (!n) return add.call(this, url, o);
      // blob: URLs are refused for worklets on file:// pages; data: URLs work
      return load(n).then((b) => { let t = ''; for (const c of b) t += String.fromCharCode(c); return add.call(this, 'data:text/javascript;base64,' + btoa(t), o); });
    };
  }
})();
