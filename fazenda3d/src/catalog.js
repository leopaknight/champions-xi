// Catálogo agronômico: fases do ciclo, tarefas (com campos), insumos, pragas,
// variedades, equipamentos. Referências: CFSEMG 5ª Aproximação (1999), Embrapa Café,
// Embrapa Cerrados, Procafé. Valores-padrão são PONTOS DE PARTIDA e ficam editáveis.

export const ESTAGIO = { P: 'Produção', F: 'Formação', A: 'Todas' };

// Ano-safra começa em julho (após a colheita) e termina em junho.
export const FASES = [
  { id: 'POS', nome: 'Pós-colheita', meses: [7, 8, 9], cor: '#8a6a4f', desc: 'Recuperação da planta, limpeza do chão, poda e amostragem de solo.' },
  { id: 'COR', nome: 'Correção do solo e pré-florada', meses: [8, 9, 10], cor: '#a5683b', desc: 'Calagem, gessagem e déficit hídrico controlado para concentrar a florada.' },
  { id: 'FLO', nome: 'Florada e pegamento', meses: [9, 10, 11], cor: '#d8c9a3', desc: 'Retomada da irrigação, abertura das flores, foliar de boro e zinco, início das chuvas.' },
  { id: 'DES', nome: 'Chumbinho e expansão', meses: [11, 12, 1], cor: '#6f9a54', desc: 'Frutos em expansão rápida: maior demanda de água, N e K. Proteção contra ferrugem e cercospora.' },
  { id: 'GRA', nome: 'Granação', meses: [1, 2, 3], cor: '#3f7a46', desc: 'Enchimento do grão. Broca em trânsito, estimativa de safra, última parcela de adubo.' },
  { id: 'MAT', nome: 'Maturação e pré-colheita', meses: [3, 4, 5], cor: '#b8432f', desc: 'Frutos mudam de verde para cereja. Preparar o chão, máquinas e terreiro.' },
  { id: 'COL', nome: 'Colheita', meses: [5, 6, 7, 8], cor: '#7b2a24', desc: 'Colheita mecanizada em passadas, recolhimento, transporte e formação de lotes.' },
  { id: 'CON', nome: 'Rotinas contínuas', meses: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12], cor: '#55707a', desc: 'Irrigação, fertirrigação, monitoramento de pragas e doenças, manejo do mato.' },
  { id: 'MAN', nome: 'Manutenção da irrigação', meses: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12], cor: '#2f6f8f', desc: 'Filtros, linhas, gotejadores, bombas, válvulas e relés.' },
  { id: 'IMP', nome: 'Implantação e formação', meses: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12], cor: '#9a8a3a', desc: 'Lavoura nova: preparo, plantio, replanta e formação até a primeira safra.' },
];

// Campos reutilizáveis
const APLIC = [
  { k: 'calda', t: 'num', l: 'Volume de calda', u: 'L/ha', def: 400 },
  { k: 'bico', t: 'sel', l: 'Ponta de pulverização', o: ['Cone vazio', 'Cone cheio', 'Leque', 'Leque antideriva (indução de ar)', 'Eletrostático'] },
  { k: 'pressao', t: 'num', l: 'Pressão', u: 'bar' },
  { k: 'velocidade', t: 'num', l: 'Velocidade', u: 'km/h' },
  { k: 'receita', t: 'txt', l: 'Nº do receituário agronômico', ph: 'Obrigatório para agrotóxicos' },
  { k: 'carencia', t: 'num', l: 'Carência (conforme bula)', u: 'dias' },
  { k: 'reentrada', t: 'num', l: 'Intervalo de reentrada', u: 'h' },
  { k: 'epi', t: 'chk', l: 'EPI completo conferido' },
];
const CLIMA = [
  { k: 'vento', t: 'num', l: 'Vento', u: 'km/h', warn: (v) => v > 10 ? 'Vento acima de 10 km/h: risco de deriva.' : v < 3 && v !== '' && v != null ? 'Vento abaixo de 3 km/h: risco de inversão térmica.' : '' },
  { k: 'temp', t: 'num', l: 'Temperatura', u: '°C', warn: (v) => v > 30 ? 'Acima de 30 °C: evaporação das gotas.' : '' },
  { k: 'ur', t: 'num', l: 'Umidade relativa', u: '%', warn: (v) => v != null && v !== '' && v < 55 ? 'UR abaixo de 55%: evaporação das gotas.' : '' },
];
const SOLO_MODO = [
  { k: 'modo', t: 'sel', l: 'Modo de aplicação', o: ['Faixa (projeção da copa)', 'Área total', 'Entrelinha', 'Via fertirrigação'] },
  { k: 'faixa', t: 'num', l: 'Largura da faixa', u: 'm' },
];

