// Utilitários gerais: RNG determinístico, geometria, geo, formatação, CSV.

export function rng(seed) {
  let s = (seed >>> 0) || 0x9e3779b9;
  return () => {
    s ^= s << 13; s >>>= 0;
    s ^= s >>> 17;
    s ^= s << 5; s >>>= 0;
    return s / 4294967296;
  };
}

export function hash(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const lerp = (a, b, t) => a + (b - a) * t;

// ---------- Geometria 2D (x = leste, y = norte, metros) ----------
export function polyArea(p) {
  let s = 0;
  for (let i = 0; i < p.length; i++) {
    const [x1, y1] = p[i];
    const [x2, y2] = p[(i + 1) % p.length];
    s += x1 * y2 - x2 * y1;
  }
  return Math.abs(s) / 2;
}

export function centroid(p) {
  let cx = 0, cy = 0, a = 0;
  for (let i = 0; i < p.length; i++) {
    const [x1, y1] = p[i];
    const [x2, y2] = p[(i + 1) % p.length];
    const f = x1 * y2 - x2 * y1;
    cx += (x1 + x2) * f; cy += (y1 + y2) * f; a += f;
  }
  if (Math.abs(a) < 1e-9) {
    const n = p.length;
    return [p.reduce((s, q) => s + q[0], 0) / n, p.reduce((s, q) => s + q[1], 0) / n];
  }
  return [cx / (3 * a), cy / (3 * a)];
}

export function scalePoly(p, k) {
  const [cx, cy] = centroid(p);
  return p.map(([x, y]) => [cx + (x - cx) * k, cy + (y - cy) * k]);
}

export function pointInPoly(x, y, p) {
  let inside = false;
  for (let i = 0, j = p.length - 1; i < p.length; j = i++) {
    const [xi, yi] = p[i], [xj, yj] = p[j];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

export function bbox(p) {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const [x, y] of p) { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); }
  return { x0, y0, x1, y1, w: x1 - x0, h: y1 - y0 };
}

// Varredura: gera segmentos de linhas paralelas dentro de um polígono.
// theta = direção das ruas (rad, a partir do leste, anti-horário).
export function scanSegments(poly, theta, spacing, headland = 6, border = 2) {
  const ux = Math.cos(theta), uy = Math.sin(theta);
  const vx = -uy, vy = ux;
  const pts = poly.map(([x, y]) => [x * ux + y * uy, x * vx + y * vy]);
  let bmin = Infinity, bmax = -Infinity;
  for (const [, b] of pts) { bmin = Math.min(bmin, b); bmax = Math.max(bmax, b); }
  const out = [];
  for (let b = bmin + border + spacing / 2; b < bmax - border; b += spacing) {
    const xs = [];
    for (let i = 0; i < pts.length; i++) {
      const [a1, b1] = pts[i];
      const [a2, b2] = pts[(i + 1) % pts.length];
      if ((b1 <= b && b2 > b) || (b2 <= b && b1 > b)) xs.push(a1 + ((b - b1) / (b2 - b1)) * (a2 - a1));
    }
    xs.sort((m, n) => m - n);
    for (let i = 0; i + 1 < xs.length; i += 2) {
      const a1 = xs[i] + headland, a2 = xs[i + 1] - headland;
      if (a2 - a1 > 12) out.push({ b, a1, a2 });
    }
  }
  return { segs: out, ux, uy, vx, vy };
}

export function distPointSeg(px, py, x1, y1, x2, y2) {
  const dx = x2 - x1, dy = y2 - y1;
  const l2 = dx * dx + dy * dy || 1;
  const t = clamp(((px - x1) * dx + (py - y1) * dy) / l2, 0, 1);
  const qx = x1 + t * dx, qy = y1 + t * dy;
  return { d: Math.hypot(px - qx, py - qy), t };
}

export function polylineLength(pts) {
  let s = 0;
  for (let i = 1; i < pts.length; i++) s += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
  return s;
}

// ---------- Geo (projeção local equiretangular) ----------
const R_LAT = 111320;
export const geo = {
  lat0: -18.624, lon0: -48.242,
  setOrigin(o) { if (o) { this.lat0 = +o.lat; this.lon0 = +o.lon; } },
  toLatLon(x, y) {
    return [this.lat0 + y / R_LAT, this.lon0 + x / (R_LAT * Math.cos((this.lat0 * Math.PI) / 180))];
  },
  fromLatLon(lat, lon) {
    return [(lon - this.lon0) * R_LAT * Math.cos((this.lat0 * Math.PI) / 180), (lat - this.lat0) * R_LAT];
  },
  fmt(x, y) {
    const [la, lo] = this.toLatLon(x, y);
    return `${la.toFixed(6)}, ${lo.toFixed(6)}`;
  },
};

// ---------- Datas ----------
export const pad = (n, w = 2) => String(n).padStart(w, '0');
export function isoDate(d = new Date()) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
export function parseISO(s) {
  if (!s) return null;
  const [y, m, d] = s.slice(0, 10).split('-').map(Number);
  return new Date(y, m - 1, d, 12);
}
export function addDays(s, n) {
  const d = parseISO(s); d.setDate(d.getDate() + n); return isoDate(d);
}
export function daysBetween(a, b) {
  return Math.round((parseISO(b) - parseISO(a)) / 86400000);
}
export const MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
export const MESES_LONGO = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
export const DIAS = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];
export function fmtDate(s) {
  if (!s) return '—';
  const d = parseISO(s);
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;
}
export function fmtDateShort(s) {
  if (!s) return '—';
  const d = parseISO(s);
  return `${pad(d.getDate())} ${MESES[d.getMonth()]}`;
}
// Ano-safra começa em 1º de julho. Safra "2027" = jul/2026 a jun/2027.
export function anoSafra(s) {
  const d = parseISO(s);
  return d.getMonth() >= 6 ? d.getFullYear() + 1 : d.getFullYear();
}

