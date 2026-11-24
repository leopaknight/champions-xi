// Dados de exemplo, gerados de forma determinística a partir da data de hoje.
// Ficam marcados como "exemplo" e somem com um clique em Configurações.
import { rng, hash, isoDate, addDays, parseISO, pad, compressRanges, anoSafra, clamp } from './util.js';
import { PARAM_PADRAO, estagio } from './agro.js';

export const EQUIP_DEMO = [
  { id: 'COL-01', nome: 'Colhedora 01', tipo: 'colhedora', serie: 'CH-2219', horimetro: 4120, consumo: 14, custoHora: 420, rastreador: 'GPS-1001' },
  { id: 'COL-02', nome: 'Colhedora 02', tipo: 'colhedora', serie: 'CH-2384', horimetro: 2890, consumo: 14, custoHora: 420, rastreador: 'GPS-1002' },
  { id: 'TR-01', nome: 'Trator 01 + pulverizador', tipo: 'pulverizador', serie: 'TR-75-01', horimetro: 6310, consumo: 7, custoHora: 190, rastreador: 'GPS-1003' },
  { id: 'TR-02', nome: 'Trator 02 + roçadeira', tipo: 'rocadeira', serie: 'TR-75-02', horimetro: 5480, consumo: 6.5, custoHora: 170, rastreador: 'GPS-1004' },
  { id: 'TR-03', nome: 'Trator 03 + bazuca', tipo: 'bazuca', serie: 'TR-85-03', horimetro: 3920, consumo: 8, custoHora: 180, rastreador: 'GPS-1005' },
  { id: 'TR-04', nome: 'Trator 04 + bazuca', tipo: 'bazuca', serie: 'TR-85-04', horimetro: 3610, consumo: 8, custoHora: 180, rastreador: 'GPS-1006' },
  { id: 'AD-01', nome: 'Trator 05 + adubadora', tipo: 'adubadora', serie: 'TR-65-05', horimetro: 4870, consumo: 6, custoHora: 160, rastreador: 'GPS-1007' },
  { id: 'RE-01', nome: 'Recolhedora 01', tipo: 'recolhedora', serie: 'RC-118', horimetro: 2210, consumo: 9, custoHora: 230, rastreador: 'GPS-1008' },
  { id: 'ES-01', nome: 'Trator 06 + esparramadora', tipo: 'esparramadora', serie: 'TR-65-06', horimetro: 3990, consumo: 6, custoHora: 160, rastreador: 'GPS-1009' },
  { id: 'CM-01', nome: 'Caminhão 01', tipo: 'caminhao', serie: 'Placa ABC1D23', horimetro: 0, consumo: 0, custoHora: 140, rastreador: 'GPS-1010' },
];

const OPER = ['João Batista', 'Marcelo Souza', 'Antônio Carlos', 'Rafael Lima', 'Sebastião Alves', 'Wesley Rocha', 'Valdir Pereira'];

