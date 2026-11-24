// Motor agronômico: interpretação de solo, recomendações, previsão de safra,
// uniformidade, ETo, lâmina e plano do ciclo.
import { TAREFAS, TAREFA, VARIEDADES } from './catalog.js';
import { mean, stdev, t95, isoDate, parseISO, addDays, daysBetween, pad } from './util.js';

// ---------------- Parâmetros padrão (editáveis em Configurações) ----------------
export const PARAM_PADRAO = {
  v2: 60,                // saturação por bases desejada (%) — 5ª Aproximação para café
  prnt: 90,              // PRNT do calcário (%)
  fracaoCalagem: 1,      // fração da área que recebe calcário (1 = área total)
  rendimento: 500,       // litros de café colhido por saca beneficiada de 60 kg
  frutosPorLitro: 450,   // frutos por litro (calibrar na fazenda)
  kcProducao: 1.05,
  kcFormacao: 0.8,
  eficienciaIrrig: 0.9,
  precoSaca: 1650,       // R$/saca (para receita estimada)
  custoHoraPessoa: 18,   // R$/h por pessoa
  // Tabelas de recomendação por classe de produtividade esperada (sc/ha):
  // classes: ≤20, 20–30, 30–40, 40–50, 50–60, >60
  classesProd: [20, 30, 40, 50, 60],
  tabN: [200, 250, 300, 350, 400, 450],
  tabK: {
    baixo: [200, 250, 300, 350, 400, 450],   // K ≤ 60 mg/dm³
    medio: [150, 190, 225, 265, 300, 340],   // 61–120
    bom: [100, 125, 150, 175, 200, 225],     // 121–200
    alto: [0, 0, 0, 0, 0, 0],                // > 200
  },
  tabP: {
    baixo: [40, 50, 60, 70, 80, 90],
    medio: [20, 30, 40, 45, 50, 60],
    bom: [0, 0, 0, 0, 0, 0],
  },
};

// ---------------- Interpretação de solo (classes da 5ª Aproximação, CFSEMG 1999) ----------------
const CL5 = ['Muito baixo', 'Baixo', 'Médio', 'Bom', 'Muito bom'];
function classe(v, lims, nomes = CL5) {
  if (v == null || v === '' || Number.isNaN(+v)) return null;
  for (let i = 0; i < lims.length; i++) if (+v <= lims[i]) return { i, nome: nomes[i] };
  return { i: lims.length, nome: nomes[lims.length] };
}
export function limitesP(argila) {
  if (argila >= 60) return [2.7, 5.4, 8.0, 12.0];
  if (argila >= 35) return [4.0, 8.0, 12.0, 18.0];
  if (argila >= 15) return [6.6, 12.0, 20.0, 30.0];
  return [10.0, 20.0, 30.0, 45.0];
}

export function derivados(a) {
  const k = (+a.k || 0) / 391; // mg/dm³ -> cmolc/dm³
  const sb = (+a.ca || 0) + (+a.mg || 0) + k;
  const T = sb + (+a.hal || 0);
  const t = sb + (+a.al || 0);
  const V = T > 0 ? (sb / T) * 100 : 0;
  const m = t > 0 ? ((+a.al || 0) / t) * 100 : 0;
  const caMg = +a.mg ? +a.ca / +a.mg : null;
  return { kc: k, sb, T, t, V, m, caMg };
}

