// Relatórios para o produtor. Cada relatório gera blocos (indicadores, tabelas, texto)
// que viram tela, CSV e HTML para arquivo/impressão.
import { TAREFA, PRAGAS, FASE, INSUMOS } from './catalog.js';
import { num, brl, pct, fmtDate, sum, groupBy, esc, geo, addDays, anoSafra, mean } from './util.js';
import { interpretar, estagio, estimar } from './agro.js';

const inPeriodo = (d, f) => (!f.ini || d >= f.ini) && (!f.fim || d <= f.fim);
const regOk = (os, f) => !f.reg || (os.ruas && os.ruas[f.reg]) || os.reg === f.reg;

export const RELATORIOS = [
  {
    id: 'resumo', nome: 'Resumo da fazenda', grupo: 'Gestão', filtros: ['safra'],
    desc: 'Área, estande, operações, custos, previsão e colheita em uma página.',
    gerar(m, f) {
      const farm = m.farm, p = m.params();
      const S = +f.safra || m.safra;
      const rows = farm.regions.map((r) => {
        const est = m.estande(r);
        const prev = m.previsao(r, S);
        const col = m.colheitaRegiao(r, S - 1);
        return { Região: r.nome, 'Área (ha)': num(r.areaHa, 2), Ruas: r.nRows, Plantas: num(r.plantas), 'Falhas (%)': num(est.pctFalhas, 1), Cultivar: r.variedade, Plantio: r.plantio, Estágio: estagio(r, S) === 'P' ? 'Produção' : 'Formação', [`Colheita ${S - 1} (sc/ha)`]: col.sacas ? num(col.schaTotal, 1) : '—', [`Previsão ${S} (sc/ha)`]: prev ? num(prev.scha, 1) : '—' };
      });
      const osS = m.osList().filter((o) => anoSafra(o.data) === S);
      const custo = sum(osS, (o) => m.custo(o).total);
      const prevTot = sum(farm.regions, (r) => m.previsao(r, S)?.total || 0);
      return {
        kpis: [
          ['Área de café', num(farm.totais.areaHa, 1) + ' ha'], ['Ruas', num(farm.totais.ruas)], ['Plantas', num(farm.totais.plantas)],
          ['Operações no ciclo', num(osS.length)], ['Custo lançado no ciclo', brl(custo)], ['Custo por hectare', brl(custo / farm.totais.areaHa)],
          [`Previsão ${S}`, num(prevTot, 0) + ' sc'], ['Receita estimada', brl(prevTot * p.precoSaca)],
        ],
        blocos: [{ h: 'Regiões', rows }],
        csv: rows,
      };
    },
  },
  {
    id: 'os', nome: 'Ordens de serviço', grupo: 'Operações', filtros: ['periodo', 'regiao', 'tarefa', 'status'],
    desc: 'Todas as operações do período, com área, horas e custo.',
    gerar(m, f) {
      const l = m.osList().filter((o) => inPeriodo(o.data, f) && regOk(o, f) && (!f.tarefa || o.tarefa === f.tarefa) && (!f.status || o.status === f.status));
      const rows = l.map((o) => {
        const c = m.custo(o);
        return { Data: fmtDate(o.data), Código: o.tarefa, Operação: TAREFA[o.tarefa]?.nome || o.tarefa, Regiões: Object.keys(o.ruas || {}).join(' ') || o.ativo || '', 'Área (ha)': num(m.areaOS(o), 2), Status: o.status, Equipamento: o.equip || '', Operador: o.operador || '', Horas: num(o.horas || 0, 1), 'Insumos (R$)': num(c.insumos, 2), 'Máquina (R$)': num(c.maquina, 2), 'Mão de obra (R$)': num(c.mao, 2), 'Total (R$)': num(c.total, 2) };
      });
      const porTipo = [...groupBy(l, (o) => o.tarefa)].map(([k, v]) => ({ Operação: TAREFA[k]?.nome || k, Quantidade: v.length, 'Área (ha)': num(sum(v, (o) => m.areaOS(o)), 1), 'Custo (R$)': num(sum(v, (o) => m.custo(o).total), 2) })).sort((a, b) => b.Quantidade - a.Quantidade);
      return { kpis: [['Ordens', l.length], ['Concluídas', l.filter((o) => o.status === 'concluida').length], ['Em execução', l.filter((o) => o.status === 'execucao').length], ['Custo total', brl(sum(l, (o) => m.custo(o).total))]], blocos: [{ h: 'Por operação', rows: porTipo }, { h: 'Lista detalhada', rows }], csv: rows };
    },
  },
  {
    id: 'caderno', nome: 'Caderno de campo (aplicações)', grupo: 'Rastreabilidade', filtros: ['periodo', 'regiao'],
    desc: 'Defensivos e fertilizantes aplicados: produto, dose, área, receituário, carência, condições climáticas e EPI. Base para certificações e auditorias.',
    gerar(m, f) {
      const ins = Object.fromEntries(m.insumos().map((i) => [i.id, i]));
      const rows = [];
      for (const o of m.osList()) {
        if (!inPeriodo(o.data, f) || !regOk(o, f) || !(o.insumos || []).length || o.status === 'cancelada' || o.status === 'planejada') continue;
        const area = m.areaOS(o);
        for (const it of o.insumos) {
          const i = ins[it.id] || { nome: it.id, un: '', cat: '' };
          const total = it.porHa === false ? +it.dose : +it.dose * area;
          rows.push({ Data: fmtDate(o.data), Regiões: Object.keys(o.ruas || {}).join(' '), Ruas: Object.entries(o.ruas || {}).map(([k, v]) => `${k}: ${v}`).join(' | '), Operação: TAREFA[o.tarefa]?.nome || o.tarefa, Categoria: i.cat, Produto: i.nome, Dose: `${num(it.dose, 3)} ${i.un}${it.porHa === false ? '' : '/ha'}`, 'Área (ha)': num(area, 2), 'Quantidade total': `${num(total, 2)} ${i.un}`, Receituário: o.campos?.receita || '', 'Carência (dias)': o.campos?.carencia ?? '', 'Vento (km/h)': o.campos?.vento ?? '', 'Temp. (°C)': o.campos?.temp ?? '', 'UR (%)': o.campos?.ur ?? '', EPI: o.campos?.epi ? 'Sim' : '', Operador: o.operador || '', Equipamento: o.equip || '' });
        }
      }
      const semReceita = rows.filter((r) => ['Fungicida', 'Inseticida', 'Herbicida'].includes(r.Categoria) && !r.Receituário).length;
      return { kpis: [['Lançamentos', rows.length], ['Agrotóxicos sem nº de receituário', semReceita]], blocos: [{ h: 'Aplicações', rows }], csv: rows, nota: semReceita ? 'Há aplicações de agrotóxicos sem número de receituário agronômico. A receita é exigida por lei na compra e deve constar no registro.' : '' };
    },
  },
  {
    id: 'solo', nome: 'Fertilidade e recomendação', grupo: 'Nutrição', filtros: [],
    desc: 'Última análise de solo por região, interpretação e recomendação de calcário, gesso e NPK.',
    gerar(m) {
      const rows = [];
      const recs = [];
      for (const r of m.farm.regions) {
        const rc = m.recomendacao(r);
        if (!rc) continue;
        const { cls, d } = interpretar(rc.solo.a020);
        rows.push({ Região: r.nome, Data: fmtDate(rc.solo.data), 'pH': rc.solo.a020.ph, 'MO': rc.solo.a020.mo, 'P': rc.solo.a020.p, 'K': rc.solo.a020.k, 'Ca': rc.solo.a020.ca, 'Mg': rc.solo.a020.mg, 'Al': rc.solo.a020.al, 'H+Al': rc.solo.a020.hal, 'T': num(d.T, 2), 'V%': num(d.V, 0), 'm%': num(d.m, 0), 'B': rc.solo.a020.b ?? '', 'Zn': rc.solo.a020.zn ?? '', 'Classe V': cls.V?.nome || '', 'Classe K': cls.k?.nome || '' });
        recs.push({ Região: r.nome, 'Produtividade usada (sc/ha)': num(rc.sc, 0), 'Calcário (t/ha)': num(rc.rec.calagem, 2), 'Tipo de calcário': rc.rec.calcario, 'Gesso (kg/ha)': rc.rec.gessagem == null ? '—' : num(rc.rec.gessagem, 0), 'N (kg/ha/ano)': rc.rec.N ?? '—', 'P₂O₅ (kg/ha/ano)': rc.rec.P2O5 ?? '—', 'K₂O (kg/ha/ano)': rc.rec.K2O ?? '—', Alertas: rc.rec.alertas.join(' ') });
      }
      return { blocos: [{ h: 'Análise 0–20 cm', rows }, { h: 'Recomendação', rows: recs }], csv: recs, nota: 'Recomendação calculada pelas tabelas configuradas (base: 5ª Aproximação, CFSEMG 1999). É um ponto de partida: valide com o engenheiro agrônomo responsável.' };
    },
  },
  {
    id: 'fito', nome: 'Fitossanidade', grupo: 'Proteção', filtros: ['periodo', 'regiao'],
    desc: 'Monitoramentos de pragas e doenças, comparados ao nível de controle.',
    gerar(m, f) {
      const rows = [];
      for (const o of m.osList().filter((o) => o.tarefa === 'MN01' && inPeriodo(o.data, f) && regOk(o, f))) {
        for (const reg of Object.keys(o.ruas || {})) {
          const r = { Data: fmtDate(o.data), Região: reg };
          for (const p of PRAGAS) { const v = o.campos?.[p.k]; r[`${p.nome} (${p.un})`] = v ?? ''; r[`${p.nome}: acima do NC?`] = v != null && +v >= p.nc ? 'SIM' : ''; }
          rows.push(r);
        }
      }
      const alert = rows.filter((r) => Object.values(r).includes('SIM')).length;
      return { kpis: [['Monitoramentos', rows.length], ['Com praga/doença acima do nível', alert]], blocos: [{ h: 'Níveis de controle usados', rows: PRAGAS.map((p) => ({ Alvo: p.nome, Unidade: p.un, 'Nível de controle': p.nc, Critério: p.desc })) }, { h: 'Leituras', rows }], csv: rows };
    },
  },
  {
    id: 'irrig', nome: 'Irrigação e energia', grupo: 'Irrigação', filtros: ['periodo'],
    desc: 'Turnos de rega, lâmina, volume bombeado, energia e uniformidade por setor.',
    gerar(m, f) {
      const l = m.osList().filter((o) => o.tarefa === 'IR01' && inPeriodo(o.data, f));
      const rows = l.map((o) => ({ Data: fmtDate(o.data), Setores: o.campos?.setor || '', 'Horas': o.campos?.horas ?? '', 'Lâmina (mm)': o.campos?.lamina ?? '', 'Volume (m³)': o.campos?.volume ?? '', 'Energia (kWh)': o.campos?.kwh ?? '', Bombas: o.campos?.bomba || '' }));
      const vol = sum(l, (o) => o.campos?.volume), kwh = sum(l, (o) => o.campos?.kwh), lam = sum(l, (o) => o.campos?.lamina);
      const setores = m.farm.regions.flatMap((r) => r.setores.map((s) => { const c = m.cudSetor(s.id); return { Setor: s.id, 'Área (ha)': num(s.areaHa, 2), 'Gotejadores': num(s.nGot), 'Vazão (m³/h)': num(s.vazao, 1), 'Taxa (mm/h)': num(r.gotVazao / (r.espLinha * r.gotEsp), 2), 'CUD (%)': c ? num(c.val, 1) : '—', Classe: c?.cls || '—', 'Teste em': c ? fmtDate(c.data) : '—' }; }));
      return { kpis: [['Turnos registrados', l.length], ['Lâmina acumulada', num(lam, 1) + ' mm'], ['Volume bombeado', num(vol) + ' m³'], ['Energia', num(kwh) + ' kWh'], ['kWh por m³', vol ? num(kwh / vol, 3) : '—']], blocos: [{ h: 'Setores e uniformidade', rows: setores }, { h: 'Turnos de rega', rows }], csv: rows };
    },
  },
  {
    id: 'manut', nome: 'Manutenção', grupo: 'Irrigação', filtros: ['periodo'],
    desc: 'Ocorrências abertas e concluídas, com localização exata (rua, metro e coordenada) e tempo de reparo.',
    gerar(m, f) {
      const l = m.store.all('manut').filter((x) => inPeriodo(x.abertoEm, f));
      const rows = l.map((x) => {
        const a = x.ativo ? m.farm.assetById.get(x.ativo) : null;
        const X = a ? a.x : x.x, Y = a ? a.y : x.y;
        return { Aberta: fmtDate(x.abertoEm), Título: x.titulo, Tipo: x.tipo, Prioridade: x.prioridade, Status: x.status, Ativo: x.ativo || '', Rua: x.rua || a?.rua || '', Metro: x.metro != null ? num(x.metro, 1) : '', Coordenada: X != null ? geo.fmt(X, Y) : '', 'Concluída': x.fechadoEm ? fmtDate(x.fechadoEm) : '', 'Dias para reparo': x.fechadoEm ? Math.max(0, Math.round((new Date(x.fechadoEm) - new Date(x.abertoEm)) / 864e5)) : '', 'Custo (R$)': x.custo ? num(x.custo, 2) : '', Responsável: x.responsavel || '' };
      });
      const fech = l.filter((x) => x.fechadoEm);
      const mttr = fech.length ? mean(fech.map((x) => (new Date(x.fechadoEm) - new Date(x.abertoEm)) / 864e5)) : null;
      return { kpis: [['Abertas', l.filter((x) => x.status !== 'concluida').length], ['Concluídas', fech.length], ['Tempo médio de reparo', mttr == null ? '—' : num(mttr, 1) + ' dias'], ['Custo', brl(sum(l, (x) => x.custo))]], blocos: [{ h: 'Ocorrências', rows }], csv: rows };
    },
  },
  {
    id: 'invent', nome: 'Inventário da infraestrutura', grupo: 'Irrigação', filtros: ['regiao'],
    desc: 'Levantamento completo: bombas, válvulas, relés, cruzetas, finais de linha, tubulações e gotejadores, com coordenadas.',
    gerar(m, f) {
      const farm = m.farm;
      const as = farm.assets.filter((a) => !f.reg || a.reg === f.reg);
      const porTipo = [...groupBy(as, (a) => a.sub || a.tipo)].map(([k, v]) => ({ Tipo: k, Quantidade: v.length }));
      const tubos = [...groupBy(farm.pipes.filter((p) => !f.reg || p.reg === f.reg), (p) => p.tipo)].map(([k, v]) => ({ Tubulação: k, Material: v[0].material, Diâmetro: v[0].dn, 'Comprimento (m)': num(sum(v, (p) => p.len), 0) }));
      const regs = farm.regions.filter((r) => !f.reg || r.id === f.reg);
      const lat = sum(regs, (r) => r.compRuas);
      tubos.push({ Tubulação: 'Tubo gotejador (laterais)', Material: 'PEBD 16 mm', Diâmetro: '16 mm', 'Comprimento (m)': num(lat, 0) });
      const lista = as.map((a) => { const st = m.assetStatus(a.id); return { ID: a.id, Tipo: a.sub || a.tipo, Nome: a.nome, Região: a.reg || '', Setor: a.setor || '', Rua: a.rua || '', Status: st, Latitude: geo.toLatLon(a.x, a.y)[0].toFixed(6), Longitude: geo.toLatLon(a.x, a.y)[1].toFixed(6) }; });
      return {
        kpis: [['Ativos cadastrados', as.length], ['Cruzetas e tês', as.filter((a) => a.tipo === 'cruzeta').length], ['Gotejadores', num(sum(regs, (r) => r.gotejadores))], ['Tubo gotejador', num(lat / 1000, 1) + ' km']],
        blocos: [{ h: 'Quantidades por tipo', rows: porTipo }, { h: 'Tubulações', rows: tubos }, { h: 'Lista de ativos com coordenadas', rows: lista }], csv: lista,
      };
    },
  },
  {
    id: 'estande', nome: 'Estande e falhas', grupo: 'Lavoura', filtros: ['regiao'],
    desc: 'Plantas por região e por rua, falhas, replantas e plantas doentes, pé a pé.',
    gerar(m, f) {
      const regs = m.farm.regions.filter((r) => !f.reg || r.id === f.reg);
      const res = regs.map((r) => { const e = m.estande(r); return { Região: r.nome, Espaçamento: `${r.espLinha} × ${r.espPlanta} m`, 'Plantas/ha (projeto)': num(r.plantasHa, 0), Covas: num(r.plantas), Falhas: num(e.falhas + e.mortas), 'Falhas (%)': num(e.pctFalhas, 2), Replantadas: num(e.repl), Doentes: num(e.doentes), 'Plantas vivas': num(e.vivas) }; });
      const ruas = [];
      for (const r of regs) for (const row of r.rows) { const p = m.plantas(row); const fa = (p.falhas?.length || 0) + (p.morta?.length || 0); if (fa) ruas.push({ Rua: row.id, Covas: row.nPl, Falhas: fa, 'Falhas (%)': num((fa / row.nPl) * 100, 2), 'Posições (nº da planta)': (p.falhas || []).slice(0, 40).map((j) => j + 1).join(', ') + ((p.falhas || []).length > 40 ? '…' : '') }); }
      ruas.sort((a, b) => b.Falhas - a.Falhas);
      return { blocos: [{ h: 'Por região', rows: res }, { h: 'Ruas com falhas (ordenadas)', rows: ruas }], csv: ruas };
    },
  },
  {
    id: 'colheita', nome: 'Colheita por rua e região', grupo: 'Colheita', filtros: ['safraColhida', 'regiao'],
    desc: 'Litros, sacas e produtividade por rua; melhores e piores ruas; maturação das cargas.',
    gerar(m, f) {
      const S = +f.safraColhida || m.safrasColhidas()[0];
      const p = m.params();
      const regs = m.farm.regions.filter((r) => !f.reg || r.id === f.reg);
      const res = regs.map((r) => { const c = m.colheitaRegiao(r, S); return { Região: r.nome, 'Litros': num(c.litros), Sacas: num(c.sacas, 1), 'sc/ha': num(c.schaTotal, 1), 'Ruas colhidas': `${c.ruasColhidas}/${r.nRows}`, 'Receita estimada': brl(c.sacas * p.precoSaca) }; });
      const { litros } = m.litrosPorRua(S);
      const ruas = [];
      for (const r of regs) for (const row of r.rows) { const L = litros.get(row.id); if (L) ruas.push({ Rua: row.id, 'Comprimento (m)': num(row.len, 0), Litros: Math.round(L), Sacas: +(L / p.rendimento).toFixed(2), 'sc/ha': +((L / p.rendimento) / row.areaHa).toFixed(1) }); }
      ruas.sort((a, b) => b['sc/ha'] - a['sc/ha']);
      const cg = m.cargas(S).filter((c) => !f.reg || c.reg === f.reg);
      const cargas = cg.map((c) => ({ Data: fmtDate(c.data), Região: c.reg, Ruas: c.ruas, Passada: c.passada, Litros: num(c.litros), Máquina: c.maquina || '', Lote: c.lote || '', 'Verde %': c.maturacao?.verde ?? '', 'Cereja %': c.maturacao?.cereja ?? '', 'Passa %': c.maturacao?.passa ?? '', 'Seco %': c.maturacao?.seco ?? '' }));
      return { kpis: [['Safra', S], ['Sacas', num(sum(regs, (r) => m.colheitaRegiao(r, S).sacas), 0)], ['Cargas', cg.length], ['Rendimento usado', `${p.rendimento} L/saca`]], blocos: [{ h: 'Por região', rows: res }, { h: '10 melhores ruas', rows: ruas.slice(0, 10) }, { h: '10 piores ruas', rows: ruas.slice(-10).reverse() }, { h: 'Cargas', rows: cargas }], csv: ruas };
    },
  },
  {
    id: 'previsao', nome: 'Estimativa de safra × realizado', grupo: 'Colheita', filtros: [],
    desc: 'Evolução das contagens, intervalo de confiança e comparação com a colheita realizada.',
    gerar(m) {
      const rows = [];
      for (const c of m.store.all('contagens').sort((a, b) => (a.data < b.data ? -1 : 1))) {
        const reg = m.farm.regionById.get(c.reg);
        if (!reg) continue;
        const e = estimarSafe(m, c, reg);
        const real = m.colheitaRegiao(reg, c.safra);
        rows.push({ Safra: c.safra, Data: fmtDate(c.data), Fase: c.fase || '', Região: reg.nome, Método: c.metodo === 'litros' ? 'Derriça amostral' : 'Contagem de frutos', Plantas: e?.n ?? '', 'L/planta': e ? num(e.lPlanta, 2) : '', 'CV (%)': e ? num(e.cv, 0) : '', 'Previsão (sc/ha)': e ? num(e.scha, 1) : '', 'IC 95% (sc/ha)': e ? `${num(e.ciLo, 1)} – ${num(e.ciHi, 1)}` : '', 'Previsão total (sc)': e ? num(e.total, 0) : '', 'Realizado (sc/ha)': real.sacas ? num(real.schaTotal, 1) : '—', 'Erro (%)': real.sacas && e ? num(((e.scha - real.schaTotal) / real.schaTotal) * 100, 1) : '—' });
      }
      return { blocos: [{ h: 'Contagens', rows }], csv: rows, nota: 'Calibre frutos por litro e litros por saca com os números da própria fazenda: são os fatores que mais pesam no erro da previsão.' };
    },
  },
  {
    id: 'equip', nome: 'Equipamentos e operadores', grupo: 'Operações', filtros: ['periodo'],
    desc: 'Horas, área trabalhada, custo e consumo estimado por máquina e por operador.',
    gerar(m, f) {
      const l = m.osList().filter((o) => inPeriodo(o.data, f) && o.status !== 'cancelada' && o.status !== 'planejada');
      const eq = m.equipMap();
      const porEq = [...groupBy(l.filter((o) => o.equip), (o) => o.equip)].map(([k, v]) => { const e = eq[k] || {}; const h = sum(v, (o) => o.horas); const a = sum(v, (o) => m.areaOS(o)); return { Equipamento: `${k} · ${e.nome || ''}`, Operações: v.length, Horas: num(h, 1), 'Área (ha)': num(a, 1), 'ha/h': h ? num(a / h, 2) : '—', 'Diesel est. (L)': num(h * (+e.consumo || 0), 0), 'Custo (R$)': num(h * (+e.custoHora || 0), 2) }; });
      const porOp = [...groupBy(l, (o) => o.operador || '—')].map(([k, v]) => ({ Operador: k, Operações: v.length, Horas: num(sum(v, (o) => o.horas), 1), 'Área (ha)': num(sum(v, (o) => m.areaOS(o)), 1) }));
      return { blocos: [{ h: 'Por equipamento', rows: porEq }, { h: 'Por operador', rows: porOp }], csv: porEq };
    },
  },
  {
    id: 'custos', nome: 'Custo de produção', grupo: 'Gestão', filtros: ['safra', 'regiao'],
    desc: 'Custo por região, por hectare e por saca prevista, separado em insumos, máquinas e mão de obra.',
    gerar(m, f) {
      const S = +f.safra || m.safra;
      const l = m.osList().filter((o) => anoSafra(o.data) === S && o.status !== 'cancelada' && o.status !== 'planejada');
      const rows = [];
      const fases = {};
      for (const reg of m.farm.regions.filter((r) => !f.reg || r.id === f.reg)) {
        let ins = 0, maq = 0, mao = 0;
        for (const o of l) {
          if (!o.ruas?.[reg.id]) continue;
          const rs = m.rowsOf(o);
          const a = sum(rs.filter((r) => r.reg === reg.id), (r) => r.areaHa);
          const tot = m.areaOS(o) || 1;
          const c = m.custo(o);
          const k = a / tot;
          ins += c.insumos * k; maq += c.maquina * k; mao += c.mao * k;
          const fs = FASE[TAREFA[o.tarefa]?.fase]?.nome || 'Outras';
          fases[fs] = (fases[fs] || 0) + c.total * k;
        }
        const prev = m.previsao(reg, S);
        const tot = ins + maq + mao;
        rows.push({ Região: reg.nome, 'Insumos (R$)': num(ins, 2), 'Máquinas (R$)': num(maq, 2), 'Mão de obra (R$)': num(mao, 2), 'Total (R$)': num(tot, 2), 'R$/ha': num(tot / reg.areaHa, 2), 'Sacas previstas': prev ? num(prev.total, 0) : '—', 'R$/saca': prev && prev.total ? num(tot / prev.total, 2) : '—' });
      }
      const fr = Object.entries(fases).map(([k, v]) => ({ Fase: k, 'Custo (R$)': num(v, 2) }));
      return { blocos: [{ h: 'Por região', rows }, { h: 'Por fase do ciclo', rows: fr }], csv: rows, nota: 'Inclui apenas o que foi lançado nas ordens de serviço (insumos pelos preços de Configurações, máquinas pelo custo/hora, mão de obra pelas horas × pessoas). Não inclui depreciação, energia fixa, administração e arrendamento.' };
    },
  },
  {
    id: 'lotes', nome: 'Lotes de café', grupo: 'Rastreabilidade', filtros: ['safraColhida'],
    desc: 'Lotes com origem (região, passada, ruas), processamento, secagem, classificação e armazenamento.',
    gerar(m, f) {
      const S = +f.safraColhida || m.safrasColhidas()[0];
      const l = m.store.all('lotes').filter((x) => +x.safra === S);
      const rows = l.map((x) => ({ Lote: x.codigo, Origem: x.origem, Região: x.reg, Litros: num(x.litros), Processo: x.processo, Secagem: x.secagem, 'Umidade (%)': x.umidade, Sacas: x.sacas, Classificação: x.classificacao, Pontuação: x.pontuacao || '', Armazém: x.armazem }));
      return { kpis: [['Lotes', l.length], ['Sacas', num(sum(l, (x) => x.sacas))]], blocos: [{ h: 'Lotes', rows }], csv: rows };
    },
  },
  {
    id: 'pend', nome: 'Pendências do ciclo por rua', grupo: 'Operações', filtros: ['regiao'],
    desc: 'Operações do plano que estão atrasadas ou na janela agora, com as faixas de ruas afetadas.',
    gerar(m, f) {
      const rows = [];
      for (const reg of m.farm.regions.filter((r) => !f.reg || r.id === f.reg)) {
        for (const p of m.pendenciasRegiao(reg)) rows.push({ Região: reg.nome, Situação: p.st === 'atrasada' ? 'Atrasada' : 'Na janela', Operação: p.nome, Janela: `${fmtDate(p.ini)} a ${fmtDate(p.fim)}`, 'Ruas': compress(p.ruas), 'Nº de ruas': p.ruas.length });
      }
      return { kpis: [['Atrasadas', rows.filter((r) => r.Situação === 'Atrasada').length], ['Na janela', rows.filter((r) => r.Situação !== 'Atrasada').length]], blocos: [{ h: 'Pendências', rows }], csv: rows };
    },
  },
];

