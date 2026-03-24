/**
 * ============================================================
 * FINANZAPP PRO — financeService.js
 * Capa de servicio: Maneja todo el almacenamiento y CRUD
 * Usa localStorage para persistencia offline-first
 *
 * Para migrar a IndexedDB: reemplaza los métodos get/set de LS
 * por operaciones de Dexie.js o localforage manteniendo la misma API
 * ============================================================
 */

'use strict';

const FinanceService = (() => {

  // ─────────────────────────────────────────────
  // FIREBASE
  // ─────────────────────────────────────────────
  const db = firebase.firestore();

  const getUser = () => firebase.auth().currentUser;

  const isGuest = () => {
    const mode = localStorage.getItem('fp_user_mode');
    return mode === 'guest' || !getUser();
  };

  const getUID = () => {
    const user = getUser();
    if (user) return user.uid;
    return 'local_guest';
  };

  // ─────────────────────────────────────────────
  // CLAVES
  // ─────────────────────────────────────────────
  const KEYS = {
    TRANSACTIONS: 'transactions',
    CATEGORIES: 'categories',
    DEBTS: 'debts',
    SAVINGS: 'savings'
  };

  // ─────────────────────────────────────────────
  // LOCAL STORAGE (INVITADOS)
  // ─────────────────────────────────────────────
  const ls = {

    get(key){
      try{
        return JSON.parse(
          localStorage.getItem(`${getUID()}_${key}`)
        ) || [];
      }catch{
        return [];
      }
    },

    set(key,data){
      localStorage.setItem(
        `${getUID()}_${key}`,
        JSON.stringify(data)
      );
    }

  };

  // ─────────────────────────────────────────────
  // FIRESTORE
  // ─────────────────────────────────────────────
  const fs = {

    async get(key){

      if(isGuest()) return ls.get(key);

      const doc = await db
        .collection("users")
        .doc(getUID())
        .collection("finance")
        .doc(key)
        .get();

      if(!doc.exists) return [];

      return doc.data().items || [];
    },

    async set(key,data){

      if(isGuest()){
        ls.set(key,data);
        return;
      }

      await db
        .collection("users")
        .doc(getUID())
        .collection("finance")
        .doc(key)
        .set({
          items:data
        });

    }

  };

  // ─────────────────────────────────────────────
  // UTILIDADES
  // ─────────────────────────────────────────────
  const genId = () =>
    `fp_${Date.now()}_${Math.random().toString(36).slice(2,7)}`;

  const today = () =>
    new Date().toISOString().split('T')[0];

  const getDateMinus = (days)=>{
    const d = new Date();
    d.setDate(d.getDate()-days);
    return d.toISOString().split('T')[0];
  };

  // ─────────────────────────────────────────────
  // DATOS INICIALES
  // ─────────────────────────────────────────────

  const DEFAULT_CATEGORIES = [

    {id:genId(),name:"Salario",type:"income"},
    {id:genId(),name:"Freelance",type:"income"},
    {id:genId(),name:"Negocio",type:"income"},

    {id:genId(),name:"Vivienda",type:"expense"},
    {id:genId(),name:"Alimentación",type:"expense"},
    {id:genId(),name:"Transporte",type:"expense"},
    {id:genId(),name:"Entretenimiento",type:"expense"},
    {id:genId(),name:"Salud",type:"expense"},
    {id:genId(),name:"Educación",type:"expense"}

  ];

  const MOCK_DATA = {

    transactions:[
      {
        id:genId(),
        type:"income",
        description:"Salario mensual",
        amount:4500000,
        date:getDateMinus(0),
        category:"Salario"
      },
      {
        id:genId(),
        type:"income",
        description:"Proyecto freelance",
        amount:800000,
        date:getDateMinus(5),
        category:"Freelance"
      },
      {
        id:genId(),
        type:"expense",
        description:"Arriendo apartamento",
        amount:1200000,
        date:getDateMinus(2),
        category:"Vivienda"
      },
      {
        id:genId(),
        type:"expense",
        description:"Mercado semanal",
        amount:380000,
        date:getDateMinus(3),
        category:"Alimentación"
      }
    ],

    debts: [
      {
        id: genId(),
        creditor: 'Banco Principal',
        description: 'Crédito libre inversión',
        totalAmount: 8000000,
        interestRate: 2.5,
        startDate: getDateMinus(90),
        remainingBalance: 6800000,
        payments: [
          { id: genId(), date: getDateMinus(60), amount: 650000, interest: 210000, capital: 440000 },
          { id: genId(), date: getDateMinus(30), amount: 650000, interest: 199000, capital: 451000 }
        ]
      }
    ],

    savings: [
      {
        id: genId(),
        name: 'Fondo de Emergencias',
        description: '3 meses de gastos',
        goal: 5000000,
        currentBalance: 2200000,
        transactions: [
          { id: genId(), type:'deposit', amount: 1500000, date: getDateMinus(60), description:'Depósito inicial' }
        ]
      }
    ]

  };

  return {};

})();
  // ══════════════════════════════════════════════════════════
  //  INICIALIZACIÓN — Carga datos mock o migra si es primera vez
  // ══════════════════════════════════════════════════════════
  function initialize() {
    const uid = getUID();
    const mode = localStorage.getItem('fp_user_mode');
    
    // Si es invitado, SIEMPRE resetear a datos de demostración para que no guarde cambios
    if (mode === 'guest') {
      ls.set(KEYS.TRANSACTIONS, MOCK_DATA.transactions);
      ls.set(KEYS.DEBTS, MOCK_DATA.debts);
      ls.set(KEYS.SAVINGS, MOCK_DATA.savings);
      ls.setBool(KEYS.INITIALIZED, true);
      console.log('[FinanzApp] Modo Invitado: Datos de demostración restaurados.');
      return;
    }

    const isNewUser = !ls.getBool(KEYS.INITIALIZED);

    if (isNewUser) {
      // Intentar migrar desde el modo anterior (sin UID) si existe
      const oldInit = localStorage.getItem('fp_initialized') === 'true';
      if (oldInit && uid !== 'guest') {
        const oldTx = JSON.parse(localStorage.getItem('fp_transactions')) || [];
        const oldDebts = JSON.parse(localStorage.getItem('fp_debts')) || [];
        const oldSav = JSON.parse(localStorage.getItem('fp_savings')) || [];
        
        ls.set(KEYS.TRANSACTIONS, oldTx);
        ls.set(KEYS.DEBTS, oldDebts);
        ls.set(KEYS.SAVINGS, oldSav);
        ls.setBool(KEYS.INITIALIZED, true);
        console.log('[FinanzApp] Datos migrados de local a cuenta ✓');
      } else {
        // Carga mock inicial
        ls.set(KEYS.TRANSACTIONS, MOCK_DATA.transactions);
        ls.set(KEYS.DEBTS, MOCK_DATA.debts);
        ls.set(KEYS.SAVINGS, MOCK_DATA.savings);
        ls.setBool(KEYS.INITIALIZED, true);
        console.log('[FinanzApp] Datos de demostración cargados ✓');
      }
    }
  }

  // ══════════════════════════════════════════════════════════
  //  TRANSACCIONES
  // ══════════════════════════════════════════════════════════
  const Transactions = {
    getAll() { return ls.get(KEYS.TRANSACTIONS); },

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
        if (to   && t.date > to)   return false;
        return true;
      }).sort((a, b) => b.date.localeCompare(a.date));
    },

    add({ type, description, amount, date, category }) {
      // Validaciones
      if (!type || !['income','expense'].includes(type)) throw new Error('Tipo inválido');
      if (!description?.trim()) throw new Error('La descripción es obligatoria');
      if (!amount || isNaN(amount) || amount <= 0) throw new Error('El monto debe ser positivo');
      if (!date) throw new Error('La fecha es obligatoria');

      const tx = { id: genId(), type, description: description.trim(), amount: parseFloat(amount), date, category: category || 'Otro' };
      const all = this.getAll();
      all.push(tx);
      ls.set(KEYS.TRANSACTIONS, all);
      return tx;
    },

    update(id, changes) {
      const all = this.getAll();
      const idx = all.findIndex(t => t.id === id);
      if (idx === -1) throw new Error('Transacción no encontrada');
      if (changes.amount !== undefined && changes.amount <= 0) throw new Error('Monto inválido');
      all[idx] = { ...all[idx], ...changes };
      ls.set(KEYS.TRANSACTIONS, all);
      return all[idx];
    },

    delete(id) {
      const all = this.getAll().filter(t => t.id !== id);
      ls.set(KEYS.TRANSACTIONS, all);
    },

    /** Totales del mes actual */
    currentMonthTotals() {
      const now  = new Date();
      const txs  = this.getByMonth(now.getFullYear(), now.getMonth());
      const income  = txs.filter(t => t.type === 'income').reduce((s,t) => s + t.amount, 0);
      const expense = txs.filter(t => t.type === 'expense').reduce((s,t) => s + t.amount, 0);
      return { income, expense, net: income - expense };
    },

    /** Gastos por categoría del mes */
    expensesByCategory() {
      const now  = new Date();
      const txs  = this.getByMonth(now.getFullYear(), now.getMonth())
                       .filter(t => t.type === 'expense');
      const map  = {};
      txs.forEach(t => { map[t.category] = (map[t.category] || 0) + t.amount; });
      return map;
    },

    /** Flujo de caja últimos N meses */
    cashflowLastMonths(n = 6) {
      const result = [];
      const now = new Date();
      for (let i = n - 1; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const txs = this.getByMonth(d.getFullYear(), d.getMonth());
        const income  = txs.filter(t => t.type === 'income').reduce((s,t) => s + t.amount, 0);
        const expense = txs.filter(t => t.type === 'expense').reduce((s,t) => s + t.amount, 0);
        result.push({
          label: d.toLocaleString('es-CO', { month: 'short', year: '2-digit' }),
          income, expense
        });
      }
      return result;
    }
  };

  // ══════════════════════════════════════════════════════════
  //  DEUDAS
  // ══════════════════════════════════════════════════════════
  const Debts = {
    getAll() { return ls.get(KEYS.DEBTS); },

    getActive() { return this.getAll().filter(d => d.remainingBalance > 0); },

    add({ creditor, description, totalAmount, interestRate, startDate }) {
      if (!creditor?.trim()) throw new Error('El acreedor es obligatorio');
      if (!totalAmount || totalAmount <= 0) throw new Error('El monto debe ser positivo');

      const debt = {
        id: genId(),
        creditor: creditor.trim(),
        description: description?.trim() || '',
        totalAmount: parseFloat(totalAmount),
        interestRate: parseFloat(interestRate) || 0,
        startDate: startDate || today(),
        remainingBalance: parseFloat(totalAmount),
        payments: []
      };
      const all = this.getAll();
      all.push(debt);
      ls.set(KEYS.DEBTS, all);
      return debt;
    },

    delete(id) {
      ls.set(KEYS.DEBTS, this.getAll().filter(d => d.id !== id));
    },

    /**
     * LÓGICA CLAVE: Calcular distribución del abono
     * Interés = saldoPendiente × (tasaMensual / 100)
     * Capital = abono - interés
     * Nuevo saldo = saldoPendiente - capital
     */
    calculatePayment(debtId, paymentAmount) {
      const debt = this.getAll().find(d => d.id === debtId);
      if (!debt) throw new Error('Deuda no encontrada');
      if (paymentAmount <= 0) throw new Error('El abono debe ser positivo');

      const interestAmount = debt.remainingBalance * (debt.interestRate / 100);
      const capitalAmount  = Math.max(0, paymentAmount - interestAmount);
      const newBalance     = Math.max(0, debt.remainingBalance - capitalAmount);

      return {
        paymentAmount,
        interestAmount: Math.min(paymentAmount, interestAmount),
        capitalAmount,
        newBalance,
        interestPercent: paymentAmount > 0 ? Math.round((Math.min(paymentAmount, interestAmount) / paymentAmount) * 100) : 0,
        capitalPercent:  paymentAmount > 0 ? Math.round((capitalAmount / paymentAmount) * 100) : 0
      };
    },

    /** Registrar abono y actualizar saldo */
    registerPayment(debtId, paymentAmount, date) {
      const calc = this.calculatePayment(debtId, paymentAmount);
      const all  = this.getAll();
      const idx  = all.findIndex(d => d.id === debtId);
      if (idx === -1) throw new Error('Deuda no encontrada');

      const payment = {
        id: genId(),
        date: date || today(),
        amount: paymentAmount,
        interest: calc.interestAmount,
        capital: calc.capitalAmount
      };

      all[idx].payments.push(payment);
      all[idx].remainingBalance = calc.newBalance;
      ls.set(KEYS.DEBTS, all);
      return { debt: all[idx], payment, calc };
    },

    /** Totales de deudas */
    totals() {
      const active = this.getActive();
      const totalRemaining = active.reduce((s,d) => s + d.remainingBalance, 0);
      const totalInterest  = active.reduce((s,d) => s + d.remainingBalance * (d.interestRate / 100), 0);
      return { totalRemaining, totalInterest, count: active.length };
    }
  };

  // ══════════════════════════════════════════════════════════
  //  AHORROS
  // ══════════════════════════════════════════════════════════
  const Savings = {
    getAll() { return ls.get(KEYS.SAVINGS); },

    add({ name, description, goal, initialBalance }) {
      if (!name?.trim()) throw new Error('El nombre es obligatorio');

      const initial = parseFloat(initialBalance) || 0;
      const txs = initial > 0
        ? [{ id: genId(), type:'deposit', amount: initial, date: today(), description:'Saldo inicial' }]
        : [];

      const account = {
        id: genId(),
        name: name.trim(),
        description: description?.trim() || '',
        goal: parseFloat(goal) || 0,
        currentBalance: initial,
        transactions: txs
      };
      const all = this.getAll();
      all.push(account);
      ls.set(KEYS.SAVINGS, all);
      return account;
    },

    delete(id) {
      ls.set(KEYS.SAVINGS, this.getAll().filter(s => s.id !== id));
    },

    /** Depositar, retirar o usar fondos */
    addMovement(accountId, { type, amount, description, date }) {
      const all = this.getAll();
      const idx = all.findIndex(s => s.id === accountId);
      if (idx === -1) throw new Error('Cuenta no encontrada');

      amount = parseFloat(amount);
      if (!amount || amount <= 0) throw new Error('El monto debe ser positivo');
      if ((type === 'withdraw' || type === 'use') && amount > all[idx].currentBalance) {
        throw new Error('Saldo insuficiente');
      }

      const movement = {
        id: genId(),
        type,
        amount,
        description: description?.trim() || (type === 'deposit' ? 'Depósito a ahorro' : type === 'withdraw' ? 'Retiro de ahorro' : 'Gasto de ahorro'),
        date: date || today()
      };

      all[idx].transactions.push(movement);
      all[idx].currentBalance = type === 'deposit'
        ? all[idx].currentBalance + amount
        : all[idx].currentBalance - amount;

      ls.set(KEYS.SAVINGS, all);

      // NUEVA LÓGICA: Solo los RETIROS crean transacciones de egreso
      if (type === 'withdraw') {
        Transactions.add({
          type: 'expense',
          description: `Retiro de ahorro: ${all[idx].name}`,
          amount: amount,
          date: date || today(),
          category: 'Otro'
        });
      }

      return { account: all[idx], movement };
    },

    /** Total en todos los ahorros */
    totalSavings() {
      return this.getAll().reduce((s, a) => s + a.currentBalance, 0);
    }
  };

  // ══════════════════════════════════════════════════════════
  //  EXPORT / IMPORT (JSON)
  // ══════════════════════════════════════════════════════════
  function exportToJSON() {
    const data = {
      exportDate: new Date().toISOString(),
      version: '1.0',
      transactions: Transactions.getAll(),
      debts: Debts.getAll(),
      savings: Savings.getAll()
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = `finanzapp-backup-${today()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function importFromJSON(jsonData) {
    const data = JSON.parse(jsonData);
    if (data.transactions) ls.set(KEYS.TRANSACTIONS, data.transactions);
    if (data.debts)        ls.set(KEYS.DEBTS,        data.debts);
    if (data.savings)      ls.set(KEYS.SAVINGS,       data.savings);
    ls.setBool(KEYS.INITIALIZED, true);
  }

  function clearAll() {
    Object.values(KEYS).forEach(k => localStorage.removeItem(k));
  }

  // ── API PÚBLICA ────────────────────────────────────────────
  return {
    initialize,
    Transactions,
    Debts,
    Savings,
    exportToJSON,
    importFromJSON,
    clearAll,
    today
  };

;
