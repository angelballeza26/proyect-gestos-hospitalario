const app = document.getElementById('app');

let state = {
  user: null,
  view: 'dashboard',
  dashboard: null,
  patients: [],
  equipment: [],
  roles: [],
  filters: { q: '', area: '', status: '', floor: '' },
  equipmentFilters: { status: '', type: '', location: '' },
  selectedPatientId: null,
  patientProfile: null,
  profileTab: 'overview',
  patientSection: 'register',
  authMode: 'login',
  equipmentFormOpen: false,
  equipmentEditId: null
};

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

async function api(path, options = {}) {
  const defaultOptions = { credentials: 'include', headers: { 'Content-Type': 'application/json' } };
  const response = await fetch(path, { ...defaultOptions, ...options, headers: { ...defaultOptions.headers, ...(options.headers || {}) } });
  const contentType = response.headers.get('content-type') || '';
  const data = contentType.includes('application/json') ? await response.json() : await response.text();
  if (!response.ok) {
    throw new Error(typeof data === 'string' ? data : (data.error || 'Error en la solicitud'));
  }
  return data;
}

function roleLabel(role) {
  if (role === 'general' || role === 'admin') return 'Administrador';
  if (role === 'doctor') return 'Médico';
  if (role === 'nurse') return 'Enfermería';
  if (role === 'engineer') return 'Ingeniería biomédica';
  return 'Administrativo';
}

function allowedViews(role) {
  if (role === 'doctor' || role === 'nurse') return ['dashboard', 'patients'];
  if (role === 'engineer') return ['dashboard', 'equipment'];
  return ['dashboard', 'patients', 'equipment'];
}

function viewTitle(view) {
  if (view === 'patients') return 'Gestión de pacientes';
  if (view === 'equipment') return 'Inventario y mantenimiento';
  return 'Panel general';
}

function viewSubtitle(view) {
  if (view === 'patients') return 'Registro, listado y perfil clínico del paciente';
  if (view === 'equipment') return 'Seguimiento rápido de equipos con problemas y mantenimiento';
  return 'Resumen operativo del centro hospitalario';
}

function formatAge(birthDate) {
  if (!birthDate) return 'Sin dato';
  const now = new Date();
  const birth = new Date(birthDate);
  let age = now.getFullYear() - birth.getFullYear();
  const monthDiff = now.getMonth() - birth.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && now.getDate() < birth.getDate())) age -= 1;
  return `${age} años`;
}

function formatDate(value) {
  if (!value) return '—';
  return new Date(value).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' });
}

function initials(name) {
  return (name || 'H').split(' ').slice(0, 2).map((word) => word[0]).join('').toUpperCase();
}

function statusTone(status) {
  if (!status) return 'bg-slate-100 text-slate-700';
  if (['Con falla', 'Averiado', 'En mantenimiento', 'En Quirófano', 'Hospitalizado'].includes(status)) return 'bg-amber-100 text-amber-700';
  if (['Disponible', 'Alta Médica'].includes(status)) return 'bg-emerald-100 text-emerald-700';
  if (['En uso', 'En Consulta', 'En Espera'].includes(status)) return 'bg-sky-100 text-sky-700';
  return 'bg-slate-100 text-slate-700';
}

function equipmentStatusTone(status) {
  if (!status) return 'bg-slate-100 text-slate-700';
  if (['Con falla', 'Averiado', 'En mantenimiento'].includes(status)) return 'bg-rose-100 text-rose-700';
  if (status === 'En uso') return 'bg-amber-100 text-amber-700';
  if (status === 'Disponible') return 'bg-emerald-100 text-emerald-700';
  return 'bg-slate-100 text-slate-700';
}

async function loadDashboard() {
  state.dashboard = await api('/api/dashboard');
}

async function loadPatients() {
  const query = new URLSearchParams(state.filters).toString();
  state.patients = await api(`/api/patients?${query}`);
  if (!state.selectedPatientId && state.patients.length) {
    state.selectedPatientId = state.patients[0].id;
  }
  if (state.selectedPatientId && !state.patients.some((patient) => patient.id === state.selectedPatientId)) {
    state.selectedPatientId = state.patients[0]?.id || null;
  }
}

async function loadEquipment() {
  const query = new URLSearchParams(state.equipmentFilters).toString();
  state.equipment = await api(`/api/equipment?${query}`);
}

async function loadPatientProfile() {
  if (!state.selectedPatientId) {
    state.patientProfile = null;
    return;
  }
  state.patientProfile = await api(`/api/patients/${state.selectedPatientId}/profile`);
}

function render() {
  if (!state.user) {
    renderAuth();
    return;
  }

  app.innerHTML = `
    <div class="min-h-screen bg-slate-100 text-slate-900">
      <div class="mx-auto flex min-h-screen max-w-7xl flex-col px-3 py-3 sm:px-4 lg:flex-row lg:gap-4 lg:px-6 lg:py-6">
        <aside class="w-full rounded-[28px] bg-slate-950 p-5 text-white shadow-2xl lg:sticky lg:top-4 lg:h-[calc(100vh-2rem)] lg:w-72 lg:p-6">
          <div class="flex items-center gap-3">
            <div class="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-600 text-lg font-semibold">H</div>
            <div>
              <p class="text-[11px] uppercase tracking-[0.35em] text-slate-400">Hospital</p>
              <h2 class="text-lg font-semibold">Gestión clínica</h2>
            </div>
          </div>
          <div class="mt-6 rounded-2xl border border-white/10 bg-white/10 p-4">
            <p class="text-sm text-slate-300">Sesión activa</p>
            <p class="mt-1 text-base font-semibold">${escapeHtml(state.user.name)}</p>
            <p class="text-sm text-slate-400">${escapeHtml(roleLabel(state.user.role))}</p>
          </div>
          <nav class="mt-6 space-y-2">
            ${allowedViews(state.user.role).map((view) => `
              <button data-view="${view}" class="flex w-full items-center justify-between rounded-2xl px-4 py-3 text-left text-sm font-medium transition ${state.view === view ? 'bg-blue-600 text-white shadow-lg' : 'bg-white/5 text-slate-200 hover:bg-white/10'}">
                <span>${view === 'dashboard' ? 'Panel principal' : view === 'patients' ? 'Pacientes' : 'Equipos'}</span>
                <i class="fa-solid ${view === 'dashboard' ? 'fa-gauge-high' : view === 'patients' ? 'fa-hospital-user' : 'fa-stethoscope'}"></i>
              </button>
            `).join('')}
          </nav>
          <button id="logoutBtn" class="mt-8 flex w-full items-center justify-center gap-2 rounded-2xl bg-white px-4 py-3 font-semibold text-slate-900">
            <i class="fa-solid fa-right-from-bracket"></i>
            Cerrar sesión
          </button>
        </aside>
        <main class="flex-1 rounded-[28px] bg-white p-4 shadow-xl sm:p-6 lg:p-8">
          <header class="mb-6 flex flex-col gap-3 border-b border-slate-200 pb-5 md:flex-row md:items-center md:justify-between">
            <div>
              <p class="text-sm font-semibold uppercase tracking-[0.3em] text-blue-700">${escapeHtml(viewTitle(state.view))}</p>
              <h1 class="text-2xl font-semibold text-slate-900">${escapeHtml(viewSubtitle(state.view))}</h1>
            </div>
            <div class="rounded-2xl bg-slate-100 px-4 py-3 text-sm text-slate-600">
              <i class="fa-solid fa-shield-heart mr-2 text-emerald-600"></i>
              Operación segura y auditada
            </div>
          </header>
          <div id="mainContent"></div>
        </main>
      </div>
    </div>
  `;

  document.querySelectorAll('[data-view]').forEach((button) => {
    button.addEventListener('click', () => {
      state.view = button.dataset.view;
      renderView();
    });
  });

  document.getElementById('logoutBtn').addEventListener('click', async () => {
    try {
      await api('/api/logout', { method: 'POST' });
    } catch (error) {
      console.error(error);
    }
    state.user = null;
    state.view = 'dashboard';
    state.dashboard = null;
    state.patients = [];
    state.equipment = [];
    state.selectedPatientId = null;
    state.patientProfile = null;
    state.patientSection = 'register';
    state.equipmentFormOpen = false;
    state.equipmentEditId = null;
    render();
  });

  renderView();
}

