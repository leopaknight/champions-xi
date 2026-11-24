// Empacota tudo (Three.js incluso) em um único HTML que funciona offline.
import { build } from 'esbuild';
import { readFileSync, writeFileSync, mkdirSync } from 'fs';

const r = await build({ entryPoints: ['src/main.js'], bundle: true, minify: true, format: 'iife', target: 'es2020', write: false, legalComments: 'none' });
const js = r.outputFiles[0].text.replace(/<\/script/gi, '<\\/script');
const css = readFileSync('src/styles.css', 'utf8');
const fonts = '<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Archivo:wght@500;600;700&family=IBM+Plex+Mono:wght@400;500&family=IBM+Plex+Sans:wght@400;500;600&display=swap">';
const body = `<div id="root"></div>\n<script>${js}</script>`;
mkdirSync('dist', { recursive: true });
// Versão para o Artifact (o publicador adiciona doctype/head/body)
writeFileSync('dist/artifact.html', `<title>Lavoura 3D Café</title>\n<meta name="claude:viewport-fit-sides" content="cover">\n${fonts}\n<style>${css}</style>\n${body}\n`);
// Versão autônoma (abrir direto no navegador, também offline)
writeFileSync('dist/fazenda-cafe-3d.html', `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><title>Lavoura 3D Café</title>${fonts}<style>${css}</style></head><body>${body}</body></html>\n`);
console.log('ok', (js.length / 1024).toFixed(0) + ' KB js');
