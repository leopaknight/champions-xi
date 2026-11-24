// Helpers de interface: ícones, chips, gráficos SVG, rampas de cor, download.
import { esc, num } from './util.js';

const P = {
  mapa: 'M3 6l6-3 6 3 6-3v15l-6 3-6-3-6 3zM9 3v15M15 6v15',
  painel: 'M3 3h8v8H3zM13 3h8v5h-8zM13 10h8v11h-8zM3 13h8v8H3z',
  agenda: 'M4 5h16v16H4zM4 9h16M8 3v4M16 3v4M8 13h3M8 17h3M13 13h3',
  solo: 'M9 3h6M10 3v6l-5 9a2 2 0 002 3h10a2 2 0 002-3l-5-9V3M7.5 15h9',
  fito: 'M12 7a4 4 0 014 4v4a4 4 0 01-8 0v-4a4 4 0 014-4zM12 7V4M8 4l2 3M16 4l-2 3M8 12H4M20 12h-4M8 16l-3 2M16 16l3 2',
  irrig: 'M12 3s6 7 6 11a6 6 0 01-12 0c0-4 6-11 6-11z',
  colheita: 'M4 10h16l-2 10H6zM8 10V7a4 4 0 018 0v3M9 14h0M12 15h0M15 14h0',
  equip: 'M3 17h2a2 2 0 104 0h6a2 2 0 104 0h2v-5l-3-4h-5V5H6v7H3zM14 8v4h6',
  manut: 'M14 7a4 4 0 00-5 5l-6 6 3 3 6-6a4 4 0 005-5l-2 2-3-1-1-3z',
  invent: 'M4 5h16M4 10h16M4 15h10M4 20h7M17 15l2 2 3-4',
  relat: 'M6 3h9l4 4v14H6zM15 3v4h4M9 12h7M9 16h7M9 8h3',
  config: 'M12 9a3 3 0 100 6 3 3 0 000-6zM19 12l2-1-1-3-2 .2-1.3-1.6.4-2-3-1-1 1.8h-2L10 3 7 4l.4 2L6 7.6 4 7.5 3 10.5l2 1.2v.6L3 13.5l1 3 2-.1 1.3 1.6-.4 2 3 1 1.1-1.8h2l1 1.8 3-1-.4-2 1.4-1.6 2 .2 1-3z',
  busca: 'M11 4a7 7 0 100 14 7 7 0 000-14zM21 21l-5-5',
  fechar: 'M6 6l12 12M18 6L6 18',
  mais: 'M12 5v14M5 12h14',
  alvo: 'M12 3v4M12 17v4M3 12h4M17 12h4M12 8a4 4 0 100 8 4 4 0 000-8z',
  play: 'M7 5l12 7-12 7z',
  pause: 'M7 5h4v14H7zM13 5h4v14h-4z',
  camadas: 'M12 3l9 5-9 5-9-5zM3 13l9 5 9-5M3 17l9 5 9-5',
  baixar: 'M12 4v11M7 10l5 5 5-5M5 20h14',
  editar: 'M4 20h4l11-11-4-4L4 16zM14 6l4 4',
  lixo: 'M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3',
  seta: 'M9 6l6 6-6 6',
  voltar: 'M15 6l-6 6 6 6',
  planta: 'M12 21v-8M12 13c0-4 3-7 7-7 0 4-3 7-7 7zM12 15c0-3-2-5-5-5 0 3 2 5 5 5z',
  menu: 'M4 6h16M4 12h16M4 18h16',
  check: 'M5 12l5 5 9-10',
  aviso: 'M12 3l10 18H2zM12 10v5M12 18h0',
  gps: 'M12 21s7-6 7-11a7 7 0 00-14 0c0 5 7 11 7 11zM12 7a3 3 0 100 6 3 3 0 000-6z',
  casa: 'M3 11l9-7 9 7M5 10v10h5v-6h4v6h5V10',
  cubo: 'M12 3l8 4.5v9L12 21l-8-4.5v-9zM12 12l8-4.5M12 12v9M12 12L4 7.5',
  trator: 'M3 16a3 3 0 106 0 3 3 0 00-6 0zM15 17a2 2 0 104 0 2 2 0 00-4 0zM9 16h6M5 13V7h6l2 6M13 9h5l2 4v3M8 7V4',
  grafico: 'M4 20h16M6 16v-5M10 16V8M14 16v-7M18 16V5',
  sino: 'M6 16V11a6 6 0 0112 0v5l2 2H4zM10 20a2 2 0 004 0',
  usuario: 'M12 12a4 4 0 100-8 4 4 0 000 8zM4 21a8 8 0 0116 0',
  nuvem: 'M7 18h10a4 4 0 00.7-7.94A6 6 0 006.2 9.1 4.5 4.5 0 007 18z',
  nuvemok: 'M7 18h10a4 4 0 00.7-7.94A6 6 0 006.2 9.1 4.5 4.5 0 007 18zM9.5 13l2 2 3.5-3.5',
  gota: 'M12 3s6 7 6 11a6 6 0 01-12 0c0-4 6-11 6-11z',
  vento: 'M3 9h11a3 3 0 10-3-3M3 13h15a3 3 0 11-3 3M3 17h7',
  chev: 'M6 9l6 6 6-6',
  campo: 'M3 18c4-6 14-6 18 0M3 14c5-7 13-7 18 0M5 10c4-5 10-5 14 0M12 4v4',
  grao: 'M12 3c4 0 7 4 7 9s-3 9-7 9-7-4-7-9 3-9 7-9zM12 3c-2 4-2 14 0 18',
  folha: 'M5 19C5 10 11 4 20 4c0 9-6 15-15 15zM5 19l8-8',
  tesoura: 'M6 6a2 2 0 104 0 2 2 0 00-4 0zM6 18a2 2 0 104 0 2 2 0 00-4 0zM9.5 7.5L20 18M9.5 16.5L20 6',
  spray: 'M8 10h6v11H8zM10 10V7h2v3M12 7h3M17 5h.01M19 7h.01M17 9h.01M19 3h.01',
  saco: 'M8 6h8l2 4v9a2 2 0 01-2 2H8a2 2 0 01-2-2v-9zM9 3h6l-1 3h-4zM10 14c1-2 3-2 4 0',
  mira: 'M12 12m-8 0a8 8 0 1016 0 8 8 0 10-16 0M12 12m-4 0a4 4 0 108 0 4 4 0 10-8 0M12 12h.01',
  bussola: 'M12 3l3 9-3 9-3-9z',
  expandir: 'M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5',
  menos: 'M5 12h14',
  check2: 'M5 12l5 5 9-10',
  pino: 'M12 21s7-6 7-11a7 7 0 00-14 0c0 5 7 11 7 11z',
};
export function ic(n, cls = '') {
  return `<svg class="ic ${cls}" viewBox="0 0 24 24" aria-hidden="true"><path d="${P[n] || P.mais}"/></svg>`;
}

