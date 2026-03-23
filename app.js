/**
 * ============================================================
 * FINANZAPP PRO — app.js
 * SPA principal: enrutamiento, render de vistas, modales,
 * gráficos Chart.js y toda la lógica de UI
 * ============================================================
 */

'use strict';

// ── ESTADO GLOBAL ─────────────────────────────────────────
const State = {
  currentView:    'dashboard',
  txCurrentPage:  1,
  txPageSize:     10,
  txFiltered:     [],
  payDonutChart:  null,
  dashDonut:      null,
  dashLine:       null,
  editTxId:       null
};

// ── COLORES DE CATEGORÍAS ──────────────────────────────────
const CAT_COLORS = {
  'Salario':        '#1a56db',
  'Freelance':      '#6366f1',
  'Negocio':        '#059669',
  'Inversión':      '#0891b2',
  'Vivienda':       '#dc2626',
  'Alimentación':   '#d97706',
  'Transporte':     '#7c3aed',
  'Salud':          '#db2777',
  'Educación':      '#0ea5e9',
  'Entretenimiento':'#f97316',
  'Servicios':      '#6b7280',
  'Otro':           '#94a3b8'
};

// ── FORMATO MONEDA ─────────────────────────────────────────
function fmt(n) {
  if (isNaN(n) || n === undefined) return '$0';
  return new Intl.NumberFormat('es-CO', {
    style: 'currency', currency: 'COP', maximumFractionDigits: 0
  }).format(n);
}

function fmtDate(str) {
  if (!str) return '--';
  const [y,m,d] = str.split('-');
  return `${d}/${m}/${y}`;
}

// ══════════════════════════════════════════════════════════
//  INICIALIZACIÓN
// ══════════════════════════════════════════════════════════
document.addEventListener('DOMContentLoaded', () => {
  // 1. Inicializar datos (carga mock si es primera vez)
  FinanceService.initialize();

  // 2. UI base
  setupNavDate();
  setupSidebar();
  setupIntersectionObserver();

  // 3. Cargar vista inicial
  navigateTo('dashboard');

  // 4. Scroll listener para revelar cards
  window.addEventListener('scroll', revealOnScroll, { passive: true });
  revealOnScroll();
});

// ── FECHA EN NAVBAR ────────────────────────────────────────
function setupNavDate() {
  const el = document.getElementById('navDate');
  if (el) {
    el.textContent = new Date().toLocaleDateString('es-CO', {
      weekday: 'short', day: 'numeric', month: 'short', year: 'numeric'
    });
  }
}

// ── SIDEBAR MOBILE ─────────────────────────────────────────
function setupSidebar() {
  const btn     = document.getElementById('sidebarToggleBtn');
  const sidebar = document.getElementById('fpSidebar');
  const overlay = document.getElementById('sidebarOverlay');

  if (btn) {
    btn.addEventListener('click', () => {
      sidebar.classList.toggle('open');
      overlay.classList.toggle('show');
    });
  }
}

function closeSidebar() {
  document.getElementById('fpSidebar')?.classList.remove('open');
  document.getElementById('sidebarOverlay')?.classList.remove('show');
}

// ── INTERSECTION OBSERVER (reveal cards) ──────────────────
function setupIntersectionObserver() {
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(e => {
      if (e.isIntersecting) {
        e.target.classList.add('visible');
        observer.unobserve(e.target);
      }
    });
  }, { threshold: 0.1 });

  document.querySelectorAll('.reveal-card').forEach(el => observer.observe(el));
}

function revealOnScroll() {
  document.querySelectorAll('.reveal-card:not(.visible)').forEach(el => {
    const rect = el.getBoundingClientRect();
    if (rect.top < window.innerHeight * 0.95) {
      el.classList.add('visible');
    }
  });
}

// ══════════════════════════════════════════════════════════
//  ENRUTADOR SPA
// ══════════════════════════════════════════════════════════
function navigateTo(view) {
  // Ocultar todas las vistas
  document.querySelectorAll('.fp-view').forEach(v => v.classList.add('d-none'));

  // Mostrar vista seleccionada
  const el = document.getElementById(`view-${view}`);
  if (el) {
    el.classList.remove('d-none');
    el.classList.add('fp-view');
  }

  // Actualizar sidebar active
  document.querySelectorAll('.sidebar-link').forEach(l => {
    l.classList.toggle('active', l.dataset.view === view);
  });

  State.currentView = view;
  closeSidebar();

  // Render de la vista
  switch (view) {
    case 'dashboard':    renderDashboard(); break;
    case 'transactions': renderTransactions(); break;
    case 'debts':        renderDebts(); break;
    case 'savings':      renderSavings(); break;
  }

  // Re-observar nuevas cards
  setTimeout(() => {
    document.querySelectorAll('.reveal-card:not(.visible)').forEach(el => {
      el.classList.add('visible');
    });
  }, 100);
}