export const ATRIBUTOS = [
  { k: 'ph', l: 'pH (água)', u: '', lims: [4.4, 5.4, 6.0, 7.0], nomes: ['Acidez muito alta', 'Acidez alta', 'Adequado', 'Acidez fraca', 'Alcalino'] },
  { k: 'mo', l: 'Matéria orgânica', u: 'dag/kg', lims: [0.7, 2.0, 4.0, 7.0] },
  { k: 'p', l: 'P (Mehlich-1)', u: 'mg/dm³', lims: null },
  { k: 'k', l: 'K', u: 'mg/dm³', lims: [15, 40, 70, 120] },
  { k: 'ca', l: 'Ca', u: 'cmolc/dm³', lims: [0.4, 1.2, 2.4, 4.0] },
  { k: 'mg', l: 'Mg', u: 'cmolc/dm³', lims: [0.15, 0.45, 0.9, 1.5] },
  { k: 'al', l: 'Al', u: 'cmolc/dm³', lims: [0.2, 0.5, 1.0, 2.0], nomes: ['Muito baixo', 'Baixo', 'Médio', 'Alto', 'Muito alto'], inverso: true },
  { k: 'hal', l: 'H + Al', u: 'cmolc/dm³', lims: [1.0, 2.5, 5.0, 9.0], nomes: ['Muito baixo', 'Baixo', 'Médio', 'Alto', 'Muito alto'], inverso: true },
  { k: 's', l: 'S', u: 'mg/dm³', lims: [2.5, 5.0, 7.5, 10] },
  { k: 'b', l: 'B', u: 'mg/dm³', lims: [0.15, 0.35, 0.6, 0.9] },
  { k: 'zn', l: 'Zn', u: 'mg/dm³', lims: [0.4, 0.9, 1.5, 2.2] },
  { k: 'cu', l: 'Cu', u: 'mg/dm³', lims: [0.3, 0.7, 1.2, 1.8] },
  { k: 'fe', l: 'Fe', u: 'mg/dm³', lims: [8, 18, 30, 45] },
  { k: 'mn', l: 'Mn', u: 'mg/dm³', lims: [2, 5, 8, 12] },
  { k: 'argila', l: 'Argila', u: '%', lims: null },
];
export const DERIV = [
  { k: 'sb', l: 'Soma de bases (SB)', u: 'cmolc/dm³', lims: [0.6, 1.8, 3.6, 6.0] },
  { k: 'T', l: 'CTC a pH 7 (T)', u: 'cmolc/dm³', lims: [1.6, 4.3, 8.6, 15] },
  { k: 'V', l: 'Saturação por bases (V)', u: '%', lims: [20, 40, 60, 80] },
  { k: 'm', l: 'Saturação por Al (m)', u: '%', lims: [15, 30, 50, 75], nomes: ['Muito baixo', 'Baixo', 'Médio', 'Alto', 'Muito alto'], inverso: true },
];

export function interpretar(a) {
  const d = derivados(a);
  const out = {};
  for (const at of ATRIBUTOS) {
    if (at.k === 'p') out.p = classe(a.p, limitesP(+a.argila || 40));
    else if (at.lims) out[at.k] = classe(a[at.k], at.lims, at.nomes);
  }
  for (const at of DERIV) out[at.k] = classe(d[at.k], at.lims, at.nomes);
  return { d, cls: out };
}

function idxProd(sc, p) {
  let i = 0;
  while (i < p.classesProd.length && sc > p.classesProd[i]) i++;
  return i;
}

// Recomendação para uma região a partir das camadas 0–20 e 20–40 cm.
export function recomendar(a020, a2040, scEsperada, p = PARAM_PADRAO, estagio = 'P') {
  const r = { alertas: [], notas: [] };
  if (!a020) return null;
  const { d } = interpretar(a020);
  r.d = d;
  const prnt = +p.prnt || 90;
  const nc = Math.max(0, ((p.v2 - d.V) * d.T) / prnt) * (+p.fracaoCalagem || 1);
  r.calagem = nc;
  r.calcario = (+a020.mg || 0) < 0.9 ? 'Dolomítico (Mg abaixo de 0,9 cmolc/dm³)' : 'Calcítico ou dolomítico';
  if (d.caMg && d.caMg > 4) r.notas.push(`Relação Ca/Mg de ${d.caMg.toFixed(1)}: alta. Preferir calcário dolomítico ou fonte de Mg.`);
  // Gessagem
  if (a2040) {
    const d2 = derivados(a2040);
    const precisa = (+a2040.ca || 0) < 0.4 || (+a2040.al || 0) > 0.5 || d2.m > 30;
    r.gessagem = precisa ? 50 * (+a2040.argila || +a020.argila || 40) : 0;
    r.motivoGesso = precisa
      ? `20–40 cm: Ca ${(+a2040.ca).toFixed(2)}, Al ${(+a2040.al).toFixed(2)} cmolc/dm³, m ${d2.m.toFixed(0)}%`
      : 'Subsolo sem restrição química pelos critérios usados.';
  } else {
    r.gessagem = null;
    r.motivoGesso = 'Sem análise da camada 20–40 cm.';
  }
  // NPK
  if (estagio === 'P') {
    const i = idxProd(scEsperada, p);
    r.classeProd = i;
    r.N = p.tabN[i];
    const kk = +a020.k;
    const kcls = kk <= 60 ? 'baixo' : kk <= 120 ? 'medio' : kk <= 200 ? 'bom' : 'alto';
    r.K2O = p.tabK[kcls][i];
    r.kClasse = kcls;
    const pl = limitesP(+a020.argila || 40);
    const pcls = +a020.p <= pl[1] ? 'baixo' : +a020.p <= pl[2] ? 'medio' : 'bom';
    r.P2O5 = p.tabP[pcls][i];
    r.pClasse = pcls;
    r.exportacao = { N: scEsperada * 2.95, K2O: scEsperada * 3.02 * 1.205 };
  } else {
    r.N = null; r.K2O = null; r.P2O5 = null;
    r.notas.push('Lavoura em formação: adubação por idade (g/cova), parcelada no período chuvoso ou via fertirrigação.');
  }
  // Micronutrientes
  if (a020.b != null && +a020.b <= 0.6) r.alertas.push('Boro baixo: 2–3 kg/ha de B via solo ou fertirrigação + foliar de ácido bórico na pré-florada.');
  if (a020.zn != null && +a020.zn <= 1.5) r.alertas.push('Zinco abaixo de bom: 2 a 3 foliares de sulfato de zinco (0,4–0,6%) entre setembro e janeiro.');
  if (a020.cu != null && +a020.cu <= 0.7) r.alertas.push('Cobre baixo: fungicidas cúpricos no programa suprem a demanda.');
  if (a020.mn != null && +a020.mn <= 5) r.alertas.push('Manganês baixo: atenção após calagem (pH alto reduz Mn disponível).');
  if (a020.s != null && +a020.s <= 5) r.alertas.push('Enxofre baixo: usar sulfato de amônio ou gesso como fonte de S.');
  if (d.m > 20) r.alertas.push(`Saturação por alumínio de ${d.m.toFixed(0)}% na camada 0–20 cm.`);
  if (+a020.mo < 2) r.alertas.push('Matéria orgânica baixa: manter palhada da entrelinha (roçada ecológica) e triturar ramos de poda.');
  return r;
}