export function chip(text, cls = '') { return `<span class="chip ${cls}">${esc(text)}</span>`; }

export const STCLS = { atrasada: 'st-bad', agora: 'st-warn', feita: 'st-ok', futura: 'st-fut', opcional: 'st-cancel' };
export const STNOME = { atrasada: 'Atrasada', agora: 'Na janela', feita: 'Feita', futura: 'Futura', opcional: 'Opcional' };

// rampa de cor entre paradas [[t, '#hex'], ...]
function hex2rgb(h) { const n = parseInt(h.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }
export function ramp(t, stops) {
  if (t == null || Number.isNaN(t)) return null;
  t = Math.max(0, Math.min(1, t));
  for (let i = 1; i < stops.length; i++) {
    if (t <= stops[i][0]) {
      const [t0, c0] = stops[i - 1], [t1, c1] = stops[i];
      const k = (t - t0) / (t1 - t0 || 1);
      const a = hex2rgb(c0), b = hex2rgb(c1);
      return '#' + a.map((v, j) => Math.round(v + (b[j] - v) * k).toString(16).padStart(2, '0')).join('');
    }
  }
  return stops[stops.length - 1][1];
}
export const RAMPA_RISCO = [[0, '#3f8f4f'], [0.5, '#e0a526'], [1, '#d2452f']];
export const RAMPA_PROD = [[0, '#e8dcb5'], [0.35, '#c9c46a'], [0.7, '#5f9a48'], [1, '#1f5a2e']];
export const RAMPA_AGUA = [[0, '#d7e7ef'], [1, '#14608a']];
const PALETA = ['#c96f3b', '#5f8f4e', '#d6a43c', '#4f86a8', '#9a5fa3', '#3a9d8f', '#b5485d', '#7a8f3a', '#5a6fc0', '#c08a3e', '#6d4f9c', '#2f7f5f'];
export function corCat(i) { return PALETA[((i % PALETA.length) + PALETA.length) % PALETA.length]; }

// Gráfico de linhas SVG simples, cores via CSS (currentColor + classes)
export function lineChart(series, { w = 560, h = 180, yMax = null, yLabel = '', xLabels = [], refLines = [] } = {}) {
  const pad = { l: 38, r: 10, t: 10, b: 24 };
  const all = series.flatMap((s) => s.pts.map((p) => p[1]));
  const ymax = yMax ?? Math.max(1, ...all, ...refLines.map((r) => r.y)) * 1.15;
  const xs = series.flatMap((s) => s.pts.map((p) => p[0]));
  const x0 = xs.length ? Math.min(...xs) : 0, x1 = xs.length ? Math.max(...xs) : 1;
  const X = (x) => pad.l + ((x - x0) / (x1 - x0 || 1)) * (w - pad.l - pad.r);
  const Y = (y) => h - pad.b - (y / ymax) * (h - pad.t - pad.b);
  let g = '';
  for (let i = 0; i <= 4; i++) {
    const v = (ymax * i) / 4;
    g += `<line class="grid" x1="${pad.l}" x2="${w - pad.r}" y1="${Y(v)}" y2="${Y(v)}"/><text class="ax" x="${pad.l - 6}" y="${Y(v) + 4}" text-anchor="end">${num(v, v < 10 ? 1 : 0)}</text>`;
  }
  for (const xl of xLabels) g += `<text class="ax" x="${X(xl[0])}" y="${h - 6}" text-anchor="middle">${esc(xl[1])}</text>`;
  for (const r of refLines) g += `<line class="ref" x1="${pad.l}" x2="${w - pad.r}" y1="${Y(r.y)}" y2="${Y(r.y)}" style="stroke:${r.cor || 'currentColor'}"/><text class="ax" x="${w - pad.r}" y="${Y(r.y) - 4}" text-anchor="end">${esc(r.l || '')}</text>`;
  for (const s of series) {
    if (!s.pts.length) continue;
    const d = s.pts.map((p, i) => `${i ? 'L' : 'M'}${X(p[0]).toFixed(1)},${Y(p[1]).toFixed(1)}`).join('');
    if (s.area) g += `<path d="${d}L${X(s.pts[s.pts.length - 1][0])},${Y(0)}L${X(s.pts[0][0])},${Y(0)}Z" style="fill:${s.cor};opacity:.12"/>`;
    g += `<path d="${d}" fill="none" style="stroke:${s.cor}" stroke-width="2"/>`;
    const lp = s.pts[s.pts.length - 1];
    g += s.pts.map((p) => `<circle cx="${X(p[0])}" cy="${Y(p[1])}" r="${p === lp ? 3.5 : 2}" style="fill:${s.cor}"/>`).join('');
  }
  return `<svg class="chart" viewBox="0 0 ${w} ${h}" preserveAspectRatio="xMidYMid meet" role="img">${yLabel ? `<title>${esc(yLabel)}</title>` : ''}${g}</svg>`;
}

export function barH(items, { max = null, unit = '' } = {}) {
  const mx = max ?? Math.max(1, ...items.map((i) => i.v));
  return `<div class="bars">${items.map((i) => `<div class="bar-row"><span class="bar-l">${esc(i.l)}</span><span class="bar-t"><span class="bar-f" style="width:${Math.max(0, Math.min(100, (i.v / mx) * 100))}%;background:${i.cor || 'var(--accent)'}"></span>${i.ref != null ? `<span class="bar-ref" style="left:${Math.min(100, (i.ref / mx) * 100)}%"></span>` : ''}</span><span class="bar-v">${esc(i.txt ?? num(i.v, 1) + unit)}</span></div>`).join('')}</div>`;
}

export async function baixar(nome, dados, tipo = 'text/plain') {
  try {
    if (window.claude && typeof window.claude.use === 'function') {
      const dl = await window.claude.use('downloads');
      if (dl) { await dl.save({ filename: nome, data: dados }); return 'salvo'; }
    }
  } catch (e) {
    if (e && e.code === 'declined') return 'cancelado';
  }
  const blob = dados instanceof Blob ? dados : new Blob([dados], { type: tipo });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = nome;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1500);
  return 'salvo';
}