// plano: ocorrências previstas no ano-safra. m = [mês início, mês fim], est = P/F/A
export const TAREFAS = [
  // ---------------- PÓS-COLHEITA ----------------
  {
    id: 'PC01', fase: 'POS', nome: 'Arruação / esparramação do cisco', unid: 'ha',
    desc: 'Devolve para baixo da saia o cisco (folhas, ramos, terra) amontoado no meio da rua durante a colheita. Protege o solo, recicla nutrientes e deixa a rua livre para as próximas operações.',
    tec: ['Fazer logo após a colheita e a varrição.', 'Esparramadora mecânica ou soprador: regular para não ferir o colo das plantas.', 'Evitar deixar o cisco encostado no tronco (abrigo de pragas).'],
    campos: [{ k: 'metodo', t: 'sel', l: 'Método', o: ['Esparramadora mecânica', 'Soprador', 'Manual (rastelo)'] }],
    equip: true, plano: [{ m: [7, 8], est: 'P' }],
  },
  {
    id: 'PC02', fase: 'POS', nome: 'Varrição e recolhimento do café de chão', unid: 'ha',
    desc: 'Recolhe os frutos que caíram durante a colheita. O café de chão tem qualidade inferior e precisa sair da lavoura: frutos remanescentes são o principal abrigo da broca entre safras.',
    tec: ['Recolhedora/varredora mecânica após soprar a rua.', 'Separar como lote de varrição (não misturar com café de pano/planta).', 'Meta prática: menos de 1 fruto por m² no chão ao final.'],
    campos: [
      { k: 'litros', t: 'num', l: 'Volume recolhido', u: 'L' },
      { k: 'lote', t: 'txt', l: 'Lote de destino' },
      { k: 'frutosm2', t: 'num', l: 'Frutos remanescentes', u: 'frutos/m²' },
    ],
    equip: true, plano: [{ m: [7, 8], est: 'P' }],
  },
  {
    id: 'PC03', fase: 'POS', nome: 'Catação de frutos remanescentes (repasse)', unid: 'ha',
    desc: 'Retirada manual dos frutos que ficaram na planta e no chão. Controle cultural da broca: quebra o ciclo do inseto na entressafra.',
    tec: ['Prioridade em ruas com histórico de broca acima de 3%.', 'Frutos catados vão para lote separado.'],
    campos: [{ k: 'litros', t: 'num', l: 'Volume catado', u: 'L' }, { k: 'pessoas', t: 'num', l: 'Pessoas', u: 'nº' }],
    plano: [{ m: [8, 9], est: 'P' }],
  },
  {
    id: 'PC04', fase: 'POS', nome: 'Poda', unid: 'ha',
    desc: 'Renova ou contém a planta. Recepa: corte do tronco a 30–40 cm do solo. Esqueletamento: corte dos ramos laterais a 20–40 cm do tronco. Decote: corte do topo a 1,8–2,2 m. Desponte: corte das pontas dos ramos laterais.',
    tec: ['Fazer logo após a colheita para a planta rebrotar com as chuvas.', 'Esqueletamento + decote programa uma safra zero no ano seguinte.', 'Triturar os ramos na entrelinha (matéria orgânica).', 'Após recepa/esqueletamento, programar desbrota.'],
    campos: [
      { k: 'tipo', t: 'sel', l: 'Tipo de poda', o: ['Decote', 'Esqueletamento', 'Esqueletamento + decote', 'Recepa baixa', 'Recepa alta', 'Desponte', 'Poda de limpeza'] },
      { k: 'altura', t: 'num', l: 'Altura do corte', u: 'm' },
      { k: 'distancia', t: 'num', l: 'Distância do tronco (esqueletamento)', u: 'cm' },
      { k: 'destino', t: 'sel', l: 'Destino dos ramos', o: ['Triturado na entrelinha', 'Retirado da lavoura', 'Deixado sob a saia'] },
    ],
    equip: true, plano: [{ m: [7, 9], est: 'P', opcional: true }],
  },
  {
    id: 'PC05', fase: 'POS', nome: 'Desbrota', unid: 'ha',
    desc: 'Após recepa ou esqueletamento, eliminar o excesso de brotos ladrões, mantendo 1 a 2 hastes por cova.',
    tec: ['Fazer quando os brotos tiverem 20–30 cm.', 'Pode exigir 2 a 3 passadas.'],
    campos: [{ k: 'hastes', t: 'num', l: 'Hastes mantidas por cova', u: 'nº', def: 2 }, { k: 'pessoas', t: 'num', l: 'Pessoas', u: 'nº' }],
    plano: [{ m: [10, 12], est: 'P', opcional: true }],
  },
  {
    id: 'PC06', fase: 'POS', nome: 'Amostragem de solo', unid: 'região',
    desc: 'Coleta de amostras compostas por região (gleba homogênea) para análise química. Base para calagem, gessagem e adubação de toda a safra.',
    tec: ['Profundidades 0–20 cm e 20–40 cm.', 'Coletar na faixa adubada (projeção da copa), 15 a 20 subamostras por amostra composta.', 'Mesma época todo ano (após a colheita) para comparar a série histórica.', 'Registrar o protocolo do laboratório e lançar o resultado no módulo Solo.'],
    campos: [
      { k: 'prof', t: 'sel', l: 'Profundidades', o: ['0–20 e 20–40 cm', '0–20 cm', '0–20, 20–40 e 40–60 cm'] },
      { k: 'subamostras', t: 'num', l: 'Subamostras por composta', u: 'nº', def: 20 },
      { k: 'laboratorio', t: 'txt', l: 'Laboratório' },
      { k: 'protocolo', t: 'txt', l: 'Nº do protocolo' },
    ],
    plano: [{ m: [7, 8], est: 'A' }],
  },
  {
    id: 'PC07', fase: 'DES', nome: 'Amostragem foliar', unid: 'região',
    desc: 'Diagnóstico do estado nutricional. Folhas do 3º ou 4º par de ramos produtivos, terço médio da planta, nos quatro lados.',
    tec: ['Época: chumbinho/expansão (dezembro–fevereiro).', 'Cerca de 25 plantas por região, 4 pares de folhas por planta.', 'Não amostrar até 30 dias após adubação foliar.'],
    campos: [{ k: 'plantas', t: 'num', l: 'Plantas amostradas', u: 'nº', def: 25 }, { k: 'laboratorio', t: 'txt', l: 'Laboratório' }, { k: 'protocolo', t: 'txt', l: 'Nº do protocolo' }],
    plano: [{ m: [12, 2], est: 'P' }],
  },
  {
    id: 'PC10', fase: 'POS', nome: 'Manutenção de carreadores e controle de erosão', unid: 'ha',
    desc: 'Patrolamento de carreadores, limpeza de bacias de contenção e saídas d’água antes das chuvas.',
    tec: ['Concluir antes das primeiras chuvas (setembro/outubro).'],
    campos: [{ k: 'metros', t: 'num', l: 'Carreador recuperado', u: 'm' }, { k: 'bacias', t: 'num', l: 'Bacias limpas', u: 'nº' }],
    equip: true, plano: [{ m: [8, 9], est: 'A' }],
  },

  // ---------------- CORREÇÃO / PRÉ-FLORADA ----------------
  {
    id: 'CR01', fase: 'COR', nome: 'Calagem', unid: 'ha', insumos: true,
    desc: 'Aplicação de calcário para corrigir a acidez, neutralizar alumínio e fornecer cálcio e magnésio. Dose calculada pelo método da saturação por bases no módulo Solo.',
    tec: ['NC (t/ha) = (V2 − V1) × T ÷ PRNT, com T em cmolc/dm³.', 'V2 de referência para café: 60% (5ª Aproximação); muitos técnicos no Cerrado usam 60–70%.', 'Em lavoura formada: aplicar na faixa da projeção da copa, sem incorporar.', 'Aplicar de agosto a outubro, antes das chuvas.', 'Preferir dolomítico quando Mg estiver baixo.'],
    campos: [...SOLO_MODO, { k: 'prnt', t: 'num', l: 'PRNT do calcário', u: '%', def: 90 }],
    equip: true, plano: [{ m: [8, 10], est: 'A' }],
  },
  {
    id: 'CR02', fase: 'COR', nome: 'Gessagem', unid: 'ha', insumos: true,
    desc: 'Gesso agrícola para levar cálcio e enxofre ao subsolo e reduzir o alumínio tóxico em profundidade, aprofundando as raízes.',
    tec: ['Indicada quando, na camada 20–40 cm, Ca < 0,4 cmolc/dm³, Al > 0,5 cmolc/dm³ ou m > 30%.', 'Dose de referência no Cerrado (Embrapa): 50 × argila (%) kg/ha.', 'Pode ser aplicado junto com o calcário.'],
    campos: [...SOLO_MODO],
    equip: true, plano: [{ m: [8, 10], est: 'A', opcional: true }],
  },
  {
    id: 'FL01', fase: 'COR', nome: 'Déficit hídrico controlado (suspensão da irrigação)', unid: 'setor',
    desc: 'Suspensão programada da irrigação no inverno para sincronizar os botões florais e concentrar a florada, o que uniformiza a maturação e facilita a colheita.',
    tec: ['Prática validada pela Embrapa Cerrados para café irrigado no Cerrado: suspensão em torno de 70 dias (fim de junho ao início de setembro).', 'A intensidade importa: déficit fraco pode não sincronizar (várias floradas).', 'Acompanhar o potencial hídrico foliar de antemanhã (câmara de pressão) e o estádio das gemas.', 'Não aplicar em lavoura em formação.'],
    campos: [
      { k: 'inicio', t: 'date', l: 'Início da suspensão' },
      { k: 'fim', t: 'date', l: 'Retomada prevista' },
      { k: 'psi', t: 'num', l: 'Potencial hídrico de antemanhã', u: 'MPa' },
      { k: 'gemas', t: 'sel', l: 'Estádio das gemas', o: ['E1', 'E2', 'E3', 'E4', 'E5', 'E6'] },
    ],
    plano: [{ m: [7, 8], est: 'P' }],
  },
  {
    id: 'FL02', fase: 'FLO', nome: 'Irrigação de indução da florada (retomada)', unid: 'setor',
    desc: 'Primeira irrigação após o déficit: lâmina alta para reidratar a planta e disparar a abertura das flores de forma concentrada.',
    tec: ['Florada costuma abrir 8 a 12 dias após a retomada.', 'Registrar a data: ela define a previsão de maturação.'],
    campos: [{ k: 'lamina', t: 'num', l: 'Lâmina aplicada', u: 'mm', def: 30 }, { k: 'horas', t: 'num', l: 'Tempo de irrigação', u: 'h' }],
    plano: [{ m: [9, 9], est: 'P' }],
  },
  {
    id: 'FL03', fase: 'FLO', nome: 'Registro de florada', unid: 'região',
    desc: 'Registro da data e da intensidade de cada florada. É a base da previsão de maturação e do planejamento da colheita.',
    tec: ['Registrar 1ª, 2ª e 3ª floradas separadamente.', 'Florada principal = maior intensidade.', 'Maturação em geral ocorre 210 a 270 dias após a florada, conforme a cultivar e o clima.'],
    campos: [
      { k: 'ordem', t: 'sel', l: 'Florada', o: ['1ª', '2ª', '3ª', '4ª'] },
      { k: 'intensidade', t: 'sel', l: 'Intensidade', o: ['Fraca', 'Média', 'Forte'] },
      { k: 'pctPlantas', t: 'num', l: 'Plantas floridas', u: '%' },
      { k: 'principal', t: 'chk', l: 'É a florada principal' },
    ],
    plano: [{ m: [9, 10], est: 'P' }],
  },
  {
    id: 'FL04', fase: 'FLO', nome: 'Foliar de boro e zinco (pré-florada/florada)', unid: 'ha', insumos: true,
    desc: 'Boro participa do pegamento das flores e do crescimento do tubo polínico; zinco do crescimento dos ramos. Aplicação foliar pré-florada e no início das chuvas.',
    tec: ['Referência comum: ácido bórico 0,3% e sulfato de zinco 0,4–0,6% na calda.', '2 a 3 aplicações por safra (setembro a janeiro).', 'Pode ser associado a fungicida, conferindo compatibilidade.'],
    campos: [...APLIC, ...CLIMA],
    equip: true, plano: [{ m: [9, 10], est: 'A' }, { m: [12, 1], est: 'A' }],
  },
  {
    id: 'FT05', fase: 'FLO', nome: 'Controle do bicho-mineiro', unid: 'ha', insumos: true,
    desc: 'Leucoptera coffeella: a lagarta faz minas nas folhas e causa desfolha. Ataque mais forte no período seco e quente (Cerrado: julho a outubro).',
    tec: ['Controlar quando as minas ativas atingirem 20–30% das folhas amostradas (3º/4º par, terço superior).', 'Via solo (início das chuvas) ou via foliar no período seco.', 'Rotacionar modos de ação (IRAC) para evitar resistência.', 'Preservar vespas predadoras: nível de não ação 40% de folhas com minas predadas.'],
    campos: [{ k: 'metodo', t: 'sel', l: 'Método', o: ['Foliar', 'Via solo (drench)', 'Via fertirrigação'] }, { k: 'infest', t: 'num', l: 'Infestação antes da aplicação', u: '% folhas' }, ...APLIC, ...CLIMA],
    equip: true, plano: [{ m: [8, 10], est: 'A', opcional: true }],
  },

  // ---------------- CHUVAS: NUTRIÇÃO E PROTEÇÃO ----------------
  {
    id: 'AD01', fase: 'DES', nome: 'Adubação NPK via solo (parcela)', unid: 'ha', insumos: true,
    desc: 'Adubação de produção parcelada em 3 ou 4 vezes no período chuvoso, na projeção da copa. Dose total por safra definida no módulo Solo pela produtividade esperada e pela análise.',
    tec: ['Parcelas típicas: outubro/novembro, dezembro, fevereiro (e março).', 'Aplicar com solo úmido; evitar ureia sobre solo seco e quente (volatilização).', 'Fósforo pode ir todo na 1ª parcela.', 'Em lavoura fertirrigada, essa operação é substituída total ou parcialmente pela fertirrigação.'],
    campos: [{ k: 'parcela', t: 'sel', l: 'Parcela', o: ['1ª', '2ª', '3ª', '4ª'] }, { k: 'formula', t: 'txt', l: 'Formulação (N-P-K)', ph: 'ex.: 20-05-20' }, ...SOLO_MODO],
    equip: true, plano: [{ m: [10, 11], est: 'P', n: '1ª parcela' }, { m: [12, 12], est: 'P', n: '2ª parcela' }, { m: [2, 2], est: 'P', n: '3ª parcela' }],
  },
  {
    id: 'AD02', fase: 'CON', nome: 'Fertirrigação', unid: 'setor', insumos: true, recorrente: 'semanal',
    desc: 'Injeção de fertilizantes solúveis na água de irrigação. Parcela a dose em aplicações semanais ou quinzenais, acompanhando a curva de demanda da planta.',
    tec: ['Usar fertilizantes de alta solubilidade (ureia, nitrato de cálcio, MAP purificado, KCl branco, sulfato/nitrato de potássio, sulfato de magnésio, ácido bórico).', 'Nunca misturar no mesmo tanque fontes de cálcio com sulfatos ou fosfatos (precipitação).', 'Sequência: irrigar 1/4 do tempo só com água, injetar, terminar com 1/4 do tempo só com água para lavar as linhas.', 'Medir CE e pH da solução na saída do gotejador.'],
    campos: [
      { k: 'setor', t: 'txt', l: 'Setor(es)' },
      { k: 'tanque', t: 'num', l: 'Volume de solução no tanque', u: 'L' },
      { k: 'tempoInj', t: 'num', l: 'Tempo de injeção', u: 'min' },
      { k: 'ce', t: 'num', l: 'CE na saída do gotejador', u: 'dS/m' },
      { k: 'ph', t: 'num', l: 'pH na saída do gotejador' },
    ],
    plano: [{ m: [9, 4], est: 'A', recorrente: 7 }],
  },
  {
    id: 'AD03', fase: 'DES', nome: 'Adubação foliar de micronutrientes', unid: 'ha', insumos: true,
    desc: 'Complemento de zinco, boro, cobre e manganês via folha no período de crescimento vegetativo.',
    tec: ['2 a 3 aplicações entre outubro e março.', 'Conferir resultado da análise foliar antes de repetir.'],
    campos: [...APLIC, ...CLIMA],
    equip: true, plano: [{ m: [11, 12], est: 'A' }, { m: [2, 3], est: 'A' }],
  },
  {
    id: 'FT01', fase: 'DES', nome: 'Fungicida: ferrugem e cercosporiose', unid: 'ha', insumos: true,
    desc: 'Ferrugem (Hemileia vastatrix) e cercosporiose (Cercospora coffeicola) são as principais doenças do café no Cerrado. Programa preventivo no período chuvoso.',
    tec: ['Via solo no início das chuvas (outubro–dezembro) com triazol sistêmico, ou programa foliar com triazol + estrobilurina (2 a 3 aplicações, novembro–março).', 'Cúpricos como protetores e complemento.', 'Lavouras com alta carga pendente são mais suscetíveis à ferrugem.', 'Registrar incidência antes e após para avaliar eficiência.'],
    campos: [{ k: 'metodo', t: 'sel', l: 'Método', o: ['Foliar', 'Via solo (drench)', 'Via fertirrigação'] }, { k: 'alvo', t: 'sel', l: 'Alvo principal', o: ['Ferrugem', 'Cercosporiose', 'Ferrugem + cercosporiose', 'Phoma / mancha-aureolada'] }, ...APLIC, ...CLIMA],
    equip: true, plano: [{ m: [11, 12], est: 'A', n: '1ª aplicação' }, { m: [1, 1], est: 'P', n: '2ª aplicação' }, { m: [3, 3], est: 'P', n: '3ª aplicação' }],
  },
  {
    id: 'FT02', fase: 'GRA', nome: 'Controle da broca-do-café', unid: 'ha', insumos: true,
    desc: 'Hypothenemus hampei perfura o fruto e se reproduz dentro da semente, causando perda de peso e de qualidade. Período de trânsito (saída dos frutos velhos para os novos): dezembro a março.',
    tec: ['Monitorar a partir de 80–90 dias após a florada principal, mensalmente até 70 dias antes da colheita.', 'Nível de controle: 3% de frutos broqueados (alguns técnicos usam até 5%).', 'Biológico: Beauveria bassiana. Químico: conforme registro no AGROFIT.', 'Base do controle é cultural: colheita bem feita, varrição e catação.'],
    campos: [{ k: 'infest', t: 'num', l: 'Frutos broqueados antes', u: '%' }, ...APLIC, ...CLIMA],
    equip: true, plano: [{ m: [1, 3], est: 'P', opcional: true }],
  },
  {
    id: 'FT03', fase: 'CON', nome: 'Controle de ácaros e cochonilhas', unid: 'ha', insumos: true,
    desc: 'Ácaro-vermelho (Oligonychus ilicis) e ácaro-da-mancha-anular aparecem em períodos secos; cochonilhas da roseta e da raiz em focos.',
    tec: ['Controlar só em reboleiras com infestação confirmada.', 'Evitar piretroides em excesso (favorecem ácaros).'],
    campos: [{ k: 'alvo', t: 'sel', l: 'Alvo', o: ['Ácaro-vermelho', 'Ácaro-da-mancha-anular', 'Cochonilha-da-roseta', 'Cochonilha-da-raiz'] }, ...APLIC, ...CLIMA],
    equip: true, plano: [],
  },
  {
    id: 'FT06', fase: 'CON', nome: 'Combate a formigas cortadeiras e cupins', unid: 'ha', insumos: true,
    desc: 'Iscas formicidas em formigueiros ativos (saúvas e quenquéns). Crítico em lavoura nova.',
    tec: ['Isca granulada: dose conforme bula por m² de terra solta do formigueiro.', 'Aplicar em dias secos, próximo aos olheiros ativos, sem tocar o produto com a mão.'],
    campos: [{ k: 'formigueiros', t: 'num', l: 'Formigueiros tratados', u: 'nº' }, { k: 'area', t: 'num', l: 'Área de terra solta', u: 'm²' }],
    plano: [{ m: [8, 9], est: 'F' }, { m: [3, 4], est: 'F' }],
  },
  {
    id: 'MD01', fase: 'CON', nome: 'Roçada da entrelinha', unid: 'ha',
    desc: 'Corte da vegetação (braquiária ou espontânea) no meio da rua. A roçadeira lateral joga a palhada sob a saia do café (roçada ecológica): cobertura morta, menos erosão e mais matéria orgânica.',
    tec: ['Altura de corte 10–15 cm.', '3 a 5 roçadas no período chuvoso.', 'Não deixar a braquiária sementear nem competir na linha.'],
    campos: [{ k: 'altura', t: 'num', l: 'Altura de corte', u: 'cm', def: 12 }, { k: 'tipo', t: 'sel', l: 'Tipo', o: ['Roçadeira lateral (ecológica)', 'Roçadeira central', 'Trincha'] }],
    equip: true, plano: [{ m: [11, 11], est: 'A' }, { m: [1, 1], est: 'A' }, { m: [3, 3], est: 'A' }],
  },
  {
    id: 'MD02', fase: 'CON', nome: 'Herbicida na linha (faixa)', unid: 'ha', insumos: true,
    desc: 'Controle químico das plantas daninhas na faixa sob a copa, onde a roçadeira não alcança.',
    tec: ['Usar protetor (chapéu-de-napoleão) e ponta antideriva para não atingir as folhas do café.', 'Pré-emergente no início das chuvas reduz o número de entradas.', 'Rotacionar mecanismos de ação.'],
    campos: [{ k: 'tipo', t: 'sel', l: 'Tipo', o: ['Pós-emergente', 'Pré-emergente', 'Pré + pós'] }, { k: 'faixa', t: 'num', l: 'Largura da faixa', u: 'm', def: 1 }, ...APLIC, ...CLIMA],
    equip: true, plano: [{ m: [10, 11], est: 'A' }, { m: [2, 3], est: 'A' }],
  },
  {
    id: 'MD03', fase: 'CON', nome: 'Capina manual / coroamento', unid: 'ha',
    desc: 'Retirada manual de plantas daninhas na linha e ao redor do tronco. Essencial em lavoura nova.',
    tec: ['Não ferir o colo nem as raízes superficiais.'],
    campos: [{ k: 'pessoas', t: 'num', l: 'Pessoas', u: 'nº' }],
    plano: [{ m: [11, 12], est: 'F' }, { m: [2, 3], est: 'F' }],
  },
  {
    id: 'MN01', fase: 'CON', nome: 'Monitoramento fitossanitário', unid: 'região', recorrente: 'mensal',
    desc: 'Levantamento mensal de bicho-mineiro, broca, ferrugem, cercosporiose e ácaros. Os valores lançados aqui alimentam o módulo Fitossanidade e os alertas de nível de controle.',
    tec: ['Caminhar em zigue-zague, 20 a 30 plantas por região.', 'Bicho-mineiro e ferrugem: folhas do 3º/4º par, 100 folhas por região.', 'Broca: 100 frutos por planta amostrada (25 por face).'],
    campos: [
      { k: 'mineiro', t: 'num', l: 'Bicho-mineiro (minas ativas)', u: '% folhas' },
      { k: 'broca', t: 'num', l: 'Broca', u: '% frutos' },
      { k: 'ferrugem', t: 'num', l: 'Ferrugem (incidência)', u: '% folhas' },
      { k: 'cercospora', t: 'num', l: 'Cercosporiose', u: '% folhas' },
      { k: 'acaro', t: 'num', l: 'Ácaro (folhas com presença)', u: '%' },
    ],
    plano: [{ m: [7, 6], est: 'A', recorrente: 30 }],
  },

  // ---------------- GRANAÇÃO / MATURAÇÃO ----------------
  {
    id: 'ES01', fase: 'GRA', nome: 'Estimativa de safra (contagem)', unid: 'região',
    desc: 'Contagem de frutos em plantas amostradas para prever a produção. Cada nova contagem atualiza a previsão da região no modo Colheita.',
    tec: ['Escolher 20 a 30 plantas por região em zigue-zague, evitando bordaduras e falhas.', 'Contar frutos em 4 ramos produtivos do terço médio (2 de cada lado) e o número de ramos produtivos da planta.', 'Fazer ao menos 3 contagens: chumbinho, granação e pré-colheita.', 'Calibrar frutos por litro e litros por saca com dados da própria fazenda.'],
    campos: [], // formulário próprio no modo Colheita
    plano: [{ m: [12, 12], est: 'P', n: '1ª contagem (chumbinho)' }, { m: [2, 2], est: 'P', n: '2ª contagem (granação)' }, { m: [4, 4], est: 'P', n: '3ª contagem (pré-colheita)' }],
  },
  {
    id: 'MT01', fase: 'MAT', nome: 'Avaliação de maturação', unid: 'região',
    desc: 'Amostra de 1 litro de frutos separada em verde, verde-cana, cereja, passa e seco. Define o momento de colher cada região.',
    tec: ['Iniciar a colheita com no máximo 20% de frutos verdes.', 'Repetir a cada 7–10 dias em março–maio.'],
    campos: [
      { k: 'verde', t: 'num', l: 'Verde', u: '%' },
      { k: 'cana', t: 'num', l: 'Verde-cana', u: '%' },
      { k: 'cereja', t: 'num', l: 'Cereja', u: '%' },
      { k: 'passa', t: 'num', l: 'Passa', u: '%' },
      { k: 'seco', t: 'num', l: 'Seco', u: '%' },
    ],
    plano: [{ m: [3, 5], est: 'P' }],
  },
  {
    id: 'PR01', fase: 'MAT', nome: 'Preparo do chão para colheita (arruação)', unid: 'ha',
    desc: 'Limpeza e nivelamento sob a saia para receber o café que cai na colheita mecanizada e facilitar a varrição.',
    tec: ['Concluir antes do início da colheita na região.', 'Arruador/soprador; cuidado com o sistema de gotejamento.'],
    campos: [{ k: 'metodo', t: 'sel', l: 'Método', o: ['Arruador mecânico', 'Soprador', 'Manual'] }],
    equip: true, plano: [{ m: [4, 5], est: 'P' }],
  },
  {
    id: 'PR02', fase: 'MAT', nome: 'Revisão e regulagem da colhedora', unid: 'equip.',
    desc: 'Revisão mecânica e regulagem de vibração, velocidade e varetas conforme a carga e a maturação.',
    tec: ['Regulagem de partida comum: 0,8–1,6 km/h de velocidade.', 'Mais vibração derriça mais, mas aumenta a desfolha e a queda de verdes.'],
    campos: [{ k: 'vibracao', t: 'num', l: 'Vibração', u: 'rpm' }, { k: 'velocidade', t: 'num', l: 'Velocidade', u: 'km/h' }, { k: 'varetas', t: 'num', l: 'Varetas trocadas', u: 'nº' }],
    equip: true, plano: [{ m: [4, 5], est: 'P' }],
  },
  {
    id: 'PR03', fase: 'MAT', nome: 'Ajuste da irrigação para a colheita', unid: 'setor',
    desc: 'Reduzir a irrigação durante a colheita para não encharcar o chão sob a saia e facilitar a secagem do café caído.',
    tec: ['Retomar lâmina de manutenção logo após a colheita da região.'],
    campos: [{ k: 'reducao', t: 'num', l: 'Redução da lâmina', u: '%' }],
    plano: [{ m: [5, 5], est: 'P' }],
  },

  // ---------------- COLHEITA ----------------
  {
    id: 'CL01', fase: 'COL', nome: 'Colheita mecanizada', unid: 'ha', colheita: true,
    desc: 'Colhedora automotriz derriça por vibração. Normalmente em 2 passadas: a 1ª com mais carga e maturação, a 2ª para os frutos restantes.',
    tec: ['Registrar litros por rua (ou por carga) e a maturação da carga.', 'Medir a perda no chão em plantas amostrais.', 'Velocidade e vibração ajustadas por região.'],
    campos: [
      { k: 'passada', t: 'sel', l: 'Passada', o: ['1ª', '2ª', '3ª'] },
      { k: 'litros', t: 'num', l: 'Volume colhido', u: 'L' },
      { k: 'velocidade', t: 'num', l: 'Velocidade', u: 'km/h' },
      { k: 'vibracao', t: 'num', l: 'Vibração', u: 'rpm' },
      { k: 'perda', t: 'num', l: 'Perda no chão', u: 'L/planta' },
      { k: 'lote', t: 'txt', l: 'Lote de destino' },
    ],
    equip: true, plano: [{ m: [5, 7], est: 'P', n: '1ª passada' }, { m: [6, 8], est: 'P', n: '2ª passada' }],
  },
  {
    id: 'CL02', fase: 'COL', nome: 'Derriça manual / semimecanizada', unid: 'ha', colheita: true,
    desc: 'Derriça no pano com derriçadeira portátil, em bordaduras, reboleiras e locais onde a colhedora não entra.',
    tec: ['Registrar litros e número de pessoas.'],
    campos: [{ k: 'litros', t: 'num', l: 'Volume colhido', u: 'L' }, { k: 'pessoas', t: 'num', l: 'Pessoas', u: 'nº' }, { k: 'lote', t: 'txt', l: 'Lote de destino' }],
    plano: [],
  },
  {
    id: 'CL03', fase: 'COL', nome: 'Recolhimento do café de chão', unid: 'ha', colheita: true,
    desc: 'Recolhedora mecânica após a colhedora. Lote separado (qualidade inferior).',
    tec: ['Fazer o quanto antes: café no chão fermenta e perde qualidade.'],
    campos: [{ k: 'litros', t: 'num', l: 'Volume recolhido', u: 'L' }, { k: 'lote', t: 'txt', l: 'Lote de destino' }],
    equip: true, plano: [{ m: [6, 8], est: 'P' }],
  },
  {
    id: 'CL04', fase: 'COL', nome: 'Transporte para lavador/terreiro', unid: 'carga',
    desc: 'Transbordo da colhedora para carreta/bazuca e transporte ao lavador, terreiro ou secador.',
    tec: ['Não deixar o café amontoado na carreta por mais de algumas horas.'],
    campos: [{ k: 'litros', t: 'num', l: 'Volume transportado', u: 'L' }, { k: 'destino', t: 'sel', l: 'Destino', o: ['Lavador/separador', 'Terreiro', 'Secador', 'Descascador (CD)'] }, { k: 'lote', t: 'txt', l: 'Lote' }],
    equip: true, plano: [],
  },

  // ---------------- IRRIGAÇÃO E MANUTENÇÃO ----------------
  {
    id: 'IR01', fase: 'MAN', nome: 'Irrigação programada (turno de rega)', unid: 'setor', recorrente: 'diária',
    desc: 'Registro de cada turno de irrigação por setor: tempo, lâmina, volume e energia. Alimenta o relatório de irrigação.',
    tec: ['Lâmina = ETo × Kc × Kr − chuva efetiva.', 'Preferir horário reservado (noturno), que tem tarifa reduzida para irrigantes.'],
    campos: [
      { k: 'setor', t: 'txt', l: 'Setor(es)' },
      { k: 'horas', t: 'num', l: 'Tempo de irrigação', u: 'h' },
      { k: 'lamina', t: 'num', l: 'Lâmina', u: 'mm' },
      { k: 'volume', t: 'num', l: 'Volume', u: 'm³' },
      { k: 'bomba', t: 'txt', l: 'Bomba(s)' },
      { k: 'kwh', t: 'num', l: 'Energia', u: 'kWh' },
    ],
    plano: [],
  },
  {
    id: 'IR02', fase: 'MAN', nome: 'Limpeza / retrolavagem de filtros', unid: 'equip.',
    desc: 'Retrolavagem dos filtros de disco ou areia quando a perda de carga sobe.',
    tec: ['Retrolavar quando o diferencial de pressão entre entrada e saída passar de 0,3–0,5 bar.', 'Abrir e lavar os elementos filtrantes manualmente a cada mês.'],
    campos: [{ k: 'pEntrada', t: 'num', l: 'Pressão de entrada', u: 'bar' }, { k: 'pSaida', t: 'num', l: 'Pressão de saída', u: 'bar' }, { k: 'tipo', t: 'sel', l: 'Tipo', o: ['Retrolavagem automática', 'Retrolavagem manual', 'Limpeza dos elementos'] }],
    plano: [{ m: [7, 6], est: 'A', recorrente: 7 }],
  },
  {
    id: 'IR03', fase: 'MAN', nome: 'Flushing (lavagem) das linhas', unid: 'setor',
    desc: 'Abertura dos finais de linha de derivação e laterais para expulsar sedimentos.',
    tec: ['Mensal, e sempre após fertirrigação com fósforo ou após reparos.', 'Abrir até sair água limpa.'],
    campos: [{ k: 'setor', t: 'txt', l: 'Setor(es)' }, { k: 'aspecto', t: 'sel', l: 'Aspecto da água', o: ['Limpa', 'Pouco sedimento', 'Muito sedimento', 'Com algas/biofilme'] }],
    plano: [{ m: [7, 6], est: 'A', recorrente: 30 }],
  },
  {
    id: 'IR04', fase: 'MAN', nome: 'Tratamento químico das linhas', unid: 'setor', insumos: true,
    desc: 'Cloração contra biofilme/algas ou acidificação contra precipitados de cálcio e ferro nos gotejadores.',
    tec: ['Cloro: 1–5 ppm contínuo ou 10–20 ppm em choque (conferir o manual do gotejador).', 'Ácido: baixar o pH da água para cerca de 2–3 em tratamento de choque, depois lavar.', 'Nunca misturar cloro e ácido no mesmo tanque.'],
    campos: [{ k: 'setor', t: 'txt', l: 'Setor(es)' }, { k: 'tipo', t: 'sel', l: 'Tipo', o: ['Cloração', 'Acidificação', 'Peróxido'] }, { k: 'ppm', t: 'num', l: 'Concentração', u: 'ppm' }, { k: 'phAlvo', t: 'num', l: 'pH alvo' }, { k: 'tempo', t: 'num', l: 'Tempo de contato', u: 'h' }],
    plano: [{ m: [8, 8], est: 'A' }, { m: [2, 2], est: 'A' }],
  },
  {
    id: 'IR05', fase: 'MAN', nome: 'Teste de uniformidade (CUD)', unid: 'setor',
    desc: 'Coleta de vazão de 16 gotejadores por setor (4 laterais × 4 posições) para calcular o coeficiente de uniformidade de distribuição.',
    tec: ['Laterais no início, 1/3, 2/3 e fim da derivação; gotejadores no início, 1/3, 2/3 e fim de cada lateral.', 'CUD = média dos 25% menores ÷ média geral × 100.', 'CUD ≥ 90% excelente; 80–90% bom; 70–80% regular; < 70% ruim.'],
    campos: [{ k: 'setor', t: 'txt', l: 'Setor' }, { k: 'vazoes', t: 'txt', l: 'Vazões medidas (L/h), separadas por vírgula', ph: '1.6, 1.58, 1.62 …' }, { k: 'pressao', t: 'num', l: 'Pressão no início da derivação', u: 'mca' }],
    plano: [{ m: [8, 9], est: 'A' }],
  },
  {
    id: 'IR06', fase: 'MAN', nome: 'Reparo em linha de gotejamento', unid: 'ponto',
    desc: 'Conserto de vazamento, furo, gotejador entupido ou emenda na lateral. Registrar a posição exata (rua e metro) para o histórico.',
    tec: ['Usar conectores do mesmo diâmetro e classe do tubo.', 'Fazer flushing do trecho após o reparo.'],
    campos: [{ k: 'problema', t: 'sel', l: 'Problema', o: ['Vazamento', 'Furo (roedor/inseto)', 'Gotejador entupido', 'Corte por implemento', 'Conexão solta', 'Final de linha danificado'] }, { k: 'metro', t: 'num', l: 'Posição na rua', u: 'm' }, { k: 'pecas', t: 'txt', l: 'Peças usadas' }],
    plano: [],
  },
  {
    id: 'IR07', fase: 'MAN', nome: 'Leitura de tensiômetros', unid: 'região',
    desc: 'Tensão de água no solo a 20 e 40 cm para ajustar a lâmina de irrigação.',
    tec: ['Irrigar quando a tensão a 20 cm passar de 30–40 kPa em lavoura em produção (fora do período de déficit).'],
    campos: [{ k: 't20', t: 'num', l: 'Tensão a 20 cm', u: 'kPa' }, { k: 't40', t: 'num', l: 'Tensão a 40 cm', u: 'kPa' }],
    plano: [],
  },
  {
    id: 'MB01', fase: 'MAN', nome: 'Manutenção de motobomba', unid: 'equip.',
    desc: 'Preventiva ou corretiva do conjunto motobomba: rolamentos, selo mecânico, alinhamento, isolamento do motor.',
    tec: ['Medir corrente nas 3 fases (desbalanço acima de 5% indica problema).', 'Teste de isolamento (megômetro) anual.', 'Registrar horímetro.'],
    campos: [{ k: 'tipo', t: 'sel', l: 'Tipo', o: ['Preventiva', 'Corretiva', 'Preditiva (vibração/termografia)'] }, { k: 'horimetro', t: 'num', l: 'Horímetro', u: 'h' }, { k: 'corrente', t: 'txt', l: 'Corrente R/S/T', u: 'A' }, { k: 'pecas', t: 'txt', l: 'Peças trocadas' }],
    plano: [{ m: [7, 7], est: 'A' }, { m: [1, 1], est: 'A' }],
  },
  {
    id: 'MB02', fase: 'MAN', nome: 'Manutenção elétrica / relés / controlador', unid: 'equip.',
    desc: 'Verificação de relés de sinal, solenoides, cabos, rádios e controlador de irrigação.',
    tec: ['Conferir tensão da bobina do solenoide e o sinal (RSSI) de cada relé.', 'Trocar baterias de módulos remotos antes da safra.'],
    campos: [{ k: 'item', t: 'txt', l: 'Item verificado' }, { k: 'rssi', t: 'num', l: 'Sinal', u: 'dBm' }, { k: 'pecas', t: 'txt', l: 'Peças trocadas' }],
    plano: [{ m: [8, 8], est: 'A' }],
  },

  // ---------------- IMPLANTAÇÃO / FORMAÇÃO ----------------
  {
    id: 'IM01', fase: 'IMP', nome: 'Preparo do solo (subsolagem, gradagem, sulcação)', unid: 'ha', insumos: true,
    desc: 'Correção em área total, subsolagem, gradagem e abertura do sulco de plantio com adubação de fundo.',
    tec: ['Calcário em área total incorporado a 0–40 cm antes do plantio.', 'Sulco de 40–60 cm com fósforo, calcário e matéria orgânica.'],
    campos: [{ k: 'profundidade', t: 'num', l: 'Profundidade do sulco', u: 'cm' }],
    equip: true, plano: [],
  },
  {
    id: 'IM02', fase: 'IMP', nome: 'Plantio de mudas', unid: 'ha',
    desc: 'Plantio das mudas no espaçamento definido, com a linha de gotejamento já instalada ou instalada logo em seguida.',
    tec: ['Mudas sadias, com 5 a 6 pares de folhas.', 'Irrigar logo após o plantio.'],
    campos: [{ k: 'mudas', t: 'num', l: 'Mudas plantadas', u: 'nº' }, { k: 'viveiro', t: 'txt', l: 'Viveiro / lote de mudas' }, { k: 'variedade', t: 'txt', l: 'Cultivar' }],
    plano: [],
  },
  {
    id: 'IM03', fase: 'IMP', nome: 'Replanta de falhas', unid: 'planta',
    desc: 'Reposição das plantas mortas. As posições ficam registradas pé a pé no mapa.',
    tec: ['Replantar no período chuvoso.', 'Usar a mesma cultivar da rua.'],
    campos: [{ k: 'mudas', t: 'num', l: 'Mudas replantadas', u: 'nº' }],
    plano: [{ m: [11, 1], est: 'F' }],
  },
  {
    id: 'IM04', fase: 'IMP', nome: 'Adubação de formação', unid: 'ha', insumos: true,
    desc: 'Adubação da lavoura em formação (1º e 2º ano), parcelada no período chuvoso ou via fertirrigação.',
    tec: ['Doses crescentes com a idade, conforme análise de solo.'],
    campos: [{ k: 'parcela', t: 'sel', l: 'Parcela', o: ['1ª', '2ª', '3ª', '4ª', '5ª', '6ª'] }, ...SOLO_MODO],
    equip: true, plano: [{ m: [10, 11], est: 'F' }, { m: [12, 1], est: 'F' }, { m: [2, 3], est: 'F' }],
  },
  {
    id: 'IM05', fase: 'IMP', nome: 'Irrigação de pegamento', unid: 'setor',
    desc: 'Irrigações curtas e frequentes nas primeiras semanas após o plantio.',
    tec: ['Manter o bulbo úmido sem encharcar.'],
    campos: [{ k: 'lamina', t: 'num', l: 'Lâmina', u: 'mm' }],
    plano: [],
  },

  // ---------------- GENÉRICA ----------------
  {
    id: 'GN01', fase: 'CON', nome: 'Outra operação', unid: 'ha', insumos: true,
    desc: 'Operação livre, para qualquer trabalho fora do catálogo.',
    tec: [],
    campos: [{ k: 'titulo', t: 'txt', l: 'Descrição curta' }],
    equip: true, plano: [],
  },
];

