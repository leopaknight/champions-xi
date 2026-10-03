# Decupagem do Reel. Tudo em batidas da trilha (96 BPM -> 0,625 s por batida, 2,5 s por compasso).
# Seções: hook 0–8 | apresentação 8–24 | dinâmica 24–56 | clímax 56–80 | herói 80–92 | logo 92–96
BPM = 96
P = 60 / BPM
TOTAL_BEATS = 96            # 60 s
FPS = 30

# (início, fim) em batidas, clipe, entrada na fonte (s), velocidade, zoom, foco (x, y em 0–1), transição de entrada
# velocidade < 1 = câmera lenta (frames intermediários por blending)
S = []
def shot(b0, b1, clip, src, speed=1.0, zoom=1.0, fx=0.5, fy=0.5, tin="cut", push=0.04):
    S.append(dict(b0=b0, b1=b1, clip=clip, src=src, speed=speed, zoom=zoom, fx=fx, fy=fy, tin=tin, push=push))

# --- HOOK (0–5 s): o melhor take primeiro --------------------------------------------
shot(0, 3,   "c2", 11.6, 0.80, 1.00, 0.50, 0.55)            # roda com pinça vermelha, passagem colada
shot(3, 4,   "c2", 0.90, 1.00, 1.00, 0.50, 0.55, "whip")    # passagem rente à câmera
shot(4, 6,   "c1", 8.70, 1.00, 1.00, 0.50, 0.55)            # picape abrindo para o lado
shot(6, 8,   "c2", 15.4, 0.65, 1.00, 0.50, 0.55)            # roda dianteira, rampa lenta

# --- APRESENTAÇÃO (5–15 s) -----------------------------------------------------------
shot(8, 12,  "c2", 3.20, 1.00, 1.05, 0.50, 0.58)            # traseira 3/4, postura rebaixada
shot(12, 14, "c6", 0.60, 1.00, 1.40, 0.45, 0.47)            # ângulo baixo, lateral
shot(14, 16, "c1", 2.40, 1.00, 1.08, 0.55, 0.60)            # traseira
shot(16, 20, "c5", 19.4, 1.00, 1.40, 0.50, 0.45, push=0.06) # grama em primeiro plano, picape chegando
shot(20, 24, "c3", 15.3, 1.00, 1.30, 0.50, 0.55)            # tracking sobre o guard-rail

# --- DINÂMICA (15–35 s) --------------------------------------------------------------
shot(24, 26, "c2", 10.0, 1.00, 1.05, 0.45, 0.60)
shot(26, 28, "c1", 11.2, 1.00, 1.05, 0.50, 0.58)
shot(28, 29, "c2", 1.00, 1.00, 1.05, 0.45, 0.60, "whip")
shot(29, 30, "c1", 13.4, 1.00, 1.00, 0.50, 0.58)
shot(30, 32, "c2", 5.60, 1.00, 1.08, 0.50, 0.60)
shot(32, 34, "c3", 10.0, 1.00, 1.30, 0.45, 0.52)
shot(34, 36, "c6", 3.00, 1.00, 1.40, 0.55, 0.47)
shot(36, 38, "c1", 4.60, 1.00, 1.08, 0.55, 0.60)
shot(38, 40, "c2", 16.0, 0.85, 1.00, 0.50, 0.55)
shot(40, 42, "c3", 6.20, 1.00, 1.30, 0.60, 0.53)
shot(42, 44, "c2", 18.2, 1.00, 1.08, 0.40, 0.60, "whip")
shot(44, 46, "c1", 0.40, 1.00, 1.05, 0.40, 0.60)
shot(46, 48, "c3", 19.0, 1.00, 1.35, 0.55, 0.55)
shot(48, 50, "c1", 6.00, 1.00, 1.05, 0.55, 0.62)
shot(50, 52, "c2", 8.00, 1.00, 1.05, 0.45, 0.60, "whip")
shot(52, 54, "c5", 21.0, 1.00, 1.35, 0.45, 0.50)
shot(54, 56, "c6", 1.60, 0.70, 1.40, 0.45, 0.47)           # rampa lenta antes do drop

# --- CLÍMAX (35–50 s): melhores takes, cortes mais rápidos ---------------------------
shot(56, 58, "c2", 11.8, 1.00, 1.00, 0.50, 0.55)
shot(58, 59, "c1", 9.20, 1.00, 1.05, 0.50, 0.60)
shot(59, 60, "c6", 2.40, 1.00, 1.45, 0.50, 0.47)
shot(60, 61, "c2", 4.60, 1.00, 1.05, 0.50, 0.58, "whip")
shot(61, 62, "c1", 12.2, 1.00, 1.05, 0.45, 0.60)
shot(62, 63, "c3", 7.20, 1.00, 1.30, 0.55, 0.53)
shot(63, 64, "c2", 1.30, 1.00, 1.00, 0.50, 0.55)
shot(64, 66, "c1", 14.2, 0.80, 1.00, 0.50, 0.58)
shot(66, 67, "c2", 8.60, 1.00, 1.05, 0.50, 0.58, "whip")
shot(67, 68, "c5", 22.0, 1.00, 1.35, 0.45, 0.50)
shot(68, 68.5, "c2", 13.0, 1.00, 1.00, 0.50, 0.55)
shot(68.5, 69, "c1", 3.50, 1.00, 1.05, 0.55, 0.60)
shot(69, 69.5, "c2", 15.0, 1.00, 1.00, 0.50, 0.55)
shot(69.5, 70, "c1", 5.50, 1.00, 1.05, 0.55, 0.60)
shot(70, 72, "c2", 2.20, 1.00, 1.00, 0.50, 0.58, "whip")
shot(72, 73, "c3", 17.0, 1.00, 1.30, 0.55, 0.56)
shot(73, 74, "c1", 11.0, 1.00, 1.00, 0.50, 0.58)
shot(74, 75, "c1", 7.50, 1.00, 1.05, 0.50, 0.60)
shot(75, 76, "c2", 16.0, 1.00, 1.00, 0.50, 0.55)
shot(76, 76.5, "c6", 0.90, 1.00, 1.45, 0.45, 0.47)
shot(76.5, 77, "c2", 12.6, 1.00, 1.00, 0.50, 0.55)
shot(77, 77.5, "c2", 7.00, 1.00, 1.05, 0.50, 0.58)
shot(77.5, 78, "c1", 13.6, 1.00, 1.00, 0.50, 0.58)
shot(78, 80, "c2", 6.80, 0.75, 1.05, 0.50, 0.60)           # rampa lenta para o plano herói

# --- HERÓI (50–56,9 s): uma tomada longa, ritmo reduzido -----------------------------
shot(80, 91, "c2", 9.40, 0.62, 1.05, 0.45, 0.60, "whip", push=0.07)

# --- LOGO (56,9–60 s): cartela final ---------------------------------------------------
END_BEAT = 91   # logo começa aqui e assenta no impacto da batida 92
LOGO_SIGNATURE = (9, 13)     # assinatura discreta durante a apresentação (batidas)

# transições whip -> som de whoosh; seções -> impactos
WHIPS = [s["b0"] for s in S if s["tin"] == "whip"]
IMPACTS = [0, 56, 92]