export function lerArquivo(accept) {
  return new Promise((res) => {
    const i = document.createElement('input');
    i.type = 'file'; i.accept = accept;
    i.onchange = () => {
      const f = i.files[0];
      if (!f) return res(null);
      const r = new FileReader();
      r.onload = () => res({ nome: f.name, texto: r.result });
      r.readAsText(f);
    };
    i.click();
  });
}

// Marca: dois grãos de café e folhas
export function logoSVG(cls = '') {
  return `<svg class="logo ${cls}" viewBox="0 0 64 64" aria-hidden="true">
  <path d="M34 22c4-12 16-16 24-14-1 9-8 18-22 17z" fill="#4f9a3c"/><path d="M34 22c6-6 12-10 20-12" stroke="#2f6b2a" stroke-width="1.6" fill="none"/>
  <path d="M30 20C25 9 16 6 9 8c2 8 9 14 21 13z" fill="#3a7f33"/><path d="M30 20C24 15 18 11 11 9" stroke="#25591f" stroke-width="1.6" fill="none"/>
  <ellipse cx="22" cy="42" rx="12" ry="15" transform="rotate(-28 22 42)" fill="#7a3e1e"/><path d="M14 31c8 4 10 14 16 22" stroke="#4a230f" stroke-width="2.4" fill="none" stroke-linecap="round"/>
  <ellipse cx="42" cy="44" rx="11" ry="14" transform="rotate(22 42 44)" fill="#9a5226"/><path d="M47 32c-7 5-9 14-12 22" stroke="#5c2c12" stroke-width="2.4" fill="none" stroke-linecap="round"/></svg>`;
}