export const TAREFA = Object.fromEntries(TAREFAS.map((t) => [t.id, t]));
export const FASE = Object.fromEntries(FASES.map((f) => [f.id, f]));

// Insumos — preços de referência editáveis em Configurações.
// Nomes por ingrediente ativo/garantia (sem marca). Dose e carência: SEMPRE pela bula/receita.
export const INSUMOS = [
  { id: 'calc-dol', nome: 'Calcário dolomítico (PRNT 90%)', cat: 'Corretivo', un: 't', preco: 180 },
  { id: 'calc-calc', nome: 'Calcário calcítico (PRNT 90%)', cat: 'Corretivo', un: 't', preco: 170 },
  { id: 'gesso', nome: 'Gesso agrícola', cat: 'Corretivo', un: 't', preco: 150 },
  { id: 'f200520', nome: 'Formulado 20-05-20', cat: 'Fertilizante', un: 'kg', preco: 3.4 },
  { id: 'f250025', nome: 'Formulado 25-00-25', cat: 'Fertilizante', un: 'kg', preco: 3.3 },
  { id: 'ureia', nome: 'Ureia (45% N)', cat: 'Fertilizante', un: 'kg', preco: 3.1 },
  { id: 'sulfamon', nome: 'Sulfato de amônio (20% N, 22% S)', cat: 'Fertilizante', un: 'kg', preco: 2.2 },
  { id: 'nitamon', nome: 'Nitrato de amônio (32% N)', cat: 'Fertilizante', un: 'kg', preco: 3.0 },
  { id: 'map', nome: 'MAP (11-52-00)', cat: 'Fertilizante', un: 'kg', preco: 4.6 },
  { id: 'mappur', nome: 'MAP purificado (12-61-00)', cat: 'Fertilizante', un: 'kg', preco: 8.5 },
  { id: 'ssp', nome: 'Superfosfato simples (18% P₂O₅)', cat: 'Fertilizante', un: 'kg', preco: 1.9 },
  { id: 'kcl', nome: 'Cloreto de potássio (60% K₂O)', cat: 'Fertilizante', un: 'kg', preco: 3.2 },
  { id: 'kclb', nome: 'Cloreto de potássio branco solúvel (60% K₂O)', cat: 'Fertilizante', un: 'kg', preco: 4.1 },
  { id: 'k2so4', nome: 'Sulfato de potássio (50% K₂O)', cat: 'Fertilizante', un: 'kg', preco: 5.2 },
  { id: 'kno3', nome: 'Nitrato de potássio (13-00-44)', cat: 'Fertilizante', un: 'kg', preco: 7.4 },
  { id: 'cano3', nome: 'Nitrato de cálcio (15,5% N, 19% Ca)', cat: 'Fertilizante', un: 'kg', preco: 4.0 },
  { id: 'mgso4', nome: 'Sulfato de magnésio (9% Mg)', cat: 'Fertilizante', un: 'kg', preco: 2.6 },
  { id: 'boric', nome: 'Ácido bórico (17% B)', cat: 'Micronutriente', un: 'kg', preco: 9.5 },
  { id: 'znso4', nome: 'Sulfato de zinco (20% Zn)', cat: 'Micronutriente', un: 'kg', preco: 8.0 },
  { id: 'mnso4', nome: 'Sulfato de manganês (26% Mn)', cat: 'Micronutriente', un: 'kg', preco: 8.5 },
  { id: 'cuoxi', nome: 'Oxicloreto de cobre (fungicida protetor)', cat: 'Fungicida', un: 'kg', preco: 38 },
  { id: 'triaz-estrob', nome: 'Fungicida triazol + estrobilurina', cat: 'Fungicida', un: 'L', preco: 160 },
  { id: 'triaz-solo', nome: 'Fungicida/inseticida via solo (triazol + neonicotinoide)', cat: 'Fungicida', un: 'kg', preco: 210 },
  { id: 'diamida', nome: 'Inseticida diamida (bicho-mineiro)', cat: 'Inseticida', un: 'L', preco: 520 },
  { id: 'ciantra', nome: 'Inseticida ciantraniliprole (broca)', cat: 'Inseticida', un: 'L', preco: 480 },
  { id: 'beauveria', nome: 'Beauveria bassiana (biológico)', cat: 'Biológico', un: 'kg', preco: 95 },
  { id: 'glifo', nome: 'Herbicida glifosato', cat: 'Herbicida', un: 'L', preco: 32 },
  { id: 'glufo', nome: 'Herbicida glufosinato de amônio', cat: 'Herbicida', un: 'L', preco: 58 },
  { id: 'preem', nome: 'Herbicida pré-emergente', cat: 'Herbicida', un: 'L', preco: 410 },
  { id: 'adjuv', nome: 'Adjuvante / óleo mineral', cat: 'Adjuvante', un: 'L', preco: 22 },
  { id: 'isca', nome: 'Isca formicida granulada', cat: 'Formicida', un: 'kg', preco: 26 },
  { id: 'cloro', nome: 'Hipoclorito de sódio 12%', cat: 'Tratamento de água', un: 'L', preco: 6.5 },
  { id: 'acfosf', nome: 'Ácido fosfórico 85%', cat: 'Tratamento de água', un: 'L', preco: 14 },
];

