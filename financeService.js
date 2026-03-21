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

  // ── CLAVES DE ALMACENAMIENTO ──────────────────────────────
  const KEYS = {
    TRANSACTIONS:   'fp_transactions',
    DEBTS:          'fp_debts',
    SAVINGS:        'fp_savings',
    INITIALIZED:    'fp_initialized'
  };

  // ── HELPERS LOCALSTORAGE ──────────────────────────────────
  const ls = {
    get: (key) => {
      try { return JSON.parse(localStorage.getItem(key)) || []; }
      catch { return []; }
    },
    set: (key, data) => {
      try { localStorage.setItem(key, JSON.stringify(data)); return true; }
      catch { console.error('Error guardando en localStorage:', key); return false; }
    },
    getBool: (key) => localStorage.getItem(key) === 'true',
    setBool: (key, val) => localStorage.setItem(key, String(val))
  };

  // ── GENERADOR DE IDs ──────────────────────────────────────
  const genId = () => `fp_${Date.now()}_${Math.random().toString(36).slice(2,7)}`;

  // ── FECHA HOY ─────────────────────────────────────────────
  const today = () => new Date().toISOString().split('T')[0];

  // ══════════════════════════════════════════════════════════
  //  DATOS MOCK INICIALES (para demo)
  // ══════════════════════════════════════════════════════════
  const MOCK_DATA = {
    transactions: [
      // Ingresos
      { id: genId(), type:'income', description:'Salario mensual', amount:4500000, date: getDateMinus(0), category:'Salario' },
      { id: genId(), type:'income', description:'Proyecto freelance', amount:800000, date: getDateMinus(5), category:'Freelance' },
      { id: genId(), type:'income', description:'Salario anterior', amount:4500000, date: getDateMinus(35), category:'Salario' },
      { id: genId(), type:'income', description:'Venta usados', amount:250000, date: getDateMinus(40), category:'Negocio' },
      { id: genId(), type:'income', description:'Bono rendimiento', amount:500000, date: getDateMinus(60), category:'Salario' },
      // Egresos
      { id: genId(), type:'expense', description:'Arriendo apartamento', amount:1200000, date: getDateMinus(2), category:'Vivienda' },
      { id: genId(), type:'expense', description:'Mercado semanal', amount:380000, date: getDateMinus(3), category:'Alimentación' },
      { id: genId(), type:'expense', description:'Servicios públicos', amount:180000, date: getDateMinus(4), category:'Servicios' },
      { id: genId(), type:'expense', description:'Gasolina', amount:120000, date: getDateMinus(6), category:'Transporte' },
      { id: genId(), type:'expense', description:'Cine + cena', amount:95000, date: getDateMinus(8), category:'Entretenimiento' },
      { id: genId(), type:'expense', description:'Médico general', amount:60000, date: getDateMinus(10), category:'Salud' },
      { id: genId(), type:'expense', description:'Curso online', amount:150000, date: getDateMinus(12), category:'Educación' },
      { id: genId(), type:'expense', description:'Mercado semanal', amount:340000, date: getDateMinus(38), category:'Alimentación' },
      { id: genId(), type:'expense', description:'Arriendo', amount:1200000, date: getDateMinus(36), category:'Vivienda' },
      { id: genId(), type:'expense', description:'Ropa', amount:220000, date: getDateMinus(45), category:'Entretenimiento' },
      { id: genId(), type:'expense', description:'Suscripciones streaming', amount:75000, date: getDateMinus(65), category:'Entretenimiento' },
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
          { id: genId(), date: getDateMinus(30), amount: 650000, interest: 199000, capital: 451000 },
        ]
      },
      {
        id: genId(),
        creditor: 'Préstamo Familiar',
        description: 'Prestado para el carro',
        totalAmount: 3000000,
        interestRate: 0,
        startDate: getDateMinus(45),
        remainingBalance: 2000000,
        payments: [
          { id: genId(), date: getDateMinus(15), amount: 1000000, interest: 0, capital: 1000000 }
        ]
      },
      {
        id: genId(),
        creditor: 'Tarjeta Crédito',
        description: 'Compras por cuotas',
        totalAmount: 1500000,
        interestRate: 3.2,
        startDate: getDateMinus(20),
        remainingBalance: 1380000,
        payments: [
          { id: genId(), date: getDateMinus(5), amount: 200000, interest: 52800, capital: 147200 }
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
          { id: genId(), type:'deposit', amount: 1500000, date: getDateMinus(60), description:'Depósito inicial' },
          { id: genId(), type:'deposit', amount: 500000,  date: getDateMinus(30), description:'Ahorro mensual' },
          { id: genId(), type:'deposit', amount: 200000,  date: getDateMinus(5),  description:'Extra mes' }
        ]
      },
      {
        id: genId(),
        name: 'Vacaciones 2025',
        description: 'Viaje a Cartagena en diciembre',
        goal: 3000000,
        currentBalance: 850000,
        transactions: [
          { id: genId(), type:'deposit', amount: 500000, date: getDateMinus(45), description:'Inicio fondo' },
          { id: genId(), type:'deposit', amount: 350000, date: getDateMinus(10), description:'Ahorro quincenal' }
        ]
      },
      {
        id: genId(),
        name: 'Nuevo Portátil',
        description: 'MacBook Pro',
        goal: 8000000,
        currentBalance: 1200000,
        transactions: [
          { id: genId(), type:'deposit', amount: 800000, date: getDateMinus(70), description:'Depósito inicial' },
          { id: genId(), type:'deposit', amount: 500000, date: getDateMinus(35), description:'Ahorro' },
          { id: genId(), type:'use',     amount: 100000, date: getDateMinus(20), description:'Accesorio temporal' }
        ]
      }
    ]
  };

  // Función helper para fechas pasadas
  function getDateMinus(days) {
    const d = new Date();
    d.setDate(d.getDate() - days);
    return d.toISOString().split('T')[0];
  }

  // ══════════════════════════════════════════════════════════
  //  INICIALIZACIÓN — Carga datos mock si es primera vez
  // ══════════════════════════════════════════════════════════
  function initialize() {
    if (!ls.getBool(KEYS.INITIALIZED)) {
      ls.set(KEYS.TRANSACTIONS, MOCK_DATA.transactions);
      ls.set(KEYS.DEBTS, MOCK_DATA.debts);
      ls.set(KEYS.SAVINGS, MOCK_DATA.savings);
      ls.setBool(KEYS.INITIALIZED, true);
      console.log('[FinanzApp] Datos de demostración cargados ✓');
    }
  }

  // ══════════════════════════════════════════════════════════
  //  TRANSACCIONES
  // ══════════════════════════════════════════════════════════
  const Transactions = {
    getAll() { return ls.get(KEYS.TRANSACTIONS); },

    getByMonth(year, month) {
      return this.getAll().filter(t => {
        const d = new Date(t.date);
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
        description: description?.trim() || (type === 'deposit' ? 'Depósito' : type === 'withdraw' ? 'Retiro' : 'Gasto'),
        date: date || today()
      };

      all[idx].transactions.push(movement);
      all[idx].currentBalance = type === 'deposit'
        ? all[idx].currentBalance + amount
        : all[idx].currentBalance - amount;

      ls.set(KEYS.SAVINGS, all);
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

})();