// ---------------- Estimativa de safra ----------------
// c = { metodo: 'frutos'|'litros', valores: [...], ramos, fpl, rend }
//   frutos: valores = frutos por ramo (média de 4 ramos) por planta; ramos = ramos produtivos/planta (média ou lista)
//   litros: valores = litros por planta (derriça amostral)
export function estimar(c, regiao, falhasPct, p = PARAM_PADRAO) {
  const fpl = +c.fpl || p.frutosPorLitro;
  const rend = +c.rend || p.rendimento;
  let lpl = [];
  if (c.metodo === 'litros') lpl = (c.valores || []).map(Number).filter((v) => v >= 0);
  else {
    const ramos = Array.isArray(c.ramos) ? c.ramos.map(Number) : null;
    lpl = (c.valores || []).map((v, i) => (+v * (ramos ? ramos[i] ?? mean(ramos) : +c.ramos || 0)) / fpl);
  }
  if (!lpl.length) return null;
  const n = lpl.length;
  const m = mean(lpl);
  const sd = stdev(lpl);
  const se = n > 1 ? sd / Math.sqrt(n) : 0;
  const plHa = regiao.plantasHa * (1 - (falhasPct || 0) / 100);
  const k = plHa / rend;
  const scha = m * k;
  const ci = t95(n - 1) * se * k;
  return {
    n, lPlanta: m, cv: m ? (sd / m) * 100 : 0, plHa, scha,
    ciLo: Math.max(0, scha - ci), ciHi: scha + ci,
    total: scha * regiao.areaHa, totalLo: Math.max(0, scha - ci) * regiao.areaHa, totalHi: (scha + ci) * regiao.areaHa,
  };
}

// ---------------- Uniformidade (CUD) ----------------
export function cud(vals) {
  const v = vals.map(Number).filter((x) => x > 0).sort((a, b) => a - b);
  if (v.length < 4) return null;
  const q = Math.max(1, Math.floor(v.length / 4));
  const low = mean(v.slice(0, q));
  const val = (low / mean(v)) * 100;
  const cls = val >= 90 ? 'Excelente' : val >= 80 ? 'Bom' : val >= 70 ? 'Regular' : 'Ruim';
  return { val, cls, n: v.length, media: mean(v) };
}

// ---------------- ETo Hargreaves-Samani (FAO-56) ----------------
export function radiacaoExtra(latDeg, doy) {
  const phi = (latDeg * Math.PI) / 180;
  const dr = 1 + 0.033 * Math.cos((2 * Math.PI * doy) / 365);
  const dec = 0.409 * Math.sin((2 * Math.PI * doy) / 365 - 1.39);
  const ws = Math.acos(Math.max(-1, Math.min(1, -Math.tan(phi) * Math.tan(dec))));
  return ((24 * 60) / Math.PI) * 0.082 * dr * (ws * Math.sin(phi) * Math.sin(dec) + Math.cos(phi) * Math.cos(dec) * Math.sin(ws));
}
export function etoHargreaves(tmax, tmin, latDeg, dateIso) {
  const d = parseISO(dateIso);
  const start = new Date(d.getFullYear(), 0, 0);
  const doy = Math.floor((d - start) / 86400000);
  const ra = radiacaoExtra(latDeg, doy);
  const tmed = (tmax + tmin) / 2;
  return 0.0023 * (tmed + 17.8) * Math.sqrt(Math.max(0, tmax - tmin)) * 0.408 * ra;
}