export const PRAGAS = [
  { k: 'mineiro', nome: 'Bicho-mineiro', un: '% folhas com minas ativas', nc: 25, desc: 'Controle a partir de 20–30% de folhas com minas ativas (3º/4º par, terço superior). Referência usada: 25%.' },
  { k: 'broca', nome: 'Broca-do-café', un: '% frutos broqueados', nc: 3, desc: 'Controle a partir de 3% de frutos broqueados (alguns técnicos usam até 5%).' },
  { k: 'ferrugem', nome: 'Ferrugem', un: '% folhas com pústulas', nc: 5, desc: 'Sem limiar oficial único. Referência de alerta usada: 5% de incidência no período chuvoso (programa preventivo recomendado).' },
  { k: 'cercospora', nome: 'Cercosporiose', un: '% folhas com lesões', nc: 10, desc: 'Ligada a desequilíbrio nutricional (N e K) e estresse. Alerta usado: 10%.' },
  { k: 'acaro', nome: 'Ácaro-vermelho', un: '% folhas com presença', nc: 20, desc: 'Em períodos secos. Alerta usado: 20% das folhas com ácaros.' },
];

// Dias da florada principal até a maturação (estimativa editável — calibrar com o histórico da fazenda)
export const VARIEDADES = [
  { nome: 'Catuaí Vermelho IAC 144', ciclo: 'Tardio', dias: 245 },
  { nome: 'Catuaí Amarelo IAC 62', ciclo: 'Tardio', dias: 245 },
  { nome: 'Mundo Novo IAC 379-19', ciclo: 'Médio', dias: 230 },
  { nome: 'Topázio MG 1190', ciclo: 'Médio', dias: 230 },
  { nome: 'Arara', ciclo: 'Médio-tardio', dias: 240 },
  { nome: 'Catucaí Amarelo 2SL', ciclo: 'Médio', dias: 230 },
  { nome: 'Acauã', ciclo: 'Tardio', dias: 250 },
  { nome: 'IPR 100', ciclo: 'Tardio', dias: 250 },
];

