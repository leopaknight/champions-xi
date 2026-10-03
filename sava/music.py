# Trilha original sintetizada (96 BPM, Lá menor) + sound design, alinhada à decupagem (edl.py).
# Saídas: build/music.wav (trilha) e build/sfx.wav (whooshes, impactos, passagens)
import numpy as np, soundfile as sf
from scipy.signal import fftconvolve, butter, sosfilt
from edl import P, TOTAL_BEATS, S, WHIPS, IMPACTS

SR = 48000
DUR = TOTAL_BEATS * P + 1.0
N = int(SR * DUR)
rng = np.random.default_rng(11)


def buf():
    return np.zeros((N, 2))


def add(dst, sig, t, g=1.0, pan=0.0):
    i = int(round(t * SR))
    if i >= N or i < 0:
        return
    sig = sig[: N - i]
    if sig.ndim == 1:
        l, r = np.cos((pan + 1) * np.pi / 4) * 1.414, np.sin((pan + 1) * np.pi / 4) * 1.414
        dst[i:i + len(sig), 0] += sig * g * l
        dst[i:i + len(sig), 1] += sig * g * r
    else:
        dst[i:i + len(sig)] += sig * g


def tt(d):
    return np.arange(int(d * SR)) / SR


def lp(x, fc, order=2):
    return sosfilt(butter(order, fc, "low", fs=SR, output="sos"), x, axis=0)


def hp(x, fc, order=2):
    return sosfilt(butter(order, fc, "high", fs=SR, output="sos"), x, axis=0)


def hz(m):
    return 440 * 2 ** ((m - 69) / 12)


def reverb(x, secs=2.2, mix=0.25):
    ir_t = tt(secs)
    ir = rng.standard_normal((len(ir_t), 2)) * np.exp(-ir_t / (secs / 5))[:, None]
    ir = lp(ir, 6000)
    wet = np.stack([fftconvolve(x[:, c], ir[:, c])[: len(x)] for c in range(2)], 1)
    wet *= np.max(np.abs(x)) / (np.max(np.abs(wet)) + 1e-9)
    return x * (1 - mix) + wet * mix


# ---------------- instrumentos ----------------
def kick(d=0.5):
    t = tt(d)
    f = 42 + 130 * np.exp(-t / 0.03)
    s = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t / 0.22)
    s += rng.standard_normal(len(t)) * np.exp(-t / 0.0015) * 0.25
    return np.tanh(s * 1.6) * 0.8


def snare():
    t = tt(0.4)
    body = np.sin(2 * np.pi * 185 * t) * np.exp(-t / 0.05) * 0.5
    nz = hp(rng.standard_normal(len(t)), 1500) * np.exp(-t / 0.11)
    return (body + nz * 0.7) * 0.55


def clap():
    t = tt(0.35)
    nz = hp(rng.standard_normal(len(t)), 1000)
    e = np.exp(-t / 0.09) * 0.7
    for k in (0.0, 0.009, 0.019):
        e += (t >= k) * np.exp(-np.maximum(t - k, 0) / 0.007) * 0.5
    return nz * e * 0.35


def hat(dec=0.035, open_=False):
    t = tt(0.4 if open_ else 0.1)
    nz = hp(rng.standard_normal(len(t)), 7000, 4)
    return nz * np.exp(-t / (0.16 if open_ else dec)) * 0.22


def b808(freq, d, glide_to=None):
    t = tt(d)
    f = np.full(len(t), freq)
    if glide_to:
        k = np.clip((t - d * 0.55) / (d * 0.3), 0, 1)
        f = freq * (glide_to / freq) ** k
    s = np.sin(2 * np.pi * np.cumsum(f) / SR)
    env = np.minimum(t / 0.004, 1) * np.exp(-t / (d * 0.9))
    return np.tanh(s * env * 2.2) * 0.55


