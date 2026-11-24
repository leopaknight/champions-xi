(() => {
  if (location.href.includes('studio.html')) return;
  const V = { on: true, t: 0, raf: new Map(), timers: new Map(), id: 1e7 };
  window.__V = V;
  const rNow = performance.now.bind(performance), rDN = Date.now.bind(Date);
  const p0 = rNow(); const RD = Date; const d0 = new RD(2026, 10, 24, 6, 28, 0).getTime();
  class FD extends RD { constructor(...a) { if (a.length) super(...a); else super(d0 + V.t); } static now() { return d0 + V.t; } }
  window.Date = FD;
  performance.now = () => p0 + V.t;
  window.requestAnimationFrame = (cb) => { const id = V.id++; V.raf.set(id, cb); return id; };
  window.cancelAnimationFrame = (id) => { V.raf.delete(id); };
  const rST = window.setTimeout.bind(window);
  window.setTimeout = (cb, ms = 0, ...a) => { if (typeof cb !== 'function') return rST(cb, ms); const id = V.id++; V.timers.set(id, { at: V.t + (+ms || 0), cb, a }); return id; };
  window.setInterval = (cb, ms = 0, ...a) => { const iv = Math.max(4, +ms || 0); const id = V.id++; V.timers.set(id, { at: V.t + iv, cb, a, iv }); return id; };
  window.clearTimeout = window.clearInterval = (id) => { V.timers.delete(id); };
  window.__tick = (ms) => {
    const end = V.t + ms;
    for (let g = 0; g < 2000; g++) {
      let best = null;
      for (const [id, tm] of V.timers) if (tm.at <= end && (!best || tm.at < best[1].at)) best = [id, tm];
      if (!best) break;
      const [id, tm] = best; V.t = Math.max(V.t, tm.at);
      if (tm.iv) tm.at += tm.iv; else V.timers.delete(id);
      try { tm.cb(...tm.a); } catch (e) { console.error(e); }
    }
    V.t = end;
    const cbs = [...V.raf.values()]; V.raf.clear();
    const now = performance.now();
    for (const cb of cbs) { try { cb(now); } catch (e) { console.error(e); } }
  };
  try { localStorage.setItem('fz3d:qualidade', 'leve'); localStorage.setItem('fz3d:nome', 'João'); } catch {}
})();