// ══════════════════════════════════════════════════════════
//  DASHBOARD
// ══════════════════════════════════════════════════════════
function renderDashboard() {
  const { income, expense } = FinanceService.Transactions.currentMonthTotals();
  const totalSavings = FinanceService.Savings.totalSavings();
  const debtTotals   = FinanceService.Debts.totals();
  const saldoLibre   = income - expense - totalSavings; // Saldo libre = Ingresos - Egresos - Ahorros

  // KPIs con animación mejorada
  animateValue('kpiSaldo',    saldoLibre);
  animateValue('kpiIngresos', income);
  animateValue('kpiEgresos',  expense);
  animateValue('kpiAhorros',  totalSavings);

  // Balance navbar
  const navEl = document.getElementById('navBalanceVal');
  if (navEl) {
    navEl.textContent = fmt(saldoLibre);
    // Animación de pulso en el cambio
    navEl.parentElement.style.animation = 'none';
    setTimeout(() => {
      navEl.parentElement.style.animation = 'pulse 0.5s ease';
    }, 10);
  }
  const chip = document.getElementById('navBalance');
  if (chip) {
    chip.style.color = saldoLibre >= 0 ? 'var(--fp-success)' : 'var(--fp-danger)';
  }

  // Trends mejorados
  const saldoTrend = document.getElementById('kpiSaldoTrend');
  if (saldoTrend) {
    saldoTrend.innerHTML = saldoLibre >= 0
      ? `<i class="bi bi-arrow-up-circle text-success"></i> Saldo libre positivo`
      : `<i class="bi bi-arrow-down-circle text-danger"></i> Saldo libre negativo`;
  }

  // Gráfico donut categorías
  renderDonutChart();

  // Gráfico líneas flujo de caja
  renderLineChart();

  // Deudas dashboard
  renderDashDebts();

  // Ahorros dashboard
  renderDashSavings();

  // Badges sidebar
  document.getElementById('badgeTx').textContent    = FinanceService.Transactions.getAll().length;
  document.getElementById('badgeDebts').textContent = FinanceService.Debts.getActive().length;
}

function refreshDashboard() { renderDashboard(); showToast('Dashboard actualizado', 'success'); }

/** Anima el valor de un KPI con efectos modernos */
function animateValue(elId, target) {
  const el = document.getElementById(elId);
  if (!el) return;

  // Obtener valor anterior o empezar desde 0
  const prevText = el.textContent.replace(/[^0-9-]/g, '');
  const start    = prevText ? parseFloat(prevText) : 0;
  const duration = 1200;
  const startTs  = performance.now();

  // Agregar clase de animación
  el.parentElement?.classList.add('kpi-animating');

  const update = (ts) => {
    const elapsed = ts - startTs;
    const progress = Math.min(elapsed / duration, 1);

    // Easing más suave: ease-out-expo
    const eased = progress === 1 ? 1 : 1 - Math.pow(2, -10 * progress);

    const current = start + (target - start) * eased;
    el.textContent = fmt(current);

    // Efecto de escala durante la animación
    const scale = 1 + Math.sin(progress * Math.PI) * 0.05;
    el.style.transform = `scale(${scale})`;

    if (progress < 1) {
      requestAnimationFrame(update);
    } else {
      el.style.transform = 'scale(1)';
      el.parentElement?.classList.remove('kpi-animating');

      // Pequeño bounce al final
      el.style.animation = 'none';
      setTimeout(() => {
        el.style.animation = 'bounceEnd 0.4s ease';
      }, 10);
    }
  };

  requestAnimationFrame(update);
}

/** Donut: gastos por categoría */
function renderDonutChart() {
  const catData   = FinanceService.Transactions.expensesByCategory();
  const labels    = Object.keys(catData);
  const values    = Object.values(catData);
  const colors    = labels.map(l => CAT_COLORS[l] || '#94a3b8');
  const isEmpty   = values.length === 0 || values.every(v => v === 0);

  const emptyEl = document.getElementById('chartDonutEmpty');
  if (emptyEl) emptyEl.classList.toggle('d-none', !isEmpty);

  const ctx = document.getElementById('chartDonut');
  if (!ctx) return;

  if (State.dashDonut) { State.dashDonut.destroy(); State.dashDonut = null; }
  if (isEmpty) return;

  State.dashDonut = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels,
      datasets: [{ data: values, backgroundColor: colors, borderWidth: 0, hoverOffset: 8 }]
    },
    options: {
      cutout: '68%',
      animation: { animateRotate: true, duration: 900 },
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: (ctx) => ` ${fmt(ctx.raw)} (${Math.round(ctx.raw / values.reduce((a,b)=>a+b,0) * 100)}%)`
          }
        }
      }
    }
  });

  // Leyenda custom
  const legEl = document.getElementById('chartDonutLegend');
  if (legEl) {
    legEl.innerHTML = labels.map((l, i) => `
      <div class="legend-item">
        <div class="legend-dot" style="background:${colors[i]}"></div>
        <span>${l}: <strong>${fmt(values[i])}</strong></span>
      </div>
    `).join('');
  }
}

/** Líneas: flujo de caja */
function renderLineChart() {
  const data = FinanceService.Transactions.cashflowLastMonths(6);
  const ctx  = document.getElementById('chartLine');
  if (!ctx) return;

  if (State.dashLine) { State.dashLine.destroy(); State.dashLine = null; }

  State.dashLine = new Chart(ctx, {
    type: 'line',
    data: {
      labels: data.map(d => d.label),
      datasets: [
        {
          label: 'Ingresos',
          data: data.map(d => d.income),
          borderColor: '#057a55',
          backgroundColor: 'rgba(5,122,85,0.08)',
          tension: 0.4, fill: true, borderWidth: 2.5,
          pointBackgroundColor: '#057a55', pointRadius: 4, pointHoverRadius: 7
        },
        {
          label: 'Egresos',
          data: data.map(d => d.expense),
          borderColor: '#c81e1e',
          backgroundColor: 'rgba(200,30,30,0.06)',
          tension: 0.4, fill: true, borderWidth: 2.5,
          pointBackgroundColor: '#c81e1e', pointRadius: 4, pointHoverRadius: 7
        }
      ]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      animation: { duration: 900, easing: 'easeOutQuart' },
      plugins: {
        legend: {
          position: 'bottom',
          labels: { usePointStyle: true, padding: 16, font: { family: "'Plus Jakarta Sans', sans-serif", size: 12 } }
        },
        tooltip: { callbacks: { label: (c) => ` ${c.dataset.label}: ${fmt(c.raw)}` } }
      },
      scales: {
        x: { grid: { display: false }, ticks: { font: { family: "'Plus Jakarta Sans', sans-serif", size: 12 } } },
        y: {
          grid: { color: 'rgba(0,0,0,0.05)' },
          ticks: { callback: v => '$' + (v >= 1e6 ? (v/1e6).toFixed(1)+'M' : (v/1e3).toFixed(0)+'k'), font: { size: 11 } }
        }
      }
    }
  });
}

