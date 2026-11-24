// Persistência: banco compartilhado do Artifact (quando disponível) ou
// armazenamento local do navegador. Mesma interface nos dois casos.
// Dados de demonstração ficam só em memória e nunca são gravados.

export const COLECOES = ['config', 'os', 'solo', 'contagens', 'colheita', 'lotes', 'manut', 'ativos', 'plantas', 'equip', 'safras', 'fotos', 'checklists'];
const LS = 'fz3d:';

export class Store extends EventTarget {
  constructor() {
    super();
    this.data = {};
    this.demo = {};
    for (const c of COLECOES) { this.data[c] = new Map(); this.demo[c] = new Map(); }
    this.mode = 'local';
    this.db = null;
    this.erro = null;
    this.readOnly = false;
    this.pendentes = this.lerPendentes();
    if (typeof window !== 'undefined') window.addEventListener('online', () => this.sincronizar());
  }

  // Fila de envio: registros feitos sem sinal ficam no aparelho e sobem quando a conexão volta
  lerPendentes() { try { return JSON.parse(localStorage.getItem(LS + 'pendentes') || '[]'); } catch { return []; } }
  salvarPendentes() { try { localStorage.setItem(LS + 'pendentes', JSON.stringify(this.pendentes)); } catch { /* sem armazenamento */ } }
  enfileirar(op) { this.pendentes = this.pendentes.filter((p) => !(p.c === op.c && p.id === op.id)); this.pendentes.push(op); this.salvarPendentes(); this.emit('*'); }
  async sincronizar() {
    if (!this.db || !this.pendentes.length) return { enviados: 0, restantes: this.pendentes.length };
    let ok = 0;
    for (const op of [...this.pendentes]) {
      try {
        if (op.del) await this.db.collection(op.c).doc(op.id).delete();
        else await this.db.collection(op.c).doc(op.id).set(op.doc);
        this.pendentes = this.pendentes.filter((p) => p !== op);
        ok++;
      } catch { break; }
    }
    this.salvarPendentes();
    this.emit('*');
    return { enviados: ok, restantes: this.pendentes.length };
  }

  emit(col) { this.dispatchEvent(new CustomEvent('change', { detail: { col } })); }

  async connect() {
    const hasClaude = typeof window !== 'undefined' && window.claude && typeof window.claude.use === 'function';
    if (hasClaude) {
      this.mode = 'conectando';
      this.emit('*');
      let db = null;
      try { db = await window.claude.use('db'); } catch { db = null; }
      if (db) {
        this.db = db;
        this.mode = 'compartilhado';
        this.subscribeAll();
        this.emit('*');
        return;
      }
    }
    this.loadLocal();
    this.mode = 'local';
    this.emit('*');
  }

  subscribeAll() {
    let pend = COLECOES.length;
    const timer = setTimeout(() => { if (pend > 0) { this.erro = 'Banco compartilhado sem resposta. Os dados podem estar desatualizados.'; this.emit('*'); } }, 10000);
    for (const c of COLECOES) {
      let first = true;
      this.db.collection(c).onSnapshot((snap) => {
        const m = new Map();
        for (const d of snap.docs) m.set(d.id, { ...d.data(), id: d.id });
        this.data[c] = m;
        if (first && !snap.metadata.fromCache) { first = false; pend--; if (pend === 0) { clearTimeout(timer); this.erro = null; } }
        this.emit(c);
      }, (e) => {
        this.erro = `Falha ao ler ${c}: ${e.code}`;
        if (e.code === 'revoked') this.readOnly = true;
        this.emit(c);
      });
    }
  }

  loadLocal() {
    for (const c of COLECOES) {
      try {
        const raw = localStorage.getItem(LS + c);
        if (raw) for (const o of JSON.parse(raw)) this.data[c].set(o.id, o);
      } catch { /* armazenamento indisponível */ }
    }
  }
  saveLocal(c) {
    try { localStorage.setItem(LS + c, JSON.stringify([...this.data[c].values()])); }
    catch { this.erro = 'Não foi possível salvar neste navegador (armazenamento cheio ou bloqueado).'; }
  }

  demoOn() {
    const cfg = this.data.config.get('main');
    return !(cfg && cfg.demoOff);
  }

  setDemo(col, arr) {
    this.demo[col] = new Map(arr.map((o) => [o.id, { ...o, demo: true }]));
  }

  get(c, id) {
    return this.data[c].get(id) || (this.demoOn() ? this.demo[c].get(id) : undefined);
  }

  all(c) {
    const out = [...this.data[c].values()];
    if (this.demoOn()) for (const [id, o] of this.demo[c]) if (!this.data[c].has(id)) out.push(o);
    return out;
  }

  async put(c, obj) {
    if (!obj.id) throw new Error('documento sem id');
    const clean = JSON.parse(JSON.stringify({ ...obj, demo: undefined }));
    clean.atualizadoEm = new Date().toISOString();
    this.data[c].set(clean.id, clean);
    this.emit(c);
    if (this.db) {
      if (typeof navigator !== 'undefined' && navigator.onLine === false) { this.enfileirar({ c, id: clean.id, doc: clean }); return clean; }
      try { await this.db.collection(c).doc(clean.id).set(clean); }
      catch (e) {
        if (e && (e.code === 'unavailable' || e.code === 'resource_exhausted')) { this.enfileirar({ c, id: clean.id, doc: clean }); return clean; }
        if (e && e.code === 'invalid_argument') this.readOnly = true;
        this.erro = `Não foi salvo (${e && e.code ? e.code : 'erro'}).`;
        this.emit(c);
        throw e;
      }
    } else this.saveLocal(c);
    return clean;
  }

  async del(c, id) {
    this.data[c].delete(id);
    this.emit(c);
    if (this.db) {
      try { await this.db.collection(c).doc(id).delete(); } catch (e) { this.erro = `Não foi excluído (${e.code || 'erro'}).`; this.emit(c); }
    } else this.saveLocal(c);
  }

  config() { return this.data.config.get('main') || { id: 'main' }; }
  async setConfig(patch) {
    const cur = this.config();
    return this.put('config', { ...cur, ...patch, id: 'main' });
  }

  exportAll() {
    const out = { versao: 1, exportadoEm: new Date().toISOString() };
    for (const c of COLECOES) out[c] = [...this.data[c].values()];
    return out;
  }
  async importAll(obj) {
    for (const c of COLECOES) {
      if (!Array.isArray(obj[c])) continue;
      for (const o of obj[c]) if (o && o.id) await this.put(c, o);
    }
  }
}