// Ramo de café com cerejas (decorativo, desenhado em SVG)
export function ramoSVG() {
  const folhas = [[40, 120, -30, 1.2], [92, 86, 20, 1.3], [150, 128, 60, 1.1], [20, 200, -60, 1], [128, 210, 30, 1.25], [70, 250, -10, 1.05], [176, 60, 40, 0.9]];
  const cerejas = [[78, 150], [92, 158], [84, 168], [100, 146], [70, 162], [96, 172], [110, 160], [60, 186], [74, 196], [62, 204], [118, 180], [130, 190], [122, 200], [40, 160], [52, 170]];
  return `<svg class="ramo" viewBox="0 0 220 300" aria-hidden="true">
  <path d="M-10 300C40 240 90 180 210 30" stroke="#5b4030" stroke-width="5" fill="none" stroke-linecap="round"/>
  ${folhas.map(([x, y, r, k]) => `<g transform="translate(${x} ${y}) rotate(${r}) scale(${k})"><path d="M0 0C14 -28 52 -34 74 -18C54 0 22 12 0 0z" fill="#2f6b33"/><path d="M0 0C24 -12 48 -18 74 -18" stroke="#6fa95a" stroke-width="1.4" fill="none"/></g>`).join('')}
  ${cerejas.map(([x, y], i) => `<circle cx="${x}" cy="${y}" r="${7 + (i % 3)}" fill="${i % 5 === 0 ? '#e0574a' : i % 4 === 0 ? '#8f1d16' : '#c22f24'}"/><circle cx="${x - 2.5}" cy="${y - 2.5}" r="2" fill="#ffffff" opacity=".45"/>`).join('')}</svg>`;
}

// Rosca (donut) com segmentos {v, cor}
export function donut(segs, { centro = '', sub = '', tam = 150, esp = 20 } = {}) {
  const tot = segs.reduce((a, s) => a + s.v, 0) || 1;
  const r = (tam - esp) / 2, C = 2 * Math.PI * r;
  let acc = 0;
  const arcs = segs.filter((s) => s.v > 0).map((s) => {
    const len = (s.v / tot) * C;
    const el = `<circle r="${r}" cx="${tam / 2}" cy="${tam / 2}" fill="none" stroke="${s.cor}" stroke-width="${esp}" stroke-dasharray="${Math.max(0, len - 2)} ${C}" stroke-dashoffset="${-acc}" transform="rotate(-90 ${tam / 2} ${tam / 2})"/>`;
    acc += len;
    return el;
  }).join('');
  return `<svg class="donut" viewBox="0 0 ${tam} ${tam}" role="img"><circle r="${r}" cx="${tam / 2}" cy="${tam / 2}" fill="none" stroke="var(--track)" stroke-width="${esp}"/>${arcs}<text x="50%" y="48%" text-anchor="middle" class="d-c">${esc(centro)}</text><text x="50%" y="63%" text-anchor="middle" class="d-s">${esc(sub)}</text></svg>`;
}