def pad(midis, d, bright=2500):
    t = tt(d)
    s = np.zeros(len(t))
    for m in midis:
        for det in (-0.08, 0.0, 0.08):           # supersaw suave
            f = hz(m + det)
            ph = rng.random() * 2 * np.pi
            s += sum(np.sin(2 * np.pi * f * k * t + ph) / k for k in range(1, 8))
    s = lp(s, bright)
    env = np.minimum(t / 0.4, 1) * np.minimum((d - t) / 0.4, 1)
    return s * env / (len(midis) * 3) * 0.5


def pluck(m, d=0.35):
    t = tt(d)
    s = sum(np.sin(2 * np.pi * hz(m) * k * t) * np.exp(-t * k * 6) / k for k in range(1, 9))
    return s * np.minimum(t / 0.002, 1) * 0.28


def riser(d, g=0.3):
    t = tt(d)
    nz = rng.standard_normal(len(t))
    out = np.zeros(len(t))
    # banda subindo em 8 fatias
    for k in range(8):
        a, b = int(len(t) * k / 8), int(len(t) * (k + 1) / 8)
        fc = 400 * (12000 / 400) ** ((k + 0.5) / 8)
        out[a:b] = hp(lp(nz[a:b], min(fc * 1.5, 20000)), fc * 0.5)
    tone = np.sin(2 * np.pi * np.cumsum(hz(57) * 2 ** (2 * t / d)) / SR) * 0.15
    return (out + tone) * (t / d) ** 2.2 * g


def impact(g=1.0):
    t = tt(2.5)
    f = 30 + 70 * np.exp(-t / 0.1)
    boom = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t / 0.8)
    nz = lp(rng.standard_normal(len(t)), 3000) * np.exp(-t / 0.25) * 0.4
    return np.tanh((boom + nz) * 1.3) * 0.8 * g


def whoosh(d=0.45, g=0.5):
    t = tt(d)
    nz = rng.standard_normal(len(t))
    out = np.zeros(len(t))
    for k in range(10):
        a, b = int(len(t) * k / 10), int(len(t) * (k + 1) / 10)
        x = k / 9
        fc = 300 + 5000 * np.sin(np.pi * x)
        out[a:b] = lp(nz[a:b], fc)
    env = np.sin(np.pi * np.clip(t / d, 0, 1)) ** 2
    return out * env * g


def passby(d=1.2, g=0.4):
    # vento/pneu passando: ruído de banda larga com pico e doppler implícito no filtro
    t = tt(d)
    nz = rng.standard_normal(len(t))
    lo = lp(nz, 700) * 1.5
    hi = hp(lp(nz, 4000), 900)
    env = np.exp(-((t - d * 0.45) / (d * 0.18)) ** 2)
    x = (lo + hi * 0.6) * env * g
    pan = np.clip((t - d * 0.45) / (d * 0.3), -1, 1)
    return np.stack([x * (1 - pan) / 2 * 1.4, x * (1 + pan) / 2 * 1.4], 1)


# ---------------- arranjo ----------------
music = buf()
B = lambda b: b * P
# Am9 | Fmaj7 | Dm9 | Esus4/E   (um acorde por compasso de 4 batidas)
CHORDS = [[57, 60, 64, 67, 71], [53, 57, 60, 64], [50, 53, 57, 60, 64], [52, 57, 59, 64]]
ROOTS = [45, 41, 38, 40]
ARP = [[69, 72, 76, 79], [69, 72, 76, 77], [69, 72, 74, 77], [68, 71, 76, 74]]


def section(b):
    if b < 8: return "hook"
    if b < 24: return "pres"
    if b < 56: return "dyn"
    if b < 80: return "climax"
    if b < 92: return "hero"
    return "end"