export function makeDemo(farm, hoje) {
  const R = rng(hash('demo' + hoje.slice(0, 7)));
  const S = anoSafra(hoje); // ciclo corrente (colheita em S)
  const y0 = S - 1;
  const D = (m, d) => `${m >= 7 ? y0 : S}-${pad(m)}-${pad(d)}`;
  const pick = (a) => a[Math.floor(R() * a.length)];
  const os = [];
  let n = 0;
  const regs = farm.regions;
  const est = (reg) => estagio(reg, S);
  const ruasDe = (reg, filtro) => ({ [reg.id]: compressRanges((filtro ? reg.rows.filter(filtro) : reg.rows).map((r) => r.idx)) });
  const setorRuas = (st) => ({ [st.reg]: compressRanges(st.rows.map((r) => r.idx)) });
  const add = (o) => {
    if (o.status !== 'planejada' && o.status !== 'execucao' && o.data > hoje) return;
    os.push({ id: `demo-os-${++n}`, status: 'concluida', operador: pick(OPER), pessoas: 1, horas: 0, insumos: [], campos: {}, ...o });
  };
  const horasArea = (reg, filtro, haH) => {
    const a = (filtro ? reg.rows.filter(filtro) : reg.rows).reduce((s, r) => s + r.areaHa, 0);
    return Math.round((a / haH) * 10) / 10;
  };

  for (const reg of regs) {
    const P = est(reg) === 'P';
    const all = ruasDe(reg);
    if (P) {
      add({ tarefa: 'PC01', data: D(7, 22 + (reg.idx || 0)), ruas: all, equip: 'ES-01', horas: horasArea(reg, null, 2.5), campos: { metodo: 'Esparramadora mecânica' } });
      add({ tarefa: 'PC02', data: D(8, 4), ruas: all, equip: 'RE-01', horas: horasArea(reg, null, 1.6), campos: { litros: Math.round(reg.areaHa * 180), lote: `V${S - 1}-${reg.id}`, frutosm2: 0.6 } });
      add({ tarefa: 'FL01', data: D(7, 1), ruas: all, campos: { inicio: `${y0}-06-24`, fim: `${y0}-09-02`, psi: -1.8, gemas: 'E4' } });
      add({ tarefa: 'FL02', data: D(9, 3), ruas: all, horas: 36, campos: { lamina: 32, horas: 36 } });
      add({ tarefa: 'FL03', data: D(9, 13 + regs.indexOf(reg)), ruas: all, campos: { ordem: '1ª', intensidade: 'Forte', pctPlantas: 88, principal: true } });
      add({ tarefa: 'FL03', data: D(10, 2), ruas: all, campos: { ordem: '2ª', intensidade: 'Fraca', pctPlantas: 20, principal: false } });
      add({ tarefa: 'FL04', data: D(9, 24), ruas: all, equip: 'TR-01', horas: horasArea(reg, null, 3), insumos: [{ id: 'boric', dose: 1.2 }, { id: 'znso4', dose: 2 }], campos: { calda: 400, bico: 'Cone vazio', pressao: 8, velocidade: 5.5, vento: 6, temp: 26, ur: 62, epi: true } });
      add({ tarefa: 'AD01', data: D(10, 18 + regs.indexOf(reg) * 6), ruas: all, equip: 'AD-01', horas: horasArea(reg, null, 4), insumos: [{ id: 'f200520', dose: 450 }], campos: { parcela: '1ª', formula: '20-05-20', modo: 'Faixa (projeção da copa)', faixa: 1.2 } });
      add({ tarefa: 'MD02', data: D(10, 28), ruas: all, equip: 'TR-01', horas: horasArea(reg, null, 4), insumos: [{ id: 'glifo', dose: 2 }, { id: 'preem', dose: 0.15 }], campos: { tipo: 'Pré + pós', faixa: 1, calda: 200, bico: 'Leque antideriva (indução de ar)', receita: `RA-${S}-0${regs.indexOf(reg) + 11}`, carencia: 0, vento: 5, temp: 27, ur: 60, epi: true } });
      add({ tarefa: 'PC06', data: D(7, 28), ruas: all, campos: { prof: '0–20 e 20–40 cm', subamostras: 20, laboratorio: 'Laboratório de solos (exemplo)', protocolo: `${S - 1}/${1200 + regs.indexOf(reg)}` } });
    } else {
      add({ tarefa: 'PC06', data: D(7, 28), ruas: all, campos: { prof: '0–20 e 20–40 cm', subamostras: 20, laboratorio: 'Laboratório de solos (exemplo)', protocolo: `${S - 1}/${1200 + regs.indexOf(reg)}` } });
      add({ tarefa: 'FT06', data: D(9, 10), ruas: all, insumos: [{ id: 'isca', dose: 0.4 }], campos: { formigueiros: 14, area: 38 }, pessoas: 2, horas: 6 });
      add({ tarefa: 'IM04', data: D(10, 26), ruas: all, equip: 'AD-01', horas: horasArea(reg, null, 5), insumos: [{ id: 'f200520', dose: 120 }], campos: { parcela: '1ª', modo: 'Faixa (projeção da copa)', faixa: 0.6 } });
      add({ tarefa: 'MD03', data: D(11, 6), ruas: ruasDe(reg, (r) => r.setor.endsWith('S1')), pessoas: 8, horas: 8 });
      add({ tarefa: 'IM03', data: D(11, 12), ruas: ruasDe(reg, (r) => r.idx % 3 === 0), pessoas: 4, horas: 8, campos: { mudas: 640 } });
    }
    add({ tarefa: 'PC10', data: D(8, 26), ruas: all, equip: 'TR-02', horas: 6, campos: { metros: Math.round(reg.areaHa * 22), bacias: Math.round(reg.areaHa / 4) } });
    add({ tarefa: 'IR04', data: D(8, 14 + regs.indexOf(reg)), ruas: all, pessoas: 2, horas: 6, insumos: [{ id: 'acfosf', dose: 1.5 }], campos: { setor: reg.setores.map((s) => s.id).join(', '), tipo: 'Acidificação', phAlvo: 3, tempo: 2 } });
    if (P) add({ tarefa: 'PC03', data: D(8, 30), ruas: all, pessoas: 6, horas: 8, campos: { litros: Math.round(reg.areaHa * 25), pessoas: 6 } });
    else {
      add({ tarefa: 'FL04', data: D(9, 26), ruas: all, equip: 'TR-01', horas: 6, insumos: [{ id: 'boric', dose: 0.8 }, { id: 'znso4', dose: 1.2 }], campos: { calda: 200, bico: 'Cone vazio', vento: 5, temp: 27, ur: 60, epi: true } });
      if (reg.id === 'R4' || reg.id === 'R5') add({ tarefa: 'CR01', data: D(9, 18), ruas: all, equip: 'AD-01', horas: 10, insumos: [{ id: 'calc-dol', dose: 0.8 }], campos: { modo: 'Faixa (projeção da copa)', faixa: 1, prnt: 90 } });
    }
    // Monitoramento mensal (alimenta Fitossanidade)
    for (let m of [7, 8, 9, 10, 11]) {
      const seco = m <= 9;
      const k = regs.indexOf(reg);
      add({
        tarefa: 'MN01', data: D(m, 15 + (k % 3)), ruas: all, pessoas: 1, horas: 4,
        campos: {
          mineiro: Math.round(clamp((seco ? 18 + m * 1.5 : 10) + (k === 1 ? 9 : 0) + R() * 6, 0, 60)),
          broca: P ? Math.round((0.6 + R() * 1.4) * 10) / 10 : 0,
          ferrugem: Math.round(clamp((m >= 10 ? 0.8 + (m - 9) * 0.9 : 0.5) + R() * 1.4 + (k === 2 && m === 11 ? 3 : 0), 0, 40) * 10) / 10,
          cercospora: Math.round((2 + R() * 4 + (P ? 0 : 3)) * 10) / 10,
          acaro: Math.round(seco ? 8 + R() * 10 : 3 + R() * 4),
        },
      });
    }
    // Fertirrigação semanal desde a retomada
    for (let d = D(9, 8); d <= hoje; d = addDays(d, 7)) {
      add({ tarefa: 'AD02', data: d, ruas: all, horas: 3, insumos: P ? [{ id: 'ureia', dose: 9 }, { id: 'kclb', dose: 10 }, { id: 'mgso4', dose: 4 }] : [{ id: 'ureia', dose: 3 }, { id: 'mappur', dose: 1.5 }, { id: 'kclb', dose: 2.5 }], campos: { setor: reg.setores.map((s) => s.id).join(', '), tanque: 2500, tempoInj: 70, ce: 1.3, ph: 6.1 } });
    }
    // Flushing mensal
    for (const m of [8, 9, 10, 11]) add({ tarefa: 'IR03', data: D(m, 5 + regs.indexOf(reg)), ruas: all, pessoas: 2, horas: 5, campos: { setor: reg.setores.map((s) => s.id).join(', '), aspecto: m === 9 ? 'Pouco sedimento' : 'Limpa' } });
    // CUD por setor
    reg.setores.forEach((st, i) => {
      const base = 1.6 - (st.id === 'R2-S1' ? 0.18 : 0);
      const vaz = Array.from({ length: 16 }, () => Math.round((base + (R() - 0.5) * (st.id === 'R2-S1' ? 0.5 : 0.18)) * 100) / 100);
      add({ tarefa: 'IR05', data: D(8, 20 + i), ruas: setorRuas(st), pessoas: 2, horas: 3, campos: { setor: st.id, vazoes: vaz.join(', '), pressao: 14 } });
    });
  }
  // Específicas
  const r1 = farm.regionById.get('R1'), r2 = farm.regionById.get('R2'), r3 = farm.regionById.get('R3'), r4 = farm.regionById.get('R4'), r5 = farm.regionById.get('R5');
  if (r1) {
    add({ tarefa: 'PC04', data: D(8, 12), ruas: ruasDe(r1, (r) => r.setor === 'R1-S3'), equip: 'TR-02', horas: 22, campos: { tipo: 'Decote', altura: 2.0, destino: 'Triturado na entrelinha' } });
    add({ tarefa: 'CR01', data: D(9, 5), ruas: ruasDe(r1), equip: 'AD-01', horas: 14, insumos: [{ id: 'calc-dol', dose: 1.2 }], campos: { modo: 'Faixa (projeção da copa)', faixa: 1.5, prnt: 90 } });
    add({ tarefa: 'FT01', data: D(11, 10), ruas: ruasDe(r1), equip: 'TR-01', horas: 16, insumos: [{ id: 'triaz-solo', dose: 1.0 }], campos: { metodo: 'Via solo (drench)', alvo: 'Ferrugem + cercosporiose', receita: `RA-${S}-021`, carencia: 0, reentrada: 24, epi: true, vento: 4, temp: 25, ur: 70 } });
    add({ tarefa: 'MD01', data: D(11, 14), ruas: ruasDe(r1), equip: 'TR-02', horas: 18, campos: { altura: 12, tipo: 'Roçadeira lateral (ecológica)' } });
  }
  if (r2) {
    add({ tarefa: 'FT05', data: D(9, 28), ruas: ruasDe(r2), equip: 'TR-01', horas: 14, insumos: [{ id: 'diamida', dose: 0.1 }, { id: 'adjuv', dose: 0.5 }], campos: { metodo: 'Foliar', infest: 31, calda: 400, bico: 'Cone vazio', receita: `RA-${S}-014`, carencia: 0, reentrada: 24, vento: 7, temp: 28, ur: 58, epi: true } });
    add({ tarefa: 'CR02', data: D(9, 6), ruas: ruasDe(r2), equip: 'AD-01', horas: 12, insumos: [{ id: 'gesso', dose: 2.6 }], campos: { modo: 'Faixa (projeção da copa)', faixa: 1.5 } });
    add({ tarefa: 'FT01', data: D(11, 18), ruas: ruasDe(r2), equip: 'TR-01', horas: 15, insumos: [{ id: 'triaz-solo', dose: 1.0 }], campos: { metodo: 'Via solo (drench)', alvo: 'Ferrugem + cercosporiose', receita: `RA-${S}-022`, carencia: 0, reentrada: 24, epi: true, vento: 5, temp: 26, ur: 66 } });
  }
  if (r3) {
    add({ tarefa: 'CR01', data: D(9, 9), ruas: ruasDe(r3), equip: 'AD-01', horas: 13, insumos: [{ id: 'calc-dol', dose: 0.9 }], campos: { modo: 'Faixa (projeção da copa)', faixa: 1.5, prnt: 90 } });
  }
  // Hoje e próximos dias
  const amanha = addDays(hoje, 1);
  if (r2) add({ tarefa: 'AD01', data: hoje, status: 'execucao', ruas: { R2: compressRanges(r2.rows.filter((r) => r.setor !== 'R2-S3').map((r) => r.idx)) }, equip: 'AD-01', horas: 9, insumos: [{ id: 'f200520', dose: 400 }], campos: { parcela: '2ª', formula: '20-05-20', modo: 'Faixa (projeção da copa)', faixa: 1.2 } });
  if (r3) add({ tarefa: 'MD01', data: hoje, status: 'execucao', ruas: ruasDe(r3), equip: 'TR-02', horas: 8, campos: { altura: 12, tipo: 'Roçadeira lateral (ecológica)' } });
  if (r5) add({ tarefa: 'AD03', data: hoje, status: 'execucao', ruas: ruasDe(r5), equip: 'TR-01', horas: 8, insumos: [{ id: 'znso4', dose: 1.5 }, { id: 'boric', dose: 1 }, { id: 'mnso4', dose: 1 }], campos: { calda: 250, bico: 'Cone vazio', pressao: 7, velocidade: 5, vento: 5, temp: 27, ur: 61, epi: true } });
  if (r3) add({ tarefa: 'FT01', data: amanha, status: 'planejada', ruas: ruasDe(r3), equip: 'TR-01', horas: 14, insumos: [{ id: 'triaz-estrob', dose: 0.75 }, { id: 'cuoxi', dose: 2 }], campos: { metodo: 'Foliar', alvo: 'Ferrugem + cercosporiose', calda: 400, bico: 'Cone vazio', receita: `RA-${S}-023` } });
  if (r1) add({ tarefa: 'PC07', data: addDays(hoje, 8), status: 'planejada', ruas: ruasDe(r1), campos: { plantas: 25 } });
  if (r4) add({ tarefa: 'MD03', data: addDays(hoje, 2), status: 'planejada', ruas: ruasDe(r4), pessoas: 10, horas: 8 });
  // Filtros (ativo) semanais e turnos de irrigação dos últimos 14 dias
  for (let d = D(9, 2); d <= hoje; d = addDays(d, 7)) add({ tarefa: 'IR02', data: d, ativo: 'FL-01', pessoas: 1, horas: 1, campos: { pEntrada: 4.2, pSaida: 3.8, tipo: 'Retrolavagem automática' } });
  for (let i = 14; i >= 1; i--) {
    const d = addDays(hoje, -i);
    const setores = farm.regions.flatMap((r) => r.setores);
    const area = setores.reduce((s, x) => s + x.areaHa, 0);
    const lam = 3.2 + R() * 1.2;
    const vol = Math.round(area * lam * 10);
    add({ tarefa: 'IR01', data: d, ruas: Object.fromEntries(regs.map((r) => [r.id, compressRanges(r.rows.map((x) => x.idx))])), horas: 0, campos: { setor: 'Todos (rodízio noturno)', horas: Math.round(vol / 380 * 10) / 10, lamina: Math.round(lam * 10) / 10, volume: vol, bomba: 'B-01, B-02', kwh: Math.round(vol * 0.24) } });
  }
  add({ tarefa: 'MB01', data: addDays(hoje, -4), status: 'execucao', ativo: 'B-03', pessoas: 2, horas: 6, campos: { tipo: 'Corretiva', horimetro: 11840, corrente: '61/63/70', pecas: 'Rolamentos 6312 e 6310' } });

  // ---------- Análises de solo ----------
  const SOLO = {
    R1: [{ ph: 5.6, mo: 2.8, p: 18, k: 135, ca: 3.1, mg: 0.9, al: 0.0, hal: 3.6, s: 9, b: 0.42, zn: 2.1, cu: 1.4, fe: 38, mn: 9, argila: 55 }, { ph: 5.2, mo: 1.6, p: 4, k: 70, ca: 1.4, mg: 0.4, al: 0.2, hal: 4.0, argila: 58 }],
    R2: [{ ph: 5.1, mo: 2.4, p: 9, k: 82, ca: 2.0, mg: 0.6, al: 0.2, hal: 4.6, s: 6, b: 0.31, zn: 1.2, cu: 0.9, fe: 42, mn: 6, argila: 50 }, { ph: 4.7, mo: 1.3, p: 2, k: 40, ca: 0.35, mg: 0.15, al: 0.6, hal: 5.0, argila: 54 }],
    R3: [{ ph: 5.4, mo: 2.6, p: 14, k: 110, ca: 2.6, mg: 0.8, al: 0.1, hal: 4.0, s: 7, b: 0.5, zn: 1.6, cu: 1.1, fe: 35, mn: 8, argila: 48 }, { ph: 5.0, mo: 1.4, p: 3, k: 55, ca: 0.8, mg: 0.3, al: 0.3, hal: 4.4, argila: 50 }],
    R4: [{ ph: 5.8, mo: 2.2, p: 22, k: 95, ca: 3.4, mg: 1.1, al: 0, hal: 3.0, s: 8, b: 0.38, zn: 1.9, cu: 1.2, fe: 30, mn: 7, argila: 46 }, { ph: 5.4, mo: 1.2, p: 5, k: 60, ca: 1.6, mg: 0.5, al: 0.1, hal: 3.5, argila: 49 }],
    R5: [{ ph: 5.7, mo: 2.0, p: 20, k: 88, ca: 3.0, mg: 1.0, al: 0, hal: 3.2, s: 7, b: 0.33, zn: 1.4, cu: 1.0, fe: 33, mn: 6, argila: 44 }, { ph: 5.3, mo: 1.1, p: 4, k: 52, ca: 1.3, mg: 0.45, al: 0.1, hal: 3.6, argila: 47 }],
  };
  const solo = [];
  for (const reg of regs) {
    const s = SOLO[reg.id] || SOLO.R3;
    solo.push({ id: `demo-solo-${reg.id}-${y0}`, reg: reg.id, data: `${y0}-07-28`, laboratorio: 'Laboratório de solos (exemplo)', protocolo: `${y0}/${1200 + regs.indexOf(reg)}`, a020: s[0], a2040: s[1], scEsperada: { R1: 45, R2: 38, R3: 36 }[reg.id] || 0 });
    const s0 = s[0];
    solo.push({ id: `demo-solo-${reg.id}-${y0 - 1}`, reg: reg.id, data: `${y0 - 1}-07-25`, laboratorio: 'Laboratório de solos (exemplo)', protocolo: `${y0 - 1}/${900 + regs.indexOf(reg)}`,
      a020: { ...s0, ph: +(s0.ph - 0.2).toFixed(1), k: Math.round(s0.k * 0.9), ca: +(s0.ca * 0.85).toFixed(2), b: +(s0.b * 0.9).toFixed(2) }, a2040: s[1], scEsperada: 0 });
  }

  // ---------- Estimativas de safra (contagens) ----------
  const contagens = [];
  const alvo = { R1: [27, 84], R2: [23, 80], R3: [21, 62] };
  const cont1 = addDays(hoje, -12);
  for (const reg of regs) {
    if (est(reg) !== 'P') continue;
    const [fr, rm] = alvo[reg.id] || [20, 60];
    const valores = Array.from({ length: 25 }, () => Math.max(2, Math.round(fr + (R() - 0.5) * fr * 0.7)));
    const ramos = Array.from({ length: 25 }, () => Math.max(10, Math.round(rm + (R() - 0.5) * 24)));
    contagens.push({ id: `demo-ct-${reg.id}-1`, reg: reg.id, safra: S, data: cont1, fase: 'Chumbinho', metodo: 'frutos', valores, ramos, fpl: PARAM_PADRAO.frutosPorLitro, rend: PARAM_PADRAO.rendimento, responsavel: pick(OPER) });
  }
  // Contagens da safra anterior (para comparar previsão x realizado)
  const realAnt = { R1: 42, R2: 51, R3: 17 };
  for (const reg of regs) {
    if (!realAnt[reg.id]) continue;
    const k = (reg.plantasHa * 0.97) / PARAM_PADRAO.rendimento;
    [[`${S - 2}-12-10`, 'Chumbinho', 1.12], [`${S - 1}-02-14`, 'Granação', 1.05], [`${S - 1}-04-08`, 'Pré-colheita', 0.98]].forEach(([d, fase, f], i) => {
      const lpl = (realAnt[reg.id] * f) / k;
      contagens.push({ id: `demo-ct-${reg.id}-ant${i}`, reg: reg.id, safra: S - 1, data: d, fase, metodo: 'litros', valores: Array.from({ length: 20 }, () => Math.max(0.2, +(lpl * (0.75 + R() * 0.5)).toFixed(2))), fpl: PARAM_PADRAO.frutosPorLitro, rend: PARAM_PADRAO.rendimento, responsavel: pick(OPER) });
    });
  }

  // ---------- Colheita da safra anterior (cargas por faixa de ruas) ----------
  const colheita = [];
  const lotes = [];
  let nc = 0;
  for (const reg of regs) {
    const sc = realAnt[reg.id];
    if (!sc) continue;
    const vig = (r) => 0.82 + 0.3 * (0.5 + 0.5 * Math.sin(r.idx / 9 + hash(reg.id) % 7)) * (0.85 + 0.3 * rng(hash(r.id))());
    const passadas = [['1ª', 0.8, `${S - 1}-05-${pad(10 + regs.indexOf(reg) * 6)}`], ['2ª', 0.2, `${S - 1}-07-${pad(1 + regs.indexOf(reg) * 5)}`]];
    for (const [pas, frac, d0] of passadas) {
      const lote = `L${String(S - 1).slice(2)}-${reg.id}-${pas === '1ª' ? 'P1' : 'P2'}`;
      let litLote = 0;
      for (let i = 0; i < reg.rows.length; i += 3) {
        const rs = reg.rows.slice(i, i + 3);
        const lit = rs.reduce((s, r) => s + sc * r.areaHa * PARAM_PADRAO.rendimento * frac * vig(r), 0);
        const dia = addDays(d0, Math.floor((i / reg.rows.length) * (pas === '1ª' ? 18 : 10)));
        const verde = pas === '1ª' ? 12 + R() * 8 : 4 + R() * 4;
        const passa = pas === '1ª' ? 15 + R() * 8 : 25 + R() * 10;
        const seco = pas === '1ª' ? 8 + R() * 6 : 25 + R() * 10;
        colheita.push({
          id: `demo-cg-${++nc}`, safra: S - 1, data: dia, reg: reg.id, ruas: compressRanges(rs.map((r) => r.idx)), litros: Math.round(lit), passada: pas,
          maquina: regs.indexOf(reg) % 2 ? 'COL-02' : 'COL-01', operador: pick(OPER), lote,
          maturacao: { verde: Math.round(verde), cereja: Math.round(100 - verde - passa - seco), passa: Math.round(passa), seco: Math.round(seco) },
        });
        litLote += lit;
      }
      const scs = litLote / PARAM_PADRAO.rendimento;
      lotes.push({ id: `demo-lt-${lote}`, codigo: lote, safra: S - 1, reg: reg.id, origem: `${reg.nome}, ${pas} passada`, litros: Math.round(litLote), processo: pas === '1ª' ? 'Cereja descascado (CD)' : 'Natural', secagem: pas === '1ª' ? 'Terreiro + secador' : 'Secador', umidade: 11.5, sacas: Math.round(scs), classificacao: pas === '1ª' ? 'Bebida dura · peneira 16↑ 58%' : 'Bebida dura/riada · peneira 16↑ 44%', armazem: `Tulha ${regs.indexOf(reg) + 1}`, pontuacao: pas === '1ª' ? 82 : 78 });
    }
    lotes.push({ id: `demo-lt-V-${reg.id}`, codigo: `V${String(S - 1).slice(2)}-${reg.id}`, safra: S - 1, reg: reg.id, origem: `${reg.nome}, varrição`, litros: Math.round(reg.areaHa * 180), processo: 'Natural (varrição)', secagem: 'Terreiro', umidade: 12, sacas: Math.round((reg.areaHa * 180) / 640), classificacao: 'Rio / riado', armazem: 'Tulha 9', pontuacao: 0 });
  }

  // ---------- Manutenção ----------
  const pos = (rowId, m) => {
    const r = farm.rowById.get(rowId);
    if (!r) return {};
    const t = Math.min(1, m / r.len);
    return { rua: rowId, metro: m, x: r.x1 + (r.x2 - r.x1) * t, y: r.y1 + (r.y2 - r.y1) * t };
  };
  const manut = [
    { id: 'demo-mt-1', titulo: 'Vazamento na lateral', tipo: 'Vazamento', prioridade: 'Alta', status: 'aberta', abertoEm: addDays(hoje, -2), ...pos('R2-L047', 132), descricao: 'Poça d’água na linha, lateral B. Provável furo por roedor.', responsavel: 'Equipe de irrigação' },
    { id: 'demo-mt-2', titulo: 'Relé sem comunicação', tipo: 'Elétrica / comunicação', prioridade: 'Média', status: 'aberta', abertoEm: addDays(hoje, -3), ativo: 'RL-R3-S2', descricao: 'Controlador sem retorno do módulo há 3 dias. Verificar bateria e antena.', responsavel: 'Eletricista' },
    { id: 'demo-mt-3', titulo: 'Rolamento ruidoso', tipo: 'Mecânica', prioridade: 'Média', status: 'andamento', abertoEm: addDays(hoje, -6), ativo: 'B-03', descricao: 'Ruído e aquecimento no mancal do lado acoplado.', responsavel: 'Mecânico terceirizado' },
    { id: 'demo-mt-4', titulo: 'Cruzeta vazando', tipo: 'Vazamento', prioridade: 'Alta', status: 'concluida', abertoEm: addDays(hoje, -38), fechadoEm: addDays(hoje, -37), ativo: 'CZ-R1-L088', descricao: 'Anel de vedação ressecado. Trocado o inicial de linha.', responsavel: 'Equipe de irrigação', custo: 85 },
    { id: 'demo-mt-5', titulo: 'Elemento filtrante danificado', tipo: 'Filtragem', prioridade: 'Média', status: 'concluida', abertoEm: addDays(hoje, -52), fechadoEm: addDays(hoje, -50), ativo: 'FL-01', descricao: 'Discos do filtro 4 com desgaste. Substituídos.', responsavel: 'Equipe de irrigação', custo: 1240 },
    { id: 'demo-mt-6', titulo: 'Gotejadores entupidos', tipo: 'Entupimento', prioridade: 'Baixa', status: 'aberta', abertoEm: addDays(hoje, -1), ...pos('R1-L120', 210), descricao: 'Bulbo seco entre 200 e 260 m. Programar tratamento com ácido no setor.', responsavel: 'Equipe de irrigação' },
    { id: 'demo-mt-7', titulo: 'Válvula com pressão baixa', tipo: 'Hidráulica', prioridade: 'Média', status: 'aberta', abertoEm: addDays(hoje, -5), ativo: 'VS-R2-S1', descricao: 'Pressão a jusante 11 mca (esperado 15). Piloto redutor descalibrado. CUD do setor caiu.', responsavel: 'Equipe de irrigação' },
  ];
  const ativos = [
    { id: 'RL-R3-S2', status: 'falha', obs: 'Sem comunicação' },
    { id: 'B-03', status: 'manutencao', obs: 'Troca de rolamentos' },
    { id: 'VS-R2-S1', status: 'alerta', obs: 'Pressão abaixo do esperado' },
  ];

  return { os, solo, contagens, colheita, lotes, manut, ativos, equip: EQUIP_DEMO };
}

// Estado pé a pé de uma rua de exemplo (falhas, replantas, doentes)
export function demoPlantas(row, reg, hoje) {
  const R = rng(hash('pl' + row.id));
  const novo = reg.plantio >= +hoje.slice(0, 4) - 1;
  const taxa = novo ? 0.035 : 0.018;
  const falhas = [], replantadas = [], doentes = [];
  for (let j = 0; j < row.nPl; j++) {
    const v = R();
    if (v < taxa) falhas.push(j);
    else if (v < taxa + (novo ? 0.02 : 0.006)) replantadas.push(j);
    else if (v < taxa + (novo ? 0.02 : 0.006) + 0.004) doentes.push(j);
  }
  return { id: row.id, falhas, replantadas, doentes, baixa: [], morta: [], notas: {} };
}
