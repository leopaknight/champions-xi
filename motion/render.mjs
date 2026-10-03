// node render.mjs            -> out/7estrelas.mp4 (H.264 yuv420p, CRF 16, áudio -14 LUFS)
// node render.mjs --sheet    -> build/sheet.png (1 frame por batida)
import { chromium } from "playwright";
import { spawn, execFileSync } from "node:child_process";
import { createServer } from "node:http";
import { readFileSync, mkdirSync, existsSync } from "node:fs";
import { extname, join, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, "..");
const SHEET = process.argv.includes("--sheet");
const W = 1080, H = 1920;
const beats = JSON.parse(readFileSync(join(HERE, "beats.json"), "utf8"));
mkdirSync(join(HERE, "build"), { recursive: true });
mkdirSync(join(HERE, "out"), { recursive: true });

// servidor estático (fontes não carregam via file://)
const TYPES = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".woff2": "font/woff2", ".json": "application/json" };
const server = createServer((req, res) => {
  const p = join(ROOT, decodeURIComponent(new URL(req.url, "http://x").pathname));
  if (!p.startsWith(ROOT) || !existsSync(p)) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { "Content-Type": TYPES[extname(p)] || "application/octet-stream" });
  res.end(readFileSync(p));
});
await new Promise(r => server.listen(0, r));
const url = `http://127.0.0.1:${server.address().port}/motion/film.html`;

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM || "/opt/pw-browsers/chromium" });
const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
await page.addInitScript(b => { window.BEATS = b; }, { period: beats.period, offset: beats.offset });
page.on("pageerror", e => { console.error("pageerror:", e.message); process.exitCode = 1; });
await page.goto(url);
await page.evaluate(() => window.READY);
const { DURATION, FPS } = await page.evaluate(() => ({ DURATION: window.DURATION, FPS: window.FPS }));

const shot = async t => { await page.evaluate(t => window.seek(t), t); return page.screenshot({ type: "png" }); };
const ff = (args, opts = {}) => execFileSync("ffmpeg", ["-hide_banner", "-loglevel", "error", "-y", ...args], opts);

if (SHEET) {
  const n = Math.floor((DURATION - beats.offset) / beats.period);
  const proc = spawn("ffmpeg", ["-hide_banner", "-loglevel", "error", "-y", "-f", "image2pipe", "-c:v", "png", "-i", "-",
    "-vf", `scale=270:480,tile=8x${Math.ceil(n / 8)}:padding=6:color=0x333333`, "-frames:v", "1", join(HERE, "build/sheet.png")],
    { stdio: ["pipe", "inherit", "inherit"] });
  for (let b = 0; b < n; b++) {
    // um pouco depois da batida: mostra o hit já assentado
    proc.stdin.write(await shot(beats.offset + b * beats.period + 0.2));
  }
  proc.stdin.end();
  await new Promise(r => proc.on("close", r));
  console.log(`sheet: ${n} frames -> build/sheet.png`);
} else {
  // áudio: loudnorm em 2 passes para -14 LUFS / -1 dBTP
  const raw = join(HERE, "build/score_raw.wav");
  // ffmpeg imprime a medição no stderr
  const err = execFileSync("sh", ["-c", `ffmpeg -hide_banner -i "${raw}" -af loudnorm=I=-14:TP=-1:LRA=11:print_format=json -f null - 2>&1`]).toString();
  const j = JSON.parse(err.slice(err.lastIndexOf("{"), err.lastIndexOf("}") + 1));
  const ln = `loudnorm=I=-14:TP=-1:LRA=11:measured_I=${j.input_i}:measured_TP=${j.input_tp}:measured_LRA=${j.input_lra}:measured_thresh=${j.input_thresh}:offset=${j.target_offset}:linear=true`;
  ff(["-i", raw, "-af", ln, "-ar", "48000", join(HERE, "build/score.wav")]);

  const out = join(HERE, "out/7estrelas.mp4");
  const proc = spawn("ffmpeg", ["-hide_banner", "-loglevel", "error", "-y",
    "-f", "image2pipe", "-framerate", String(FPS), "-c:v", "png", "-i", "-",
    "-i", join(HERE, "build/score.wav"),
    "-c:v", "libx264", "-preset", "slow", "-crf", "16", "-pix_fmt", "yuv420p", "-movflags", "+faststart",
    "-c:a", "aac", "-b:a", "256k", "-shortest", out], { stdio: ["pipe", "inherit", "inherit"] });
  const total = Math.round(DURATION * FPS);
  for (let f = 0; f < total; f++) {
    const buf = await shot(f / FPS);
    if (!proc.stdin.write(buf)) await new Promise(r => proc.stdin.once("drain", r));
    if (f % 60 === 0) process.stdout.write(`\rframe ${f}/${total}`);
  }
  proc.stdin.end();
  await new Promise(r => proc.on("close", r));
  console.log(`\nok -> ${out}`);
}
await browser.close();
server.close();