function compress(a) {
  const s = [...a].sort((x, y) => x - y), out = [];
  for (let i = 0; i < s.length; i++) { let j = i; while (j + 1 < s.length && s[j + 1] === s[j] + 1) j++; out.push(i === j ? s[i] : `${s[i]}-${s[j]}`); i = j; }
  return out.join(',');
}
function estimarSafe(m, c, reg) {
  try { return estimar(c, reg, m.estande(reg).pctFalhas, m.params()); } catch { return null; }
}

export function tabelaHTML(rows, max = 400) {
  if (!rows || !rows.length) return '<p class="muted">Sem dados para os filtros escolhidos.</p>';
  const cols = Object.keys(rows[0]);
  const fmt = (v) => (typeof v === 'number' ? num(v, Number.isInteger(v) ? 0 : Math.abs(v) < 10 ? 2 : 1) : v);
  const body = rows.slice(0, max).map((r) => `<tr>${cols.map((c) => `<td>${esc(fmt(r[c]))}</td>`).join('')}</tr>`).join('');
  return `<div class="tbl-wrap"><table class="tbl"><thead><tr>${cols.map((c) => `<th>${esc(c)}</th>`).join('')}</tr></thead><tbody>${body}</tbody></table></div>${rows.length > max ? `<p class="muted">Mostrando ${max} de ${rows.length} linhas. O CSV traz todas.</p>` : ''}`;
}

