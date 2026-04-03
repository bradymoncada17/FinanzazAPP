# FinanzApp Pro

<p align="center">
  <img src="https://img.shields.io/badge/Version-1.2.4-blue?style=for-the-badge&logo=data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'><defs><linearGradient id='g' x1='0%25' y1='0%25' x2='100%25' y2='100%25'><stop offset='0%25' stop-color='%234f46e5'/><stop offset='100%25' stop-color='%232563eb'/></linearGradient></defs><rect width='32' height='32' rx='10' fill='url(%23g)'/><path d='M9 16l5 5 9-9' stroke='white' stroke-width='3' stroke-linecap='round' stroke-linejoin='round' fill='none'/></svg>" alt="Version">
  <img src="https://img.shields.io/badge/License-MIT-green?style=for-the-badge" alt="License">
  <img src="https://img.shields.io/badge/Platform-PWA-orange?style=for-the-badge" alt="PWA">
</p>

<p align="center">
  <a href="https://bradymoncada17.github.io/FinanzazAPP/" target="_blank">
    <img src="https://img.shields.io/badge/🚀_Ver_Online-2563eb?style=for-the-badge&logo=google-chrome" alt="Ver Online">
  </a>
</p>

---

## Descripción

**FinanzApp Pro** es una aplicación web progresiva (PWA) de gestión financiera personal diseñada para el mercado latinoamericano. Permite controlar ingresos, egresos, deudas, ahorros, tarjetas de crédito y préstamos grupales con una interfaz moderna, fluida y completamente offline-first.

### 🚀 Demo en Vivo

👉 **https://bradymoncada17.github.io/FinanzazAPP/**

### Características Principales

- **Dashboard Inteligente**: KPIs visuales con animación, gráficos donut y líneas de flujo de caja
- **Gestión de Transacciones**: CRUD completo con filtros avanzados y paginación
- **Control de Deudas**: Seguimiento de préstamos con cálculo de intereses en tiempo real
- **Sistema de Ahorros**: Metas de ahorro con progress circular y lineal
- **Tarjetas de Crédito**: Control de cupos, movimientos y ciclos de facturación
- **Préstamos Grupales**: Gestión de clientes y préstamos entre particulares
- **Export/Import**: Backup en JSON y sincronización con GitHub Gist
- **PWA Nativo**: Agregar a pantalla de inicio, funciona sin conexión
- **Diseño Responsive**: Optimizado para móvil, tablet y escritorio

---

## Tecnologías

<p align="center">
  <img src="https://img.shields.io/badge/HTML5-E34F26?style=for-the-badge&logo=html5&logoColor=white" alt="HTML5">
  <img src="https://img.shields.io/badge/CSS3-1572B6?style=for-the-badge&logo=css3&logoColor=white" alt="CSS3">
  <img src="https://img.shields.io/badge/JavaScript-F7DF1E?style=for-the-badge&logo=javascript&logoColor=black" alt="JavaScript">
  <img src="https://img.shields.io/badge/Bootstrap_5-7952B3?style=for-the-badge&logo=bootstrap&logoColor=white" alt="Bootstrap 5">
  <img src="https://img.shields.io/badge/Chart.js-FF6384?style=for-the-badge&logo=chart.js&logoColor=white" alt="Chart.js">
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Firebase-FFCA28?style=for-the-badge&logo=firebase&logoColor=black" alt="Firebase">
  <img src="https://img.shields.io/badge/Firestore-FFCA28?style=for-the-badge&logo=firebase&logoColor=black" alt="Firestore">
  <img src="https://img.shields.io/badge/GitHub-181717?style=for-the-badge&logo=github&logoColor=white" alt="GitHub">
  <img src="https://img.shields.io/badge/Google_Fonts-4285F4?style=for-the-badge&logo=google&logoColor=white" alt="Google Fonts">
  <img src="https://img.shields.io/badge/PWA-5A0FC8?style=for-the-badge&logo=pwa&logoColor=white" alt="PWA">
</p>

| Categoría | Tecnología |
|-----------|-------------|
| **Frontend** | HTML5, CSS3 (CSS Variables, Flexbox, Grid), Vanilla JavaScript |
| **Framework UI** | Bootstrap 5.3 |
| **Gráficos** | Chart.js 4.x |
| **Iconos** | Bootstrap Icons 1.11 |
| **Fuentes** | Plus Jakarta Sans (UI), JetBrains Mono (números) |
| **Backend/Auth** | Firebase Authentication (Google, Apple) |
| **Base de Datos** | Firebase Firestore |
| **Sincronización** | GitHub Gist API |
| **PWA** | Service Worker, Web App Manifest |
| **Almacenamiento** | LocalStorage + sincronización cloud |

