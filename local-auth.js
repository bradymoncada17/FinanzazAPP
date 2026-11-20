/* FinanzApp Pro: autenticación local del laboratorio Docker. */
(function () {
  'use strict';

  const API = '/api/auth';
  const MODE_KEY = 'fp_user_mode';
  const UID_KEY = 'fp_user_uid';
  const INTENT_KEY = 'fp_auth_intent';
  const NAME_KEY = 'fp_user_display_name';
  let initialized = false;

  function localAvailable() {
    return Boolean(window.FINANZAPP_CONFIG && window.FINANZAPP_CONFIG.sqlServerApi === true);
  }

  function setPanel(name) {
    const panelIds = {
      chooser: 'authChooser',
      local: 'authLocalPanel',
      online: 'authOnlinePanel'
    };
    Object.entries(panelIds).forEach(([key, id]) => {
      const panel = document.getElementById(id);
      if (panel) panel.hidden = key !== name;
    });
  }

  function setMessage(message, success) {
    const messageEl = document.getElementById('localAuthMessage');
    if (!messageEl) return;
    messageEl.textContent = message || '';
    messageEl.classList.toggle('is-success', Boolean(success && message));
  }

  function setPending(form, pending, label) {
    const button = form && form.querySelector('[type="submit"]');
    if (!button) return;
    if (!button.dataset.originalLabel) button.dataset.originalLabel = button.innerHTML;
    button.disabled = pending;
    button.setAttribute('aria-busy', pending ? 'true' : 'false');
    button.innerHTML = pending
      ? '<span class="spinner-border spinner-border-sm" aria-hidden="true"></span> Procesando…'
      : (label || button.dataset.originalLabel);
  }

  function updateEnvironment() {
    const available = localAvailable();
    const badge = document.getElementById('authEnvironmentBadge');
    const localButton = document.getElementById('authLocalModeButton');
    const modeNote = document.getElementById('authModeNote');
    const docker = document.querySelectorAll('[data-guest-action]');
    if (badge) {
      badge.innerHTML = available
        ? '<i class="bi bi-circle-fill" aria-hidden="true"></i> Laboratorio Docker · SQL local'
        : '<i class="bi bi-circle-fill" aria-hidden="true"></i> GitHub Pages · online';
    }
    if (localButton) {
      localButton.disabled = !available;
      localButton.setAttribute('aria-disabled', available ? 'false' : 'true');
      localButton.title = available ? 'Crear una cuenta local o iniciar sesión' : 'Este modo requiere ejecutar FinanzApp con Docker';
    }
    if (modeNote) {
      modeNote.innerHTML = available
        ? '<i class="bi bi-shield-lock" aria-hidden="true"></i> Las cuentas locales se guardan en la base FinanzApp de SQL Server de este laboratorio.'
        : '<i class="bi bi-info-circle" aria-hidden="true"></i> En GitHub Pages puedes iniciar con Google. Para usar cuentas SQL locales, ejecuta el laboratorio Docker en tu PC.';
    }
    docker.forEach((button) => button.classList.toggle('d-none', available));
  }

  function openMode(mode) {
    const target = mode === 'local' ? 'local' : 'online';
    if (target === 'local' && !localAvailable()) {
      setPanel('chooser');
      if (typeof window.showToast === 'function') {
        window.showToast('El inicio local requiere ejecutar la app desde Docker.', 'info');
      }
      return;
    }
    localStorage.setItem(INTENT_KEY, target);
    setPanel(target);
    if (target === 'local') {
      setMessage('');
      const loginForm = document.getElementById('localSignInForm');
      const registerForm = document.getElementById('localRegisterForm');
      if (loginForm) loginForm.hidden = false;
      if (registerForm) registerForm.hidden = true;
      const loginSwitch = document.getElementById('localLoginSwitch');
      const registerSwitch = document.getElementById('localRegisterSwitch');
      if (loginSwitch) loginSwitch.hidden = false;
      if (registerSwitch) registerSwitch.hidden = true;
      const heading = document.getElementById('localAuthHeading');
      const kicker = document.getElementById('localAuthKicker');
      if (heading) heading.textContent = 'Accede a tu espacio';
      if (kicker) kicker.textContent = 'Cuenta local · SQL Server';
      window.setTimeout(() => document.getElementById('localEmail')?.focus(), 80);
    }
  }

  function showChooser() {
    localStorage.setItem(INTENT_KEY, 'choose');
    setPanel('chooser');
    setMessage('');
  }

  function toggleForm(which) {
    const register = which === 'register';
    const loginForm = document.getElementById('localSignInForm');
    const registerForm = document.getElementById('localRegisterForm');
    const heading = document.getElementById('localAuthHeading');
    const kicker = document.getElementById('localAuthKicker');
    const loginSwitch = document.getElementById('localLoginSwitch');
    const registerSwitch = document.getElementById('localRegisterSwitch');
    if (loginForm) loginForm.hidden = register;
    if (registerForm) registerForm.hidden = !register;
    if (loginSwitch) loginSwitch.hidden = register;
    if (registerSwitch) registerSwitch.hidden = !register;
    if (heading) heading.textContent = register ? 'Crea tu cuenta local' : 'Accede a tu espacio';
    if (kicker) kicker.textContent = register ? 'Registro local · SQL Server' : 'Cuenta local · SQL Server';
    setMessage('');
    const focusId = register ? 'localDisplayName' : 'localEmail';
    window.setTimeout(() => document.getElementById(focusId)?.focus(), 50);
  }

  async function request(path, payload) {
    const response = await fetch(API + path, {
      method: payload ? 'POST' : 'GET',
      credentials: 'same-origin',
      cache: 'no-store',
      headers: payload ? { 'Content-Type': 'application/json' } : undefined,
      body: payload ? JSON.stringify(payload) : undefined
    });
    let result = {};
    try { result = await response.json(); } catch (error) { /* el servidor pudo responder HTML si la API no existe */ }
    if (!response.ok) {
      const error = new Error(result.error || (response.status === 401
        ? 'Correo o contraseña incorrectos.'
        : 'No se pudo completar la solicitud.'));
      error.status = response.status;
      throw error;
    }
    return result;
  }

  function rememberUser(user) {
    if (!user || !user.id) throw new Error('La respuesta del servidor no contiene una cuenta válida.');
    localStorage.setItem(MODE_KEY, 'local');
    localStorage.setItem(UID_KEY, user.id);
    localStorage.setItem(NAME_KEY, user.displayName || user.email || 'Usuario local');
    localStorage.setItem(INTENT_KEY, 'local');
    localStorage.removeItem('fp_user_role');
    return {
      uid: user.id,
      id: user.id,
      email: user.email || '',
      displayName: user.displayName || user.email || 'Usuario local',
      photoURL: null
    };
  }

  async function enterLocalSession(user) {
    const appUser = rememberUser(user);
    setMessage('Sesión local iniciada.', true);
    if (typeof window.initAppSession === 'function') {
      window.initAppSession(appUser);
    }
  }

  async function submitLogin(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const email = document.getElementById('localEmail')?.value.trim() || '';
    const password = document.getElementById('localPassword')?.value || '';
    setMessage('');
    setPending(form, true);
    try {
      const result = await request('/login', { email, password });
      await enterLocalSession(result.user);
    } catch (error) {
      setMessage(error.message || 'No se pudo iniciar sesión.');
    } finally {
      setPending(form, false);
    }
  }

  async function submitRegister(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const displayName = document.getElementById('localDisplayName')?.value.trim() || '';
    const email = document.getElementById('localRegisterEmail')?.value.trim() || '';
    const password = document.getElementById('localRegisterPassword')?.value || '';
    const confirmPassword = document.getElementById('localConfirmPassword')?.value || '';
    if (password !== confirmPassword) {
      setMessage('Las contraseñas no coinciden.');
      return;
    }
    if (password.length < 10) {
      setMessage('Usa al menos 10 caracteres para la contraseña.');
      return;
    }
    setMessage('');
    setPending(form, true);
    try {
      const result = await request('/register', { displayName, email, password });
      await enterLocalSession(result.user);
    } catch (error) {
      setMessage(error.message || 'No se pudo crear la cuenta.');
    } finally {
      setPending(form, false);
    }
  }

  async function restoreSession() {
    if (!localAvailable()) return false;
    try {
      const result = await request('/me');
      if (result.user) {
        await enterLocalSession(result.user);
        return true;
      }
    } catch (error) {
      if (error.status === 401) {
        if (localStorage.getItem(MODE_KEY) === 'local') {
          localStorage.removeItem(MODE_KEY);
          localStorage.removeItem(UID_KEY);
          localStorage.removeItem(NAME_KEY);
        }
        const intent = localStorage.getItem(INTENT_KEY);
        if (intent === 'local') {
          setPanel('local');
          setMessage('Tu sesión local terminó. Inicia sesión de nuevo.');
        } else if (intent === 'online') {
          setPanel('online');
        } else {
          setPanel('chooser');
        }
        document.getElementById('view-login')?.classList.remove('d-none');
        document.body.classList.remove('is-loading');
        return false;
      }
      console.warn('[Auth local] No fue posible comprobar la sesión:', error.message);
      const intent = localStorage.getItem(INTENT_KEY);
      if (intent === 'local') {
        setPanel('local');
        setMessage('No se pudo conectar con la API. Comprueba que los contenedores Docker estén activos.');
      } else {
        setPanel('chooser');
      }
      document.getElementById('view-login')?.classList.remove('d-none');
      document.body.classList.remove('is-loading');
      return false;
    }
    return false;
  }

  async function logout() {
    localStorage.setItem(INTENT_KEY, 'choose');
    try { await request('/logout', {}); } catch (error) {
      console.warn('[Auth local] Cierre de sesión remoto no confirmado:', error.message);
    }
    [MODE_KEY, UID_KEY, NAME_KEY, 'fp_user_role', 'fp_last_activity_ts', 'fp_hidden_since_ts'].forEach((key) => localStorage.removeItem(key));
    location.reload();
  }

  function init() {
    if (initialized) return;
    initialized = true;
    updateEnvironment();
    document.getElementById('localSignInForm')?.addEventListener('submit', submitLogin);
    document.getElementById('localRegisterForm')?.addEventListener('submit', submitRegister);
    document.querySelectorAll('[data-password-toggle]').forEach((button) => {
      button.addEventListener('click', () => {
        const input = document.getElementById(button.dataset.passwordToggle);
        if (!input) return;
        const reveal = input.type === 'password';
        input.type = reveal ? 'text' : 'password';
        button.setAttribute('aria-label', reveal ? 'Ocultar contraseña' : 'Mostrar contraseña');
        button.innerHTML = reveal ? '<i class="bi bi-eye-slash" aria-hidden="true"></i>' : '<i class="bi bi-eye" aria-hidden="true"></i>';
      });
    });
    if (localAvailable() && localStorage.getItem(INTENT_KEY) === 'local') setPanel('local');
  }

  window.LocalAuthUI = {
    init,
    restoreSession,
    openMode,
    showChooser,
    toggleForm,
    submitLogin,
    submitRegister,
    logout,
    localAvailable,
    isLocalMode: () => localAvailable() && localStorage.getItem(MODE_KEY) === 'local'
  };
})();