/** Mini lista deudas en dashboard */
function renderDashDebts() {
  const el    = document.getElementById('dashDebtsList');
  const debts = FinanceService.Debts.getActive().slice(0, 3);
  if (!el) return;

  if (debts.length === 0) {
    el.innerHTML = `<div class="empty-state py-4">
      <i class="bi bi-check-circle-fill text-success fs-3"></i>
      <p class="mt-2 mb-0">¡Sin deudas registradas!</p>
    </div>`;
    return;
  }

  el.innerHTML = debts.map(d => {
    const pct = Math.round(((d.totalAmount - d.remainingBalance) / d.totalAmount) * 100);
    return `
    <div class="dash-debt-item">
      <div class="d-flex justify-content-between align-items-start mb-1">
        <strong style="font-size:13.5px">${d.creditor}</strong>
        <span class="fp-badge fp-badge-red">${fmt(d.remainingBalance)}</span>
      </div>
      <div class="fp-progress">
        <div class="fp-progress-bar" style="width:${pct}%"></div>
      </div>
      <small class="text-muted">${pct}% pagado · Tasa: ${d.interestRate}%/mes</small>
    </div>`;
  }).join('');
}

/** Mini lista ahorros en dashboard */
function renderDashSavings() {
  const el      = document.getElementById('dashSavingsList');
  const savings = FinanceService.Savings.getAll().slice(0, 3);
  if (!el) return;

  if (savings.length === 0) {
    el.innerHTML = `<div class="empty-state py-4">
      <i class="bi bi-piggy-bank fs-3" style="color:var(--fp-gold)"></i>
      <p class="mt-2 mb-0">Crea tu primera cuenta de ahorro</p>
    </div>`;
    return;
  }

  el.innerHTML = savings.map(s => {
    const pct = s.goal > 0 ? Math.min(100, Math.round((s.currentBalance / s.goal) * 100)) : 0;
    return `
    <div class="dash-saving-item">
      <div class="d-flex justify-content-between mb-1">
        <strong style="font-size:13.5px">${s.name}</strong>
        <span class="fp-badge fp-badge-gold">${fmt(s.currentBalance)}</span>
      </div>
      ${s.goal > 0 ? `
      <div class="fp-progress">
        <div class="fp-progress-bar" style="width:${pct}%;background:linear-gradient(90deg,var(--fp-gold),#f59e0b)"></div>
      </div>
      <small class="text-muted">${pct}% de ${fmt(s.goal)}</small>` : ''}
    </div>`;
  }).join('');
}