// Barras verticais simples [{l, v, cor, txt}]
export function barrasV(items, { h = 170, unid = '' } = {}) {
  const mx = Math.max(1, ...items.map((i) => i.v)) * 1.12;
  const passo = Math.pow(10, Math.floor(Math.log10(mx))) * (mx / Math.pow(10, Math.floor(Math.log10(mx))) > 5 ? 2 : 1);
  const ticks = [];
  for (let t = 0; t <= mx; t += passo) ticks.push(t);
  const W = 420, pl = 44, pb = 26, pt = 8;
  const bw = (W - pl - 10) / items.length;
  const Y = (v) => h - pb - (v / mx) * (h - pb - pt);
  return `<svg class="barras" viewBox="0 0 ${W} ${h}" role="img">
  ${ticks.map((t) => `<line class="grid" x1="${pl}" x2="${W - 6}" y1="${Y(t)}" y2="${Y(t)}"/><text class="ax" x="${pl - 6}" y="${Y(t) + 4}" text-anchor="end">${num(t)}</text>`).join('')}
  ${items.map((it, i) => { const x = pl + i * bw + bw * 0.18, w = bw * 0.64; return `<rect x="${x}" y="${Y(it.v)}" width="${w}" height="${Math.max(0, h - pb - Y(it.v))}" rx="4" fill="${it.cor}"><title>${esc(it.l)}: ${esc(it.txt || num(it.v))}${unid}</title></rect><text class="ax" x="${x + w / 2}" y="${h - 8}" text-anchor="middle">${esc(it.l)}</text>`; }).join('')}</svg>`;
}

