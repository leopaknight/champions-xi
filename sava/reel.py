# Montagem do Reel: lê os clipes preparados (build/prep), aplica cortes no grid da trilha,
# câmera lenta por blending, punch-in lento, whip transitions, assinatura e cartela da logo.
#   python3 reel.py --sheet   -> build/sheet.png (1 frame por plano + transições)
#   python3 reel.py           -> out/sava_reel.mp4
import sys, subprocess, json
import numpy as np, cv2
from edl import S, P, FPS, TOTAL_BEATS, END_BEAT, LOGO_SIGNATURE

W, H = 1080, 1920
WHIP_F = 4                       # frames de cada lado do corte em whip
LOGO = cv2.imread("src/logo.png", cv2.IMREAD_UNCHANGED)        # BGRA, transparente


class Reader:
    """Lê frames de um clipe preparado a partir de um ponto, em ordem crescente."""
    def __init__(self, clip, start):
        self.start = start
        self.p = subprocess.Popen(["ffmpeg", "-hide_banner", "-loglevel", "error", "-ss", f"{start:.3f}",
                                   "-i", f"build/prep/{clip}.mp4", "-f", "rawvideo", "-pix_fmt", "bgr24", "-"],
                                  stdout=subprocess.PIPE)
        self.idx, self.cache = -1, {}

    def get(self, i):
        while self.idx < i:
            raw = self.p.stdout.read(W * H * 3)
            if len(raw) < W * H * 3:
                break                    # fim do clipe: repete o último
            self.idx += 1
            self.cache[self.idx] = np.frombuffer(raw, np.uint8).reshape(H, W, 3)
            self.cache.pop(self.idx - 3, None)
        return self.cache.get(i, self.cache[self.idx])

    def close(self):
        self.p.kill()


def ease(k):
    k = min(max(k, 0.0), 1.0)
    return k * k * (3 - 2 * k)


def frame_of(shot, reader, u):
    """u = segundos desde o início do plano."""
    pos = u * shot["speed"] * FPS
    i0 = int(np.floor(pos)); a = pos - i0
    f0 = reader.get(i0).astype(np.float32)
    img = f0 if a < 0.02 or shot["speed"] >= 1 else f0 * (1 - a) + reader.get(i0 + 1).astype(np.float32) * a
    dur = (shot["b1"] - shot["b0"]) * P
    z = shot["zoom"] * (1 + shot["push"] * u / dur)
    cw, ch = W / z, H / z
    cx = min(max(shot["fx"] * W, cw / 2), W - cw / 2)
    cy = min(max(shot["fy"] * H, ch / 2), H - ch / 2)
    M = np.float32([[z, 0, W / 2 - z * cx], [0, z, H / 2 - z * cy]])
    return cv2.warpAffine(img, M, (W, H), flags=cv2.INTER_CUBIC, borderMode=cv2.BORDER_REFLECT)


def hblur(img, length):
    length = int(length)
    if length < 3:
        return img
    k = np.zeros((1, length), np.float32); k[0, :] = 1 / length
    return cv2.filter2D(img, -1, k, borderType=cv2.BORDER_REFLECT)


def whip(img, k, outgoing):
    """k: 0..1 intensidade. Sai para a esquerda / entra pela direita, com desfoque direcional."""
    dx = (-1 if outgoing else 1) * k * k * 520
    M = np.float32([[1, 0, dx], [0, 1, 0]])
    img = cv2.warpAffine(img, M, (W, H), borderMode=cv2.BORDER_REFLECT)
    return hblur(img, 6 + k * 140)


def overlay_logo(img, width, cx, cy, alpha, wipe, dy=0.0):
    """Logo 2D intacta: só escala, opacidade e máscara de revelação (esq -> dir, borda suave)."""
    h = int(LOGO.shape[0] * width / LOGO.shape[1])
    lg = cv2.resize(LOGO, (width, h), interpolation=cv2.INTER_AREA).astype(np.float32)
    x0, y0 = int(cx - width / 2), int(cy - h / 2 + dy)
    a = lg[..., 3:] / 255 * alpha
    if wipe < 1:
        soft = 0.18
        xs = np.linspace(0, 1, width)[None, :, None]
        a = a * np.clip((wipe * (1 + soft) - xs) / soft, 0, 1)
    roi = img[y0:y0 + h, x0:x0 + width]
    img[y0:y0 + h, x0:x0 + width] = roi * (1 - a) + lg[..., :3] * a
    return img


