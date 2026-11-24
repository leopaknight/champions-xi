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
