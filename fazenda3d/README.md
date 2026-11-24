# NexoCafé 3D

Sistema de gestão de lavoura de café em 3D: ruas e plantas pé a pé, plano do ciclo
completo, ordens de serviço, solo, pragas, irrigação por gotejamento (bombas, válvulas,
relés, cruzetas, gotejadores), colheita com previsão por contagem, máquinas com GPS e
relatórios.

Abra `dist/fazenda-cafe-3d.html` em qualquer navegador (funciona offline: o Three.js vai
embutido no arquivo). A mesma página está publicada como Artifact no claude.ai com banco
compartilhado.

## Estrutura

| Arquivo | Conteúdo |
|---|---|
| `src/catalog.js` | Fases do ciclo, 50 operações com campos e recomendações técnicas, insumos, pragas e níveis de controle, cultivares, tipos de máquina |
| `src/agro.js` | Interpretação de solo (5ª Aproximação), calagem, gessagem, NPK, estimativa de safra com IC 95%, CUD, ETo Hargreaves, lâmina, plano do ciclo |
| `src/farm.js` | Geração das ruas a partir dos polígonos (varredura), plantas, gotejadores, rede de irrigação, inventário; leitura de GeoJSON/KML |
| `src/model.js` | Índices por rua, status do plano, colheita por rua, previsões, estande, fitossanidade |
| `src/scene.js` | Cena 3D (ruas instanciadas, plantas pé a pé, rede, ativos, máquinas, marcadores) |
| `src/sim.js` | GPS (simulação, importação GPX/CSV/NMEA, tempo real via `fazendaGPS.push`) e telemetria simulada |
| `src/reports.js` | 15 relatórios com exportação CSV e HTML |
| `src/ui.js`, `views.js`, `forms.js` | Interface |
| `src/store.js` | Persistência: banco compartilhado do Artifact ou navegador local |
| `src/demo.js` | Dados de exemplo (marcados, removíveis em Ajustes) |

## Montar

```bash
npm install
node build.mjs   # gera dist/fazenda-cafe-3d.html e dist/artifact.html
```

## Primeiros passos com dados reais

1. **Ajustes → Limites reais**: importar um KML (Google Earth) ou GeoJSON com um polígono por região.
2. **Ajustes → Regiões**: conferir espaçamento, ângulo das ruas, cultivar, ano de plantio, setores, gotejador.
3. **Ajustes → Dados**: ocultar os dados de exemplo.
4. Lançar as análises de solo, cadastrar as máquinas e começar as ordens de serviço.

## Pontos que dependem de dados da fazenda

- Os polígonos, posições de reservatório, casa de bombas e traçado da rede de demonstração são fictícios.
- A rede de irrigação é gerada por regra (derivação no meio da quadra, uma cruzeta por rua). Se o projeto
  hidráulico real for diferente, o ideal é importar o as-built (próxima etapa).
- Telemetria de bombas, relés e nível é simulada até a integração com o CLP/controlador.
- Tabelas de N, P₂O₅ e K₂O e os fatores frutos/litro e litros/saca são editáveis e devem ser calibrados
  com o agrônomo e o histórico da fazenda.