function renderAuth() {
  app.innerHTML = `
    <div class="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(30,64,175,0.2),_transparent_35%),linear-gradient(135deg,_#0f172a_0%,_#1e40af_100%)] px-4 py-6 sm:px-6 lg:px-8">
      <div class="mx-auto flex min-h-screen max-w-6xl items-center justify-center">
        <div class="w-full max-w-5xl overflow-hidden rounded-[32px] bg-white shadow-2xl lg:grid lg:grid-cols-[1.05fr_0.95fr]">
          <div class="bg-slate-950 px-6 py-8 text-white sm:px-8 lg:px-10 lg:py-10">
            <p class="text-sm font-semibold uppercase tracking-[0.35em] text-blue-300">Sistema hospitalario</p>
            <h1 class="mt-3 text-3xl font-semibold sm:text-4xl">Gestión clínica, pacientes y equipos en un solo lugar.</h1>
            <p class="mt-4 max-w-lg text-base leading-7 text-slate-300">Flujo de pacientes por áreas, historial, traslados, notas y equipos con fallas en una experiencia preparada para desktop y móvil.</p>
            <div class="mt-8 space-y-3 text-sm text-slate-300">
              <div class="rounded-2xl border border-white/10 bg-white/10 p-3">✓ Registro por roles y acceso seguro</div>
              <div class="rounded-2xl border border-white/10 bg-white/10 p-3">✓ Perfil clínico completo por tabs</div>
              <div class="rounded-2xl border border-white/10 bg-white/10 p-3">✓ Vista urgente de equipos con problemas</div>
            </div>
          </div>
          <div class="px-5 py-6 sm:px-8 sm:py-8 lg:px-10">
            <div class="flex flex-wrap gap-2 rounded-2xl bg-slate-100 p-2">
              <button id="showLoginTab" class="flex-1 rounded-2xl px-4 py-3 text-sm font-semibold ${state.authMode === 'login' ? 'bg-blue-600 text-white shadow' : 'bg-transparent text-slate-600'}">Iniciar sesión</button>
              <button id="showRegisterTab" class="flex-1 rounded-2xl px-4 py-3 text-sm font-semibold ${state.authMode === 'register' ? 'bg-blue-600 text-white shadow' : 'bg-transparent text-slate-600'}">Crear cuenta</button>
            </div>
            <div id="authPanel" class="mt-5"></div>
            <p class="mt-5 text-sm text-slate-500">Demo: admin / admin123</p>
          </div>
        </div>
      </div>
    </div>
  `;

  document.getElementById('showLoginTab').addEventListener('click', () => {
    state.authMode = 'login';
    renderAuthPanel();
  });
  document.getElementById('showRegisterTab').addEventListener('click', async () => {
    state.authMode = 'register';
    if (!state.roles.length) {
      state.roles = await api('/api/roles');
    }
    renderAuthPanel();
  });
  renderAuthPanel();
}

async function renderAuthPanel() {
  const panel = document.getElementById('authPanel');
  if (state.authMode === 'register') {
    panel.innerHTML = `
      <form id="registerForm" class="space-y-4">
        <div class="grid gap-4 sm:grid-cols-2">
          <label class="block text-sm font-medium text-slate-700">
            <span class="mb-2 block">Nombre completo</span>
            <input name="full_name" required class="w-full rounded-2xl border border-slate-200 px-4 py-3" />
          </label>
          <label class="block text-sm font-medium text-slate-700">
            <span class="mb-2 block">Usuario</span>
            <input name="username" required class="w-full rounded-2xl border border-slate-200 px-4 py-3" />
          </label>
          <label class="block text-sm font-medium text-slate-700">
            <span class="mb-2 block">Correo</span>
            <input name="email" type="email" class="w-full rounded-2xl border border-slate-200 px-4 py-3" />
          </label>
          <label class="block text-sm font-medium text-slate-700">
            <span class="mb-2 block">Contraseña</span>
            <input name="password" type="password" required class="w-full rounded-2xl border border-slate-200 px-4 py-3" />
          </label>
          <label class="block text-sm font-medium text-slate-700">
            <span class="mb-2 block">Rol</span>
            <select name="role" required class="w-full rounded-2xl border border-slate-200 px-4 py-3">
              ${state.roles.map((role) => `<option value="${escapeHtml(role.name)}">${escapeHtml(role.description)}</option>`).join('')}
            </select>
          </label>
          <label class="block text-sm font-medium text-slate-700">
            <span class="mb-2 block">Especialidad</span>
            <input name="specialty" class="w-full rounded-2xl border border-slate-200 px-4 py-3" />
          </label>
        </div>
        <button class="w-full rounded-2xl bg-blue-600 px-4 py-3 font-semibold text-white" type="submit">Crear cuenta</button>
        <p id="authMessage" class="min-h-6 text-sm"></p>
      </form>
    `;
    document.getElementById('registerForm').addEventListener('submit', async (event) => {
      event.preventDefault();
      const payload = Object.fromEntries(new FormData(event.target));
      const message = document.getElementById('authMessage');
      try {
        const data = await api('/api/register', { method: 'POST', body: JSON.stringify(payload) });
        state.user = data.user;
        message.className = 'min-h-6 text-sm text-emerald-600';
        message.textContent = 'Cuenta creada correctamente';
        render();
      } catch (error) {
        message.className = 'min-h-6 text-sm text-rose-600';
        message.textContent = error.message;
      }
    });
    return;
  }

  panel.innerHTML = `
    <form id="loginForm" class="space-y-4">
      <label class="block text-sm font-medium text-slate-700">
        <span class="mb-2 block">Correo o usuario</span>
        <input id="loginUser" type="text" required class="w-full rounded-2xl border border-slate-200 px-4 py-3" />
      </label>
      <label class="block text-sm font-medium text-slate-700">
        <span class="mb-2 block">Contraseña</span>
        <input id="loginPass" type="password" required class="w-full rounded-2xl border border-slate-200 px-4 py-3" />
      </label>
      <button class="w-full rounded-2xl bg-blue-600 px-4 py-3 font-semibold text-white" type="submit">Entrar al sistema</button>
      <p id="authMessage" class="min-h-6 text-sm"></p>
    </form>
  `;

  document.getElementById('loginForm').addEventListener('submit', async (event) => {
    event.preventDefault();
    const loginValue = document.getElementById('loginUser').value.trim();
    const password = document.getElementById('loginPass').value;
    const message = document.getElementById('authMessage');
    try {
      const data = await api('/api/login', {
        method: 'POST',
        body: JSON.stringify({ username: loginValue, email: loginValue.includes('@') ? loginValue : null, password })
      });
      state.user = data.user;
      message.className = 'min-h-6 text-sm text-emerald-600';
      message.textContent = 'Bienvenido';
      render();
    } catch (error) {
      message.className = 'min-h-6 text-sm text-rose-600';
      message.textContent = error.message;
    }
  });
}