export const TIPOS_EQUIP = {
  colhedora: { nome: 'Colhedora automotriz', vel: 1.3, cor: '#d9a441' },
  trator: { nome: 'Trator', vel: 6, cor: '#3e7cb1' },
  pulverizador: { nome: 'Trator + pulverizador', vel: 5.5, cor: '#4aa3a2' },
  adubadora: { nome: 'Trator + adubadora', vel: 6, cor: '#9b7bd1' },
  rocadeira: { nome: 'Trator + roçadeira', vel: 5, cor: '#6aa84f' },
  recolhedora: { nome: 'Recolhedora / varredora', vel: 2.5, cor: '#c27c4a' },
  bazuca: { nome: 'Trator + carreta graneleira (bazuca)', vel: 8, cor: '#d26a5c' },
  caminhao: { nome: 'Caminhão', vel: 25, cor: '#8a8f98' },
  esparramadora: { nome: 'Trator + esparramadora/soprador', vel: 4, cor: '#b08d57' },
};

export const STATUS_OS = {
  planejada: { nome: 'Planejada', cls: 'st-plan' },
  execucao: { nome: 'Em execução', cls: 'st-exec' },
  concluida: { nome: 'Concluída', cls: 'st-ok' },
  cancelada: { nome: 'Cancelada', cls: 'st-cancel' },
};

export const STATUS_ATIVO = {
  ok: { nome: 'Operando normal', cls: 'st-ok' },
  alerta: { nome: 'Alerta', cls: 'st-warn' },
  falha: { nome: 'Falha', cls: 'st-bad' },
  manutencao: { nome: 'Em manutenção', cls: 'st-plan' },
  desligado: { nome: 'Desligado', cls: 'st-cancel' },
};

export const STATUS_PLANTA = {
  ok: { nome: 'Normal', cor: '#3f7a46' },
  falha: { nome: 'Falha (cova vazia)', cor: '#c0392b' },
  replantada: { nome: 'Replantada', cor: '#9bc46b' },
  doente: { nome: 'Doente / atacada', cor: '#d9a441' },
  baixa: { nome: 'Baixo vigor', cor: '#b6a36a' },
  morta: { nome: 'Morta (a replantar)', cor: '#5a3a2a' },
};