export function relatorioHTML(rel, res, meta) {
  const kp = (res.kpis || []).map(([k, v]) => `<div class="kpi"><span>${esc(k)}</span><b>${esc(v)}</b></div>`).join('');
  return `${kp ? `<div class="kpis">${kp}</div>` : ''}${res.nota ? `<p class="nota">${esc(res.nota)}</p>` : ''}${(res.blocos || []).map((b) => `<h3>${esc(b.h)}</h3>${tabelaHTML(b.rows)}`).join('')}`;
}

export function documentoHTML(rel, res, meta) {
  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>${esc(rel.nome)} · ${esc(meta.fazenda)}</title>
<style>body{font:13px/1.45 system-ui,Segoe UI,Roboto,sans-serif;color:#1d1b18;margin:24px}h1{font-size:20px;margin:0}h3{margin:22px 0 6px;font-size:14px}.meta{color:#6b655c;margin:4px 0 16px}.kpis{display:grid;grid-template-columns:repeat(auto-fill,minmax(160px,1fr));gap:8px}.kpi{border:1px solid #ddd5c8;border-radius:6px;padding:8px}.kpi span{display:block;color:#6b655c;font-size:11px}.kpi b{font-size:16px}table{border-collapse:collapse;width:100%;font-size:11px}th,td{border:1px solid #ddd5c8;padding:3px 6px;text-align:left}th{background:#f3eee6}.nota{background:#fbf3e4;border-left:3px solid #c07a2c;padding:8px}.muted{color:#6b655c}@media print{body{margin:10mm}}</style></head>
<body><h1>${esc(rel.nome)}</h1><div class="meta">${esc(meta.fazenda)} · ${esc(meta.filtros)} · gerado em ${esc(meta.quando)}</div>${relatorioHTML(rel, res, meta)}</body></html>`;
}