async function renderView() {
  const main = document.getElementById('mainContent');
  if (state.view === 'dashboard') {
    if (!state.dashboard) await loadDashboard();
    const criticalEquipment = (state.dashboard.equipment || []).filter((equipment) => ['Con falla', 'Averiado', 'En mantenimiento'].includes(equipment.status));
    main.innerHTML = `
      <div class="space-y-6">
        <section class="rounded-[28px] border border-blue-100 bg-gradient-to-br from-blue-600 to-sky-600 p-6 text-white shadow-lg">
          <div class="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p class="text-sm font-semibold uppercase tracking-[0.3em] text-blue-100">Resumen operativo</p>
              <h2 class="mt-2 text-2xl font-semibold">Monitoreo clínico y operativo en tiempo real</h2>
              <p class="mt-2 max-w-2xl text-sm text-blue-50">Panel diseñado para priorizar pacientes, traslados, urgencias y equipos críticos.</p>
            </div>
            <div class="rounded-2xl bg-white/15 px-4 py-3 text-sm">${state.dashboard.hospitalized} pacientes hospitalizados</div>
          </div>
        </section>
        <div class="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          ${[
            { title: 'Pacientes hospitalizados', value: state.dashboard.hospitalized, icon: 'fa-bed', accent: 'from-blue-500 to-indigo-600' },
            { title: 'Urgencias', value: state.dashboard.urgencias, icon: 'fa-triangle-exclamation', accent: 'from-amber-500 to-orange-500' },
            { title: 'Quirófano', value: state.dashboard.quirurgico, icon: 'fa-kit-medical', accent: 'from-emerald-500 to-green-600' },
            { title: 'Estudios de imagen', value: state.dashboard.images, icon: 'fa-x-ray', accent: 'from-slate-700 to-slate-900' }
          ].map((card) => `
            <div class="rounded-[24px] border border-slate-200 bg-slate-50 p-5 shadow-sm">
              <div class="flex items-start justify-between">
                <div>
                  <p class="text-sm text-slate-500">${escapeHtml(card.title)}</p>
                  <p class="mt-2 text-3xl font-semibold text-slate-900">${card.value}</p>
                </div>
                <div class="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br ${card.accent} text-white">
                  <i class="fa-solid ${card.icon}"></i>
                </div>
              </div>
            </div>
          `).join('')}
        </div>
        <div class="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
          <div class="rounded-[24px] border border-emerald-200 bg-emerald-50 p-5 shadow-sm">
            <div class="mb-4 flex items-center justify-between">
              <div>
                <p class="text-sm font-semibold uppercase tracking-[0.3em] text-emerald-700">Pacientes recientes</p>
                <h2 class="text-lg font-semibold text-slate-900">Últimos ingresos y seguimientos</h2>
              </div>
              <span class="rounded-full bg-white px-3 py-1 text-sm font-medium text-emerald-700">Bienvenido</span>
            </div>
            <div class="space-y-3">
              ${state.dashboard.patients.map((patient) => `
                <div class="flex items-center justify-between rounded-2xl border border-emerald-200 bg-white px-4 py-3">
                  <div>
                    <p class="font-semibold text-slate-900">${escapeHtml(`${patient.first_name} ${patient.last_name}`)}</p>
                    <p class="text-sm text-slate-500">${escapeHtml(patient.area)} • ${escapeHtml(patient.status)}</p>
                  </div>
                  <span class="rounded-full bg-emerald-100 px-3 py-1 text-sm font-medium text-emerald-700">${escapeHtml(patient.status)}</span>
                </div>
              `).join('')}
            </div>
          </div>
          <div class="rounded-[24px] border border-rose-200 bg-rose-50 p-5 shadow-sm">
            <div class="mb-4 flex items-center justify-between">
              <div>
                <p class="text-sm font-semibold uppercase tracking-[0.3em] text-rose-700">Equipos con problemas</p>
                <h2 class="text-lg font-semibold text-slate-900">Urgentes y priorizados</h2>
              </div>
              <span class="rounded-full bg-white px-3 py-1 text-sm font-medium text-rose-700">Atención</span>
            </div>
            <div class="space-y-3">
              ${criticalEquipment.length ? criticalEquipment.map((equipment) => `
                <div class="rounded-2xl border border-rose-200 bg-white px-4 py-3">
                  <p class="font-semibold text-slate-900">${escapeHtml(equipment.name)}</p>
                  <p class="text-sm text-slate-500">${escapeHtml(equipment.code)} • ${escapeHtml(equipment.status)} • ${escapeHtml(equipment.area || 'Sin área')}</p>
                </div>
              `).join('') : '<p class="rounded-2xl border border-dashed border-rose-300 bg-white p-4 text-sm text-slate-500">No hay equipos con fallas registradas.</p>'}
            </div>
          </div>
        </div>
      </div>
    `;
    return;
  }

  if (state.view === 'patients') {
    await loadPatients();
    if (!state.selectedPatientId && state.patients.length) {
      state.selectedPatientId = state.patients[0].id;
    }
    if (!state.patientProfile && state.selectedPatientId) {
      await loadPatientProfile();
    }

    main.innerHTML = `
      <div class="space-y-6">
        <div class="flex flex-wrap gap-2 rounded-[24px] border border-slate-200 bg-slate-50 p-2">
          ${['register', 'list', 'profile'].map((section) => `
            <button data-patient-section="${section}" class="flex-1 rounded-2xl px-4 py-3 text-sm font-semibold transition ${state.patientSection === section ? 'bg-blue-600 text-white shadow' : 'bg-transparent text-slate-600'}">
              ${section === 'register' ? 'Registro de paciente' : section === 'list' ? 'Listado de pacientes' : 'Perfil del paciente'}
            </button>
          `).join('')}
        </div>
        ${state.patientSection === 'register' ? `
          <section class="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm">
            <div class="mb-4">
              <p class="text-sm font-semibold uppercase tracking-[0.3em] text-blue-700">Página 1</p>
              <h2 class="text-xl font-semibold text-slate-900">Registro de paciente</h2>
            </div>
            <form id="patientForm" class="space-y-4">
              <div class="grid gap-4 sm:grid-cols-2">
                <label class="block text-sm font-medium text-slate-700"><span class="mb-2 block">Nombre</span><input name="first_name" required class="w-full rounded-2xl border border-slate-200 px-4 py-3" /></label>
                <label class="block text-sm font-medium text-slate-700"><span class="mb-2 block">Apellido</span><input name="last_name" required class="w-full rounded-2xl border border-slate-200 px-4 py-3" /></label>
                <label class="block text-sm font-medium text-slate-700"><span class="mb-2 block">DNI/RUT</span><input name="dni" required class="w-full rounded-2xl border border-slate-200 px-4 py-3" /></label>
                <label class="block text-sm font-medium text-slate-700"><span class="mb-2 block">Fecha de nacimiento</span><input name="birth_date" type="date" required class="w-full rounded-2xl border border-slate-200 px-4 py-3" /></label>
                <label class="block text-sm font-medium text-slate-700"><span class="mb-2 block">Género</span><select name="gender" class="w-full rounded-2xl border border-slate-200 px-4 py-3"><option>Femenino</option><option>Masculino</option><option>Otro</option></select></label>
                <label class="block text-sm font-medium text-slate-700"><span class="mb-2 block">Teléfono</span><input name="phone" class="w-full rounded-2xl border border-slate-200 px-4 py-3" /></label>
                <label class="block text-sm font-medium text-slate-700"><span class="mb-2 block">Motivo de ingreso</span><input name="reason" class="w-full rounded-2xl border border-slate-200 px-4 py-3" /></label>
                <label class="block text-sm font-medium text-slate-700"><span class="mb-2 block">Doctor asignado</span><input name="assigned_doctor" class="w-full rounded-2xl border border-slate-200 px-4 py-3" /></label>
                <label class="block text-sm font-medium text-slate-700"><span class="mb-2 block">Área</span><select name="area" class="w-full rounded-2xl border border-slate-200 px-4 py-3"><option>Urgencias</option><option>Sala de Espera</option><option>Consultas</option><option>Quirófano</option><option>Hospitalización</option><option>Rayos X</option><option>Tomografía</option><option>Resonancia</option></select></label>
                <label class="block text-sm font-medium text-slate-700"><span class="mb-2 block">Piso</span><select name="floor" class="w-full rounded-2xl border border-slate-200 px-4 py-3"><option>Piso 1</option><option>Piso 2</option><option>Piso 3</option></select></label>
                <label class="block text-sm font-medium text-slate-700"><span class="mb-2 block">Estado</span><select name="status" class="w-full rounded-2xl border border-slate-200 px-4 py-3"><option>En Espera</option><option>En Consulta</option><option>En Quirófano</option><option>Hospitalizado</option><option>Alta Médica</option><option>Trasladado</option></select></label>
                <label class="block text-sm font-medium text-slate-700"><span class="mb-2 block">Habitación</span><input name="room" class="w-full rounded-2xl border border-slate-200 px-4 py-3" /></label>
              </div>
              <label class="block text-sm font-medium text-slate-700"><span class="mb-2 block">Diagnóstico inicial</span><textarea name="diagnosis" class="w-full rounded-2xl border border-slate-200 px-4 py-3" rows="3"></textarea></label>
              <div class="flex flex-wrap gap-3">
                <button type="submit" class="rounded-2xl bg-blue-600 px-4 py-3 font-semibold text-white">Registrar paciente</button>
                <button type="button" id="resetPatientBtn" class="rounded-2xl bg-slate-100 px-4 py-3 font-semibold text-slate-700">Limpiar</button>
              </div>
            </form>
          </section>
        ` : ''}
        ${state.patientSection === 'list' ? `
          <div class="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
            <section class="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm">
              <div class="mb-4">
                <p class="text-sm font-semibold uppercase tracking-[0.3em] text-blue-700">Página 2</p>
                <h2 class="text-xl font-semibold text-slate-900">Listado de pacientes</h2>
              </div>
              <div class="grid gap-4 sm:grid-cols-2">
                <label class="block text-sm font-medium text-slate-700"><span class="mb-2 block">Buscar por nombre o DNI</span><input id="filterQ" class="w-full rounded-2xl border border-slate-200 px-4 py-3" value="${escapeHtml(state.filters.q)}" /></label>
                <label class="block text-sm font-medium text-slate-700"><span class="mb-2 block">Área</span><select id="filterArea" class="w-full rounded-2xl border border-slate-200 px-4 py-3"><option value="">Todas</option><option value="Urgencias" ${state.filters.area === 'Urgencias' ? 'selected' : ''}>Urgencias</option><option value="Sala de Espera" ${state.filters.area === 'Sala de Espera' ? 'selected' : ''}>Sala de Espera</option><option value="Consultas" ${state.filters.area === 'Consultas' ? 'selected' : ''}>Consultas</option><option value="Quirófano" ${state.filters.area === 'Quirófano' ? 'selected' : ''}>Quirófano</option><option value="Hospitalización" ${state.filters.area === 'Hospitalización' ? 'selected' : ''}>Hospitalización</option><option value="Rayos X" ${state.filters.area === 'Rayos X' ? 'selected' : ''}>Rayos X</option><option value="Tomografía" ${state.filters.area === 'Tomografía' ? 'selected' : ''}>Tomografía</option><option value="Resonancia" ${state.filters.area === 'Resonancia' ? 'selected' : ''}>Resonancia</option></select></label>
                <label class="block text-sm font-medium text-slate-700"><span class="mb-2 block">Estado</span><select id="filterStatus" class="w-full rounded-2xl border border-slate-200 px-4 py-3"><option value="">Todos</option><option value="En Espera" ${state.filters.status === 'En Espera' ? 'selected' : ''}>En Espera</option><option value="Hospitalizado" ${state.filters.status === 'Hospitalizado' ? 'selected' : ''}>Hospitalizado</option><option value="Alta Médica" ${state.filters.status === 'Alta Médica' ? 'selected' : ''}>Alta Médica</option><option value="Trasladado" ${state.filters.status === 'Trasladado' ? 'selected' : ''}>Trasladado</option></select></label>
                <label class="block text-sm font-medium text-slate-700"><span class="mb-2 block">Piso</span><select id="filterFloor" class="w-full rounded-2xl border border-slate-200 px-4 py-3"><option value="">Todos</option><option value="Piso 1" ${state.filters.floor === 'Piso 1' ? 'selected' : ''}>Piso 1</option><option value="Piso 2" ${state.filters.floor === 'Piso 2' ? 'selected' : ''}>Piso 2</option><option value="Piso 3" ${state.filters.floor === 'Piso 3' ? 'selected' : ''}>Piso 3</option></select></label>
              </div>
              <div class="mt-4 flex gap-3">
                <button id="applyFiltersBtn" class="rounded-2xl bg-slate-900 px-4 py-3 font-semibold text-white">Aplicar filtros</button>
                <button id="clearFiltersBtn" class="rounded-2xl bg-slate-100 px-4 py-3 font-semibold text-slate-700">Limpiar</button>
              </div>
            </section>
            <section class="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm">
              <div class="space-y-3">
                ${state.patients.length ? state.patients.map((patient) => `
                  <button data-select-patient="${patient.id}" class="flex w-full items-center justify-between rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 text-left transition hover:border-blue-300 hover:bg-blue-50">
                    <div>
                      <p class="font-semibold text-slate-900">${escapeHtml(`${patient.first_name} ${patient.last_name}`)}</p>
                      <p class="text-sm text-slate-500">${escapeHtml(patient.area)} • ${escapeHtml(patient.status)}</p>
                    </div>
                    <span class="rounded-full bg-blue-100 px-3 py-1 text-sm font-medium text-blue-700">${escapeHtml(patient.dni)}</span>
                  </button>
                `).join('') : '<p class="rounded-2xl bg-slate-50 p-4 text-sm text-slate-500">No hay pacientes con esos filtros.</p>'}
              </div>
            </section>
          </div>
        ` : ''}
        ${state.patientSection === 'profile' ? `
          <section class="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm">
            ${state.selectedPatientId && state.patientProfile ? renderPatientProfilePanel() : '<div class="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-6 text-sm text-slate-500">Selecciona un paciente para abrir su perfil completo.</div>'}
          </section>
        ` : ''}
      </div>
    `;

    document.querySelectorAll('[data-patient-section]').forEach((button) => {
      button.addEventListener('click', () => {
        state.patientSection = button.dataset.patientSection;
        renderView();
      });
    });

    document.getElementById('patientForm')?.addEventListener('submit', async (event) => {
      event.preventDefault();
      const payload = Object.fromEntries(new FormData(event.target));
      try {
        await api('/api/patients', { method: 'POST', body: JSON.stringify(payload) });
        await loadPatients();
        if (state.patients.length) {
          state.selectedPatientId = state.patients[0].id;
          await loadPatientProfile();
        }
        state.patientSection = 'list';
        renderView();
      } catch (error) {
        alert(error.message);
      }
    });

    document.getElementById('resetPatientBtn')?.addEventListener('click', () => document.getElementById('patientForm').reset());
    document.getElementById('applyFiltersBtn')?.addEventListener('click', async () => {
      state.filters.q = document.getElementById('filterQ').value;
      state.filters.area = document.getElementById('filterArea').value;
      state.filters.status = document.getElementById('filterStatus').value;
      state.filters.floor = document.getElementById('filterFloor').value;
      await loadPatients();
      renderView();
    });
    document.getElementById('clearFiltersBtn')?.addEventListener('click', async () => {
      state.filters = { q: '', area: '', status: '', floor: '' };
      await loadPatients();
      renderView();
    });
    document.querySelectorAll('[data-select-patient]').forEach((button) => {
      button.addEventListener('click', async () => {
        state.selectedPatientId = Number(button.dataset.selectPatient);
        state.patientSection = 'profile';
        await loadPatientProfile();
        renderView();
      });
    });

    if (state.selectedPatientId && state.patientProfile) {
      document.querySelectorAll('[data-profile-tab]').forEach((button) => {
        button.addEventListener('click', () => {
          state.profileTab = button.dataset.profileTab;
          renderView();
        });
      });

      const overviewForm = document.getElementById('patientOverviewForm');
      if (overviewForm) {
        overviewForm.addEventListener('submit', async (event) => {
          event.preventDefault();
          const values = Object.fromEntries(new FormData(event.target));
          try {
            await api(`/api/patients/${state.selectedPatientId}`, { method: 'PUT', body: JSON.stringify(values) });
            await loadPatientProfile();
            renderView();
          } catch (error) {
            alert(error.message);
          }
        });
      }

      const statusForm = document.getElementById('patientStatusForm');
      if (statusForm) {
        statusForm.addEventListener('submit', async (event) => {
          event.preventDefault();
          const payload = Object.fromEntries(new FormData(event.target));
          try {
            await api(`/api/patients/${state.selectedPatientId}/move`, { method: 'POST', body: JSON.stringify(payload) });
            await loadPatientProfile();
            renderView();
          } catch (error) {
            alert(error.message);
          }
        });
      }

      const noteForm = document.getElementById('patientNoteForm');
      if (noteForm) {
        noteForm.addEventListener('submit', async (event) => {
          event.preventDefault();
          const payload = Object.fromEntries(new FormData(event.target));
          try {
            await api(`/api/patients/${state.selectedPatientId}/notes`, { method: 'POST', body: JSON.stringify(payload) });
            await loadPatientProfile();
            renderView();
          } catch (error) {
            alert(error.message);
          }
        });
      }

      const procedureForm = document.getElementById('patientProcedureForm');
      if (procedureForm) {
        procedureForm.addEventListener('submit', async (event) => {
          event.preventDefault();
          const payload = Object.fromEntries(new FormData(event.target));
          try {
            await api(`/api/patients/${state.selectedPatientId}/procedures`, { method: 'POST', body: JSON.stringify(payload) });
            await loadPatientProfile();
            renderView();
          } catch (error) {
            alert(error.message);
          }
        });
      }

      const documentForm = document.getElementById('patientDocumentForm');
      if (documentForm) {
        documentForm.addEventListener('submit', async (event) => {
          event.preventDefault();
          const payload = Object.fromEntries(new FormData(event.target));
          try {
            await api(`/api/patients/${state.selectedPatientId}/documents`, { method: 'POST', body: JSON.stringify(payload) });
            await loadPatientProfile();
            renderView();
          } catch (error) {
            alert(error.message);
          }
        });
      }

      document.getElementById('dischargePatientBtn')?.addEventListener('click', async () => {
        try {
          await api(`/api/patients/${state.selectedPatientId}/move`, {
            method: 'POST',
            body: JSON.stringify({ area: 'Hospitalización', status: 'Alta Médica', floor: 'Piso 1', room: '', bed: '', notes: 'Alta médica registrada desde la interfaz' })
          });
          await loadPatientProfile();
          renderView();
        } catch (error) {
          alert(error.message);
        }
      });
    }

    return;
  }

  if (state.view === 'equipment') {
    if (!state.equipment.length) await loadEquipment();
    const problemEquipment = state.equipment.filter((item) => ['Con falla', 'Averiado', 'En mantenimiento'].includes(item.status));
    const editEquipment = state.equipment.find((item) => item.id === state.equipmentEditId) || null;
    main.innerHTML = `
      <div class="space-y-6">
        <section class="rounded-[28px] border border-rose-200 bg-rose-50 p-5 shadow-sm">
          <div class="mb-4 flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p class="text-sm font-semibold uppercase tracking-[0.3em] text-rose-700">Equipos con problemas</p>
              <h2 class="text-xl font-semibold text-slate-900">Prioridad inmediata en mantenimiento</h2>
            </div>
            <button id="openEquipmentFormBtn" class="rounded-2xl bg-rose-600 px-4 py-3 font-semibold text-white">+ Nuevo equipo</button>
          </div>
          <div class="grid gap-3 md:grid-cols-3">
            ${problemEquipment.length ? problemEquipment.map((item) => `
              <div class="rounded-2xl border border-rose-200 bg-white p-4">
                <p class="font-semibold text-slate-900">${escapeHtml(item.name)}</p>
                <p class="mt-1 text-sm text-slate-500">${escapeHtml(item.code)} • ${escapeHtml(item.type)}</p>
                <span class="mt-3 inline-flex rounded-full bg-rose-100 px-3 py-1 text-sm font-medium text-rose-700">${escapeHtml(item.status)}</span>
              </div>
            `).join('') : '<div class="rounded-2xl border border-dashed border-rose-300 bg-white p-4 text-sm text-slate-500">No hay equipos críticos.</div>'}
          </div>
        </section>
        <section class="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm">
          <div class="mb-4 flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p class="text-sm font-semibold uppercase tracking-[0.3em] text-blue-700">Inventario</p>
              <h2 class="text-xl font-semibold text-slate-900">Listado completo de equipos médicos</h2>
            </div>
            <div class="flex flex-wrap gap-3">
              <select id="filterEquipmentStatus" class="rounded-2xl border border-slate-200 px-3 py-2 text-sm"><option value="">Todos los estados</option><option value="Disponible" ${state.equipmentFilters.status === 'Disponible' ? 'selected' : ''}>Disponible</option><option value="En uso" ${state.equipmentFilters.status === 'En uso' ? 'selected' : ''}>En uso</option><option value="En mantenimiento" ${state.equipmentFilters.status === 'En mantenimiento' ? 'selected' : ''}>En mantenimiento</option><option value="Con falla" ${state.equipmentFilters.status === 'Con falla' ? 'selected' : ''}>Con falla</option><option value="Averiado" ${state.equipmentFilters.status === 'Averiado' ? 'selected' : ''}>Averiado</option></select>
              <select id="filterEquipmentType" class="rounded-2xl border border-slate-200 px-3 py-2 text-sm"><option value="">Todos los tipos</option>${state.equipment.map((item) => item.type).filter((value, index, array) => array.indexOf(value) === index).map((type) => `<option value="${escapeHtml(type)}" ${state.equipmentFilters.type === type ? 'selected' : ''}>${escapeHtml(type)}</option>`).join('')}</select>
              <input id="filterEquipmentLocation" value="${escapeHtml(state.equipmentFilters.location)}" placeholder="Ubicación" class="rounded-2xl border border-slate-200 px-3 py-2 text-sm" />
            </div>
          </div>
          ${state.equipmentFormOpen ? `
            <div class="mb-5 rounded-[24px] border border-slate-200 bg-slate-50 p-4">
              <div class="mb-4 flex items-center justify-between">
                <h3 class="text-lg font-semibold text-slate-900">${editEquipment ? 'Editar equipo médico' : 'Agregar nuevo equipo médico'}</h3>
                <button id="cancelEquipmentFormBtn" class="rounded-2xl bg-white px-3 py-2 text-sm font-semibold text-slate-700">Cancelar</button>
              </div>
              <form id="equipmentForm" class="space-y-4">
                <div class="grid gap-4 md:grid-cols-2">
                  <label class="block text-sm font-medium text-slate-700"><span class="mb-2 block">Nombre</span><input name="name" required value="${editEquipment ? escapeHtml(editEquipment.name) : ''}" class="w-full rounded-2xl border border-slate-200 px-4 py-3" /></label>
                  <label class="block text-sm font-medium text-slate-700"><span class="mb-2 block">Código</span><input name="code" required value="${editEquipment ? escapeHtml(editEquipment.code) : ''}" class="w-full rounded-2xl border border-slate-200 px-4 py-3" /></label>
                  <label class="block text-sm font-medium text-slate-700"><span class="mb-2 block">Tipo</span><input name="type" required value="${editEquipment ? escapeHtml(editEquipment.type) : ''}" class="w-full rounded-2xl border border-slate-200 px-4 py-3" /></label>
                  <label class="block text-sm font-medium text-slate-700"><span class="mb-2 block">Marca</span><input name="brand" value="${editEquipment ? escapeHtml(editEquipment.brand || '') : ''}" class="w-full rounded-2xl border border-slate-200 px-4 py-3" /></label>
                  <label class="block text-sm font-medium text-slate-700"><span class="mb-2 block">Modelo</span><input name="model" value="${editEquipment ? escapeHtml(editEquipment.model || '') : ''}" class="w-full rounded-2xl border border-slate-200 px-4 py-3" /></label>
                  <label class="block text-sm font-medium text-slate-700"><span class="mb-2 block">Estado</span><select name="status" class="w-full rounded-2xl border border-slate-200 px-4 py-3"><option value="Disponible" ${editEquipment?.status === 'Disponible' ? 'selected' : ''}>Disponible</option><option value="En uso" ${editEquipment?.status === 'En uso' ? 'selected' : ''}>En uso</option><option value="En mantenimiento" ${editEquipment?.status === 'En mantenimiento' ? 'selected' : ''}>En mantenimiento</option><option value="Con falla" ${editEquipment?.status === 'Con falla' ? 'selected' : ''}>Con falla</option><option value="Averiado" ${editEquipment?.status === 'Averiado' ? 'selected' : ''}>Averiado</option></select></label>
                  <label class="block text-sm font-medium text-slate-700"><span class="mb-2 block">Área</span><input name="area" value="${editEquipment ? escapeHtml(editEquipment.area || '') : ''}" class="w-full rounded-2xl border border-slate-200 px-4 py-3" /></label>
                  <label class="block text-sm font-medium text-slate-700"><span class="mb-2 block">Ubicación</span><input name="location" value="${editEquipment ? escapeHtml(editEquipment.location || '') : ''}" class="w-full rounded-2xl border border-slate-200 px-4 py-3" /></label>
                  <label class="block text-sm font-medium text-slate-700"><span class="mb-2 block">Fecha de adquisición</span><input name="acquisition_date" type="date" required value="${editEquipment ? escapeHtml(editEquipment.acquisition_date || '') : ''}" class="w-full rounded-2xl border border-slate-200 px-4 py-3" /></label>
                  <label class="block text-sm font-medium text-slate-700"><span class="mb-2 block">Paciente asignado</span><input name="patient_id" value="${editEquipment ? escapeHtml(editEquipment.patient_id || '') : ''}" class="w-full rounded-2xl border border-slate-200 px-4 py-3" /></label>
                </div>
                <button class="rounded-2xl bg-blue-600 px-4 py-3 font-semibold text-white" type="submit">${editEquipment ? 'Guardar cambios' : 'Guardar equipo'}</button>
              </form>
            </div>
          ` : ''}
          <div class="space-y-3">
            ${state.equipment.map((equipment) => `
              <div class="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <div class="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div>
                    <div class="flex flex-wrap items-center gap-2">
                      <p class="font-semibold text-slate-900">${escapeHtml(equipment.name)}</p>
                      <span class="inline-flex rounded-full px-3 py-1 text-sm font-medium ${equipmentStatusTone(equipment.status)}">${escapeHtml(equipment.status)}</span>
                    </div>
                    <p class="mt-2 text-sm text-slate-500">${escapeHtml(equipment.code)} • ${escapeHtml(equipment.type)} • ${escapeHtml(equipment.area || 'Sin área')}</p>
                    <p class="mt-1 text-sm text-slate-500">Ubicación: ${escapeHtml(equipment.location || 'Sin ubicación')}</p>
                  </div>
                  <div class="flex flex-wrap gap-2">
                    <button data-edit-equipment="${equipment.id}" class="rounded-2xl bg-slate-900 px-3 py-2 text-sm font-semibold text-white">Editar</button>
                    <button data-change-status-equipment="${equipment.id}" class="rounded-2xl bg-amber-600 px-3 py-2 text-sm font-semibold text-white">Cambiar estado</button>
                    <button data-delete-equipment="${equipment.id}" class="rounded-2xl bg-rose-600 px-3 py-2 text-sm font-semibold text-white">Eliminar</button>
                  </div>
                </div>
              </div>
            `).join('')}
          </div>
        </section>
      </div>
      <button id="floatingEquipmentBtn" class="fixed bottom-5 right-5 flex h-16 w-16 items-center justify-center rounded-full bg-blue-600 text-3xl font-semibold text-white shadow-2xl">+</button>
    `;

    document.getElementById('openEquipmentFormBtn')?.addEventListener('click', () => {
      state.equipmentFormOpen = true;
      state.equipmentEditId = null;
      renderView();
    });
    document.getElementById('floatingEquipmentBtn')?.addEventListener('click', () => {
      state.equipmentFormOpen = true;
      state.equipmentEditId = null;
      renderView();
    });
    document.getElementById('cancelEquipmentFormBtn')?.addEventListener('click', () => {
      state.equipmentFormOpen = false;
      state.equipmentEditId = null;
      renderView();
    });

    document.getElementById('filterEquipmentStatus')?.addEventListener('change', async (event) => {
      state.equipmentFilters.status = event.target.value;
      await loadEquipment();
      renderView();
    });
    document.getElementById('filterEquipmentType')?.addEventListener('change', async (event) => {
      state.equipmentFilters.type = event.target.value;
      await loadEquipment();
      renderView();
    });
    document.getElementById('filterEquipmentLocation')?.addEventListener('input', async (event) => {
      state.equipmentFilters.location = event.target.value;
      await loadEquipment();
      renderView();
    });

    document.getElementById('equipmentForm')?.addEventListener('submit', async (event) => {
      event.preventDefault();
      const payload = Object.fromEntries(new FormData(event.target));
      try {
        if (state.equipmentEditId) {
          await api(`/api/equipment/${state.equipmentEditId}`, { method: 'PUT', body: JSON.stringify(payload) });
        } else {
          await api('/api/equipment', { method: 'POST', body: JSON.stringify(payload) });
        }
        state.equipmentFormOpen = false;
        state.equipmentEditId = null;
        await loadEquipment();
        renderView();
      } catch (error) {
        alert(error.message);
      }
    });

    document.querySelectorAll('[data-edit-equipment]').forEach((button) => {
      button.addEventListener('click', () => {
        state.equipmentEditId = Number(button.dataset.editEquipment);
        state.equipmentFormOpen = true;
        renderView();
      });
    });

    document.querySelectorAll('[data-change-status-equipment]').forEach((button) => {
      button.addEventListener('click', async () => {
        const id = Number(button.dataset.changeStatusEquipment);
        const item = state.equipment.find((entry) => entry.id === id);
        const nextStatus = window.prompt('Nuevo estado', item?.status || 'En mantenimiento');
        if (!nextStatus) return;
        const updatedPayload = {
          ...item,
          status: nextStatus,
          name: item.name,
          code: item.code,
          type: item.type,
          brand: item.brand,
          model: item.model,
          location: item.location,
          acquisition_date: item.acquisition_date,
          area: item.area,
          patient_id: item.patient_id
        };
        try {
          await api(`/api/equipment/${id}`, { method: 'PUT', body: JSON.stringify(updatedPayload) });
          await loadEquipment();
          renderView();
        } catch (error) {
          alert(error.message);
        }
      });
    });

    document.querySelectorAll('[data-delete-equipment]').forEach((button) => {
      button.addEventListener('click', async () => {
        const id = Number(button.dataset.deleteEquipment);
        if (confirm('¿Deseas eliminar este equipo?')) {
          try {
            await api(`/api/equipment/${id}`, { method: 'DELETE' });
            await loadEquipment();
            renderView();
          } catch (error) {
            alert(error.message);
          }
        }
      });
    });
    return;
  }
}