for bar in range(TOTAL_BEATS // 4):
    b0 = bar * 4
    sec = section(b0)
    ci = bar % 4
    # pad em todo o filme (mais aberto no clímax)
    if sec != "end":
        bright = {"hook": 2200, "pres": 1600, "dyn": 2400, "climax": 3500, "hero": 1800}[sec]
        add(music, pad(CHORDS[ci], 4 * P + 0.3, bright), B(b0), 0.9)
    # arpejo pluck
    if sec in ("pres", "dyn", "climax", "hero"):
        step = 0.5
        for k in range(8):
            m = ARP[ci][k % 4] + (12 if sec == "climax" and k % 2 else 0)
            add(music, pluck(m), B(b0 + k * step), 0.5 if sec != "hero" else 0.35, (k % 2) * 0.6 - 0.3)
    # bateria
    for k in range(4):
        b = b0 + k
        if sec in ("hook", "dyn", "climax"):
            if k in (0, 2) or (sec == "climax" and k == 3):
                add(music, kick(), B(b), 1.0)
            if sec == "dyn" and k == 1 and bar % 2:
                add(music, kick(), B(b + 0.5), 0.8)
            if k in (1, 3):
                add(music, snare(), B(b), 0.9); add(music, clap(), B(b), 0.8)
            sub = 4 if sec == "climax" else 2
            for j in range(sub):
                add(music, hat(), B(b + j / sub), 0.8 if j else 1.0, 0.35)
            if sec == "climax" and k == 3 and bar % 2:      # rolagem de chimbal
                for j in range(6):
                    add(music, hat(0.02), B(b + 0.5 + j / 12), 0.7, 0.35)
        elif sec == "pres":
            if k == 0:
                add(music, kick(), B(b), 0.8)
            add(music, hat(open_=True), B(b + 0.5), 0.5, 0.35)
            if k == 3 and bar % 2:
                add(music, clap(), B(b), 0.6)
        elif sec == "hero":
            if k == 0:
                add(music, kick(), B(b), 0.6)
    # 808
    if sec in ("hook", "dyn", "climax"):
        r = hz(ROOTS[ci] - 12 + 12)
        add(music, b808(r, 2 * P * 0.95), B(b0), 1.0)
        nxt = hz(ROOTS[(ci + 1) % 4])
        add(music, b808(r, 2 * P * 0.95, nxt if sec == "climax" else None), B(b0 + 2), 0.9)
    elif sec == "hero":
        add(music, b808(hz(ROOTS[ci]), 4 * P * 0.95), B(b0), 0.6)

# risers antes das viradas de seção
add(music, riser(4 * P, 0.35), B(4))
add(music, riser(8 * P, 0.45), B(48))
add(music, riser(4 * P, 0.25), B(76))
add(music, riser(4 * P, 0.30), B(88))
# acorde final
add(music, pad([57, 64, 69, 72, 76], 3.0, 2500), B(92), 1.2)
add(music, kick(1.0), B(92), 1.0)

music = reverb(music, 2.0, 0.18)
music[:, :] = hp(music, 28)

# ---------------- sound design ----------------
sfx = buf()
for b in WHIPS:
    add(sfx, whoosh(0.45, 0.5), B(b) - 0.25, 1.0, 0.4)
for b in IMPACTS:
    add(sfx, impact(0.9 if b else 0.7), B(b), 1.0)
# passagens rentes (c7 e c2 ~1 s): vento/pneu
for s in S:
    if (s["clip"] == "c7" and s["src"] < 1.0) or (s["clip"] == "c2" and s["src"] < 2.5):
        add(sfx, passby(1.1, 0.5), B(s["b0"]) - 0.2, 1.0)
sfx = reverb(sfx, 1.2, 0.12)

# pico normalizado; loudness final (-14 LUFS) é feita no ffmpeg
peak = max(np.max(np.abs(music + sfx)), 1e-9)
sf.write("build/music.wav", np.tanh(music / peak * 1.1) * 0.9, SR, subtype="PCM_24")
sf.write("build/sfx.wav", sfx / peak * 0.9, SR, subtype="PCM_24")
print("ok", round(DUR, 2), "s")
