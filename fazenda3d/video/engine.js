const { chromium } = require('playwright');
const fs = require('fs');
const FPS = +process.env.FPS || 30, DT = 1000 / FPS;
const OUT = process.env.OUT || 'frames';
const E = { list: [], n: 0, cur: [960, 600], curA: 0, capA: 0, spot: null, last: null, t0: Date.now() };
E.init = async () => {
  fs.rmSync(OUT, { recursive: true, force: true }); fs.mkdirSync(OUT);
  E.b = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--allow-file-access-from-files'] });
  E.ctx = await E.b.newContext({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
  await E.ctx.addInitScript({ content: fs.readFileSync(__dirname + '/shim.js', 'utf8').replace("'leve'", JSON.stringify(process.env.Q || 'leve')) + ';Element.prototype.requestFullscreen = function () { return Promise.resolve(); };' });
  E.p = await E.ctx.newPage();
  E.p.on('pageerror', (e) => console.log('PAGEERR', e.message));
  E.p.on('console', (m) => { if (m.type() === 'error') console.log('CONSOLE', m.text().slice(0, 200)); });
  await E.p.goto('file://' + __dirname + '/studio.html');
  E.f = E.p.frames().find((x) => x.url().includes('app.html'));
  await E.p.waitForTimeout(1500);
  for (let i = 0; i < 30; i++) { await E.f.evaluate((ms) => window.__tick(ms), 100); }
  await E.p.evaluate(() => document.fonts.ready);
  await E.f.evaluate(() => { const u = window.__fazenda.ui; const rv = u.renderView.bind(u); u.renderView = (...a) => { const v = document.querySelector('#view'); const st = v ? v.scrollTop : 0; const r = rv(...a); const v2 = document.querySelector('#view'); if (v2) v2.scrollTop = st; return r; }; });
  E.cdp = await E.ctx.newCDPSession(E.p);
  await E.cdp.send('Animation.enable');
};
E.setRate = async (r) => { await E.cdp.send('Animation.setPlaybackRate', { playbackRate: r }); };
E.track = async () => { if (!E.spotSel || !E.spot || E.spot[4] < 1) return; const b = await E.box(E.spotSel, E.f, true); if (b) E.spot = [b.x - E.spotPad, b.y - E.spotPad, b.width + 2 * E.spotPad, b.height + 2 * E.spotPad, 1]; };
const ov = () => ({ cur: E.cur, curA: E.curA, capA: E.capA, ...(E.spot ? { spot: E.spot } : {}) });
E.shot = async (dur) => {
  const name = `${OUT}/${String(E.n++).padStart(6, '0')}.jpg`;
  await E.p.screenshot({ path: name, type: 'jpeg', quality: 90 });
  E.list.push([name, dur]); E.last = name;
};
// avança n quadros renderizando cada um (algo se mexe)
E.live = async (n, each) => {
  for (let i = 0; i < n; i++) {
    if (each) await each(i / Math.max(1, n - 1), i);
    await E.f.evaluate((ms) => window.__tick(ms), DT);
    await E.track();
    await E.p.evaluate((o) => S.set(o), ov());
    await E.shot(1 / FPS);
  }
};
E.sec = (s) => Math.max(1, Math.round(s * FPS));
// segura: um quadro só, repetido (nada se mexe)
E.hold = async (s) => {
  await E.f.evaluate((ms) => { for (let k = 0; k < 6; k++) window.__tick(ms / 6); }, s * 1000);
  await E.track();
  await E.p.evaluate((o) => S.set(o), ov());
  await E.shot(s);
};
E.wait = async (s, live) => (live ? E.live(E.sec(s)) : E.hold(s));
const ease = (k) => (k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2);
E.ease = ease;
E.caption = async (k, h, p, cls = '', live = false) => {
  if (E.capA > 0) await E.live(E.sec(0.25), (k2) => { E.capA = 1 - k2; });
  await E.p.evaluate(([a, b, c, d]) => S.cap(a, b, c, d), [k, h, p, cls]);
  await E.live(E.sec(0.4), (k2) => { E.capA = ease(k2); });
};
E.capOff = async () => { if (E.capA > 0) await E.live(E.sec(0.3), (k) => { E.capA = 1 - k; }); };
E.box = async (sel, frame = E.f, noScroll) => {
  const r = await frame.evaluate(([sel, ns]) => { const el = document.querySelector(sel); if (!el) return null; if (!ns) { const b0 = el.getBoundingClientRect(); if (b0.top < 70 || b0.bottom > innerHeight - 20) el.scrollIntoView({ block: 'center' }); } const b = el.getBoundingClientRect(); return { x: b.left, y: b.top, width: b.width, height: b.height }; }, [sel, !!noScroll]);
  if (!r) return null;
  const off = frame === E.p.mainFrame() ? { x: 0, y: 0 } : await E.p.evaluate(() => { const b = document.querySelector('#app').getBoundingClientRect(); return { x: b.left, y: b.top }; });
  return { x: r.x + off.x, y: r.y + off.y, width: r.width, height: r.height };
};
E.move = async (x, y, s = 0.7) => {
  const [x0, y0] = E.cur; if (E.curA < 1) { E.cur = [x, y]; await E.live(E.sec(0.25), (k) => { E.curA = k; }); return; }
  await E.live(E.sec(s), (k) => { const e = ease(k); E.cur = [x0 + (x - x0) * e, y0 + (y - y0) * e - Math.sin(Math.PI * k) * 40]; });
};
E.moveTo = async (sel, s, frame) => { const b = await E.box(sel, frame); if (!b) { console.log('SEM ALVO', sel); return null; } await E.move(b.x + b.width / 2, b.y + b.height / 2, s); return b; };
E.ripple = async () => { const [x, y] = E.cur; await E.live(E.sec(0.35), async (k) => { await E.p.evaluate((o) => S.set(o), { rip: [x, y, k] }); }); await E.p.evaluate(() => S.set({ rip: [0, 0, 1] })); };
E.click = async (sel, opts = {}) => {
  const frame = opts.frame || E.f;
  const b = await E.moveTo(sel, opts.s, frame); if (!b) return false;
  await E.p.mouse.click(E.cur[0], E.cur[1]);
  await E.ripple();
  return true;
};
E.spotOn = async (sel, pad = 10, frame) => {
  const b = await E.box(sel, frame); if (!b) { console.log('SEM SPOT', sel); return; }
  E.spotSel = null; E.spotPad = pad;
  const to = [b.x - pad, b.y - pad, b.width + 2 * pad, b.height + 2 * pad];
  const from = E.spot && E.spot[4] > 0 ? E.spot.slice(0, 4) : to;
  await E.live(E.sec(0.45), (k) => { const e = ease(k); E.spot = [...from.map((v, i) => v + (to[i] - v) * e), E.spot && E.spot[4] > 0 ? 1 : e]; });
  E.spotSel = sel;
};
E.spotOff = async () => { E.spotSel = null; if (!E.spot || !E.spot[4]) return; const s = E.spot.slice(0, 4); await E.live(E.sec(0.3), (k) => { E.spot = [...s, 1 - k]; }); E.spot = null; await E.p.evaluate(() => S.set({ spot: [0, 0, 0, 0, 0] })); };
E.go = async (v) => { await E.f.evaluate((v) => { location.hash = v; }, v); await E.f.evaluate(() => { const el = document.querySelector('#view'); if (el) el.scrollTop = 0; }); await E.f.evaluate(() => { for (let k = 0; k < 10; k++) window.__tick(30); }); };
E.ev = (fn, arg) => E.f.evaluate(fn, arg);
E.scroll = async (sel, dy, s = 1) => { const b = await E.box(sel); await E.live(E.sec(s), async (k, i) => { const n = E.sec(s); await E.f.evaluate(([sel, d]) => { const el = document.querySelector(sel); if (el) el.scrollTop += d; }, [sel, dy / n]); }); void b; };
E.card = async (html, s, items = 0) => {
  await E.capOff(); await E.spotOff();
  await E.p.evaluate((h) => S.card(h), html);
  await E.live(E.sec(0.5), async (k) => { await E.p.evaluate((a) => S.set({ cardA: a, items: 0 }), ease(k)); });
  if (items) { const per = 0.55; await E.live(E.sec(items * per), async (k) => { await E.p.evaluate((x) => S.set({ items: x }), k * items); }); }
  await E.hold(s);
};
E.cardOff = async () => { await E.live(E.sec(0.5), async (k) => { await E.p.evaluate((a) => S.set({ cardA: a }), 1 - ease(k)); }); };
E.finish = async () => {
  let txt = ''; for (const [f, d] of E.list) txt += `file '${f.split('/').pop()}'\nduration ${d.toFixed(5)}\n`;
  txt += `file '${E.last.split('/').pop()}'\n`;
  fs.writeFileSync(`${OUT}/list.txt`, txt);
  const tot = E.list.reduce((a, x) => a + x[1], 0);
  console.log(`quadros ${E.n} · vídeo ${tot.toFixed(1)} s · ${((Date.now() - E.t0) / 60000).toFixed(1)} min`);
  await E.b.close();
};
module.exports = E;
// marca por texto: o card/section cujo título contém o texto
E.mark = async (txt, scope = 'section, .card, .tile, .drawer, .m-b, details, .tbl-wrap', frame = E.f) => {
  const id = 't' + Math.random().toString(36).slice(2, 7);
  const ok = await frame.evaluate(([txt, scope, id]) => {
    const els = [...document.querySelectorAll(scope)].filter((e) => e.offsetParent !== null && e.textContent.includes(txt));
    if (!els.length) return false;
    els.sort((a, b) => a.textContent.length - b.textContent.length);
    els[0].setAttribute('data-tour', id); return true;
  }, [txt, scope, id]);
  if (!ok) console.log('SEM MARCA', txt);
  return `[data-tour="${id}"]`;
};
E.spotT = async (txt, pad, scope) => E.spotOn(await E.mark(txt, scope), pad);
E.ui = (fn, arg) => E.f.evaluate(fn, arg);