function renderPatientProfilePanel() {
  const profile = state.patientProfile;
  const patient = profile.patient;
  const tabs = [
    { key: 'overview', label: 'Sobre' },
    { key: 'history', label: 'Historial médico' },
    { key: 'movements', label: 'Movimientos' },
    { key: 'tests', label: 'Pruebas / Imágenes' },
    { key: 'notes', label: 'Notas' }
  ];

  return `
    <div class="overflow-hidden rounded-[24px] border border-slate-200 bg-white">
      <div class="bg-gradient-to-r from-slate-900 via-blue-700 to-sky-600 px-5 py-8 text-white">
        <div class="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <p class="text-sm uppercase tracking-[0.3em] text-blue-100">Página 3</p>
            <h3 class="mt-2 text-2xl font-semibold">${escapeHtml(`${patient.first_name} ${patient.last_name}`)}</h3>
            <p class="mt-2 text-sm text-blue-50">${escapeHtml(patient.area)} • ${escapeHtml(patient.floor)} • ${escapeHtml(patient.status)}</p>
          </div>
          <div class="flex flex-wrap gap-2">
            <span class="rounded-full bg-white/15 px-3 py-1 text-sm font-medium">${escapeHtml(patient.status)}</span>
            <button id="dischargePatientBtn" class="rounded-full bg-emerald-500 px-3 py-1 text-sm font-medium text-white">Dar de alta</button>
          </div>
        </div>
      </div>
      <div class="px-4 pb-5 sm:px-5">
        <div class="mt-5 flex flex-wrap gap-2">
          ${tabs.map((tab) => `
            <button data-profile-tab="${tab.key}" class="rounded-full px-3 py-2 text-sm font-medium ${state.profileTab === tab.key ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600'}">${tab.label}</button>
          `).join('')}
        </div>
        <div class="mt-5">
          ${renderPatientTabContent()}
        </div>
      </div>
    </div>
  `;
}

