const LOGO = 'logo.webp';
module.exports = {
async abertura(E) {
  await E.card(`<img class="logo" src="${LOGO}"><div class="sub" style="font-size:36px;margin-top:10px">A lavoura de café inteira, <b style="color:#fff">rua por rua, pé por pé.</b></div>`, 4.5);
  await E.card(`<div class="kick">O fundamento</div><h1>O que não se mede, não se corrige.</h1>
  <div class="grid">
   <div class="it"><b>1 · Medir</b><span>Análise de solo, monitoramento de pragas, contagem de frutos, estande e uniformidade da irrigação — <em>no lugar exato</em> onde foram feitos.</span></div>
   <div class="it"><b>2 · Planejar</b><span>Cada operação do ciclo na <em>janela agronômica certa</em>, com dose e técnica recomendadas para cada região.</span></div>
   <div class="it"><b>3 · Executar e conferir</b><span>Ordens de serviço por rua, máquinas com GPS e registro no celular. <em>O que foi feito fica provado</em>; o que faltou, aparece.</span></div>
  </div>`, 6.5, 3);
  await E.card(`<div class="kick">Um dia de trabalho</div><h1>Acompanhe o gerente da fazenda<br>do primeiro café ao fim da tarde</h1><div class="sub">Fazenda de demonstração: 167 ha, 5 regiões, 809 ruas e cerca de 700 mil covas.</div>`, 3.5);
  await E.cardOff();
},
async inicio(E) {
  await E.go('inicio'); await E.live(4);
  await E.caption('06:30 · Visão geral', 'Bom dia: a fazenda inteira em uma tela', 'Área, regiões ativas, operações do dia e produção estimada, sempre atualizados com o que a equipe lança no campo.', 'r');
  await E.ui(() => { let e = [...document.querySelectorAll('#view *')].find((x) => x.children.length === 0 && x.textContent.trim() === 'Área total'); while (e && !e.textContent.includes('Produção estimada')) e = e.parentElement; if (e) e.setAttribute('data-tour', 'kp'); });
  await E.spotOn('[data-tour="kp"]', 8); await E.hold(4.5);
  await E.caption('06:32 · Visão geral', 'Operações em andamento', 'O avanço de cada ordem de serviço é calculado pelas ruas já concluídas, não por estimativa de quem está no escritório.', 'r');
  await E.spotT('Operações em andamento'); await E.hold(4.5);
  await E.caption('06:34 · Visão geral', 'Clima da lavoura antes de decidir o dia', 'Umidade, vento e chuva da estação da fazenda: é com isso que se decide se a pulverização sai hoje ou fica para amanhã.', 'r');
  await E.spotT('Condições da lavoura'); await E.hold(4.5);
  await E.spotOff();
  await E.spotOff(); await E.hold(0.5);
},
async mapa(E) {
  await E.go('mapa'); await E.live(6);
  await E.caption('06:45 · Mapa 3D', 'A lavoura em 3D, rua por rua', 'As 809 ruas e cada pé de café são gerados a partir do contorno real das regiões, com o espaçamento e o alinhamento de plantio.');
  await E.live(E.sec(2.5));
  await E.click('[data-act="selRegiao"][data-r="R2"]'); await E.live(E.sec(1.3));
  await E.caption('06:46 · Mapa 3D', 'Selecione uma região', 'Área, comprimento de ruas, covas, gotejadores e tudo o que está pendente no plano dessa região aparecem na hora.');
  await E.spotOn('#drawer', 0); await E.hold(5); await E.spotOff();
  await E.caption('06:47 · Mapa 3D', 'Cores que mostram onde agir', 'Pintando por <b>plano do ciclo</b>: em dia, na janela ou atrasado. Também dá para pintar por pragas, falhas de estande, cultivar, idade ou dias sem operação.');
  await E.move(1550, 380, 0.6);
  await E.ui(() => { const u = window.__fazenda.ui; u.cor.manejo = 'plano'; u.colorir(); u.renderHud(); }); await E.ripple(); await E.live(E.sec(2.2));
  await E.ui(() => { const u = window.__fazenda.ui; u.cor.manejo = 'fito'; u.colorir(); u.renderHud(); }); await E.live(E.sec(2.2));
  await E.caption('06:48 · Mapa 3D', 'Cada rua tem a sua ficha', 'Histórico de operações, plantas, gotejadores e problemas registrados com o metro exato onde aconteceram.');
  await E.ui(() => { const u = window.__fazenda.ui; u.cor.manejo = 'natural'; u.colorir(); u.focarRua('R2-L047'); }); await E.live(E.sec(2.4));
  await E.hold(3);
  await E.caption('06:49 · Mapa 3D', 'E cada pé de café', 'Planta falhada, doente ou replantada é marcada no próprio pé. O estande e a previsão de colheita passam a usar esse dado.');
  await E.click('#drawer [data-act="planta"]'); await E.live(E.sec(2.2)); await E.hold(4);
},
async os(E) {
  await E.go('mapa'); await E.live(3);
  await E.ui(() => window.__fazenda.ui.handlers ? 0 : 0);
  await E.ui(() => { document.querySelector('[data-act="selRegiao"][data-r="R3"]').click(); }); await E.live(E.sec(1.2));
  await E.caption('07:10 · Ordem de serviço', 'Lançar o trabalho direto da seleção', 'As ruas selecionadas no mapa já entram na ordem de serviço. Nada de digitar talhão ou contar linhas.');
  await E.click('#drawer [data-act="novaOS"]'); await E.live(6);
  await E.ui(() => { const f = document.querySelector('#fOS'); const fs = f.querySelector('#osFase'); for (const o of fs.options) { fs.value = o.value; fs.dispatchEvent(new Event('change', { bubbles: true })); const t = [...f.querySelector('#osTarefa').options].find((x) => /fungicida/i.test(x.textContent)); if (t) { f.querySelector('#osTarefa').value = t.value; f.querySelector('#osTarefa').dispatchEvent(new Event('change', { bubbles: true })); break; } } const d = f.querySelector('#osTec'); if (d) d.open = true; });
  await E.live(4);
  await E.caption('07:11 · Ordem de serviço', 'Cada operação com a técnica certa', 'São 50 operações do ciclo, cada uma com recomendação técnica, campos próprios (produto, dose, volume de calda, bicos) e cálculo do custo de insumos.');
  await E.spotOn('#osTec', 6); await E.hold(5); await E.spotOff();
  await E.moveTo('[name="operador"]'); await E.ripple();
  for (const ch of 'Equipe do Zé Carlos') { await E.ui((c) => { const i = document.querySelector('[name="operador"]'); i.value += c; }, ch); await E.live(1); }
  await E.ui(() => { const s = document.querySelector('[name="equip"]'); if (s && s.options.length > 1) { s.value = [...s.options].find((o) => /pulveriz/i.test(o.textContent))?.value || s.options[1].value; s.dispatchEvent(new Event('change', { bubbles: true })); } });
  await E.live(3); await E.hold(1.5);
  await E.caption('07:12 · Ordem de serviço', 'Salvou: está no mapa, na agenda e no celular', 'A ordem entra no plano, aparece pintada no mapa e chega ao celular de quem vai executar.');
  await E.click('#fOS .m-f .btn.pri'); await E.live(10); await E.hold(2.5);
},
async agenda(E) {
  await E.go('agenda'); await E.live(3);
  await E.caption('07:30 · Operações', 'Agenda do dia e ordens de serviço', 'O que cada equipe faz hoje, em que ruas, com que máquina, e o que já foi concluído.', 'r');
  await E.hold(4);
  await E.caption('07:31 · Operações', 'Terminou? Um toque conclui', 'A ordem concluída atualiza o plano do ciclo, o mapa e os relatórios na mesma hora.', 'r');
  await E.click('[data-act="viewAct"][data-a="osSt"][data-id="demo-os-185"]'); await E.live(8); await E.hold(3);
  await E.click('[data-act="viewAct"][data-t="plano"]'); await E.live(6);
  await E.caption('07:31 · Operações', 'O plano do ciclo completo, por região', 'Da pós-colheita à colheita: cada operação na janela agronômica certa, com o que já foi feito, o que está na janela e o que atrasou.', 'r');
  await E.hold(4); await E.scroll('#view', 500, 1.5); await E.hold(2.5);
  await E.click('[data-act="viewAct"][data-t="pend"]'); await E.live(6);
  await E.caption('07:32 · Operações', 'Pendências: nada fica esquecido', 'Tudo o que falta em cada região, rua por rua. É aqui que se evita a calagem que ficou para depois ou a rua que a adubadora pulou.', 'r');
  await E.hold(5);
},
async maquinas(E) {
  await E.go('trabalho'); await E.live(4);
  await E.caption('08:00 · Equipamentos', 'Máquinas trabalhando agora', 'Cada trator com GPS mostra posição, velocidade, rua atual e área já feita. O percurso fica gravado como prova do serviço.', 'r');
  await E.hold(5);
  await E.click('#view .os-act [data-act="acompanhar"][data-id="AD-01"]'); await E.live(E.sec(2.5));
  await E.caption('08:02 · Acompanhar em 3D', 'Seguindo a adubadora no mapa', 'A câmera acompanha a máquina rua por rua. Dá para conferir se passou em todas as ruas e na velocidade certa, sem sair do escritório.');
  await E.live(E.sec(3.5));
  await E.click('[data-act="camModo"][data-m="lateral"]'); await E.live(E.sec(3));
  await E.caption('08:04 · Acompanhar em 3D', 'Vista de cima: a cobertura das ruas', 'De cima, o rastro do GPS mostra quais ruas já receberam o adubo e quais faltam. Funciona também no celular e numa TV do escritório.');
  await E.click('[data-act="camModo"][data-m="cima"]'); await E.live(E.sec(4.5));
},
async campo(E) {
  await E.p.evaluate(() => S.phone(true)); await E.go('inicio'); await E.live(6); await E.hold(0.5);
  await E.caption('09:00 · No celular', 'O mesmo sistema no bolso', 'Na lavoura o gerente abre o celular: clima, mapa 3D, tarefas e alertas, num aplicativo que se instala como app e funciona offline.');
  await E.hold(4);
  await E.go('campo'); await E.live(4);
  await E.caption('09:05 · Modo de Campo', 'Feito para usar no sol, com luva e sem sinal', 'Botões grandes para registrar operação, tirar foto, apontar praga ou doença e fazer o checklist de segurança.');
  await E.hold(4.5);
  await E.click('[data-act="checklist"]'); await E.live(6);
  await E.caption('09:06 · Modo de Campo', 'Checklist de EPI e segurança', 'Antes de pulverizar, a equipe confirma os equipamentos de proteção. Fica registrado com data, hora e responsável.');
  await E.hold(4.5);
  await E.ui(() => document.querySelector('[data-act="fecharModal"]')?.click()); await E.live(4);
  await E.click('[data-act="novaOS"][data-tarefa="MN01"]'); await E.live(6);
  await E.caption('09:08 · Modo de Campo', 'Ocorrência de praga ou doença', 'O monitoramento é lançado na hora, na rua onde foi visto, e já entra na comparação com o nível de controle.');
  await E.hold(4.5);
  await E.ui(() => document.querySelector('[data-act="fecharModal"]')?.click()); await E.live(4);
  await E.caption('09:10 · Modo de Campo', 'Sem sinal? Tudo fica guardado', 'Os registros ficam no aparelho e sobem sozinhos quando a internet volta. Nada se perde no meio da lavoura.');
  await E.spotOn('[data-act="sincronizar"]', 6); await E.hold(3); await E.spotOff();
  await E.go('alertas'); await E.live(4);
  await E.caption('09:15 · Previsão e Alertas', 'Previsão do tempo e alertas da lavoura', 'Previsão de 5 dias e, logo abaixo, os alertas: praga acima do nível de controle, vazamento na linha, válvula com pressão baixa.');
  await E.hold(5);
},
async solo(E) {
  await E.go('solo'); await E.live(3);
  await E.caption('10:00 · Solo e nutrição', 'Da análise de solo à dose, sem planilha', 'A análise é interpretada pela 5ª Aproximação (CFSEMG) e cada atributo recebe sua classe: baixo, médio, bom ou alto.', 'r');
  await E.spotT('Análise de'); await E.hold(5);
  await E.caption('10:02 · Solo e nutrição', 'Recomendação calculada para o ciclo', 'Calcário, gesso, nitrogênio, fósforo e potássio por hectare, conforme a análise, a idade da lavoura e a produtividade esperada.', 'r');
  await E.spotT('Recomendação para o ciclo'); await E.hold(5); await E.spotOff();
  await E.click('[data-act="novaOS"][data-tarefa="CR01"]'); await E.live(6);
  await E.caption('10:03 · Solo e nutrição', 'A recomendação vira ordem de serviço', 'A dose calculada já vem preenchida na ordem de calagem. Aplica-se o que o solo pede: nem a mais, nem a menos.', 'r');
  await E.hold(5);
},
async pragas(E) {
  await E.go('fitossanidade'); await E.live(3);
  await E.caption('10:30 · Pragas e doenças', 'Monitorar e comparar com o nível de controle', 'Cada barra é a infestação medida no monitoramento; a marca é o nível de controle. Passou do limite, o alerta aparece.', 'r');
  await E.hold(3); await E.spotT('Região 3', 8, 'section.card'); await E.hold(4.5);
  await E.caption('10:31 · Pragas e doenças', 'Aplicar quando compensa', 'Bicho-mineiro, broca, ferrugem e cercosporiose com níveis de controle técnicos e editáveis pelo agrônomo. Menos aplicação desnecessária e menos perda por atraso.', 'r');
  await E.spotT('Níveis de controle usados'); await E.hold(5); await E.spotOff();
},
async irrigacao(E) {
  await E.go('irrigacao'); await E.live(4);
  await E.caption('11:00 · Irrigação', 'Bombas, reservatório e válvulas', 'Nível do reservatório, pressão e estado das bombas, válvulas e relés de cada setor de gotejamento.', 'r');
  await E.hold(4.5);
  await E.caption('11:01 · Irrigação', 'A lâmina certa para cada setor', 'A necessidade de água vem da evapotranspiração (Hargreaves) e é corrigida pela uniformidade medida em campo (CUD). Daí sai o tempo de rega de cada setor.', 'r');
  await E.spotT('Cálculo da lâmina do dia'); await E.hold(5);
  await E.spotT('Setores', 8, 'section.card'); await E.hold(3.5); await E.spotOff();
  await E.click('[data-act="setModeIrr"]'); await E.live(E.sec(2.5));
  await E.caption('11:03 · Irrigação', 'A rede inteira no mapa', 'Linhas principais, derivações, cruzetas, válvulas e gotejadores, com o setor que está irrigando agora e os vazamentos marcados.');
  await E.live(E.sec(3.5));
},
async colheita(E) {
  await E.go('colheita'); await E.live(3);
  await E.caption('14:00 · Colheita e previsão', 'Previsão de safra por contagem', 'Contam-se frutos em plantas amostradas; o sistema estima sacas por hectare com intervalo de confiança de 95% e desconta as falhas de estande.', 'r');
  await E.spotT('Por região', 8, 'section.card'); await E.hold(5.5); await E.spotOff();
  await E.caption('14:02 · Colheita e previsão', 'Cargas, lotes e rastreabilidade', 'Cada carga sai de ruas conhecidas e forma lotes com origem. Venda, secagem e logística planejadas com número, não com palpite.', 'r');
  await E.scroll('#view', 600, 1.5); await E.hold(4);
  await E.go('producao'); await E.ui(() => { const el = document.querySelector('#view'); if (el) el.scrollTop = 0; }); await E.live(4);
  await E.caption('14:10 · Produção', 'Produção da safra e evolução', 'Meta, colhido, sacas por hectare em cada região e o histórico de safras. Cada ano calibra a previsão do seguinte.', 'r');
  await E.hold(5);
},
async regioes(E) {
  await E.go('regioes'); await E.live(3);
  await E.caption('15:00 · Regiões', 'Cada região com sua situação', 'Idade, cultivar, última operação e previsão de produção, lado a lado.', 'r');
  await E.hold(3.5);
  await E.click('[data-act="regiaoDet"][data-r="R2"]'); await E.live(6);
  await E.caption('15:01 · Região', 'Saúde da lavoura em um número', 'Estande, sanidade, nutrição e uniformidade da irrigação somados num índice. Mostra onde investir primeiro.', 'r');
  await E.hold(5);
  await E.go('manejo'); await E.live(4);
  await E.caption('15:10 · Manejo do Café', 'Calendário do ciclo mês a mês', 'O que fazer em cada mês e o que já foi feito, em cada região. Ótimo para alinhar equipe e agrônomo.', 'r');
  await E.hold(4.5);
},
async final(E) {
  await E.go('manutencao'); await E.live(3);
  await E.caption('16:00 · Manutenção', 'Problemas com endereço', 'Vazamento, gotejador entupido ou bomba com defeito: cada ocorrência tem rua, metro, responsável e prazo.', 'r');
  await E.hold(4);
  await E.go('inventario'); await E.live(3);
  await E.caption('16:20 · Levantamento', 'Tudo contado a partir do traçado', 'Ruas, covas, gotejadores, cruzetas, válvulas, relés e metros de tubo, com coordenadas. Base para compra, projeto e manutenção.', 'r');
  await E.hold(4);
  await E.go('relatorios'); await E.live(3);
  await E.caption('17:00 · Relatórios', 'Fechando o dia com relatórios prontos', 'Resumo da fazenda, custos por região, caderno de campo das aplicações, pendências por rua e mais, exportáveis em CSV ou HTML.', 'r');
  await E.hold(3);
  await E.click('[data-act="relatorio"][data-id="custos"]'); await E.live(6); await E.hold(4);
  await E.ui(() => document.querySelector('[data-act="fecharModal"]')?.click()); await E.live(2);
},
async valor(E) {
  E.curA = 0;
  await E.card(`<div class="kick">Feito por completo, o que muda</div><h1>Cada decisão tomada no lugar certo</h1>
  <div class="grid g2">
   <div class="it"><b>Correção por rua, não pela média</b><span>O problema aparece onde está: a rua com falhas, o setor com baixa uniformidade, a mancha de ferrugem. <em>Corrige-se só ali.</em></span></div>
   <div class="it"><b>Insumo na dose que o solo pede</b><span>Calagem, gessagem e adubação pela análise e pela meta de produção. <em>Menos desperdício e menos carência.</em></span></div>
   <div class="it"><b>Defensivo quando compensa</b><span>Aplicação decidida pelo nível de controle e pelo clima do dia. <em>Menos entradas desnecessárias e menos perda por atraso.</em></span></div>
   <div class="it"><b>Água e fertirrigação uniformes</b><span>Lâmina pela evapotranspiração e pelo CUD medido. <em>Cada planta recebe o mesmo.</em></span></div>
  </div>`, 7, 4);
  await E.card(`<div class="kick">Rendimento da operação</div><h1>Menos retrabalho, mais previsibilidade</h1>
  <div class="grid">
   <div class="it"><b>Serviço conferido</b><span>GPS e ordens por rua mostram o que foi feito, por quem e quando. <em>Rua esquecida aparece no mesmo dia.</em></span></div>
   <div class="it"><b>Safra prevista com método</b><span>Contagem com intervalo de confiança para planejar <em>venda, secagem e logística</em>.</span></div>
   <div class="it"><b>Histórico que ensina</b><span>Cada safra registrada calibra a próxima: custos, doses e produtividade <em>da sua própria fazenda</em>.</span></div>
  </div>
  <div class="sub" style="font-size:22px;margin-top:40px">O ganho depende de usar por completo: medir, lançar e conferir todos os dias.</div>`, 7, 3);
  await E.card(`<img class="logo" src="${LOGO}" style="width:640px"><div class="sub" style="font-size:34px;margin-top:8px">Gestão da lavoura de café em 3D, do planejamento à colheita.</div><div class="note">Dados e telemetria de demonstração · Computador, tablet e celular · Funciona offline</div>`, 5);
},
};
