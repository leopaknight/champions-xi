// Empacota tudo (Three.js incluso) em um único HTML que funciona offline.
import { build } from 'esbuild';
import { readFileSync, writeFileSync, mkdirSync } from 'fs';

const r = await build({ entryPoints: ['src/main.js'], bundle: true, minify: true, format: 'iife', target: 'es2020', write: false, legalComments: 'none', loader: { '.webp': 'dataurl', '.png': 'dataurl' } });
const js = r.outputFiles[0].text.replace(/<\/script/gi, '<\\/script');
const css = readFileSync('src/styles.css', 'utf8');
const fonts = '<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=Fraunces:ital,wght@1,600&family=IBM+Plex+Mono:wght@400;500&display=swap">';
const body = `<div id="root"></div>\n<script>${js}</script>`;
mkdirSync('dist', { recursive: true });
// Versão para o Artifact (o publicador adiciona doctype/head/body)
writeFileSync('dist/artifact.html', `<title>Lavoura 3D Café</title>\n<meta name="claude:viewport-fit-sides" content="cover">\n${fonts}\n<style>${css}</style>\n${body}\n`);
// Versão autônoma (abrir direto no navegador, também offline)
writeFileSync('dist/fazenda-cafe-3d.html', `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><title>Lavoura 3D Café</title>${fonts}<style>${css}</style></head><body>${body}</body></html>\n`);
// Versão para Cloudflare Pages (pasta dist/cloudflare): instalável no celular e funciona offline
mkdirSync('dist/cloudflare', { recursive: true });
const pwaHead = '<link rel="manifest" href="manifest.webmanifest"><meta name="theme-color" content="#2c6a44"><link rel="icon" href="icon.svg" type="image/svg+xml"><link rel="apple-touch-icon" href="icon.svg"><meta name="apple-mobile-web-app-capable" content="yes"><meta name="mobile-web-app-capable" content="yes">';
const swReg = `<script>if('serviceWorker' in navigator){addEventListener('load',()=>navigator.serviceWorker.register('sw.js').catch(()=>{}));}</script>`;
writeFileSync('dist/cloudflare/index.html', `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><title>Lavoura 3D Café</title>${pwaHead}${fonts}<style>${css}</style></head><body>${body}${swReg}</body></html>\n`);
writeFileSync('dist/cloudflare/manifest.webmanifest', JSON.stringify({ name: 'Lavoura 3D Café', short_name: 'Lavoura 3D', start_url: './', scope: './', display: 'standalone', orientation: 'any', background_color: '#111512', theme_color: '#2c6a44', lang: 'pt-BR', icons: [{ src: 'icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any maskable' }] }, null, 1));
writeFileSync('dist/cloudflare/icon.svg', '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><rect width="512" height="512" rx="96" fill="#a5522b"/><g fill="none" stroke="#fff" stroke-width="30" stroke-linecap="round" stroke-linejoin="round"><path d="M256 420V250"/><path d="M256 250c0-80 60-140 140-140 0 80-60 140-140 140z"/><path d="M256 290c0-60-40-100-100-100 0 60 40 100 100 100z"/></g></svg>');
const versao = Date.now().toString(36);
writeFileSync('dist/cloudflare/sw.js', `// Cache para uso offline no campo. Versão: ${versao}
const CACHE = 'lavoura3d-${versao}';
const ARQ = ['./', './index.html', './manifest.webmanifest', './icon.svg'];
self.addEventListener('install', (e) => { e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ARQ)).then(() => self.skipWaiting())); });
self.addEventListener('activate', (e) => { e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  // página: rede primeiro (pega atualizações), cache se estiver sem sinal
  if (req.mode === 'navigate' || url.pathname.endsWith('/index.html')) {
    e.respondWith(fetch(req).then((r) => { const cp = r.clone(); caches.open(CACHE).then((c) => c.put('./index.html', cp)); return r; }).catch(() => caches.match('./index.html')));
    return;
  }
  // demais (ícone, fontes): cache primeiro
  e.respondWith(caches.match(req).then((hit) => hit || fetch(req).then((r) => { if (r.ok && (url.origin === location.origin || url.hostname.endsWith('gstatic.com') || url.hostname.endsWith('googleapis.com'))) { const cp = r.clone(); caches.open(CACHE).then((c) => c.put(req, cp)); } return r; })));
});
`);
writeFileSync('dist/cloudflare/_headers', `/*
  X-Content-Type-Options: nosniff
  Referrer-Policy: strict-origin-when-cross-origin
  Permissions-Policy: camera=(), microphone=(), geolocation=(self)
/index.html
  Cache-Control: no-cache
/
  Cache-Control: no-cache
/sw.js
  Cache-Control: no-cache
/manifest.webmanifest
  Content-Type: application/manifest+json
`);
console.log('ok', (js.length / 1024).toFixed(0) + ' KB js');