// ══════════════════════════════════════════════════════════
//  TRANSACCIONES
// ══════════════════════════════════════════════════════════
function renderTransactions() {
  const type     = document.getElementById('filterTxType')?.value || '';
  const category = document.getElementById('filterTxCat')?.value  || '';
  const from     = document.getElementById('filterFrom')?.value   || '';
  const to       = document.getElementById('filterTo')?.value     || '';

  State.txFiltered = FinanceService.Transactions.getFiltered({ type, category, from, to });

  const total = State.txFiltered.length;
  const pages = Math.max(1, Math.ceil(total / State.txPageSize));
  if (State.txCurrentPage > pages) State.txCurrentPage = 1;

  const start  = (State.txCurrentPage - 1) * State.txPageSize;
  const slice  = State.txFiltered.slice(start, start + State.txPageSize);

  document.getElementById('txCount').textContent   = `${total} registro${total !== 1 ? 's' : ''}`;
  document.getElementById('txPagInfo').textContent = `Página ${State.txCurrentPage} de ${pages}`;
  document.getElementById('txPrevBtn').disabled    = State.txCurrentPage <= 1;
  document.getElementById('txNextBtn').disabled    = State.txCurrentPage >= pages;

  const tbody = document.getElementById('txTableBody');
  if (!tbody) return;

  if (slice.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6" class="text-center py-5 text-muted">
      <i class="bi bi-search fs-2 d-block mb-2 opacity-25"></i>No se encontraron transacciones
    </td></tr>`;
    return;
  }

  tbody.innerHTML = slice.map(t => {
    const isIncome = t.type === 'income';
    return `
    <tr>
      <td>
        <span class="fp-badge ${isIncome ? 'fp-badge-green' : 'fp-badge-red'}">
          <i class="bi bi-arrow-${isIncome ? 'up' : 'down'}-circle me-1"></i>
          ${isIncome ? 'Ingreso' : 'Egreso'}
        </span>
      </td>
      <td><strong>${escHtml(t.description)}</strong></td>
      <td><span class="fp-badge fp-badge-gray">${t.category}</span></td>
      <td class="amount-mono ${isIncome ? 'text-success' : 'text-danger'}">
        ${isIncome ? '+' : '-'}${fmt(t.amount)}
      </td>
      <td class="text-muted" style="font-size:12.5px">${fmtDate(t.date)}</td>
      <td class="text-end">
        <button class="btn btn-sm fp-btn-ghost me-1" onclick="editTx('${t.id}')" title="Editar">
          <i class="bi bi-pencil"></i>
        </button>
        <button class="btn btn-sm fp-btn-ghost text-danger" onclick="deleteTx('${t.id}')" title="Eliminar">
          <i class="bi bi-trash3"></i>
        </button>
      </td>
    </tr>`;
  }).join('');

  // Actualizar badges sidebar
  document.getElementById('badgeTx').textContent = FinanceService.Transactions.getAll().length;
}

function txPage(dir) {
  const pages = Math.ceil(State.txFiltered.length / State.txPageSize);
  State.txCurrentPage = Math.max(1, Math.min(pages, State.txCurrentPage + dir));
  renderTransactions();
}

// MODAL TX
function openTxModal(editId = null) {
  State.editTxId = editId;
  const modal = new bootstrap.Modal(document.getElementById('modalTx'));

  document.getElementById('txEditId').value = editId || '';
  document.getElementById('txDesc').value   = '';
  document.getElementById('txAmount').value = '';
  document.getElementById('txDate').value   = FinanceService.today();
  document.getElementById('txCategory').value = 'Salario';
  setTxType('income');

  if (editId) {
    const tx = FinanceService.Transactions.getAll().find(t => t.id === editId);
    if (tx) {
      document.getElementById('modalTxTitle').innerHTML =
        '<i class="bi bi-pencil-fill me-2"></i>Editar Transacción';
      document.getElementById('txDesc').value     = tx.description;
      document.getElementById('txAmount').value   = tx.amount;
      document.getElementById('txDate').value     = tx.date;
      document.getElementById('txCategory').value = tx.category;
      setTxType(tx.type);
    }
  } else {
    document.getElementById('modalTxTitle').innerHTML =
      '<i class="bi bi-plus-circle-fill me-2"></i>Nueva Transacción';
  }

  modal.show();
}

function setTxType(type) {
  document.getElementById('txType').value = type;
  document.getElementById('btnIncome').classList.toggle('active', type === 'income');
  document.getElementById('btnExpense').classList.toggle('active', type === 'expense');
}

function saveTx() {
  try {
    const id   = document.getElementById('txEditId').value;
    const data = {
      type:        document.getElementById('txType').value,
      description: document.getElementById('txDesc').value,
      amount:      parseFloat(document.getElementById('txAmount').value),
      date:        document.getElementById('txDate').value,
      category:    document.getElementById('txCategory').value
    };

    if (id) {
      FinanceService.Transactions.update(id, data);
      showToast('Transacción actualizada ✓', 'success');
    } else {
      FinanceService.Transactions.add(data);
      showToast('Transacción registrada ✓', 'success');
    }

    bootstrap.Modal.getInstance(document.getElementById('modalTx'))?.hide();
    renderTransactions();
    if (State.currentView === 'dashboard') renderDashboard();

  } catch (err) {
    showToast(err.message, 'danger');
  }
}

function editTx(id) { openTxModal(id); }

function deleteTx(id) {
  if (!confirm('¿Eliminar esta transacción?')) return;
  FinanceService.Transactions.delete(id);
  renderTransactions();
  showToast('Transacción eliminada', 'warning');
}

// ══════════════════════════════════════════════════════════
//  DEUDAS
// ══════════════════════════════════════════════════════════
function renderDebts() {
  const debts  = FinanceService.Debts.getActive();
  const totals = FinanceService.Debts.totals();

  // KPIs
  animateValue('debtTotalAmt', totals.totalRemaining);
  animateValue('debtTotalInt', totals.totalInterest);
  document.getElementById('debtCount').textContent = totals.count;

  document.getElementById('badgeDebts').textContent = totals.count;

  const grid = document.getElementById('debtsList');
  if (!grid) return;

  if (debts.length === 0) {
    grid.innerHTML = `<div class="col-12">
      <div class="empty-state-large">
        <i class="bi bi-emoji-smile fs-1" style="color:var(--fp-success)"></i>
        <h4 class="mt-3">¡Sin deudas activas!</h4>
        <p class="text-muted">Agrega una deuda para comenzar el seguimiento</p>
        <button class="btn fp-btn-primary mt-2" onclick="openDebtModal()">
          <i class="bi bi-plus-lg"></i> Agregar Deuda
        </button>
      </div>
    </div>`;
    return;
  }

  grid.innerHTML = debts.map((d, i) => {
    const pctPaid = Math.round(((d.totalAmount - d.remainingBalance) / d.totalAmount) * 100);
    const intEst  = d.remainingBalance * (d.interestRate / 100);
    const isAlarm = pctPaid < 20;

    return `
    <div class="col-lg-6 reveal-card" style="--delay:${i * 0.08}s">
      <div class="debt-card">
        <div class="debt-card-body">
          <div class="d-flex justify-content-between align-items-start mb-1">
            <div>
              <div class="debt-name">${escHtml(d.creditor)}</div>
              ${d.description ? `<div class="debt-meta">${escHtml(d.description)}</div>` : ''}
            </div>
            <button class="btn btn-sm fp-btn-ghost text-danger" onclick="deleteDebt('${d.id}')" title="Eliminar">
              <i class="bi bi-trash3"></i>
            </button>
          </div>

          <!-- STATS -->
          <div class="row g-2 my-3">
            <div class="col-6">
              <div style="background:var(--fp-surface2);border-radius:10px;padding:12px">
                <div style="font-size:10.5px;text-transform:uppercase;letter-spacing:.5px;color:var(--fp-text2)">Capital inicial</div>
                <div class="amount-mono mt-1">${fmt(d.totalAmount)}</div>
              </div>
            </div>
            <div class="col-6">
              <div style="background:var(--fp-danger-lt);border-radius:10px;padding:12px">
                <div style="font-size:10.5px;text-transform:uppercase;letter-spacing:.5px;color:var(--fp-danger)">Saldo pendiente</div>
                <div class="amount-mono mt-1 text-danger">${fmt(d.remainingBalance)}</div>
              </div>
            </div>
            <div class="col-6">
              <div style="background:var(--fp-surface2);border-radius:10px;padding:12px">
                <div style="font-size:10.5px;text-transform:uppercase;letter-spacing:.5px;color:var(--fp-text2)">Tasa mensual</div>
                <div class="amount-mono mt-1">${d.interestRate}%</div>
              </div>
            </div>
            <div class="col-6">
              <div style="background:var(--fp-orange-lt);border-radius:10px;padding:12px">
                <div style="font-size:10.5px;text-transform:uppercase;letter-spacing:.5px;color:var(--fp-orange)">Interés est./mes</div>
                <div class="amount-mono mt-1" style="color:var(--fp-orange)">${fmt(intEst)}</div>
              </div>
            </div>
          </div>

          <!-- PROGRESS -->
          <div class="d-flex justify-content-between mb-1" style="font-size:12px">
            <span class="text-muted">Progreso del pago</span>
            <strong>${pctPaid}%</strong>
          </div>
          <div class="fp-progress">
            <div class="fp-progress-bar ${isAlarm ? 'danger' : ''}" style="width:${pctPaid}%"></div>
          </div>
          <div class="d-flex justify-content-between mt-1" style="font-size:11.5px;color:var(--fp-text2)">
            <span>Desde: ${fmtDate(d.startDate)}</span>
            <span>${d.payments.length} abono(s)</span>
          </div>

          <!-- ACTIONS -->
          <div class="d-flex gap-2 mt-3">
            <button class="btn fp-btn-primary flex-fill" onclick="openPaymentModal('${d.id}')">
              <i class="bi bi-cash-coin me-1"></i> Registrar Abono
            </button>
          </div>
        </div>
      </div>
    </div>`;
  }).join('');

  setTimeout(() => {
    document.querySelectorAll('.reveal-card:not(.visible)').forEach(el => el.classList.add('visible'));
  }, 50);
}

// MODAL NUEVA DEUDA
function openDebtModal() {
  document.getElementById('debtCreditor').value = '';
  document.getElementById('debtTotal').value    = '';
  document.getElementById('debtRate').value     = '0';
  document.getElementById('debtStart').value    = FinanceService.today();
  document.getElementById('debtDesc').value     = '';
  new bootstrap.Modal(document.getElementById('modalDebt')).show();
}

function saveDebt() {
  try {
    FinanceService.Debts.add({
      creditor:     document.getElementById('debtCreditor').value,
      totalAmount:  document.getElementById('debtTotal').value,
      interestRate: document.getElementById('debtRate').value,
      startDate:    document.getElementById('debtStart').value,
      description:  document.getElementById('debtDesc').value
    });
    bootstrap.Modal.getInstance(document.getElementById('modalDebt'))?.hide();
    renderDebts();
    showToast('Deuda registrada ✓', 'success');
  } catch (err) {
    showToast(err.message, 'danger');
  }
}

function deleteDebt(id) {
  if (!confirm('¿Eliminar esta deuda y todos sus abonos?')) return;
  FinanceService.Debts.delete(id);
  renderDebts();
  showToast('Deuda eliminada', 'warning');
}

// ── MODAL ABONO ────────────────────────────────────────────
let _payDonutChart = null;

function openPaymentModal(debtId) {
  const debt = FinanceService.Debts.getAll().find(d => d.id === debtId);
  if (!debt) return;

  document.getElementById('payDebtId').value  = debtId;
  document.getElementById('payAmount').value  = '';
  document.getElementById('payDate').value    = FinanceService.today();

  // Info banner
  document.getElementById('payDebtInfo').innerHTML = `
    <div class="d-flex gap-4 flex-wrap">
      <div><small class="text-muted d-block" style="font-size:11px">ACREEDOR</small><strong>${escHtml(debt.creditor)}</strong></div>
      <div><small class="text-muted d-block" style="font-size:11px">SALDO PENDIENTE</small><strong class="text-danger amount-mono">${fmt(debt.remainingBalance)}</strong></div>
      <div><small class="text-muted d-block" style="font-size:11px">TASA MENSUAL</small><strong>${debt.interestRate}%</strong></div>
      <div><small class="text-muted d-block" style="font-size:11px">INTERÉS EST.</small><strong class="text-warning amount-mono">${fmt(debt.remainingBalance * debt.interestRate / 100)}</strong></div>
    </div>`;

  document.getElementById('payPreview').style.display = 'none';

  // Donut inicial vacío
  initPayDonut();

  // Historial abonos
  renderPayHistory(debt);

  new bootstrap.Modal(document.getElementById('modalPayment')).show();
}

function initPayDonut() {
  const ctx = document.getElementById('payDonut');
  if (!ctx) return;
  if (_payDonutChart) { _payDonutChart.destroy(); _payDonutChart = null; }

  _payDonutChart = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: ['Capital', 'Interés'],
      datasets: [{ data: [1, 1], backgroundColor: ['#057a55','#c81e1e'], borderWidth: 0, hoverOffset: 4 }]
    },
    options: {
      cutout: '68%', animation: { duration: 500 },
      plugins: { legend: { display: false }, tooltip: { callbacks: { label: c => ` ${fmt(c.raw)}` } } }
    }
  });
}

/** Cálculo EN TIEMPO REAL al escribir el monto */
function calcPaymentPreview() {
  const id     = document.getElementById('payDebtId').value;
  const amount = parseFloat(document.getElementById('payAmount').value) || 0;
  const prev   = document.getElementById('payPreview');

  if (!amount || amount <= 0) { prev.style.display = 'none'; return; }

  try {
    const calc = FinanceService.Debts.calculatePayment(id, amount);

    document.getElementById('prevInterest').textContent  = fmt(calc.interestAmount);
    document.getElementById('prevCapital').textContent   = fmt(calc.capitalAmount);
    document.getElementById('prevNewBalance').textContent= fmt(calc.newBalance);
    prev.style.display = 'block';

    // Actualizar donut
    if (_payDonutChart) {
      _payDonutChart.data.datasets[0].data = [calc.capitalAmount, calc.interestAmount];
      _payDonutChart.update();
    }

    // Centro del donut
    const centerEl = document.getElementById('payDonutCenter');
    if (centerEl) {
      centerEl.innerHTML = `<span>${calc.capitalPercent}%</span><small>capital</small>`;
    }

  } catch (err) {
    prev.style.display = 'none';
  }
}

function savePayment() {
  try {
    const id     = document.getElementById('payDebtId').value;
    const amount = parseFloat(document.getElementById('payAmount').value);
    const date   = document.getElementById('payDate').value;

    if (!amount || amount <= 0) throw new Error('Ingresa un monto válido');

    const result = FinanceService.Debts.registerPayment(id, amount, date);
    bootstrap.Modal.getInstance(document.getElementById('modalPayment'))?.hide();
    renderDebts();
    showToast(`Abono de ${fmt(amount)} registrado. Capital reducido: ${fmt(result.calc.capitalAmount)} ✓`, 'success');
  } catch (err) {
    showToast(err.message, 'danger');
  }
}

function renderPayHistory(debt) {
  const el = document.getElementById('payHistory');
  if (!el || !debt.payments.length) { el.innerHTML = ''; return; }

  const last5 = [...debt.payments].reverse().slice(0, 5);
  el.innerHTML = `
    <div class="history-title"><i class="bi bi-clock-history"></i> Últimos abonos</div>
    ${last5.map(p => `
      <div class="history-item">
        <span class="text-muted">${fmtDate(p.date)}</span>
        <span class="d-flex gap-3">
          <span class="text-danger amount-mono" style="font-size:12px" title="Interés">↗ ${fmt(p.interest)}</span>
          <span class="text-success amount-mono" style="font-size:12px" title="Capital">↘ ${fmt(p.capital)}</span>
          <strong class="amount-mono">${fmt(p.amount)}</strong>
        </span>
      </div>`).join('')}`;
}

// ══════════════════════════════════════════════════════════
//  AHORROS
// ══════════════════════════════════════════════════════════
function renderSavings() {
  const accounts = FinanceService.Savings.getAll();
  const total    = FinanceService.Savings.totalSavings();

  const totalEl = document.getElementById('savingsTotal');
  if (totalEl) totalEl.textContent = fmt(total);

  const grid = document.getElementById('savingsGrid');
  if (!grid) return;

  if (accounts.length === 0) {
    grid.innerHTML = `<div class="col-12">
      <div class="empty-state-large">
        <i class="bi bi-piggy-bank" style="font-size:3rem;color:var(--fp-gold)"></i>
        <h4 class="mt-3">Empieza a ahorrar</h4>
        <p class="text-muted">Crea tu primera cuenta de ahorro y define tu meta</p>
        <button class="btn fp-btn-primary mt-2" onclick="openSavingModal()">
          <i class="bi bi-plus-lg"></i> Crear Primera Cuenta
        </button>
      </div>
    </div>`;
    return;
  }

  grid.innerHTML = accounts.map((s, i) => {
    const pct = s.goal > 0 ? Math.min(100, Math.round((s.currentBalance / s.goal) * 100)) : 0;
    const circumference = 2 * Math.PI * 32; // r=32
    const offset = circumference - (pct / 100) * circumference;

    return `
    <div class="col-xl-4 col-md-6 reveal-card" style="--delay:${i*0.08}s">
      <div class="saving-card">
        <div class="saving-card-body">
          <div class="d-flex justify-content-between align-items-start mb-3">
            <div>
              <div class="saving-name">${escHtml(s.name)}</div>
              ${s.description ? `<div class="saving-goal">${escHtml(s.description)}</div>` : ''}
            </div>
            <div class="d-flex align-items-center gap-2">
              ${s.goal > 0 ? `
                <div class="circular-progress">
                  <svg viewBox="0 0 80 80" width="80" height="80">
                    <circle class="track" cx="40" cy="40" r="32"/>
                    <circle class="bar" cx="40" cy="40" r="32"
                      stroke-dasharray="${circumference}"
                      stroke-dashoffset="${offset}"/>
                  </svg>
                  <div class="circular-center">
                    <span class="circular-pct">${pct}%</span>
                    <span class="circular-lbl">meta</span>
                  </div>
                </div>` : `<button class="btn btn-sm fp-btn-ghost text-danger" onclick="deleteSaving('${s.id}')"><i class="bi bi-trash3"></i></button>`}
            </div>
          </div>

          <!-- Saldo -->
          <div class="saving-balance">${fmt(s.currentBalance)}</div>
          ${s.goal > 0 ? `<small class="text-muted">Meta: ${fmt(s.goal)} · Faltan: ${fmt(Math.max(0, s.goal - s.currentBalance))}</small>` : ''}

          <!-- Progress lineal -->
          ${s.goal > 0 ? `
          <div class="fp-progress mt-3">
            <div class="fp-progress-bar" style="width:${pct}%;background:linear-gradient(90deg,var(--fp-gold),#f59e0b)"></div>
          </div>` : ''}

          <!-- Acciones -->
          <div class="d-flex gap-2 mt-3 flex-wrap">
            <button class="btn fp-btn-gold btn-sm flex-fill" onclick="openSavingMoveModal('${s.id}','deposit')">
              <i class="bi bi-plus-lg"></i> Depositar
            </button>
            <button class="btn fp-btn-ghost btn-sm flex-fill" onclick="openSavingMoveModal('${s.id}','withdraw')">
              <i class="bi bi-dash-lg"></i> Retirar
            </button>
            <button class="btn fp-btn-ghost btn-sm flex-fill" onclick="openSavingMoveModal('${s.id}','use')">
              <i class="bi bi-cart3"></i> Usar
            </button>
          </div>

          ${s.goal > 0 ? `
          <button class="btn fp-btn-ghost btn-sm text-danger mt-2 w-100" onclick="deleteSaving('${s.id}')">
            <i class="bi bi-trash3 me-1"></i> Eliminar cuenta
          </button>` : ''}
        </div>
      </div>
    </div>`;
  }).join('');

  setTimeout(() => {
    document.querySelectorAll('.reveal-card:not(.visible)').forEach(el => el.classList.add('visible'));
  }, 50);
}

// MODAL NUEVA CUENTA
function openSavingModal() {
  document.getElementById('savName').value    = '';
  document.getElementById('savGoal').value    = '';
  document.getElementById('savInitial').value = '0';
  document.getElementById('savDesc').value    = '';
  new bootstrap.Modal(document.getElementById('modalSaving')).show();
}

function saveSaving() {
  try {
    FinanceService.Savings.add({
      name:           document.getElementById('savName').value,
      description:    document.getElementById('savDesc').value,
      goal:           document.getElementById('savGoal').value,
      initialBalance: document.getElementById('savInitial').value
    });
    bootstrap.Modal.getInstance(document.getElementById('modalSaving'))?.hide();
    renderSavings();
    showToast('Cuenta de ahorro creada ✓', 'success');
  } catch (err) {
    showToast(err.message, 'danger');
  }
}

function deleteSaving(id) {
  if (!confirm('¿Eliminar esta cuenta y todo su historial?')) return;
  FinanceService.Savings.delete(id);
  renderSavings();
  showToast('Cuenta eliminada', 'warning');
}

// MODAL MOVIMIENTO AHORRO
function openSavingMoveModal(id, tipo = 'deposit') {
  document.getElementById('savMoveId').value     = id;
  document.getElementById('savMoveAmount').value = '';
  document.getElementById('savMoveDate').value   = FinanceService.today();
  document.getElementById('savMoveDesc').value   = '';
  setSavMoveType(tipo);

  const acc = FinanceService.Savings.getAll().find(s => s.id === id);
  if (acc) {
    document.getElementById('modalSavMoveTitle').innerHTML =
      `<i class="bi bi-cash-stack me-2"></i>${escHtml(acc.name)}`;
    renderSavMoveHistory(acc);
  }

  new bootstrap.Modal(document.getElementById('modalSavMove')).show();
}

function setSavMoveType(type) {
  document.getElementById('savMoveType').value = type;
  ['deposit','withdraw','use'].forEach(t => {
    const btn = document.getElementById('btn' + t.charAt(0).toUpperCase() + t.slice(1));
    if (btn) btn.classList.toggle('active', t === type);
  });
  const confirmBtn = document.getElementById('savMoveConfirmBtn');
  if (confirmBtn) {
    const labels = { deposit:'Confirmar Depósito', withdraw:'Confirmar Retiro', use:'Confirmar Gasto' };
    confirmBtn.innerHTML = `<i class="bi bi-check-lg"></i> ${labels[type]}`;
  }
}

function saveSavingMove() {
  try {
    FinanceService.Savings.addMovement(
      document.getElementById('savMoveId').value,
      {
        type:        document.getElementById('savMoveType').value,
        amount:      document.getElementById('savMoveAmount').value,
        description: document.getElementById('savMoveDesc').value,
        date:        document.getElementById('savMoveDate').value
      }
    );
    bootstrap.Modal.getInstance(document.getElementById('modalSavMove'))?.hide();
    renderSavings();
    showToast('Movimiento registrado ✓', 'success');
  } catch (err) {
    showToast(err.message, 'danger');
  }
}

function renderSavMoveHistory(account) {
  const el   = document.getElementById('savMoveHistory');
  const movs = account.transactions?.slice(-5).reverse() || [];
  if (!el || movs.length === 0) { el.innerHTML = ''; return; }

  const typeLabel = { deposit:'Depósito', withdraw:'Retiro', use:'Gasto' };
  const typeColor = { deposit:'text-success', withdraw:'text-danger', use:'text-warning' };
  const typeIcon  = { deposit:'bi-arrow-up-circle', withdraw:'bi-arrow-down-circle', use:'bi-cart3' };

  el.innerHTML = `
    <div class="history-title"><i class="bi bi-clock-history"></i> Movimientos recientes</div>
    ${movs.map(m => `
      <div class="history-item">
        <span class="d-flex align-items-center gap-2">
          <i class="bi ${typeIcon[m.type]} ${typeColor[m.type]}"></i>
          <span>${typeLabel[m.type]} · <span class="text-muted">${m.description}</span></span>
        </span>
        <span class="amount-mono ${typeColor[m.type]}">${m.type==='deposit' ? '+' : '-'}${fmt(m.amount)}</span>
      </div>`).join('')}`;
}

// ══════════════════════════════════════════════════════════
//  FAB CONTEXTUAL (mobile)
// ══════════════════════════════════════════════════════════
function handleFab() {
  switch (State.currentView) {
    case 'transactions': openTxModal(); break;
    case 'debts':        openDebtModal(); break;
    case 'savings':      openSavingModal(); break;
    default:             navigateTo('transactions'); openTxModal();
  }
}

// ══════════════════════════════════════════════════════════
//  EXPORT / IMPORT / CLEAR
// ══════════════════════════════════════════════════════════
function exportData() {
  FinanceService.exportToJSON();
  showToast('Backup exportado ✓', 'success');
}

function importData(event) {
  const file = event.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      FinanceService.importFromJSON(e.target.result);
      showToast('Datos importados correctamente ✓', 'success');
      navigateTo(State.currentView);
    } catch (err) {
      showToast('Error al importar: ' + err.message, 'danger');
    }
  };
  reader.readAsText(file);
  event.target.value = '';
}

function clearAllData() {
  if (!confirm('¿Borrar TODOS los datos? Esta acción no se puede deshacer.')) return;
  if (!confirm('¿Estás seguro? Se perderán ingresos, egresos, deudas y ahorros.')) return;
  FinanceService.clearAll();
  location.reload();
}

// ══════════════════════════════════════════════════════════
//  TOAST NOTIFICATIONS
// ══════════════════════════════════════════════════════════
function showToast(message, type = 'success') {
  const icons = { success:'check-circle-fill', danger:'x-circle-fill', warning:'exclamation-triangle-fill', info:'info-circle-fill' };
  const colors = { success:'var(--fp-success)', danger:'var(--fp-danger)', warning:'var(--fp-gold)', info:'var(--fp-primary)' };

  const id   = 'toast_' + Date.now();
  const html = `
    <div id="${id}" class="fp-toast toast align-items-center show mb-2" role="alert" aria-live="assertive">
      <div class="toast-header border-0" style="background:transparent">
        <i class="bi bi-${icons[type] || icons.info} me-2" style="color:${colors[type]}"></i>
        <strong class="me-auto" style="font-size:13px;color:${colors[type]}">
          ${type === 'success' ? 'Éxito' : type === 'danger' ? 'Error' : type === 'warning' ? 'Aviso' : 'Info'}
        </strong>
        <button type="button" class="btn-close btn-close-sm" onclick="removeToast('${id}')"></button>
      </div>
      <div class="toast-body">${escHtml(message)}</div>
    </div>`;

  const stack = document.getElementById('toastStack');
  if (stack) stack.insertAdjacentHTML('beforeend', html);

  setTimeout(() => removeToast(id), 4500);
}

function removeToast(id) {
  const el = document.getElementById(id);
  if (!el) return;
  el.classList.add('removing');
  setTimeout(() => el.remove(), 300);
}

// ── UTILIDADES ─────────────────────────────────────────────
function escHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g,'&amp;')
    .replace(/</g,'&lt;')
    .replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;');
}

// ── PWA INSTALLATION ──────────────────────────────────────
let deferredPrompt;
const installBtn = document.getElementById('pwaInstallBtn');
const installWrapper = document.getElementById('installBtnWrapper');
const installMenuDivider = document.getElementById('installMenuItem');

window.addEventListener('beforeinstallprompt', (e) => {
  // Prevenir que Chrome 67 y anteriores muestren el prompt automáticamente
  e.preventDefault();
  // Guardar el evento para que se pueda disparar más tarde
  deferredPrompt = e;
  // Mostrar el botón de instalación
  if (installBtn && installWrapper) {
    installWrapper.style.display = 'block';
    if (installMenuDivider) installMenuDivider.style.display = 'block';
  }
});

if (installBtn) {
  installBtn.addEventListener('click', async () => {
    if (!deferredPrompt) return;
    // Mostrar el prompt de instalación
    deferredPrompt.prompt();
    // Esperar a que el usuario responda al prompt
    const { outcome } = await deferredPrompt.userChoice;
    console.log(`User response to the install prompt: ${outcome}`);
    // Ya no necesitamos el prompt guardado
    deferredPrompt = null;
    // Ocultar el botón
    installWrapper.style.display = 'none';
    if (installMenuDivider) installMenuDivider.style.display = 'none';
  });
}

window.addEventListener('appinstalled', (evt) => {
  console.log('FinanzApp fue instalada correctamente');
  showToast('¡Aplicación instalada en tu PC! ✓', 'success');
});

// Registrar Service Worker
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js')
      .then(reg => console.log('Service Worker registrado', reg))
      .catch(err => console.log('Error registrando SW', err));
  });
}