// Taxa de aplicação do gotejamento (mm/h) e tempo de rega
export function taxaMmH(reg) { return reg.gotVazao / (reg.espLinha * reg.gotEsp); }
export function tempoRega(etcMm, reg, p = PARAM_PADRAO) {
  return etcMm / (taxaMmH(reg) * (+p.eficienciaIrrig || 0.9));
}
export function kr(reg) {
  const cob = Math.min(1, reg.largCopa / reg.espLinha);
  return Math.min(1, cob / 0.85);
}

// ---------------- Estágio e plano do ciclo ----------------
export function idadeAnos(reg, iso) {
  const d = parseISO(iso);
  return d.getFullYear() + d.getMonth() / 12 - (reg.plantio + 0.1);
}
export function estagio(reg, safra) {
  return safra - reg.plantio >= 2 ? 'P' : 'F';
}
export function faseAtual(iso) {
  const m = parseISO(iso).getMonth() + 1;
  if (m === 7 || m === 8) return 'POS';
  if (m === 9) return 'COR';
  if (m === 10) return 'FLO';
  if (m === 11 || m === 12) return 'DES';
  if (m >= 1 && m <= 3) return 'GRA';
  if (m === 4) return 'MAT';
  return 'COL';
}

// Ciclo "safra S": de julho de S-1 (pós-colheita) até a colheita de S.
function janela(safra, m0, m1) {
  const y0 = m0 < 7 ? safra : safra - 1;
  const y1 = m1 < m0 ? y0 + 1 : y0;
  const last = new Date(y1, m1, 0).getDate();
  return [`${y0}-${pad(m0)}-01`, `${y1}-${pad(m1)}-${pad(last)}`];
}

// Ocorrências planejadas no ano-safra para um estágio
export function planoSafra(safra, est) {
  const out = [];
  for (const t of TAREFAS) {
    if (t.unid === 'equip.') continue; // tarefas de equipamento não entram no plano por rua
    (t.plano || []).forEach((p, i) => {
      if (p.est !== 'A' && p.est !== est) return;
      const [ini, fim] = janela(safra, p.m[0], p.m[1]);
      out.push({
        key: `${t.id}#${i}`, tarefa: t.id, nome: t.nome + (p.n ? ` — ${p.n}` : ''), fase: t.fase,
        ini, fim,
        recorrente: p.recorrente || 0, opcional: !!p.opcional, unid: t.unid,
      });
    });
  }
  out.sort((a, b) => (a.ini < b.ini ? -1 : a.ini > b.ini ? 1 : 0));
  return out;
}

// Status de uma ocorrência dada a lista de datas em que a tarefa foi feita na rua
export function statusOcorrencia(oc, datas, hoje) {
  if (oc.recorrente) {
    if (hoje < oc.ini) return { st: 'futura' };
    if (hoje > oc.fim) return { st: 'feita' };
    const dentro = datas.filter((d) => d >= addDays(oc.ini, -oc.recorrente) && d <= hoje).sort();
    const ult = dentro[dentro.length - 1];
    if (!ult) return { st: daysBetween(oc.ini, hoje) > oc.recorrente * 1.5 ? 'atrasada' : 'agora' };
    const dias = daysBetween(ult, hoje);
    return { st: dias > oc.recorrente * 1.5 ? 'atrasada' : 'feita', ult, dias };
  }
  const ini = addDays(oc.ini, -20), fim = addDays(oc.fim, 30);
  const feita = datas.find((d) => d >= ini && d <= fim);
  if (feita) return { st: 'feita', ult: feita };
  if (hoje > oc.fim) return { st: oc.opcional ? 'opcional' : 'atrasada' };
  if (hoje >= oc.ini) return { st: oc.opcional ? 'opcional' : 'agora' };
  return { st: 'futura' };
}

export function diasMaturacao(variedade) {
  const v = VARIEDADES.find((x) => x.nome === variedade);
  return v ? v.dias : 240;
}
export function previsaoMaturacao(floradaIso, variedade) {
  return floradaIso ? addDays(floradaIso, diasMaturacao(variedade)) : null;
}

export function sacas(litros, p = PARAM_PADRAO) { return (+litros || 0) / (+p.rendimento || 500); }

// Custo de uma OS
export function custoOS(os, areaHa, precos, equipMap, p = PARAM_PADRAO) {
  let insumos = 0;
  for (const it of os.insumos || []) {
    const pr = precos[it.id] ?? 0;
    const qtd = it.porHa === false ? +it.dose || 0 : (+it.dose || 0) * areaHa;
    insumos += qtd * pr;
  }
  const horas = +os.horas || 0;
  const eq = os.equip ? equipMap[os.equip] : null;
  const maquina = eq ? horas * (+eq.custoHora || 0) : 0;
  const mao = horas * (+os.pessoas || 0) * (+p.custoHoraPessoa || 0);
  return { insumos, maquina, mao, total: insumos + maquina + mao };
}

export { TAREFA };