rng_grain = np.random.default_rng(5)
GRAIN = [cv2.GaussianBlur(rng_grain.normal(0, 3.2, (H, W)).astype(np.float32), (0, 0), 0.7) for _ in range(6)]
yy, xx = np.mgrid[0:H, 0:W].astype(np.float32)
SIG_SHADE = np.exp(-(((xx - W / 2) / 520) ** 2 + ((yy - 1560) / 150) ** 2))[..., None]   # sombra suave atrás da assinatura


def render(t, readers):
    b = t / P
    if b < END_BEAT:
        si = next(i for i, s in enumerate(S) if s["b0"] <= b < s["b1"])
        s = S[si]
        u = t - s["b0"] * P
        img = frame_of(s, readers(si), u)
        # whip: fim do plano anterior ao corte e início do seguinte
        n_f = round((s["b1"] - b) * P * FPS)
        if si + 1 < len(S) and S[si + 1]["tin"] == "whip" and n_f <= WHIP_F:
            img = whip(img, 1 - n_f / (WHIP_F + 1), True)
        k_in = round(u * FPS)
        if s["tin"] == "whip" and k_in < WHIP_F:
            img = whip(img, 1 - (k_in + 1) / (WHIP_F + 1), False)
        # assinatura discreta da marca
        b0, b1 = LOGO_SIGNATURE
        if b0 <= b < b1:
            kin, kout = ease((b - b0) / 1.2), 1 - ease((b - (b1 - 0.8)) / 0.8)
            al = min(kin, kout)
            img = img * (1 - SIG_SHADE * 0.45 * al)
            img = overlay_logo(img, 400, W / 2, 1560, al, ease((b - b0) / 1.4) if b < b0 + 1.4 else 1, (1 - kin) * 14)
    else:
        # cartela final: plano herói continua, escurecido e desfocado, logo assenta no impacto
        last = S[-1]
        u = t - last["b0"] * P
        bg = frame_of(last, readers(len(S) - 1), u)
        k = ease((b - END_BEAT) / 1.0)
        bg = cv2.GaussianBlur(bg, (0, 0), 1 + 14 * k) * (1 - 0.72 * k)
        rev = ease((b - END_BEAT) / 1.0)
        out = ease((t - (TOTAL_BEATS * P - 0.55)) / 0.55)
        img = overlay_logo(bg, 900, W / 2, 900, rev * (1 - out), rev, (1 - rev) * 24)
        img = img * (1 - out)
    img = img + GRAIN[int(round(t * FPS)) % len(GRAIN)][..., None]
    return np.clip(img, 0, 255).astype(np.uint8)


class Pool:
    def __init__(self):
        self.cur = {}

    def __call__(self, si):
        if si not in self.cur:
            for r in self.cur.values():
                r.close()
            s = S[si]
            self.cur = {si: Reader(s["clip"], s["src"])}
        return self.cur[si]


if "--sheet" in sys.argv:
    times = []
    for s in S:
        times.append((s["b0"] + (s["b1"] - s["b0"]) * 0.5) * P)
        if s["tin"] == "whip":
            times.append(s["b0"] * P + 1 / FPS)
    times += [b * P for b in (9.8, 11.5, 91.5, 92.3, 94.5)]
    times.sort()
    tiles = []
    for t in times:
        pool = Pool()                        # leitor novo por amostra (acesso aleatório)
        img = render(t, pool)
        for r in pool.cur.values():
            r.close()
        tiles.append(cv2.resize(img, (216, 384), interpolation=cv2.INTER_AREA))
        cv2.putText(tiles[-1], f"{t:5.2f}", (6, 20), cv2.FONT_HERSHEY_SIMPLEX, 0.55, (0, 255, 255), 2)
    cols = 12
    while len(tiles) % cols:
        tiles.append(np.zeros_like(tiles[0]))
    rows = [np.hstack(tiles[i:i + cols]) for i in range(0, len(tiles), cols)]
    cv2.imwrite("build/sheet.png", np.vstack(rows))
    print(len(times), "amostras -> build/sheet.png")
else:
    import os
    os.makedirs("out", exist_ok=True)
    total = int(round(TOTAL_BEATS * P * FPS))
    enc = subprocess.Popen(["ffmpeg", "-hide_banner", "-loglevel", "error", "-y",
                            "-f", "rawvideo", "-pix_fmt", "bgr24", "-s", f"{W}x{H}", "-r", str(FPS), "-i", "-",
                            "-c:v", "libx264", "-preset", "slow", "-crf", "16", "-pix_fmt", "yuv420p",
                            "build/video.mp4"], stdin=subprocess.PIPE)
    pool = Pool()
    for f in range(total):
        enc.stdin.write(render(f / FPS, pool).tobytes())
        if f % 150 == 0:
            print(f"frame {f}/{total}", flush=True)
    enc.stdin.close(); enc.wait()
    print("video ok")