---

## Arquitectura de la Aplicación

```
FinanzApp Pro/
├── index.html          # Punto de entrada SPA
├── app.js              # Lógica de UI, enrutamiento, render, charts
├── financeService.js   # Capa de datos: CRUD, storage, sync
├── styles.css          # Design system completo
├── sw.js               # Service Worker para PWA offline
├── manifest.json       # Web App Manifest (PWA)
└── .git/               # Control de versiones
```

### Flujo de Datos

```
┌─────────────┐     ┌──────────────────┐     ┌─────────────┐
│   UI Layer  │────▶│  FinanceService  │────▶│  Storage    │
│   (app.js)  │◀────│  (Logic Layer)   │◀────│ (Local + DB)│
└─────────────┘     └──────────────────┘     └─────────────┘
                           │
                           ▼
                    ┌─────────────┐
                    │   Sync      │
                    │ (Firebase/  │
                    │   Gist)     │
                    └─────────────┘
```

---

## Esquema de Base de Datos

### LocalStorage Keys (por usuario)

| Key | Descripción | Estructura |
|-----|-------------|------------|
| `{uid}_transactions` | Ingresos y egresos | `Array<Transaction>` |
| `{uid}_debts` | Deudas y préstamos | `Array<Debt>` |
| `{uid}_savings` | Cuentas de ahorro | `Array<Saving>` |
| `{uid}_tarjetas` | Tarjetas de crédito | `Array<Tarjeta>` |
| `{uid}_prestamos` | Préstamos grupales | `Array<Prestamo>` |
| `{uid}_clientes` | Clientes (prestamista) | `Array<Cliente>` |
| `{uid}_categories` | Categorías personalizadas | `Array<Category>` |

### Modelos de Datos

#### Transaction (Transacción)
```javascript
{
  id: "fp_1700000000_abc123",    // ID único generado
  type: "income" | "expense",    // Tipo de transacción
  description: "Salario mensual", // Descripción
  amount: 4500000,               // Monto (COP)
  date: "2024-01-15",            // Fecha ISO
  category: "Salario",           // Categoría
  origin: "tarjeta_pago" | "debt_payment" | "saving_reincorp", // Origen (opcional)
  debtId: "fp_xxx"              // ID deuda asociada (opcional)
}
```

#### Debt (Deuda)
```javascript
{
  id: "fp_1700000000_abc123",
  creditor: "Cooperativa Financiera",
  description: "Crédito libre inversión",
  debtType: "efectivo" | "virtual",
  totalAmount: 13000000,
  interestRate: 2.1,        // Tasa mensual %
  months: 48,
  cuota: 440990,
  hasSeguro: false,
  seguroBase: 0,
  hasAporte: true,
  aporteBase: 13103,
  startDate: "2024-01-01",
  remainingBalance: 11800000,
  gastado: 0,
  payments: [
    {
      id: "fp_xxx",
      date: "2024-02-01",
      amount: 440990,
      interest: 298000,
      capital: 142990,
      aporte: 13103,
      source: "libre"
    }
  ]
}
```

#### Saving (Cuenta de Ahorro)
```javascript
{
  id: "fp_1700000000_abc123",
  name: "Fondo de Emergencias",
  description: "3 meses de gastos",
  goal: 5000000,
  currentBalance: 2200000,
  transactions: [
    {
      id: "fp_xxx",
      type: "deposit" | "withdraw" | "use",
      amount: 500000,
      date: "2024-01-15",
      description: "Aporte mensual"
    }
  ]
}
```

#### Tarjeta (Tarjeta de Crédito)
```javascript
{
  id: "fp_xxx",
  nombre: "Banco Colombia",
  franquicia: "mastercard" | "visa" | "amex" | "otro",
  cupoAprobado: 10000000,
  cupoUsado: 3500000,
  tasa: 2.5,        // Tasa mensual %
  diaCorte: 15,
  diaPago: 5,
  descripcion: "Tarjeta principal",
  fechaInicio: "2023-06-01",
  movements: []
}
```

#### Cliente (Préstamos Grupales)
```javascript
{
  id: "fp_xxx",
  nombre: "Juan Pérez",
  telefono: "+573001234567",
  email: "juan@email.com",
  documento: "12345678",
  direccion: "Carrera 10 #20-30",
  notas: "Cliente frecuente",
  fechaCreacion: "2023-01-01"
}
```

#### Prestamo (Préstamo Grupal)
```javascript
{
  id: "fp_xxx",
  clienteId: "fp_client_xxx",
  monto: 5000000,
  tasa: 3.0,
  cuotas: 12,
  frecuencia: "mensual" | "quincenal" | "semanal",
  fecha: "2024-01-01",
  descripcion: "Préstamo personal",
  payments: [],
  totalPagado: 0
}
```

