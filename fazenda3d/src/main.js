// Ponto de entrada.
import { Store } from './store.js';
import { Model } from './model.js';
import { Sim } from './sim.js';
import { UI } from './ui.js';

const store = new Store();
const model = new Model(store);
const sim = new Sim(model);
const ui = new UI(store, model, sim);
window.__fazenda = { store, model, sim, ui };
try {
  ui.start();
} catch (e) {
  console.error(e);
  document.getElementById('root').innerHTML = `<p style="padding:24px">Não foi possível iniciar o 3D neste aparelho: ${String(e.message || e)}</p>`;
}
store.connect().catch((e) => console.error(e));
