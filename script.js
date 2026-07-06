const POS_ORDER = ["FWD", "MID", "DEF", "GK"];
const POS_LABEL = { GK: "GOL", DEF: "ZAG/LAT", MID: "MEIA", FWD: "ATAQUE" };

let current = null;
let slots = [];        // { pos, filledIndex: number|null }
let pool = [];         // { name, pos, rating, used: bool }

const introEl = document.getElementById("intro");
const gameEl = document.getElementById("game");
const rollBtn = document.getElementById("rollBtn");
const resetBtn = document.getElementById("resetBtn");
const simBtn = document.getElementById("simBtn");
const pitchEl = document.getElementById("pitch");
const poolEl = document.getElementById("pool");
const modal = document.getElementById("resultModal");
const playAgainBtn = document.getElementById("playAgainBtn");

rollBtn.addEventListener("click", startRound);
resetBtn.addEventListener("click", startRound);
simBtn.addEventListener("click", simulate);
playAgainBtn.addEventListener("click", () => {
  modal.classList.add("hidden");
  startRound();
});

function startRound() {
  current = CHAMPIONS[Math.floor(Math.random() * CHAMPIONS.length)];

  const counts = { GK: 0, DEF: 0, MID: 0, FWD: 0 };
  current.players.forEach(p => counts[p.pos]++);

  slots = [];
  POS_ORDER.forEach(pos => {
    for (let i = 0; i < counts[pos]; i++) slots.push({ pos, player: null });
  });

  pool = shuffle(current.players.map(p => ({ ...p, used: false })));

  document.getElementById("cbYear").textContent = current.year;
  document.getElementById("cbClub").textContent = current.club;
  document.getElementById("cbOpp").textContent = "vs " + current.opponent;
  document.getElementById("cbScore").textContent = current.score;
  document.getElementById("cbCrest").textContent = initials(current.club);
  document.documentElement.style.setProperty("--team-1", current.colors[0]);
  document.documentElement.style.setProperty("--team-2", current.colors[1]);

  introEl.classList.add("hidden");
  gameEl.classList.remove("hidden");

  renderPitch();
  renderPool();
  updateSimButton();
}

function renderPitch() {
  pitchEl.innerHTML = "";
  POS_ORDER.forEach(pos => {
    const rowSlots = slots.filter(s => s.pos === pos);
    if (!rowSlots.length) return;
    const row = document.createElement("div");
    row.className = "pitch-row";
    rowSlots.forEach(slot => {
      const div = document.createElement("div");
      div.className = "slot" + (slot.player ? " filled " + pos : "");
      const idx = slots.indexOf(slot);
      div.dataset.idx = idx;
      if (slot.player) {
        div.innerHTML = `<div class="slot-pos">${POS_LABEL[pos]}</div><div class="slot-name">${slot.player.name}</div>`;
        div.addEventListener("click", () => unassign(idx));
      } else {
        div.innerHTML = `<div class="slot-pos">${POS_LABEL[pos]}</div><div class="slot-name">vazio</div>`;
      }
      row.appendChild(div);
    });
    pitchEl.appendChild(row);
  });
}

function renderPool() {
  poolEl.innerHTML = "";
  pool.forEach((p, i) => {
    const chip = document.createElement("div");
    chip.className = "chip " + p.pos + (p.used ? " used" : "");
    chip.innerHTML = `<span class="dot"></span>${p.name} <span style="color:var(--muted); font-weight:400;">(${POS_LABEL[p.pos]})</span>`;
    if (!p.used) chip.addEventListener("click", () => assign(i));
    poolEl.appendChild(chip);
  });
}

function assign(poolIdx) {
  const p = pool[poolIdx];
  if (p.used) return;
  const freeSlot = slots.find(s => s.pos === p.pos && !s.player);
  if (!freeSlot) return;
  freeSlot.player = p;
  p.used = true;
  renderPitch();
  renderPool();
  updateSimButton();
}

function unassign(slotIdx) {
  const slot = slots[slotIdx];
  if (!slot.player) return;
  const p = pool.find(pl => pl.name === slot.player.name);
  if (p) p.used = false;
  slot.player = null;
  renderPitch();
  renderPool();
  updateSimButton();
}

function updateSimButton() {
  const allFilled = slots.every(s => s.player);
  simBtn.disabled = !allFilled;
}

function simulate() {
  const avg = slots.reduce((sum, s) => sum + s.player.rating, 0) / slots.length;
  const strength = (avg - 78) / 20; // ~0 to ~1
  const goalsFor = Math.max(1, Math.round(3 + strength * 6 + Math.random() * 2));
  const goalsAgainst = Math.max(0, Math.round(Math.random() * 2 - strength * 1.5));

  document.getElementById("modalScore").textContent = `${goalsFor} – ${goalsAgainst}`;
  document.getElementById("modalRating").textContent = `Força média do time: ${avg.toFixed(1)}`;

  let msg;
  if (goalsFor >= 7 && goalsAgainst === 0) msg = "🔥 GOLEADA HISTÓRICA — 7 A 0!";
  else if (goalsFor - goalsAgainst >= 4) msg = "💥 Show de bola, atropelou geral!";
  else if (goalsFor > goalsAgainst) msg = "✅ Vitória tranquila do seu time.";
  else if (goalsFor === goalsAgainst) msg = "😅 Empatou, mas o time é lenda.";
  else msg = "😬 Foi pro jogo, mas tropeçou.";

  document.getElementById("modalMsg").textContent = msg;
  modal.classList.remove("hidden");
}

function initials(name) {
  const words = name.replace(/^(AC|FC)\s+/i, "").split(" ").filter(Boolean);
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[words.length - 1][0]).toUpperCase();
}

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