// ---------- Formatação ----------
const nf = {};
export function num(v, d = 0) {
  if (v == null || Number.isNaN(+v)) return '—';
  const k = 'n' + d;
  nf[k] = nf[k] || new Intl.NumberFormat('pt-BR', { minimumFractionDigits: d, maximumFractionDigits: d });
  return nf[k].format(+v);
}
export const brl = (v) => (v == null || Number.isNaN(+v) ? '—' : 'R$ ' + num(v, 2));
export const pct = (v, d = 1) => (v == null || Number.isNaN(+v) ? '—' : num(v, d) + '%');

export function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

export function uid(prefix = '') {
  const t = Date.now().toString(36);
  const r = Math.random().toString(36).slice(2, 8);
  return prefix + t + r;
}

export function toCSV(rows) {
  if (!rows.length) return '';
  const cols = Object.keys(rows[0]);
  const q = (v) => {
    const s = v == null ? '' : String(v);
    return /[;"\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  };
  return '﻿' + [cols.join(';'), ...rows.map((r) => cols.map((c) => q(r[c])).join(';'))].join('\n');
}

// Faixas de ruas: "1-45,60,62-80" <-> [1..45,60,62..80]
export function compressRanges(nums) {
  const a = [...new Set(nums)].sort((x, y) => x - y);
  const out = [];
  for (let i = 0; i < a.length; i++) {
    let j = i;
    while (j + 1 < a.length && a[j + 1] === a[j] + 1) j++;
    out.push(i === j ? `${a[i]}` : `${a[i]}-${a[j]}`);
    i = j;
  }
  return out.join(',');
}
export function expandRanges(s) {
  const out = [];
  if (!s) return out;
  for (const part of String(s).split(',')) {
    const p = part.trim();
    if (!p) continue;
    const m = p.match(/^(\d+)\s*-\s*(\d+)$/);
    if (m) { const a = +m[1], b = +m[2]; for (let i = Math.min(a, b); i <= Math.max(a, b); i++) out.push(i); }
    else if (/^\d+$/.test(p)) out.push(+p);
  }
  return out;
}

export function mean(a) { return a.length ? a.reduce((s, v) => s + v, 0) / a.length : 0; }
export function stdev(a) {
  if (a.length < 2) return 0;
  const m = mean(a);
  return Math.sqrt(a.reduce((s, v) => s + (v - m) ** 2, 0) / (a.length - 1));
}
// t de Student bicaudal 95% (aprox.) por graus de liberdade
export function t95(df) {
  const t = [0, 12.71, 4.303, 3.182, 2.776, 2.571, 2.447, 2.365, 2.306, 2.262, 2.228, 2.201, 2.179, 2.16, 2.145, 2.131, 2.12, 2.11, 2.101, 2.093, 2.086];
  if (df <= 0) return 0;
  if (df < t.length) return t[df];
  if (df < 30) return 2.05;
  if (df < 60) return 2.01;
  return 1.98;
}

export function debounce(fn, ms) {
  let h;
  return (...a) => { clearTimeout(h); h = setTimeout(() => fn(...a), ms); };
}

export function groupBy(arr, fn) {
  const m = new Map();
  for (const x of arr) { const k = fn(x); if (!m.has(k)) m.set(k, []); m.get(k).push(x); }
  return m;
}

export function sum(arr, fn = (x) => x) { let s = 0; for (const x of arr) s += +fn(x) || 0; return s; }