function renderPatientTabContent() {
  const profile = state.patientProfile;
  const patient = profile.patient;
  if (state.profileTab === 'history') {
    return `
      <div class="grid gap-4 md:grid-cols-2">
        <div class="rounded-2xl border border-slate-200 bg-slate-50 p-4">
          <p class="text-sm font-semibold uppercase tracking-[0.3em] text-slate-500">Motivo</p>
          <p class="mt-2 text-sm text-slate-700">${escapeHtml(patient.reason || 'Sin motivo registrado')}</p>
        </div>
        <div class="rounded-2xl border border-slate-200 bg-slate-50 p-4">
          <p class="text-sm font-semibold uppercase tracking-[0.3em] text-slate-500">Diagnóstico</p>
          <p class="mt-2 text-sm text-slate-700">${escapeHtml(patient.diagnosis || 'Sin diagnóstico')}</p>
        </div>
        <div class="rounded-2xl border border-slate-200 bg-slate-50 p-4">
          <p class="text-sm font-semibold uppercase tracking-[0.3em] text-slate-500">Antecedentes</p>
          <p class="mt-2 text-sm text-slate-700">${escapeHtml(patient.background || 'Sin antecedentes')}</p>
        </div>
        <div class="rounded-2xl border border-slate-200 bg-slate-50 p-4">
          <p class="text-sm font-semibold uppercase tracking-[0.3em] text-slate-500">Alergias</p>
          <p class="mt-2 text-sm text-slate-700">${escapeHtml(patient.allergies || 'Sin alergias registradas')}</p>
        </div>
      </div>
    `;
  }

  if (state.profileTab === 'movements') {
    return `
      <div class="space-y-3">
        ${profile.movements.length ? profile.movements.map((movement) => `
          <div class="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <div class="flex flex-wrap items-center justify-between gap-2">
              <p class="font-semibold text-slate-900">${escapeHtml(movement.to_area)}</p>
              <p class="text-sm text-slate-500">${formatDate(movement.moved_at)}</p>
            </div>
            <p class="mt-2 text-sm text-slate-600">${escapeHtml(`${movement.from_area} → ${movement.to_area} • ${movement.from_status} → ${movement.to_status}`)}</p>
            <p class="mt-1 text-sm text-slate-500">${escapeHtml(movement.notes || 'Sin observaciones')}</p>
          </div>
        `).join('') : '<p class="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-4 text-sm text-slate-500">No hay movimientos aún.</p>'}
      </div>
    `;
  }

  if (state.profileTab === 'tests') {
    return `
      <div class="grid gap-4 lg:grid-cols-[1fr_0.9fr]">
        <div class="space-y-3">
          ${profile.documents.length ? profile.documents.map((document) => `
            <div class="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <p class="font-semibold text-slate-900">${escapeHtml(document.title)}</p>
              <p class="mt-1 text-sm text-slate-600">${escapeHtml(document.notes || 'Sin observaciones')}</p>
            </div>
          `).join('') : '<p class="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-4 text-sm text-slate-500">No hay pruebas o imágenes registradas.</p>'}
        </div>
        <form id="patientDocumentForm" class="rounded-2xl border border-slate-200 bg-slate-50 p-4">
          <h4 class="font-semibold text-slate-900">Registrar prueba o imagen</h4>
          <label class="mt-3 block text-sm font-medium text-slate-700"><span class="mb-2 block">Título</span><input name="title" required class="w-full rounded-2xl border border-slate-200 px-4 py-3" /></label>
          <label class="mt-3 block text-sm font-medium text-slate-700"><span class="mb-2 block">URL o referencia</span><input name="file_url" class="w-full rounded-2xl border border-slate-200 px-4 py-3" /></label>
          <label class="mt-3 block text-sm font-medium text-slate-700"><span class="mb-2 block">Observaciones</span><textarea name="notes" class="w-full rounded-2xl border border-slate-200 px-4 py-3" rows="3"></textarea></label>
          <button class="mt-4 rounded-2xl bg-blue-600 px-4 py-3 font-semibold text-white" type="submit">Guardar</button>
        </form>
      </div>
    `;
  }

  if (state.profileTab === 'notes') {
    return `
      <div class="grid gap-4 lg:grid-cols-[1fr_0.9fr]">
        <div class="space-y-3">
          ${profile.notes.length ? profile.notes.map((note) => `
            <div class="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <p class="font-semibold text-slate-900">${escapeHtml(note.title || 'Nota')}</p>
              <p class="mt-2 text-sm text-slate-600">${escapeHtml(note.content)}</p>
            </div>
          `).join('') : '<p class="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-4 text-sm text-slate-500">No hay notas médicas registradas.</p>'}
        </div>
        <form id="patientNoteForm" class="rounded-2xl border border-slate-200 bg-slate-50 p-4">
          <h4 class="font-semibold text-slate-900">Agregar nota</h4>
          <label class="mt-3 block text-sm font-medium text-slate-700"><span class="mb-2 block">Título</span><input name="title" class="w-full rounded-2xl border border-slate-200 px-4 py-3" /></label>
          <label class="mt-3 block text-sm font-medium text-slate-700"><span class="mb-2 block">Contenido</span><textarea name="content" required class="w-full rounded-2xl border border-slate-200 px-4 py-3" rows="4"></textarea></label>
          <button class="mt-4 rounded-2xl bg-blue-600 px-4 py-3 font-semibold text-white" type="submit">Guardar nota</button>
        </form>
      </div>
    `;
  }

  return `
    <div class="grid gap-4 lg:grid-cols-[1.05fr_0.95fr]">
      <form id="patientOverviewForm" class="space-y-3 rounded-2xl border border-slate-200 bg-slate-50 p-4">
        <h4 class="font-semibold text-slate-900">Datos del paciente</h4>
        <div class="grid gap-3 sm:grid-cols-2">
          <label class="block text-sm font-medium text-slate-700"><span class="mb-2 block">Nombre</span><input name="first_name" value="${escapeHtml(patient.first_name)}" class="w-full rounded-2xl border border-slate-200 px-4 py-3" /></label>
          <label class="block text-sm font-medium text-slate-700"><span class="mb-2 block">Apellido</span><input name="last_name" value="${escapeHtml(patient.last_name)}" class="w-full rounded-2xl border border-slate-200 px-4 py-3" /></label>
          <label class="block text-sm font-medium text-slate-700"><span class="mb-2 block">DNI/RUT</span><input name="dni" value="${escapeHtml(patient.dni)}" class="w-full rounded-2xl border border-slate-200 px-4 py-3" /></label>
          <label class="block text-sm font-medium text-slate-700"><span class="mb-2 block">Nacimiento</span><input name="birth_date" type="date" value="${escapeHtml(patient.birth_date || '')}" class="w-full rounded-2xl border border-slate-200 px-4 py-3" /></label>
          <label class="block text-sm font-medium text-slate-700"><span class="mb-2 block">Teléfono</span><input name="phone" value="${escapeHtml(patient.phone || '')}" class="w-full rounded-2xl border border-slate-200 px-4 py-3" /></label>
          <label class="block text-sm font-medium text-slate-700"><span class="mb-2 block">Dirección</span><input name="address" value="${escapeHtml(patient.address || '')}" class="w-full rounded-2xl border border-slate-200 px-4 py-3" /></label>
          <label class="block text-sm font-medium text-slate-700"><span class="mb-2 block">Alergias</span><input name="allergies" value="${escapeHtml(patient.allergies || '')}" class="w-full rounded-2xl border border-slate-200 px-4 py-3" /></label>
          <label class="block text-sm font-medium text-slate-700"><span class="mb-2 block">Doctor</span><input name="assigned_doctor" value="${escapeHtml(patient.assigned_doctor || '')}" class="w-full rounded-2xl border border-slate-200 px-4 py-3" /></label>
        </div>
        <label class="block text-sm font-medium text-slate-700"><span class="mb-2 block">Motivo</span><input name="reason" value="${escapeHtml(patient.reason || '')}" class="w-full rounded-2xl border border-slate-200 px-4 py-3" /></label>
        <label class="block text-sm font-medium text-slate-700"><span class="mb-2 block">Diagnóstico</span><textarea name="diagnosis" class="w-full rounded-2xl border border-slate-200 px-4 py-3" rows="3">${escapeHtml(patient.diagnosis || '')}</textarea></label>
        <label class="block text-sm font-medium text-slate-700"><span class="mb-2 block">Antecedentes</span><textarea name="background" class="w-full rounded-2xl border border-slate-200 px-4 py-3" rows="3">${escapeHtml(patient.background || '')}</textarea></label>
        <button class="rounded-2xl bg-blue-600 px-4 py-3 font-semibold text-white" type="submit">Guardar cambios</button>
      </form>
      <div class="space-y-3">
        <form id="patientStatusForm" class="rounded-2xl border border-slate-200 bg-slate-50 p-4">
          <h4 class="font-semibold text-slate-900">Cambiar estado o traslado</h4>
          <div class="mt-3 grid gap-3 sm:grid-cols-2">
            <label class="block text-sm font-medium text-slate-700"><span class="mb-2 block">Área</span><select name="area" class="w-full rounded-2xl border border-slate-200 px-4 py-3"><option>${escapeHtml(patient.area)}</option><option>Urgencias</option><option>Consultas</option><option>Quirófano</option><option>Observación Post-Quirúrgica</option><option>Hospitalización</option><option>Rayos X</option><option>Tomografía</option><option>Resonancia</option></select></label>
            <label class="block text-sm font-medium text-slate-700"><span class="mb-2 block">Estado</span><select name="status" class="w-full rounded-2xl border border-slate-200 px-4 py-3"><option>${escapeHtml(patient.status)}</option><option>En Espera</option><option>En Consulta</option><option>En Quirófano</option><option>Hospitalizado</option><option>Alta Médica</option><option>Trasladado</option></select></label>
            <label class="block text-sm font-medium text-slate-700"><span class="mb-2 block">Piso</span><select name="floor" class="w-full rounded-2xl border border-slate-200 px-4 py-3"><option>${escapeHtml(patient.floor)}</option><option>Piso 1</option><option>Piso 2</option><option>Piso 3</option></select></label>
            <label class="block text-sm font-medium text-slate-700"><span class="mb-2 block">Habitación</span><input name="room" value="${escapeHtml(patient.room || '')}" class="w-full rounded-2xl border border-slate-200 px-4 py-3" /></label>
            <label class="block text-sm font-medium text-slate-700"><span class="mb-2 block">Cama</span><input name="bed" value="${escapeHtml(patient.bed || '')}" class="w-full rounded-2xl border border-slate-200 px-4 py-3" /></label>
            <label class="block text-sm font-medium text-slate-700"><span class="mb-2 block">Observación</span><input name="notes" class="w-full rounded-2xl border border-slate-200 px-4 py-3" /></label>
          </div>
          <button class="mt-4 rounded-2xl bg-emerald-600 px-4 py-3 font-semibold text-white" type="submit">Aplicar traslado</button>
        </form>
        <form id="patientProcedureForm" class="rounded-2xl border border-slate-200 bg-slate-50 p-4">
          <h4 class="font-semibold text-slate-900">Registrar procedimiento</h4>
          <label class="mt-3 block text-sm font-medium text-slate-700"><span class="mb-2 block">Título</span><input name="title" class="w-full rounded-2xl border border-slate-200 px-4 py-3" /></label>
          <label class="mt-3 block text-sm font-medium text-slate-700"><span class="mb-2 block">Detalle</span><textarea name="content" class="w-full rounded-2xl border border-slate-200 px-4 py-3" rows="3"></textarea></label>
          <button class="mt-4 rounded-2xl bg-slate-900 px-4 py-3 font-semibold text-white" type="submit">Guardar procedimiento</button>
        </form>
      </div>
    </div>
  `;
}

render();
