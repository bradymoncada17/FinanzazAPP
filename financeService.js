/**
 * ============================================================
 * FINANZAPP PRO — financeService.js
 * Capa de servicio: Maneja todo el almacenamiento y CRUD
 * Incluye sincronización con Firestore y GitHub Gist
 * ============================================================
 */

'use strict';

const FinanceService = (() => {
  // ─────────────────────────────────────────────
  // CONFIGURACIÓN
  // ─────────────────────────────────────────────
  const db = firebase ? firebase.firestore() : null;

  // ─────────────────────────────────────────────
  // UTILIDADES
  // ─────────────────────────────────────────────
  const genId = () => `fp_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  const today = () => new Date().toISOString().split('T')[0];
  const getDateMinus = (days) => {
    const d = new Date();
    d.setDate(d.getDate() - days);
    return d.toISOString().split('T')[0];
  };

  // ─────────────────────────────────────────────
  // CLAVES DE ALMACENAMIENTO
  // ─────────────────────────────────────────────
  const KEYS = {
    TX: 'transactions',
    DEBTS: 'debts',
    SAV: 'savings',
    TC: 'tarjetas',
    PT: 'prestamos',
    CLIENTS: 'clientes',
    CATS: 'categories',
    CONCEPTOS: 'conceptos',
    INITIALIZED: 'initialized',
    USER_MODE: 'fp_user_mode',
    USER_UID: 'fp_user_uid'
  };

  // ─────────────────────────────────────────────
  // HELPERS DE USUARIO
  // ─────────────────────────────────────────────
  const getUser = () => firebase && firebase.auth ? firebase.auth().currentUser : null;
  const isGuest = () => localStorage.getItem(KEYS.USER_MODE) === 'guest';
  const getUID = () => {
    const user = getUser();
    if (user) return user.uid;
    return 'local_' + (localStorage.getItem(KEYS.USER_UID) || 'guest');
  };
  const getKey = (key) => `${getUID()}_${key}`;

  // ─────────────────────────────────────────────
  // STORAGE (LOCAL + FIRESTORE)
  // ─────────────────────────────────────────────
  const ls = {
    get(key) {
      try {
        const data = localStorage.getItem(getKey(key));
        return data ? JSON.parse(data) : null;
      } catch {
        return null;
      }
    },
    set(key, data) {
      try {
        localStorage.setItem(getKey(key), JSON.stringify(data));
        this.queueSync(key);
      } catch (e) {
        console.error('Error guardando localStorage:', e);
      }
    },
    getArray(key) {
      const data = this.get(key);
      return Array.isArray(data) ? data : [];
    },
    queueSync(key) {
      if (this._syncTimeout) clearTimeout(this._syncTimeout);
      this._syncTimeout = setTimeout(() => this.syncToCloud(key), 2000);
    },
    async syncToCloud(key) {
      if (isGuest()) {
        await syncToGist();
        return;
      }
      const user = getUser();
      if (!user || !db) return;
      try {
        const data = this.get(key) || [];
        await db.collection('users').doc(user.uid).collection('finance').doc(key).set({
          items: data,
          updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        console.log(`[Sync] Guardado en Firestore: ${key}`);
      } catch (e) {
        console.error('[Sync] Error sincronizando a Firestore:', e);
      }
    }
  };

  // ─────────────────────────────────────────────
  // FIRESTORE (lectura)
  // ─────────────────────────────────────────────
  async function loadFromFirestore() {
    const user = getUser();
    if (!user || !db || isGuest()) return;
    try {
      const doc = await db.collection('users').doc(user.uid).collection('finance').doc('all').get();
      if (doc.exists && doc.data()) {
        const data = doc.data();
        Object.keys(KEYS).forEach(key => {
          if (data[key] && Array.isArray(data[key])) {
            ls.set(key, data[key]);
          }
        });
        console.log('[Sync] Datos cargados desde Firestore');
      }
    } catch (e) {
      console.error('[Sync] Error cargando desde Firestore:', e);
    }
  }

  // ─────────────────────────────────────────────
  // GITHUB GIST SYNC
  // ─────────────────────────────────────────────
  const GIST_TOKEN_KEY = 'fp_gist_token';
  const GIST_ID_KEY = 'fp_gist_id';

  function getGistToken() { return localStorage.getItem(GIST_TOKEN_KEY) || ''; }
  function getGistId() { return localStorage.getItem(GIST_ID_KEY) || ''; }

  async function syncToGist() {
    const token = getGistToken();
    if (!token) return;
    try {
      const data = {
        updated: new Date().toISOString(),
        transactions: ls.getArray(KEYS.TX),
        debts: ls.getArray(KEYS.DEBTS),
        savings: ls.getArray(KEYS.SAV),
        tarjetas: ls.getArray(KEYS.TC),
        prestamos: ls.getArray(KEYS.PT),
        clientes: ls.getArray(KEYS.CLIENTS),
        categories: ls.get(KEYS.CATS) || [],
        conceptos: ls.get(KEYS.CONCEPTOS) || {}
      };
      const gistId = getGistId();
      const content = JSON.stringify(data, null, 2);
      const filename = 'finanzapp-data.json';

      let url, method;
      if (gistId) {
        // Actualizar gist existente
        const res = await fetch(`https://api.github.com/gists/${gistId}`, {
          headers: { 'Authorization': `Bearer ${token}`, 'Accept': 'application/vnd.github+json' }
        });
        const gist = await res.json();
        const file = gist.files[filename];
        const sha = file?.raw_url ? await fetch(file.raw_url).then(r => r.text()).then(() => file.sha) : null;
        
        url = `https://api.github.com/gists/${gistId}`;
        method = 'PATCH';
        const body = {
          description: 'FinanzApp Pro - Backup de datos',
          files: {
            [filename]: { content, sha }
          }
        };
        await fetch(url, {
          method,
          headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify(body)
        });
      } else {
        // Crear nuevo gist
        url = 'https://api.github.com/gists';
        method = 'POST';
        const body = {
          description: 'FinanzApp Pro - Backup de datos',
          public: false,
          files: {
            [filename]: { content }
          }
        };
        const res = await fetch(url, {
          method,
          headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify(body)
        });
        const gist = await res.json();
        if (gist.id) {
          localStorage.setItem(GIST_ID_KEY, gist.id);
        }
      }
      console.log('[Gist] Backup guardado exitosamente');
      return true;
    } catch (e) {
      console.error('[Gist] Error guardando:', e);
      return false;
    }
  }

  async function loadFromGist() {
    const token = getGistToken();
    const gistId = getGistId();
    if (!token || !gistId) return false;
    try {
      const res = await fetch(`https://api.github.com/gists/${gistId}`, {
        headers: { 'Authorization': `Bearer ${token}`, 'Accept': 'application/vnd.github+json' }
      });
      if (!res.ok) throw new Error('Gist no encontrado');
      const gist = await res.json();
      const file = gist.files['finanzapp-data.json'];
      if (!file) throw new Error('Archivo de datos no encontrado');
      const rawUrl = file.raw_url;
      const dataRes = await fetch(rawUrl);
      const data = await dataRes.json();
      if (data.transactions) ls.set(KEYS.TX, data.transactions);
      if (data.debts) ls.set(KEYS.DEBTS, data.debts);
      if (data.savings) ls.set(KEYS.SAV, data.savings);
      if (data.tarjetas) ls.set(KEYS.TC, data.tarjetas);
      if (data.prestamos) ls.set(KEYS.PT, data.prestamos);
      if (data.clientes) ls.set(KEYS.CLIENTS, data.clientes);
      if (data.categories) ls.set(KEYS.CATS, data.categories);
      if (data.conceptos) ls.set(KEYS.CONCEPTOS, data.conceptos);
      console.log('[Gist] Datos cargados desde Gist');
      return true;
    } catch (e) {
      console.error('[Gist] Error cargando:', e);
      return false;
    }
  }

  // ─────────────────────────────────────────────
  // DATOS INICIALES
  // ─────────────────────────────────────────────
  const MOCK_DATA = {
    transactions: [
      { id: genId(), type: 'income', description: 'Salario mensual', amount: 4500000, date: getDateMinus(0), category: 'Salario' },
      { id: genId(), type: 'income', description: 'Proyecto freelance', amount: 800000, date: getDateMinus(5), category: 'Freelance' },
      { id: genId(), type: 'expense', description: 'Arriendo apartamento', amount: 1200000, date: getDateMinus(2), category: 'Vivienda' },
      { id: genId(), type: 'expense', description: 'Mercado semanal', amount: 380000, date: getDateMinus(3), category: 'Alimentación' }
    ],
    debts: [
      {
        id: genId(), creditor: 'Cooperativa Financiera', description: 'Crédito libre inversión',
        debtType: 'efectivo', totalAmount: 13000000, interestRate: 2.1, months: 48, cuota: 440990,
        hasSeguro: false, hasAporte: true, aporteBase: 13103,
        startDate: getDateMinus(90), remainingBalance: 11800000, gastado: 0,
        payments: [
          { id: genId(), date: getDateMinus(60), amount: 440990, interest: 298000, capital: 142990, aporte: 13103, source: 'libre' },
          { id: genId(), date: getDateMinus(30), amount: 440990, interest: 294995, capital: 145995, aporte: 13103, source: 'libre' }
        ]
      }
    ],
    savings: [
      { id: genId(), name: 'Fondo de Emergencias', description: '3 meses de gastos', goal: 5000000, currentBalance: 2200000, transactions: [] },
      { id: genId(), name: 'Vacaciones', description: 'Viaje planeado', goal: 3000000, currentBalance: 850000, transactions: [] }
    ],
    tarjetas: [],
    prestamos: [],
    clientes: []
  };

  // ─────────────────────────────────────────────
  // INICIALIZACIÓN
  // ─────────────────────────────────────────────
  function initialize() {
    const initialized = localStorage.getItem(getKey(KEYS.INITIALIZED));
    if (initialized === 'true') return;

    Object.keys(KEYS).forEach(key => {
      if (key === 'INITIALIZED' || key === 'USER_MODE' || key === 'USER_UID') return;
      const data = MOCK_DATA[key];
      if (data) ls.set(key, data);
    });

    localStorage.setItem(getKey(KEYS.INITIALIZED), 'true');
    console.log('[FinanceService] Datos inicializados');
  }

  // ─────────────────────────────────────────────
  // TRANSACCIONES
  // ─────────────────────────────────────────────
  const Transactions = {
    getAll() { return ls.getArray(KEYS.TX); },
    getByMonth(year, month) {
      return this.getAll().filter(t => {
        const d = new Date(t.date + 'T12:00:00');
        return d.getFullYear() === year && d.getMonth() === month;
      });
    },
    getFiltered({ type = '', category = '', from = '', to = '' } = {}) {
      return this.getAll().filter(t => {
        if (type && t.type !== type) return false;
        if (category && t.category !== category) return false;
        if (from && t.date < from) return false;
        if (to && t.date > to) return false;
        return true;
      }).sort((a, b) => b.date.localeCompare(a.date));
    },
    add(data) {
      const tx = { id: genId(), ...data, date: data.date || today() };
      const all = this.getAll();
      all.push(tx);
      ls.set(KEYS.TX, all);
      return tx;
    },
    update(id, changes) {
      const all = this.getAll();
      const idx = all.findIndex(t => t.id === id);
      if (idx === -1) throw new Error('Transacción no encontrada');
      all[idx] = { ...all[idx], ...changes };
      ls.set(KEYS.TX, all);
      return all[idx];
    },
    delete(id) {
      ls.set(KEYS.TX, this.getAll().filter(t => t.id !== id));
    },
    currentMonthTotals() {
      const now = new Date();
      const txs = this.getByMonth(now.getFullYear(), now.getMonth());
      const income = txs.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0);
      const expense = txs.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
      return { income, expense, net: income - expense };
    },
    expensesByCategory() {
      const now = new Date();
      const txs = this.getByMonth(now.getFullYear(), now.getMonth()).filter(t => t.type === 'expense');
      const map = {};
      txs.forEach(t => { map[t.category] = (map[t.category] || 0) + t.amount; });
      return map;
    }
  };

  // ─────────────────────────────────────────────
  // DEUDAS
  // ─────────────────────────────────────────────
  const Debts = {
    getAll() { return ls.getArray(KEYS.DEBTS); },
    getActive() { return this.getAll().filter(d => d.remainingBalance > 0); },
    add(data) {
      const debt = {
        id: genId(),
        creditor: data.creditor,
        description: data.description || '',
        debtType: data.debtType || 'efectivo',
        totalAmount: parseFloat(data.totalAmount),
        interestRate: parseFloat(data.interestRate) || 0,
        months: parseInt(data.months) || 12,
        cuota: data.cuota || 0,
        hasSeguro: data.hasSeguro || false,
        seguroBase: parseFloat(data.seguroBase) || 0,
        seguroAjustes: [],
        hasAporte: data.hasAporte || false,
        aporteBase: parseFloat(data.aporteBase) || 0,
        aporteAjustes: [],
        startDate: data.startDate || today(),
        remainingBalance: parseFloat(data.totalAmount),
        gastado: data.gastado || 0,
        payments: []
      };
      const all = this.getAll();
      all.push(debt);
      ls.set(KEYS.DEBTS, all);
      return debt;
    },
    update(id, changes) {
      const all = this.getAll();
      const idx = all.findIndex(d => d.id === id);
      if (idx === -1) throw new Error('Deuda no encontrada');
      all[idx] = { ...all[idx], ...changes };
      ls.set(KEYS.DEBTS, all);
      return all[idx];
    },
    delete(id) {
      ls.set(KEYS.DEBTS, this.getAll().filter(d => d.id !== id));
    },
    addPayment(debtId, payment) {
      const all = this.getAll();
      const idx = all.findIndex(d => d.id === debtId);
      if (idx === -1) throw new Error('Deuda no encontrada');
      all[idx].payments = all[idx].payments || [];
      all[idx].payments.push({ id: genId(), ...payment });
      all[idx].remainingBalance = Math.max(0, all[idx].remainingBalance - (payment.capital || 0));
      ls.set(KEYS.DEBTS, all);
      return all[idx];
    },
    deletePayment(debtId, paymentId) {
      const all = this.getAll();
      const idx = all.findIndex(d => d.id === debtId);
      if (idx === -1) return;
      const payment = all[idx].payments.find(p => p.id === paymentId);
      if (payment) {
        all[idx].remainingBalance += payment.capital || 0;
        all[idx].payments = all[idx].payments.filter(p => p.id !== paymentId);
      }
      ls.set(KEYS.DEBTS, all);
    },
    totals() {
      const active = this.getActive();
      return {
        totalRemaining: active.reduce((s, d) => s + d.remainingBalance, 0),
        count: active.length
      };
    }
  };

  // ─────────────────────────────────────────────
  // TARJETAS DE CRÉDITO
  // ─────────────────────────────────────────────
  const Tarjetas = {
    getAll() { return ls.getArray(KEYS.TC); },
    getById(id) { return this.getAll().find(t => t.id === id); },
    add(data) {
      const tarjeta = {
        id: genId(),
        nombre: data.nombre,
        franquicia: data.franquicia || 'otro',
        cupoAprobado: parseFloat(data.cupoAprobado),
        cupoUsado: parseFloat(data.cupoUsado) || 0,
        tasa: parseFloat(data.tasa) || 0,
        diaCorte: parseInt(data.diaCorte) || 0,
        diaPago: parseInt(data.diaPago) || 0,
        descripcion: data.descripcion || '',
        fechaInicio: data.fechaInicio || '',
        movements: []
      };
      const all = this.getAll();
      all.push(tarjeta);
      ls.set(KEYS.TC, all);
      return tarjeta;
    },
    update(id, changes) {
      const all = this.getAll();
      const idx = all.findIndex(t => t.id === id);
      if (idx === -1) throw new Error('Tarjeta no encontrada');
      all[idx] = { ...all[idx], ...changes };
      ls.set(KEYS.TC, all);
      return all[idx];
    },
    delete(id) {
      ls.set(KEYS.TC, this.getAll().filter(t => t.id !== id));
    },
    addMovement(tarjetaId, movement) {
      const all = this.getAll();
      const idx = all.findIndex(t => t.id === tarjetaId);
      if (idx === -1) throw new Error('Tarjeta no encontrada');
      all[idx].movements = all[idx].movements || [];
      all[idx].movements.push({ id: genId(), ...movement });
      ls.set(KEYS.TC, all);
      return all[idx];
    },
    getCupoDisponible(tarjeta) {
      return Math.max(0, (tarjeta.cupoAprobado || 0) - (tarjeta.cupoUsado || 0));
    },
    getTotalCupo() {
      return this.getAll().reduce((s, t) => s + (t.cupoAprobado || 0), 0);
    },
    getTotalUsado() {
      return this.getAll().reduce((s, t) => s + (t.cupoUsado || 0), 0);
    }
  };

  // ─────────────────────────────────────────────
  // PRÉSTAMOS
  // ─────────────────────────────────────────────
  const Prestamos = {
    getAll() { return ls.getArray(KEYS.PT); },
    getById(id) { return this.getAll().find(p => p.id === id); },
    add(data) {
      const prestamo = {
        id: genId(),
        clienteId: data.clienteId,
        monto: parseFloat(data.monto),
        tasa: parseFloat(data.tasa) || 0,
        cuotas: parseInt(data.cuotas) || 1,
        frecuencia: data.frecuencia || 'mensual',
        fecha: data.fecha || today(),
        descripcion: data.descripcion || '',
        payments: [],
        totalPagado: 0
      };
      const all = this.getAll();
      all.push(prestamo);
      ls.set(KEYS.PT, all);
      return prestamo;
    },
    update(id, changes) {
      const all = this.getAll();
      const idx = all.findIndex(p => p.id === id);
      if (idx === -1) throw new Error('Préstamo no encontrado');
      all[idx] = { ...all[idx], ...changes };
      ls.set(KEYS.PT, all);
      return all[idx];
    },
    delete(id) {
      ls.set(KEYS.PT, this.getAll().filter(p => p.id !== id));
    },
    addPayment(prestamoId, payment) {
      const all = this.getAll();
      const idx = all.findIndex(p => p.id === prestamoId);
      if (idx === -1) throw new Error('Préstamo no encontrado');
      all[idx].payments = all[idx].payments || [];
      all[idx].payments.push({ id: genId(), ...payment });
      all[idx].totalPagado = (all[idx].totalPagado || 0) + parseFloat(payment.amount);
      ls.set(KEYS.PT, all);
      return all[idx];
    },
    deletePayment(prestamoId, paymentId) {
      const all = this.getAll();
      const idx = all.findIndex(p => p.id === prestamoId);
      if (idx === -1) return;
      const payment = all[idx].payments.find(p => p.id === paymentId);
      if (payment) {
        all[idx].totalPagado -= parseFloat(payment.amount);
        all[idx].payments = all[idx].payments.filter(p => p.id !== paymentId);
      }
      ls.set(KEYS.PT, all);
    },
    getPendiente(prestamo) {
      return Math.max(0, prestamo.monto - (prestamo.totalPagado || 0));
    },
    getTotalPrestado() {
      return this.getAll().reduce((s, p) => s + p.monto, 0);
    },
    getTotalCobrado() {
      return this.getAll().reduce((s, p) => s + (p.totalPagado || 0), 0);
    },
    getTotalPendiente() {
      return this.getAll().reduce((s, p) => s + this.getPendiente(p), 0);
    }
  };

  // ─────────────────────────────────────────────
  // CLIENTES
  // ─────────────────────────────────────────────
  const Clientes = {
    getAll() { return ls.getArray(KEYS.CLIENTS); },
    getById(id) { return this.getAll().find(c => c.id === id); },
    add(data) {
      const cliente = {
        id: genId(),
        nombre: data.nombre,
        telefono: data.telefono || '',
        email: data.email || '',
        documento: data.documento || '',
        direccion: data.direccion || '',
        notas: data.notas || '',
        fechaCreacion: today()
      };
      const all = this.getAll();
      all.push(cliente);
      ls.set(KEYS.CLIENTS, all);
      return cliente;
    },
    update(id, changes) {
      const all = this.getAll();
      const idx = all.findIndex(c => c.id === id);
      if (idx === -1) throw new Error('Cliente no encontrado');
      all[idx] = { ...all[idx], ...changes };
      ls.set(KEYS.CLIENTS, all);
      return all[idx];
    },
    delete(id) {
      ls.set(KEYS.CLIENTS, this.getAll().filter(c => c.id !== id));
    },
    getPrestamos(clienteId) {
      return Prestamos.getAll().filter(p => p.clienteId === clienteId);
    }
  };

  // ─────────────────────────────────────────────
  // AHORROS
  // ─────────────────────────────────────────────
  const Savings = {
    getAll() { return ls.getArray(KEYS.SAV); },
    getById(id) { return this.getAll().find(s => s.id === id); },
    add(data) {
      const initial = parseFloat(data.initialBalance) || 0;
      const txs = initial > 0 ? [{ id: genId(), type: 'deposit', amount: initial, date: today(), description: 'Saldo inicial' }] : [];
      const account = {
        id: genId(),
        name: data.name,
        description: data.description || '',
        goal: parseFloat(data.goal) || 0,
        currentBalance: initial,
        transactions: txs
      };
      const all = this.getAll();
      all.push(account);
      ls.set(KEYS.SAV, all);
      return account;
    },
    update(id, changes) {
      const all = this.getAll();
      const idx = all.findIndex(s => s.id === id);
      if (idx === -1) throw new Error('Cuenta no encontrada');
      all[idx] = { ...all[idx], ...changes };
      ls.set(KEYS.SAV, all);
      return all[idx];
    },
    delete(id) {
      ls.set(KEYS.SAV, this.getAll().filter(s => s.id !== id));
    },
    addMovement(accountId, movement) {
      const all = this.getAll();
      const idx = all.findIndex(s => s.id === accountId);
      if (idx === -1) throw new Error('Cuenta no encontrada');
      all[idx].transactions = all[idx].transactions || [];
      all[idx].transactions.push({ id: genId(), ...movement });
      if (movement.type === 'deposit') {
        all[idx].currentBalance += parseFloat(movement.amount);
      } else {
        all[idx].currentBalance -= parseFloat(movement.amount);
      }
      ls.set(KEYS.SAV, all);
      return all[idx];
    },
    totalSavings() {
      return this.getAll().reduce((s, a) => s + a.currentBalance, 0);
    }
  };

  // ─────────────────────────────────────────────
  // CATEGORÍAS
  // ─────────────────────────────────────────────
  const Categories = {
    getAll() { return ls.get(KEYS.CATS) || []; },
    add(data) {
      const cat = { id: genId(), name: data.name, color: data.color || '#3b82f6', concepts: data.concepts || [] };
      const all = this.getAll();
      all.push(cat);
      ls.set(KEYS.CATS, all);
      return cat;
    },
    update(id, changes) {
      const all = this.getAll();
      const idx = all.findIndex(c => c.id === id);
      if (idx === -1) throw new Error('Categoría no encontrada');
      all[idx] = { ...all[idx], ...changes };
      ls.set(KEYS.CATS, all);
      return all[idx];
    },
    delete(id) {
      ls.set(KEYS.CATS, this.getAll().filter(c => c.id !== id));
    },
    addConcept(catId, concepto) {
      const all = this.getAll();
      const idx = all.findIndex(c => c.id === catId);
      if (idx === -1) return;
      all[idx].concepts = all[idx].concepts || [];
      if (!all[idx].concepts.includes(concepto)) {
        all[idx].concepts.push(concepto);
        ls.set(KEYS.CATS, all);
      }
    },
    removeConcept(catId, concepto) {
      const all = this.getAll();
      const idx = all.findIndex(c => c.id === catId);
      if (idx === -1) return;
      all[idx].concepts = (all[idx].concepts || []).filter(c => c !== concepto);
      ls.set(KEYS.CATS, all);
    }
  };

  // ─────────────────────────────────────────────
  // EXPORT / IMPORT
  // ─────────────────────────────────────────────
  function exportToJSON() {
    const data = {
      exportDate: new Date().toISOString(),
      version: '1.0',
      transactions: Transactions.getAll(),
      debts: Debts.getAll(),
      savings: Savings.getAll(),
      tarjetas: Tarjetas.getAll(),
      prestamos: Prestamos.getAll(),
      clientes: Clientes.getAll(),
      categories: Categories.getAll()
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `finanzapp-backup-${today()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function importFromJSON(jsonData) {
    try {
      const data = JSON.parse(jsonData);
      if (data.transactions) ls.set(KEYS.TX, data.transactions);
      if (data.debts) ls.set(KEYS.DEBTS, data.debts);
      if (data.savings) ls.set(KEYS.SAV, data.savings);
      if (data.tarjetas) ls.set(KEYS.TC, data.tarjetas);
      if (data.prestamos) ls.set(KEYS.PT, data.prestamos);
      if (data.clientes) ls.set(KEYS.CLIENTS, data.clientes);
      if (data.categories) ls.set(KEYS.CATS, data.categories);
      localStorage.setItem(getKey(KEYS.INITIALIZED), 'true');
      return true;
    } catch (e) {
      console.error('Error importando datos:', e);
      return false;
    }
  }

  function clearAll() {
    Object.values(KEYS).forEach(k => {
      localStorage.removeItem(getKey(k));
    });
  }

  // ─────────────────────────────────────────────
  // API PÚBLICA
  // ─────────────────────────────────────────────
  return {
    initialize,
    Transactions,
    Debts,
    Tarjetas,
    Prestamos,
    Clientes,
    Savings,
    Categories,
    exportToJSON,
    importFromJSON,
    clearAll,
    syncToGist,
    loadFromGist,
    loadFromFirestore,
    today,
    genId
  };
})();