---

## Cómo Usar

### 🌐 Acceder Online (Recomendado)

La app está desplegada y lista para usar:

**👉 https://bradymoncada17.github.io/FinanzazAPP/**

Simplemente abre el enlace en tu navegador y commencer a usar la app.

### 📱 Agregar a Pantalla de Inicio (PWA)

Para una experiencia como app nativa, puedes instalar la app en tu dispositivo:

**En Chrome/Edge (Android, Windows, Mac):**
1. Abre **https://bradymoncada17.github.io/FinanzazAPP/** en el navegador
2. Verás el icono de instalación (📥) en la barra de direcciones o en el menú inferior
3. Haz clic en "Instalar FinanzApp Pro" o "Instalar app"
4. ¡Listo! La app aparecerá en tu launcher como una aplicación nativa

**En Safari (iOS/iPadOS):**
1. Abre **https://bradymoncada17.github.io/FinanzazAPP/** en Safari
2. Toca el botón de **Compartir** (⬆) en la barra de herramientas
3. Desplázate y selecciona **"Añadir a pantalla de inicio"**
4. Nombra la app y toca "Añadir"
5. La app aparecerá como acceso directo en tu pantalla de inicio

### 💻 Ejecutar Localmente (Desarrollo)

Si deseas modificar o desarrollar la app:

```bash
# Clona el repositorio
git clone https://github.com/bradymoncada17/FinanzazAPP.git

# Entra a la carpeta
cd FinanzazAPP

# Ejecuta con Python
python -m http.server 8000

# O con Node.js
npx serve .
```

Luego accede a: `http://localhost:8000`

### 📦 Descargar Código Fuente

1. Ve al repositorio: **https://github.com/bradymoncada17/FinanzazAPP**
2. Haz clic en el botón **"Code"** (verde)
3. Selecciona **"Download ZIP"** o clona con Git
4. Descomprime y abre `index.html` en tu navegador

---

## Modos de Uso

### Modo Invitado (Guest)
- Todos los datos se almacenan en LocalStorage
- Sincronización opcional con GitHub Gist (backup manual)
- Ideal para pruebas rápidas

### Modo Registrado (Firebase)
- Autenticación con Google o Apple
- Sincronización automática con Firestore
- Acceso desde múltiples dispositivos

### Sincronización con GitHub Gist

Para usuarios guest que quieren backup en la nube:
1. Genera un token de GitHub en: `Settings > Developer settings > Personal access tokens`
2. Selecciona alcance `gist`
3. En FinanzApp: Configuración > Sincronización Gist > Pegar token
4. Los datos se respaldarán automáticamente

---

## Capturas de Pantalla

La interfaz incluye:
- Login con degrade oscuro y botones sociales
- Dashboard con KPIs animados y gráficos Chart.js
- Sidebar flotante con animaciones y badges
- Vista transacciones con filtros y paginación
- Gestión de deudas con progreso y cálculo de intereses
- Sistema de ahorros con progress circular
- Diseño mobile-first con safe-area y notch support

---

## Actualizaciones y Mejoras

### Versión 1.2.4 (Actual)
- Animaciones avanzadas (orbits, typewriter, shimmer)
- Mejoras en experiencia mobile
- Optimización de rendimiento

### Próximas Funciones
- [ ] Reportes PDF exportables
- [ ] Modo oscuro completo
- [ ] Notificaciones push
- [ ] Integración con bancos (mock API)

---

## Licencia

MIT License - Feel free to use, modify and distribute.

---

## Créditos

- **Framework UI**: <img src="https://img.shields.io/badge/Bootstrap-7952B3?style=flat&logo=bootstrap" height="16"> Bootstrap 5.3
- **Iconos**: <img src="https://img.shields.io/badge/Bootstrap_Icons-7952B3?style=flat" height="16"> Bootstrap Icons
- **Gráficos**: <img src="https://img.shields.io/badge/Chart.js-FF6384?style=flat&logo=chart.js" height="16"> Chart.js
- **Fuentes**: <img src="https://img.shields.io/badge/Google_Fonts-4285F4?style=flat&logo=google" height="16"> Plus Jakarta Sans, JetBrains Mono
- **Backend**: <img src="https://img.shields.io/badge/Firebase-FFCA28?style=flat&logo=firebase" height="16"> Firebase, <img src="https://img.shields.io/badge/GitHub-181717?style=flat&logo=github" height="16"> GitHub API

---

<p align="center">
  <sub>Desarrollado con ❤️ por Brady Moncada</sub>
</p>