// Ícones coloridos dos atalhos da tela inicial (celular)
export function tileIcon(n) {
  const S = (c) => `<svg class="tile-ic" viewBox="0 0 48 48" aria-hidden="true">${c}</svg>`;
  switch (n) {
    case 'mapa': return S('<path d="M6 32l18 8 18-8-18-8z" fill="#4c9a3a"/><path d="M6 26l18 8 18-8-18-8z" fill="#7cc35a"/><path d="M24 4a8 8 0 00-8 8c0 6 8 14 8 14s8-8 8-14a8 8 0 00-8-8z" fill="#e9f3e4"/><circle cx="24" cy="12" r="3.2" fill="#2f6b2a"/>');
    case 'operacoes': return S('<rect x="8" y="14" width="18" height="12" rx="2" fill="#e9f0e6"/><path d="M26 18h8l4 8v6H26z" fill="#e9f0e6"/><rect x="11" y="9" width="10" height="6" rx="1.5" fill="#cfd9cb"/><circle cx="14" cy="34" r="7" fill="#2a2f2a" stroke="#e9f0e6" stroke-width="3"/><circle cx="36" cy="35" r="5" fill="#2a2f2a" stroke="#e9f0e6" stroke-width="3"/>');
    case 'regioes': return S('<path d="M4 36l8-22h24l8 22z" fill="#3c8a34"/><path d="M8 34l6-18M16 34l4-18M24 34V16M32 34l-4-18M40 34l-6-18" stroke="#9fe07a" stroke-width="3"/><path d="M4 36h40" stroke="#b6e98f" stroke-width="3"/>');
    case 'maquinas': return S('<path d="M8 30V18h14l4 6h8v6z" fill="#f2c443"/><rect x="11" y="12" width="9" height="7" rx="1.5" fill="#e9f0e6"/><path d="M34 24l8-6 2 3-8 6z" fill="#f2c443"/><circle cx="14" cy="34" r="6" fill="#2a2f2a" stroke="#e9f0e6" stroke-width="2.6"/><circle cx="31" cy="35" r="4.5" fill="#2a2f2a" stroke="#e9f0e6" stroke-width="2.6"/>');
    case 'solo': return S('<path d="M19 6h10M21 6v12L11 36a4 4 0 003.5 6h19a4 4 0 003.5-6L27 18V6" fill="none" stroke="#e9f0e6" stroke-width="3" stroke-linejoin="round"/><path d="M14 31h20l3 5a3 3 0 01-2.6 4.5H13.6A3 3 0 0111 36z" fill="#e9f0e6"/>');
    case 'pragas': return S('<ellipse cx="24" cy="28" rx="9" ry="11" fill="none" stroke="#e9f0e6" stroke-width="3"/><path d="M24 17v22M18 12l3 5M30 12l-3 5M15 24H8M40 24h-7M15 32l-6 3M33 32l6 3M16 20l-6-4M32 20l6-4" stroke="#e9f0e6" stroke-width="3" stroke-linecap="round"/>');
    case 'colheita': return S('<path d="M24 14c4-8 12-9 16-7-2 6-8 10-16 7z" fill="#58a83f"/><path d="M22 14c-3-6-10-8-14-6 2 5 7 8 14 6z" fill="#3f8a32"/>' + [[17, 24], [27, 22], [22, 31], [32, 31], [14, 34], [26, 40], [36, 39]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="5.5" fill="#d9362b"/><circle cx="${x - 1.8}" cy="${y - 1.8}" r="1.6" fill="#fff" opacity=".5"/>`).join(''));
    case 'producao': return S('<path d="M15 12h18l4 8v18a4 4 0 01-4 4H15a4 4 0 01-4-4V20z" fill="#e6d3ae"/><path d="M17 6h14l-2 6H19z" fill="#cdb58b"/><path d="M15 12h18" stroke="#a88a5a" stroke-width="2"/><ellipse cx="24" cy="29" rx="5" ry="7" fill="#7a4524"/><path d="M24 22c-2 4-2 10 0 14" stroke="#e6d3ae" stroke-width="1.6" fill="none"/>');
    case 'relatorios': return S('<rect x="9" y="26" width="7" height="14" rx="1.5" fill="#e9f0e6"/><rect x="20.5" y="16" width="7" height="24" rx="1.5" fill="#e9f0e6"/><rect x="32" y="8" width="7" height="32" rx="1.5" fill="#e9f0e6"/>');
    default: return S('<circle cx="24" cy="24" r="12" fill="#e9f0e6"/>');
  }
}

// Miniatura de lavoura (ruas de café em perspectiva) para cartões
export function rowsThumb(cor = '#3f8a34', jovem = false) {
  const linhas = Array.from({ length: 9 }, (_, i) => { const x0 = -20 + i * 18, x1 = 20 + i * 11; return `<path d="M${x0} 70L${x1} 26" stroke="${cor}" stroke-width="${jovem ? 3 : 6}" stroke-linecap="round"/>`; }).join('');
  return `<svg class="thumb" viewBox="0 0 120 70" preserveAspectRatio="xMidYMid slice" aria-hidden="true"><rect width="120" height="26" fill="#9cc6dc"/><path d="M0 26h120v44H0z" fill="#9a4f2a"/><path d="M0 24c20-6 40-4 60-1s40 2 60-2v5H0z" fill="#5b8a45"/>${linhas}</svg>`;
}

// Cenas ilustradas (no lugar de fotos) para cartões de operações, máquinas e cabeçalhos
export function cena(tipo = 'trator', cor = '#2f8a2a') {
  const fundo = `<defs><linearGradient id="ceu" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#8fc3e0"/><stop offset="1" stop-color="#d9ecf2"/></linearGradient></defs><rect width="120" height="80" fill="url(#ceu)"/><path d="M0 34c20-8 44-6 64-2s40 4 56-2v50H0z" fill="#5c8f45"/><path d="M0 44h120v36H0z" fill="#9a5028"/>${Array.from({ length: 8 }, (_, i) => `<path d="M${-10 + i * 18} 80L${30 + i * 9} 44" stroke="#3f8a34" stroke-width="5" stroke-linecap="round"/>`).join('')}`;
  const roda = (x, y, r) => `<circle cx="${x}" cy="${y}" r="${r}" fill="#222"/><circle cx="${x}" cy="${y}" r="${r * 0.45}" fill="#d9c27a"/>`;
  const trator = (c) => `<g transform="translate(34 30)"><rect x="10" y="14" width="30" height="13" rx="2" fill="${c}"/><rect x="18" y="2" width="15" height="14" rx="2" fill="${c}"/><rect x="20" y="4" width="11" height="9" fill="#bfe3f5"/><rect x="36" y="9" width="2.5" height="8" fill="#555"/>${roda(18, 30, 9)}${roda(42, 32, 6)}</g>`;
  let fig = '';
  switch (tipo) {
    case 'trator': case 'saco': case 'adubadora': fig = trator(cor) + (tipo !== 'trator' ? `<rect x="10" y="44" width="22" height="14" rx="2" fill="#e8742a"/>` : ''); break;
    case 'spray': case 'pulverizador': fig = trator(cor) + `<ellipse cx="22" cy="54" rx="13" ry="8" fill="#eee"/><path d="M8 50c-6-4-8-10-6-14M8 56c-8 0-12-4-13-8" stroke="#fff" stroke-width="2" opacity=".8" fill="none"/>`; break;
    case 'folha': case 'rocadeira': fig = trator(cor) + `<rect x="6" y="56" width="26" height="6" rx="2" fill="#f39c12"/>`; break;
    case 'colhedora': case 'grao': fig = `<g transform="translate(34 18)"><rect x="4" y="6" width="44" height="8" rx="2" fill="${cor}"/><rect x="4" y="6" width="9" height="36" fill="${cor}"/><rect x="39" y="6" width="9" height="36" fill="${cor}"/><rect x="30" y="-4" width="14" height="11" rx="2" fill="${cor}"/><rect x="32" y="-2" width="10" height="7" fill="#bfe3f5"/>${roda(9, 44, 6)}${roda(44, 44, 6)}</g>`; break;
    case 'tesoura': fig = `<g transform="translate(40 18) rotate(-20)"><path d="M10 0l6 30M30 0l-6 30" stroke="#ccc" stroke-width="4"/><circle cx="10" cy="40" r="8" fill="none" stroke="#c0392b" stroke-width="5"/><circle cx="30" cy="40" r="8" fill="none" stroke="#c0392b" stroke-width="5"/></g>`; break;
    case 'caminhao': fig = `<g transform="translate(26 32)"><rect x="0" y="4" width="44" height="20" fill="#e8e3d6"/><rect x="44" y="10" width="18" height="14" rx="2" fill="${cor}"/>${roda(10, 26, 6)}${roda(52, 26, 6)}</g>`; break;
    case 'gota': fig = `<path d="M60 18s14 16 14 26a14 14 0 01-28 0c0-10 14-26 14-26z" fill="#3a9ad9"/>`; break;
    case 'fito': fig = `<g transform="translate(46 24)"><ellipse cx="14" cy="18" rx="10" ry="13" fill="#5a3a22"/><path d="M14 5v26M4 12L-4 6M24 12l8-6M3 22l-8 4M25 22l8 4" stroke="#5a3a22" stroke-width="3"/></g>`; break;
    case 'solo': fig = `<path d="M60 44c0-12 0-18 0-22" stroke="#4f8a2a" stroke-width="3"/><path d="M60 26c-10-2-16-10-16-16 10 0 16 6 16 16zM60 30c8-2 14-8 14-14-8 0-14 6-14 14z" fill="#6fbf3f"/>`; break;
    default: fig = trator(cor);
  }
  return `<svg class="cena" viewBox="0 0 120 80" preserveAspectRatio="xMidYMid slice" aria-hidden="true">${fundo}${fig}</svg>`;
}

// Anel de progresso pequeno
export function anel(p, cor = '#2f8a2a', tam = 44) {
  const r = tam / 2 - 4, C = 2 * Math.PI * r;
  const v = Math.max(0, Math.min(100, p || 0));
  return `<svg class="anel" viewBox="0 0 ${tam} ${tam}" width="${tam}" height="${tam}"><circle cx="${tam / 2}" cy="${tam / 2}" r="${r}" fill="none" stroke="#e4dfd2" stroke-width="4"/><circle cx="${tam / 2}" cy="${tam / 2}" r="${r}" fill="none" stroke="${cor}" stroke-width="4" stroke-linecap="round" stroke-dasharray="${(v / 100) * C} ${C}" transform="rotate(-90 ${tam / 2} ${tam / 2})"/><text x="50%" y="55%" text-anchor="middle" font-size="${tam * 0.24}" font-weight="800" fill="#1d2a1f">${Math.round(v)}%</text></svg>`;
}

// Comprime uma imagem (File) para JPEG com lado máximo `max`
export function comprimirImagem(file, max = 1024, q = 0.62) {
  return new Promise((res, rej) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const k = Math.min(1, max / Math.max(img.width, img.height));
      const c = document.createElement('canvas');
      c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(url);
      res(c.toDataURL('image/jpeg', q));
    };
    img.onerror = (e) => { URL.revokeObjectURL(url); rej(e); };
    img.src = url;
  });
}
