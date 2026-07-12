// ===== STATE =====
let currentUser = null;
let currentPage = 'dashboard-home';
let allRewards = [];
let selectedRewardColor = 'primary';
let currentModTab = 'followers';
let modData = { followers: [], chatters: [], banned: [], moderators: [], vips: [] };
let streamRefreshInterval = null;

// ===== INIT =====
document.addEventListener('DOMContentLoaded', () => {
  checkAuth();
  setupNavigation();
  setupSidebar();
  setupModSearch();
  setupCategorySearch();
  setupColorBtns();
  setupChatInput();
});

// ===== AUTH =====
async function checkAuth() {
  try {
    const resp = await fetch('/auth/me');
    const data = await resp.json();
    if (data.authenticated && data.user) {
      currentUser = data.user;
      showDashboard();
    } else {
      showLogin();
    }
  } catch {
    showLogin();
  }
}

function showLogin() {
  document.getElementById('login-screen').classList.remove('hidden');
  document.getElementById('dashboard').classList.add('hidden');
}

function showDashboard() {
  document.getElementById('login-screen').classList.add('hidden');
  document.getElementById('dashboard').classList.remove('hidden');
  populateUserInfo();
  loadHomeData();
  startStreamRefresh();
  startViewerTracking();
  startFollowerTracking();
}

function populateUserInfo() {
  if (!currentUser) return;
  document.getElementById('userAvatar').src = currentUser.profile_image_url;
  document.getElementById('userName').textContent = currentUser.display_name;
  document.getElementById('pageTitle').textContent = 'Inicio';
}

// ===== NAVIGATION =====
function setupNavigation() {
  document.querySelectorAll('.nav-item[data-page]').forEach(item => {
    item.addEventListener('click', (e) => {
      e.preventDefault();
      navigateTo(item.dataset.page);
    });
  });
}

function navigateTo(page) {
  currentPage = page;

  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  const activeNav = document.querySelector(`.nav-item[data-page="${page}"]`);
  if (activeNav) activeNav.classList.add('active');

  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  const pageEl = document.getElementById(`page-${page}`);
  if (pageEl) pageEl.classList.add('active');

  const titles = {
    'dashboard-home': 'Inicio',
    'moderation': 'Moderacion',
    'channel-points': 'Puntos del Canal',
    'stream-config': 'Configurar Directo',
    'chat-settings': 'Chat',
    'stats': 'Estadisticas',
    'predictions': 'Predicciones',
    'polls': 'Encuestas',
    'about': 'Acerca de'
  };
  document.getElementById('pageTitle').textContent = titles[page] || 'Dashboard';

  // Close mobile sidebar
  document.getElementById('sidebar').classList.remove('open');

  loadPageData(page);
}

function loadPageData(page) {
  switch (page) {
    case 'dashboard-home': loadHomeData(); break;
    case 'moderation': loadModerationData(); break;
    case 'channel-points': loadRewards(); break;
    case 'stream-config': loadStreamConfig(); break;
    case 'chat-settings': loadChatSettings(); break;
    case 'stats': loadStats(); break;
    case 'predictions': loadPredictions(); break;
    case 'polls': loadPolls(); break;
  }
}

// ===== SIDEBAR =====
function setupSidebar() {
  document.getElementById('sidebarToggle').addEventListener('click', () => {
    document.getElementById('sidebar').classList.toggle('collapsed');
  });
  document.getElementById('mobileMenuBtn').addEventListener('click', () => {
    document.getElementById('sidebar').classList.toggle('open');
  });
}

// ===== API HELPER =====
async function api(endpoint, options = {}) {
  try {
    const resp = await fetch(endpoint, {
      headers: { 'Content-Type': 'application/json', ...options.headers },
      ...options,
      body: options.body ? JSON.stringify(options.body) : undefined
    });
    if (resp.status === 401) {
      showToast('Sesion expirada. Recarga la pagina.', 'error');
      return null;
    }
    return await resp.json();
  } catch (err) {
    console.error('API Error:', err);
    showToast('Error de conexion', 'error');
    return null;
  }
}

// ===== HOME =====
async function loadHomeData() {
  if (!currentUser) return;
  
  document.getElementById('followersValue').textContent = currentUser.followers_count || '--';
  document.getElementById('viewsValue').textContent = formatNumber(currentUser.view_count);

  await refreshStreamStatus();
}

function startStreamRefresh() {
  if (streamRefreshInterval) clearInterval(streamRefreshInterval);
  streamRefreshInterval = setInterval(async () => {
    if (currentPage === 'dashboard-home' || currentPage === 'stats') {
      await refreshStreamStatus();
    }
  }, 30000);
}

async function refreshStreamStatus() {
  const stream = await api('/api/stream');
  if (stream && stream.data && stream.data.length > 0) {
    const s = stream.data[0];
    document.getElementById('userStatus').textContent = 'EN DIRECTO';
    document.getElementById('userStatus').className = 'user-status live';
    document.getElementById('streamStatusLabel').textContent = 'EN DIRECTO';
    document.querySelector('.status-dot').className = 'status-dot live';
    document.getElementById('viewerCountNum').textContent = s.viewer_count;
    document.getElementById('currentViewersValue').textContent = s.viewer_count;

    const startTime = new Date(s.started_at);
    document.getElementById('streamTimeValue').textContent = getTimeSince(startTime);

    const homeInfo = document.getElementById('homeStreamInfo');
    homeInfo.innerHTML = `
      <div class="channel-info-grid">
        <div class="channel-info-item">
          <span class="label">Titulo</span>
          <span class="value">${escapeHtml(s.title)}</span>
        </div>
        <div class="channel-info-item">
          <span class="label">Categoria</span>
          <span class="value">${escapeHtml(s.game_name || 'Sin categoria')}</span>
        </div>
        <div class="channel-info-item">
          <span class="label">Espectadores</span>
          <span class="value">${s.viewer_count}</span>
        </div>
        <div class="channel-info-item">
          <span class="label">Idioma</span>
          <span class="value">${s.language}</span>
        </div>
        <div class="channel-info-item">
          <span class="label">Inicio</span>
          <span class="value">${new Date(s.started_at).toLocaleString('es')}</span>
        </div>
        <div class="channel-info-item">
          <span class="label">Tags</span>
          <span class="value">${s.tags ? s.tags.join(', ') : 'Ninguno'}</span>
        </div>
      </div>
    `;
  } else {
    document.getElementById('userStatus').textContent = 'Offline';
    document.getElementById('userStatus').className = 'user-status';
    document.getElementById('streamStatusLabel').textContent = 'Offline';
    document.querySelector('.status-dot').className = 'status-dot offline';
    document.getElementById('currentViewersValue').textContent = '0';
    document.getElementById('streamTimeValue').textContent = '--';
    document.getElementById('homeStreamInfo').innerHTML = '<div class="empty-state"><p>No hay directo activo</p></div>';
  }
}

// ===== MODERATION =====
let followers = [];

function setupModSearch() {
  const input = document.getElementById('modUserSearch');
  let debounce;
  input.addEventListener('input', () => {
    clearTimeout(debounce);
    debounce = setTimeout(() => {
      const q = input.value.toLowerCase().trim();
      filterCurrentModTab(q);
    }, 250);
  });
}

function switchModTab(tab) {
  currentModTab = tab;
  document.querySelectorAll('.mod-tab').forEach(t => t.classList.remove('active'));
  document.querySelector(`.mod-tab[data-mod-tab="${tab}"]`).classList.add('active');
  document.querySelectorAll('.mod-tab-content').forEach(c => c.classList.remove('active'));
  document.getElementById(`modTab-${tab}`).classList.add('active');
  if (tab === 'automod') { loadBannedWords(); return; }
  if (tab === 'actionlog') { loadActionLog(); return; }
  refreshCurrentModTab();
}

function refreshCurrentModTab() {
  switch (currentModTab) {
    case 'followers': loadFollowers(); break;
    case 'chatters': loadChatters(); break;
    case 'banned': loadBanned(); break;
    case 'moderators': loadModerators(); break;
    case 'vips': loadVIPs(); break;
  }
}

function filterCurrentModTab(q) {
  switch (currentModTab) {
    case 'followers': filterAndRender('followers', q); break;
    case 'chatters': filterAndRender('chatters', q); break;
    case 'banned': filterAndRender('banned', q); break;
    case 'moderators': filterAndRender('moderators', q); break;
    case 'vips': filterAndRender('vips', q); break;
  }
}

function filterAndRender(tab, q) {
  const data = modData[tab];
  if (!q) {
    renderModList(tab, data.slice(0, 100), data.length);
    return;
  }
  const filtered = data.filter(item => {
    const name = (item.user_name || item.login || item.display_name || '').toLowerCase();
    const login = (item.login || item.user_login || '').toLowerCase();
    return name.includes(q) || login.includes(q);
  });
  renderModList(tab, filtered.slice(0, 100), data.length, filtered.length);
}

function renderModList(tab, list, total, filtered) {
  const containerId = {
    followers: 'followersList',
    chatters: 'chattersList',
    banned: 'bannedList',
    moderators: 'moderatorsList',
    vips: 'vipsList'
  }[tab];
  const countId = 'modFollowerCount';
  const container = document.getElementById(containerId);

  if (filtered !== undefined) {
    document.getElementById(countId).textContent = `${filtered} de ${total} resultados`;
  } else {
    const labels = { followers: 'seguidores', chatters: 'chatters', banned: 'baneados', moderators: 'moderadores', vips: 'VIPs' };
    document.getElementById(countId).textContent = `${total} ${labels[tab]}`;
  }

  if (list.length === 0) {
    container.innerHTML = '<div class="empty-state"><p>No se encontraron resultados</p></div>';
    return;
  }

  if (tab === 'followers') {
    container.innerHTML = list.map(f => `
      <div class="user-item" data-userid="${f.user_id}">
        <img src="${f.user_profile_image_url || ''}" alt="" onerror="this.style.background='var(--purple-700)';this.style.borderRadius='50%';this.src='data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 40 40%22><rect fill=%22%237c3aed%22 width=%2240%22 height=%2240%22 rx=%2220%22/><text x=%2220%22 y=%2226%22 fill=%22white%22 text-anchor=%22middle%22 font-size=%2216%22 font-family=%22sans-serif%22>${f.user_name.charAt(0).toUpperCase()}</text></svg>'">
        <div class="user-item-info">
          <div class="user-item-name">${escapeHtml(f.user_name)}</div>
          <div class="user-item-meta">Siguiendo desde ${new Date(f.followed_at).toLocaleDateString('es')}</div>
        </div>
        <div class="user-item-actions-inline">
          <button class="btn btn-danger btn-sm" onclick="showBanModal('${f.user_id}', '${escapeAttr(f.user_name)}')" title="Banear">Ban</button>
          <button class="btn btn-warning btn-sm" onclick="showTimeoutModal('${f.user_id}', '${escapeAttr(f.user_name)}')" title="Mutear">Mute</button>
          <button class="btn btn-secondary btn-sm" onclick="showRoleModal('${f.user_id}', '${escapeAttr(f.user_name)}')" title="Rol">Rol</button>
        </div>
      </div>
    `).join('');
  } else if (tab === 'chatters') {
    container.innerHTML = list.map(f => `
      <div class="user-item" data-userid="${f.user_id}">
        <img src="${f.user_profile_image_url || ''}" alt="" onerror="this.style.background='var(--blue-600)';this.style.borderRadius='50%';this.src='data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 40 40%22><rect fill=%22%233b82f6%22 width=%2240%22 height=%2240%22 rx=%2220%22/><text x=%2220%22 y=%2226%22 fill=%22white%22 text-anchor=%22middle%22 font-size=%2216%22 font-family=%22sans-serif%22>${(f.user_name||'').charAt(0).toUpperCase()}</text></svg>'">
        <div class="user-item-info">
          <div class="user-item-name">${escapeHtml(f.user_name || f.user_login)}</div>
          <div class="user-item-meta">${f.user_id === currentUser?.id ? 'Tu' : 'Chatter'}</div>
        </div>
        <div class="user-item-actions-inline">
          <button class="btn btn-danger btn-sm" onclick="showBanModal('${f.user_id}', '${escapeAttr(f.user_name || f.user_login)}')" title="Banear">Ban</button>
          <button class="btn btn-warning btn-sm" onclick="showTimeoutModal('${f.user_id}', '${escapeAttr(f.user_name || f.user_login)}')" title="Mutear">Mute</button>
          <button class="btn btn-secondary btn-sm" onclick="showRoleModal('${f.user_id}', '${escapeAttr(f.user_name || f.user_login)}')" title="Rol">Rol</button>
        </div>
      </div>
    `).join('');
  } else if (tab === 'banned') {
    container.innerHTML = list.map(f => {
      const isTimeout = !!f.expires_at;
      const expiry = isTimeout ? new Date(f.expires_at).toLocaleString('es') : 'Permanente';
      const actionBtn = isTimeout
        ? `<button class="btn btn-warning btn-sm" onclick="unbanUser('${f.user_id}', '${escapeAttr(f.user_name || f.user_login)}')">Quitar Timeout</button>`
        : `<button class="btn btn-success btn-sm" onclick="unbanUser('${f.user_id}', '${escapeAttr(f.user_name || f.user_login)}')">Desbanear</button>`;
      return `
        <div class="user-item" data-userid="${f.user_id}">
          <img src="${f.user_profile_image_url || ''}" alt="" onerror="this.style.background='var(--danger)';this.style.borderRadius='50%';this.src='data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 40 40%22><rect fill=%22%23ef4444%22 width=%2240%22 height=%2240%22 rx=%2220%22/><text x=%2220%22 y=%2226%22 fill=%22white%22 text-anchor=%22middle%22 font-size=%2216%22 font-family=%22sans-serif%22>${(f.user_name||'').charAt(0).toUpperCase()}</text></svg>'">
          <div class="user-item-info">
            <div class="user-item-name">${escapeHtml(f.user_name || f.user_login)}</div>
            <div class="user-item-meta">${f.moderator_name ? `${isTimeout ? 'Timeout por' : 'Baneado por'} ${f.moderator_name}` : ''} ${f.reason ? `| ${escapeHtml(f.reason)}` : ''} | Expira: ${expiry}</div>
          </div>
          <div class="user-item-actions-inline">
            ${actionBtn}
          </div>
        </div>
      `;
    }).join('');
  } else if (tab === 'moderators') {
    container.innerHTML = list.map(f => `
      <div class="user-item" data-userid="${f.user_id}">
        <img src="${f.user_profile_image_url || ''}" alt="" onerror="this.style.background='var(--blue-500)';this.style.borderRadius='50%';this.src='data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 40 40%22><rect fill=%22%233b82f6%22 width=%2240%22 height=%2240%22 rx=%2220%22/><text x=%2220%22 y=%2226%22 fill=%22white%22 text-anchor=%22middle%22 font-size=%2216%22 font-family=%22sans-serif%22>${(f.user_name||'').charAt(0).toUpperCase()}</text></svg>'">
        <div class="user-item-info">
          <div class="user-item-name">${escapeHtml(f.user_name || f.user_login)}</div>
          <div class="user-item-meta">Moderador</div>
        </div>
        <div class="user-item-actions-inline">
          <button class="btn btn-danger btn-sm" onclick="removeAsMod('${f.user_id}', '${escapeAttr(f.user_name || f.user_login)}')">Quitar Mod</button>
        </div>
      </div>
    `).join('');
  } else if (tab === 'vips') {
    container.innerHTML = list.map(f => `
      <div class="user-item" data-userid="${f.user_id}">
        <img src="${f.user_profile_image_url || ''}" alt="" onerror="this.style.background='var(--purple-500)';this.style.borderRadius='50%';this.src='data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 40 40%22><rect fill=%22%23a855f7%22 width=%2240%22 height=%2240%22 rx=%2220%22/><text x=%2220%22 y=%2226%22 fill=%22white%22 text-anchor=%22middle%22 font-size=%2216%22 font-family=%22sans-serif%22>${(f.user_name||'').charAt(0).toUpperCase()}</text></svg>'">
        <div class="user-item-info">
          <div class="user-item-name">${escapeHtml(f.user_name || f.user_login)}</div>
          <div class="user-item-meta">VIP</div>
        </div>
        <div class="user-item-actions-inline">
          <button class="btn btn-danger btn-sm" onclick="removeAsVip('${f.user_id}', '${escapeAttr(f.user_name || f.user_login)}')">Quitar VIP</button>
        </div>
      </div>
    `).join('');
  }
}

async function loadModerationData() {
  refreshCurrentModTab();
}

async function loadFollowers() {
  const loadingEl = document.getElementById('followersLoading');
  const countEl = document.getElementById('modFollowerCount');

  loadingEl.style.display = '';
  countEl.textContent = 'Cargando...';

  try {
    const data = await fetch('/api/mod/followers').then(r => r.json());

    if (data && data.data && Array.isArray(data.data.data) && data.data.data.length > 0) {
      modData.followers = data.data.data;
      countEl.textContent = `${modData.followers.length} seguidores`;
      renderModList('followers', modData.followers.slice(0, 100), modData.followers.length);
    } else if (data && data.data && data.data.error) {
      const errMsg = data.data.error.message || data.data.error.error || JSON.stringify(data.data.error);
      document.getElementById('followersList').innerHTML = `<div class="empty-state"><p>Error: ${escapeHtml(errMsg)}</p><p style="margin-top:12px">Cierra sesion y vuelve a loguearte para actualizar los permisos.</p></div>`;
      countEl.textContent = 'Error';
    } else {
      document.getElementById('followersList').innerHTML = '<div class="empty-state"><p>No se pudieron cargar los seguidores.</p></div>';
      countEl.textContent = '0 seguidores';
    }
  } catch (err) {
    console.error('Load followers error:', err);
    document.getElementById('followersList').innerHTML = `<div class="empty-state"><p>Error de conexion</p></div>`;
    countEl.textContent = 'Error';
  }

  loadingEl.style.display = 'none';
}

async function loadChatters() {
  const loadingEl = document.getElementById('chattersLoading');
  loadingEl.style.display = '';

  try {
    const data = await fetch('/api/mod/chatters/list').then(r => r.json());
    if (data && data.data && data.data.data && data.data.data.length > 0) {
      modData.chatters = data.data.data;
      renderModList('chatters', modData.chatters.slice(0, 100), modData.chatters.length);
    } else {
      modData.chatters = [];
      document.getElementById('chattersList').innerHTML = '<div class="empty-state"><p>No hay chatters en el chat (o el directo no esta activo)</p></div>';
    }
  } catch (err) {
    console.error('Load chatters error:', err);
    document.getElementById('chattersList').innerHTML = '<div class="empty-state"><p>Error al cargar chatters</p></div>';
  }

  loadingEl.style.display = 'none';
}

async function loadBanned() {
  const loadingEl = document.getElementById('bannedLoading');
  loadingEl.style.display = '';

  try {
    const data = await fetch('/api/mod/bans').then(r => r.json());
    if (data && data.data && data.data.data && data.data.data.length > 0) {
      modData.banned = data.data.data;
      renderModList('banned', modData.banned.slice(0, 100), modData.banned.length);
    } else {
      modData.banned = [];
      document.getElementById('bannedList').innerHTML = '<div class="empty-state"><p>No hay usuarios baneados</p></div>';
    }
  } catch (err) {
    console.error('Load banned error:', err);
    document.getElementById('bannedList').innerHTML = '<div class="empty-state"><p>Error al cargar baneados</p></div>';
  }

  loadingEl.style.display = 'none';
}

async function loadModerators() {
  const loadingEl = document.getElementById('moderatorsLoading');
  loadingEl.style.display = '';

  try {
    const data = await fetch('/api/mod/moderators').then(r => r.json());
    if (data && data.data && data.data.data && data.data.data.length > 0) {
      modData.moderators = data.data.data;
      renderModList('moderators', modData.moderators.slice(0, 100), modData.moderators.length);
    } else {
      modData.moderators = [];
      document.getElementById('moderatorsList').innerHTML = '<div class="empty-state"><p>No hay moderadores asignados</p></div>';
    }
  } catch (err) {
    console.error('Load moderators error:', err);
    document.getElementById('moderatorsList').innerHTML = '<div class="empty-state"><p>Error al cargar moderadores</p></div>';
  }

  loadingEl.style.display = 'none';
}

async function loadVIPs() {
  const loadingEl = document.getElementById('vipsLoading');
  loadingEl.style.display = '';

  try {
    const data = await fetch('/api/mod/vips').then(r => r.json());
    if (data && data.data && data.data.data && data.data.data.length > 0) {
      modData.vips = data.data.data;
      renderModList('vips', modData.vips.slice(0, 100), modData.vips.length);
    } else {
      modData.vips = [];
      document.getElementById('vipsList').innerHTML = '<div class="empty-state"><p>No hay VIPs asignados</p></div>';
    }
  } catch (err) {
    console.error('Load VIPs error:', err);
    document.getElementById('vipsList').innerHTML = '<div class="empty-state"><p>Error al cargar VIPs</p></div>';
  }

  loadingEl.style.display = 'none';
}

// ===== BAN =====
function showBanModal(userId, userName) {
  showModal('Banear a ' + userName, `
    <div class="form-group">
      <label>Tipo de ban</label>
      <div class="ban-type-selector">
        <button class="ban-type-btn active" data-type="permanent" onclick="selectBanType(this, 'permanent')">Permanente</button>
        <button class="ban-type-btn" data-type="temporary" onclick="selectBanType(this, 'temporary')">Temporal</button>
      </div>
    </div>
    <div class="form-group hidden" id="banDurationGroup">
      <label>Duracion</label>
      <select id="banDuration" class="form-input">
        <option value="600">10 minutos</option>
        <option value="1800">30 minutos</option>
        <option value="3600" selected>1 hora</option>
        <option value="7200">2 horas</option>
        <option value="14400">4 horas</option>
        <option value="43200">12 horas</option>
        <option value="86400">24 horas</option>
        <option value="259200">3 dias</option>
        <option value="604800">7 dias</option>
      </select>
    </div>
    <div class="form-group">
      <label>Motivo</label>
      <input type="text" id="banReason" class="form-input" placeholder="Motivo del ban (opcional)">
    </div>
  `, [
    { text: 'Cancelar', class: 'btn-secondary', action: 'closeModal()' },
    { text: 'Banear', class: 'btn-danger', action: `executeBan('${userId}', '${userName}')` }
  ]);
}

function selectBanType(btn, type) {
  document.querySelectorAll('.ban-type-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  const durationGroup = document.getElementById('banDurationGroup');
  if (type === 'temporary') {
    durationGroup.classList.remove('hidden');
  } else {
    durationGroup.classList.add('hidden');
  }
}

async function executeBan(userId, userName) {
  const isTemporary = document.querySelector('.ban-type-btn.active').dataset.type === 'temporary';
  const reason = document.getElementById('banReason').value;
  const body = { user_id: userId, reason: reason || '' };
  if (isTemporary) body.duration = parseInt(document.getElementById('banDuration').value);

  const result = await api('/api/mod/ban', { method: 'POST', body });
  closeModal();
  if (result && (result.status === 200 || result.status === 204)) {
    logAction('ban', userName, reason || (isTemporary ? `Temporal ${document.getElementById('banDuration').value}s` : 'Permanente'));
    showToast(`${userName} ha sido baneado${isTemporary ? ' temporalmente' : ''}`, 'success');
  } else {
    showToast('Error al banear usuario', 'error');
  }
}

async function unbanUser(userId, userName) {
  const result = await api(`/api/mod/unban?user_id=${userId}`, { method: 'DELETE' });
  closeModal();
  if (result && (result.status === 200 || result.status === 204)) {
    logAction('unban', userName || 'Usuario');
    showToast(`${userName || 'Usuario'} desbaneado`, 'success');
    loadBanned();
  } else {
    showToast('Error al desbanear', 'error');
  }
}

// ===== TIMEOUT =====
function showTimeoutModal(userId, userName) {
  showModal('Mutear a ' + userName, `
    <div class="form-group">
      <label>Duracion del mute</label>
      <select id="timeoutDuration" class="form-input">
        <option value="60">1 minuto</option>
        <option value="300">5 minutos</option>
        <option value="600" selected>10 minutos</option>
        <option value="1800">30 minutos</option>
        <option value="3600">1 hora</option>
        <option value="7200">2 horas</option>
        <option value="14400">4 horas</option>
        <option value="43200">12 horas</option>
        <option value="86400">24 horas</option>
      </select>
    </div>
    <div class="form-group">
      <label>Motivo</label>
      <input type="text" id="timeoutReason" class="form-input" placeholder="Motivo del mute (opcional)">
    </div>
  `, [
    { text: 'Cancelar', class: 'btn-secondary', action: 'closeModal()' },
    { text: 'Mutear', class: 'btn-warning', action: `executeTimeout('${userId}', '${userName}')` }
  ]);
}

async function executeTimeout(userId, userName) {
  const duration = parseInt(document.getElementById('timeoutDuration').value);
  const reason = document.getElementById('timeoutReason').value;

  const result = await api('/api/mod/timeout', { method: 'POST', body: { user_id: userId, duration, reason } });
  closeModal();
  if (result && (result.status === 200 || result.status === 204)) {
    logAction('timeout', userName, `${Math.floor(duration / 60)}m ${reason || ''}`);
    const mins = Math.floor(duration / 60);
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    const timeStr = h > 0 ? `${h}h ${m > 0 ? m + 'm' : ''}` : `${m} minutos`;
    showToast(`${userName} mutado por ${timeStr}`, 'success');
  } else {
    showToast('Error al mutear usuario', 'error');
  }
}

// ===== ROLES =====
function showRoleModal(userId, userName) {
  showModal('Cambiar rol: ' + userName, `
    <div class="role-options">
      <div class="role-option" onclick="addAsMod('${userId}', '${userName}')">
        <div class="role-option-icon" style="background:rgba(59,130,246,0.15);color:var(--blue-400)">
          <svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
        </div>
        <div class="role-option-info">
          <span class="role-option-title">Hacer Moderador</span>
          <span class="role-option-desc">Permisos completos de moderacion del canal</span>
        </div>
      </div>
      <div class="role-option" onclick="removeAsMod('${userId}', '${userName}')">
        <div class="role-option-icon" style="background:rgba(107,95,138,0.15);color:var(--text-muted)">
          <svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/></svg>
        </div>
        <div class="role-option-info">
          <span class="role-option-title">Quitar Moderador</span>
          <span class="role-option-desc">Remover permisos de moderador</span>
        </div>
      </div>
      <div class="role-option" onclick="addAsVip('${userId}', '${userName}')">
        <div class="role-option-icon" style="background:rgba(168,85,247,0.15);color:var(--purple-400)">
          <svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" stroke-width="2"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
        </div>
        <div class="role-option-info">
          <span class="role-option-title">Hacer VIP</span>
          <span class="role-option-desc">Badge VIP en el chat</span>
        </div>
      </div>
      <div class="role-option" onclick="removeAsVip('${userId}', '${userName}')">
        <div class="role-option-icon" style="background:rgba(107,95,138,0.15);color:var(--text-muted)">
          <svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" stroke-width="2"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/><line x1="4" y1="4" x2="20" y2="20" stroke-width="2"/></svg>
        </div>
        <div class="role-option-info">
          <span class="role-option-title">Quitar VIP</span>
          <span class="role-option-desc">Remover badge VIP</span>
        </div>
      </div>
    </div>
  `, [{ text: 'Cerrar', class: 'btn-secondary', action: 'closeModal()' }]);
}

async function addAsMod(userId, userName) {
  const result = await api('/api/mod/moderators', { method: 'POST', body: { user_id: userId } });
  closeModal();
  if (result && (result.status === 200 || result.status === 204)) {
    logAction('mod', userName, 'Agregado como moderador');
    showToast(`${userName} ahora es moderador`, 'success');
  } else {
    showToast('Error al asignar moderador', 'error');
  }
}

async function removeAsMod(userId, userName) {
  const result = await api(`/api/mod/moderators?user_id=${userId}`, { method: 'DELETE' });
  closeModal();
  if (result && (result.status === 200 || result.status === 204)) {
    logAction('mod', userName, 'Removido como moderador');
    showToast(`Moderador removido de ${userName}`, 'success');
  } else {
    showToast('Error al remover moderador', 'error');
  }
}

async function addAsVip(userId, userName) {
  const result = await api('/api/mod/vips', { method: 'POST', body: { user_id: userId } });
  console.log('VIP result:', result);
  closeModal();
  if (result && (result.status === 200 || result.status === 204)) {
    logAction('vip', userName, 'Agregado como VIP');
    showToast(`${userName} ahora es VIP`, 'success');
  } else {
    const errMsg = result?.data?.message || result?.data?.error || JSON.stringify(result);
    console.error('VIP error:', errMsg);
    showToast('Error al asignar VIP: ' + errMsg, 'error');
  }
}

async function removeAsVip(userId, userName) {
  const result = await api(`/api/mod/vips?user_id=${userId}`, { method: 'DELETE' });
  closeModal();
  if (result && (result.status === 200 || result.status === 204)) {
    logAction('vip', userName, 'Removido como VIP');
    showToast(`VIP removido de ${userName}`, 'success');
  } else {
    showToast('Error al remover VIP', 'error');
  }
}

// ===== CHANNEL POINTS =====
async function loadRewards() {
  document.getElementById('rewardsLoading').style.display = '';
  const data = await api('/api/channel-points/rewards');
  const grid = document.getElementById('rewardsGrid');

  if (data && data.data && data.data.length > 0) {
    allRewards = data.data;
    grid.innerHTML = data.data.map(r => `
      <div class="reward-card">
        <div class="reward-header">
          <div class="reward-icon" style="background:${r.backgroundColor || '#7c3aed'}">${r.image ? `<img src="${r.image.url}" style="width:100%;height:100%;object-fit:contain;border-radius:8px">` : '🎁'}</div>
          <div>
            <div class="reward-title">${escapeHtml(r.title)}</div>
            <div class="reward-cost">${formatNumber(r.cost)} puntos</div>
          </div>
        </div>
        <div class="reward-description">${escapeHtml(r.prompt || 'Sin descripcion')}</div>
        <div style="font-size:0.8rem;color:var(--text-muted);margin-bottom:12px">
          ${r.isEnabled ? 'Activa' : 'Inactiva'} | Max redenciones/dia: ${r.maxRedemptionsPerStream || 'Ilimitado'} | Total: ${r.totalRedemptions || 0}
        </div>
        <div class="reward-actions">
          <button class="btn btn-secondary btn-sm" onclick="editReward('${r.id}')">Editar</button>
          <button class="btn btn-secondary btn-sm" onclick="duplicateReward('${r.id}')">Duplicar</button>
          <button class="btn btn-danger btn-sm" onclick="deleteReward('${r.id}')">Eliminar</button>
        </div>
      </div>
    `).join('');
  } else {
    grid.innerHTML = '<div class="empty-state"><p>No hay recompensas creadas. Crea la primera!</p></div>';
  }
  document.getElementById('rewardsLoading').style.display = 'none';
}

function showRewardModal(reward = null) {
  const isEdit = !!reward;
  showModal(isEdit ? 'Editar Recompensa' : 'Nueva Recompensa', `
    <div class="form-group">
      <label>Titulo</label>
      <input type="text" id="rewardTitle" class="form-input" value="${isEdit ? escapeHtml(reward.title) : ''}" placeholder="Nombre de la recompensa">
    </div>
    <div class="form-group">
      <label>Costo (puntos)</label>
      <input type="number" id="rewardCost" class="form-input" value="${isEdit ? reward.cost : 100}" min="0">
    </div>
    <div class="form-group">
      <label>Descripcion / Prompt</label>
      <textarea id="rewardPrompt" class="form-input" rows="2" placeholder="Que deben hacer los viewers?">${isEdit ? escapeHtml(reward.prompt || '') : ''}</textarea>
    </div>
    <div class="form-group">
      <label>Color de fondo</label>
      <div class="color-options">
        ${['#7c3aed','#db2777','#3b82f6','#06b6d4','#10b981','#f59e0b','#ef4444','#8b5cf6'].map(c => `
          <button type="button" class="color-btn ${isEdit && reward.backgroundColor === c ? 'active' : ''}" style="background:${c}" onclick="selectRewardColor(this, '${c}')"></button>
        `).join('')}
      </div>
    </div>
    <div class="form-group">
      <label>Maximo por directo</label>
      <input type="number" id="rewardMaxPerStream" class="form-input" value="${isEdit && reward.maxRedemptionsPerStream ? reward.maxRedemptionsPerStream : ''}" placeholder="Ilimitado" min="0">
    </div>
    <div class="form-group">
      <label>Maximo por usuario</label>
      <input type="number" id="rewardMaxPerUser" class="form-input" value="${isEdit && reward.maxRedemptionsPerUser ? reward.maxRedemptionsPerUser : ''}" placeholder="Ilimitado" min="0">
    </div>
    <div class="form-group">
      <label style="display:flex;align-items:center;gap:8px">
        <input type="checkbox" id="rewardEnabled" ${isEdit ? (reward.isEnabled ? 'checked' : '') : 'checked'}>
        Activa
      </label>
    </div>
  `, [
    { text: 'Cancelar', class: 'btn-secondary', action: 'closeModal()' },
    { text: isEdit ? 'Guardar' : 'Crear', class: 'btn-primary', action: isEdit ? `updateReward('${reward.id}')` : 'createReward()' }
  ]);

  selectedRewardColor = isEdit ? (reward.backgroundColor || '#7c3aed') : '#7c3aed';
}

function selectRewardColor(btn, color) {
  document.querySelectorAll('.color-options .color-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  selectedRewardColor = color;
}

async function createReward() {
  const body = {
    title: document.getElementById('rewardTitle').value,
    cost: parseInt(document.getElementById('rewardCost').value) || 100,
    prompt: document.getElementById('rewardPrompt').value,
    backgroundColor: selectedRewardColor,
    isEnabled: document.getElementById('rewardEnabled').checked
  };
  const maxPerStream = document.getElementById('rewardMaxPerStream').value;
  const maxPerUser = document.getElementById('rewardMaxPerUser').value;
  if (maxPerStream) body.maxRedemptionsPerStream = parseInt(maxPerStream);
  if (maxPerUser) body.maxRedemptionsPerUser = parseInt(maxPerUser);

  const result = await api('/api/channel-points/rewards', { method: 'POST', body });
  closeModal();
  if (result && result.data) {
    showToast('Recompensa creada!', 'success');
    loadRewards();
  } else {
    showToast('Error al crear recompensa', 'error');
  }
}

function editReward(id) {
  const reward = allRewards.find(r => r.id === id);
  if (reward) showRewardModal(reward);
}

async function updateReward(id) {
  const body = {
    title: document.getElementById('rewardTitle').value,
    cost: parseInt(document.getElementById('rewardCost').value) || 100,
    prompt: document.getElementById('rewardPrompt').value,
    backgroundColor: selectedRewardColor,
    isEnabled: document.getElementById('rewardEnabled').checked
  };
  const maxPerStream = document.getElementById('rewardMaxPerStream').value;
  const maxPerUser = document.getElementById('rewardMaxPerUser').value;
  if (maxPerStream) body.maxRedemptionsPerStream = parseInt(maxPerStream);
  else body.maxRedemptionsPerStream = null;
  if (maxPerUser) body.maxRedemptionsPerUser = parseInt(maxPerUser);
  else body.maxRedemptionsPerUser = null;

  const result = await api(`/api/channel-points/rewards/${id}`, { method: 'PATCH', body });
  closeModal();
  if (result && result.data) {
    showToast('Recompensa actualizada!', 'success');
    loadRewards();
  } else {
    showToast('Error al actualizar', 'error');
  }
}

async function duplicateReward(id) {
  const reward = allRewards.find(r => r.id === id);
  if (!reward) return;

  const body = {
    title: reward.title + ' (copia)',
    cost: reward.cost,
    prompt: reward.prompt,
    backgroundColor: reward.backgroundColor,
    isEnabled: reward.isEnabled
  };
  if (reward.maxRedemptionsPerStream) body.maxRedemptionsPerStream = reward.maxRedemptionsPerStream;
  if (reward.maxRedemptionsPerUser) body.maxRedemptionsPerUser = reward.maxRedemptionsPerUser;

  const result = await api('/api/channel-points/rewards', { method: 'POST', body });
  if (result && result.data) {
    showToast('Recompensa duplicada!', 'success');
    loadRewards();
  } else {
    showToast('Error al duplicar', 'error');
  }
}

async function deleteReward(id) {
  if (!confirm('Eliminar esta recompensa?')) return;
  const result = await api(`/api/channel-points/rewards/${id}`, { method: 'DELETE' });
  if (result && (result.status === 200 || result.status === 204)) {
    showToast('Recompensa eliminada', 'success');
    loadRewards();
  } else {
    showToast('Error al eliminar', 'error');
  }
}

// ===== STREAM CONFIG =====
let selectedGameId = null;

async function loadStreamConfig() {
  const channelData = await api('/api/channel');
  if (channelData && channelData.data && channelData.data[0]) {
    const ch = channelData.data[0];
    document.getElementById('streamTitle').value = ch.title || '';
    document.getElementById('currentGameName').textContent = ch.game_name || 'Sin categoria';
    selectedGameId = ch.game_id;

    const langSelect = document.getElementById('streamLanguage');
    for (let opt of langSelect.options) {
      if (opt.value === ch.language) { opt.selected = true; break; }
    }
  }

  const tagsData = await api('/api/tags');
  const tagsContainer = document.getElementById('streamTags');
  if (tagsData && tagsData.data && tagsData.data.length > 0) {
    tagsContainer.innerHTML = tagsData.data.map(t => 
      `<span class="tag">${escapeHtml(t.localization_names && t.localization_names['es-mx'] ? t.localization_names['es-mx'] : t.tag_id)}</span>`
    ).join('');
  } else {
    tagsContainer.innerHTML = '<span class="help-text">No hay etiquetas configuradas</span>';
  }
}

function setupCategorySearch() {
  const input = document.getElementById('gameSearch');
  const dropdown = document.getElementById('categoryDropdown');
  let debounce;

  input.addEventListener('input', () => {
    clearTimeout(debounce);
    debounce = setTimeout(async () => {
      const name = input.value.trim();
      if (name.length < 2) { dropdown.classList.add('hidden'); return; }
      
      const data = await api(`/api/categories/search?name=${encodeURIComponent(name)}`);
      if (data && data.data && data.data.length > 0) {
        dropdown.innerHTML = data.data.slice(0, 8).map(c => `
          <div class="category-option" onclick="selectCategory('${c.id}', '${escapeHtml(c.name)}')">
            <img src="${c.box_art_url.replace('{width}', '30').replace('{height}', '30')}" alt="">
            <span>${escapeHtml(c.name)}</span>
          </div>
        `).join('');
        dropdown.classList.remove('hidden');
      } else {
        dropdown.classList.add('hidden');
      }
    }, 400);
  });

  input.addEventListener('blur', () => {
    setTimeout(() => dropdown.classList.add('hidden'), 200);
  });
}

function selectCategory(id, name) {
  selectedGameId = id;
  document.getElementById('gameSearch').value = '';
  document.getElementById('currentGameName').textContent = name;
  document.getElementById('categoryDropdown').classList.add('hidden');
  showToast(`Categoria: ${name}`, 'info');
}

async function updateStreamInfo() {
  const body = {
    title: document.getElementById('streamTitle').value,
    language: document.getElementById('streamLanguage').value
  };
  if (selectedGameId) body.game_id = selectedGameId;

  const result = await api('/api/stream/info', { method: 'PATCH', body });
  if (result && (result.status === 200 || result.status === 204)) {
    showToast('Directo actualizado!', 'success');
  } else {
    showToast('Error al actualizar', 'error');
  }
}

// ===== CHAT SETTINGS =====
async function loadChatSettings() {
  const data = await api('/api/chat/settings');
  const container = document.getElementById('chatSettings');

  if (data && data.data) {
    const s = data.data;
    const settings = [
      { key: 'emote_mode', label: 'Modo Emotes', desc: 'Solo se permiten emotes en el chat' },
      { key: 'subscriber_mode', label: 'Modo Suscriptores', desc: 'Solo suscriptores pueden chatear' },
      { key: 'follower_mode', label: 'Modo Seguidores', desc: 'Solo seguidores pueden chatear' },
      { key: 'slow_mode', label: 'Modo Lento', desc: 'Limita la velocidad de mensajes' },
      { key: 'unique_chat_mode', label: 'Mensajes Unicos', desc: 'No se pueden repetir mensajes' }
    ];

    container.innerHTML = settings.map(st => `
      <div class="setting-item">
        <div class="setting-info">
          <span class="setting-label">${st.label}</span>
          <span class="setting-desc">${st.desc}</span>
        </div>
        <label class="toggle">
          <input type="checkbox" ${s[st.key] ? 'checked' : ''} onchange="toggleChatSetting('${st.key}', this.checked)">
          <span class="toggle-slider"></span>
        </label>
      </div>
    `).join('') + `
      <div class="setting-item">
        <div class="setting-info">
          <span class="setting-label">Emotes no moderados</span>
          <span class="setting-desc">${s.non_moderator_chat_delay ? `Retraso: ${s.non_moderator_chat_delay} segundos` : 'Sin retraso'}</span>
        </div>
      </div>
    `;
  } else {
    container.innerHTML = '<div class="empty-state"><p>No se pudieron cargar los ajustes</p></div>';
  }
}

async function toggleChatSetting(key, value) {
  const body = {};
  body[key] = value;
  const result = await api('/api/chat/settings', { method: 'PATCH', body });
  if (result && (result.status === 200 || result.status === 204)) {
    showToast('Configuracion actualizada', 'success');
  } else {
    showToast('Error al actualizar', 'error');
    loadChatSettings();
  }
}

// ===== ANNOUNCEMENTS =====
function setupColorBtns() {
  document.querySelectorAll('.color-btn[data-color]').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.color-btn[data-color]').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      selectedRewardColor = btn.dataset.color;
    });
  });
}

async function sendAnnouncement() {
  const message = document.getElementById('announcementMessage').value.trim();
  if (!message) return showToast('Escribe un mensaje', 'warning');

  const activeColor = document.querySelector('.color-btn[data-color].active');
  const color = activeColor ? activeColor.dataset.color : 'primary';

  const result = await api('/api/mod/announce', { method: 'POST', body: { message, color } });
  if (result && (result.status === 200 || result.status === 204)) {
    showToast('Anuncio enviado!', 'success');
    document.getElementById('announcementMessage').value = '';
  } else {
    showToast('Error al enviar anuncio', 'error');
  }
}

// ===== CHAT MESSAGE =====
function setupChatInput() {
  const input = document.getElementById('chatMessageInput');
  if (!input) return;
  input.addEventListener('input', () => {
    const count = document.getElementById('chatCharCount');
    if (count) count.textContent = input.value.length;
  });
}

function insertQuickMessage(msg) {
  const input = document.getElementById('chatMessageInput');
  if (input) {
    input.value = msg;
    input.focus();
    const count = document.getElementById('chatCharCount');
    if (count) count.textContent = msg.length;
  }
}

async function sendChatMessage() {
  const input = document.getElementById('chatMessageInput');
  const message = input.value.trim();
  if (!message) return showToast('Escribe un mensaje', 'warning');

  const result = await api('/api/chat/send', { method: 'POST', body: { message } });
  if (result && (result.status === 200 || result.status === 204)) {
    showToast('Mensaje enviado!', 'success');
    input.value = '';
    const count = document.getElementById('chatCharCount');
    if (count) count.textContent = '0';
  } else {
    const errMsg = result?.data?.message || result?.data?.error || 'Error al enviar mensaje';
    showToast(errMsg, 'error');
  }
}

// ===== STATS =====
async function loadStats() {
  if (!currentUser) return;

  document.getElementById('statBigFollowers').textContent = formatNumber(currentUser.followers_count || 0);
  document.getElementById('statBigViews').textContent = formatNumber(currentUser.view_count);
  document.getElementById('statBigBroadcaster').textContent = currentUser.broadcaster_type === 'partner' ? 'Partner' : currentUser.broadcaster_type === 'affiliate' ? 'Afiliado' : 'Estandar';

  const channelData = await api('/api/channel');
  const channelInfo = document.getElementById('channelInfoDetail');
  if (channelData && channelData.data && channelData.data[0]) {
    const ch = channelData.data[0];
    channelInfo.innerHTML = `
      <div class="channel-info-grid">
        <div class="channel-info-item"><span class="label">Nombre</span><span class="value">${escapeHtml(ch.display_name)}</span></div>
        <div class="channel-info-item"><span class="label">Titulo</span><span class="value">${escapeHtml(ch.title || '--')}</span></div>
        <div class="channel-info-item"><span class="label">Categoria</span><span class="value">${escapeHtml(ch.game_name || '--')}</span></div>
        <div class="channel-info-item"><span class="label">Idioma</span><span class="value">${ch.language || '--'}</span></div>
        <div class="channel-info-item"><span class="label">Seguidores</span><span class="value">${formatNumber(ch.follower_count || currentUser.followers_count || 0)}</span></div>
        <div class="channel-info-item"><span class="label">Tipo</span><span class="value">${ch.broadcaster_type || 'Estándar'}</span></div>
        <div class="channel-info-item"><span class="label">Creado</span><span class="value">${new Date(currentUser.created_at).toLocaleDateString('es')}</span></div>
        <div class="channel-info-item"><span class="label">Descripcion</span><span class="value">${escapeHtml(ch.description || 'Sin descripcion')}</span></div>
      </div>
    `;
  }

  loadViewerChart();
  loadHoursChart();
  loadFollowerChart();
  loadGlobalEmotes();
}

async function loadViewerChart() {
  const data = await api('/api/stats/viewer-history');
  if (data && data.data && data.data.length > 0) {
    const samples = data.data;
    const labels = samples.map(s => {
      const d = new Date(s.t);
      return d.getHours() + ':' + String(d.getMinutes()).padStart(2, '0');
    });
    const values = samples.map(s => s.viewers);
    document.getElementById('viewerChartBadge').textContent = samples.length + ' muestras';
    drawLineChart('viewerChart', labels, values, '#a855f7', 'viewerChartEmpty');
  } else {
    document.getElementById('viewerChartEmpty').style.display = '';
    const c = document.getElementById('viewerChart');
    if (c) c.style.display = 'none';
  }
}

async function loadHoursChart() {
  const data = await api('/api/stats/stream-analysis');
  if (data && data.data) {
    const d = data.data;
    document.getElementById('hoursChartBadge').textContent = d.bestHour + ' / ' + d.bestDay;
    drawBarChart('hoursChart', d.hours, d.dayCounts, '#3b82f6', 'hoursChartEmpty');
  }
}

async function loadFollowerChart() {
  const data = await api('/api/stats/follower-history');
  if (data && data.data && data.data.length > 0) {
    const samples = data.data;
    const labels = samples.map(s => new Date(s.t).toLocaleDateString('es'));
    const values = samples.map(s => s.count);
    document.getElementById('followerChartBadge').textContent = samples.length + ' muestras';
    drawLineChart('followerChart', labels, values, '#10b981', 'followerChartEmpty');
  } else {
    document.getElementById('followerChartEmpty').style.display = '';
    const c = document.getElementById('followerChart');
    if (c) c.style.display = 'none';
  }
}

// ===== PREDICTIONS =====
async function loadPredictions() {
  const data = await api('/api/predictions');
  const container = document.getElementById('predictionsList');

  if (data && data.data && data.data.length > 0) {
    container.innerHTML = data.data.map(p => {
      const statusClass = p.status === 'ACTIVE' ? 'active' : p.status === 'RESOLVED' ? 'resolved' : 'canceled';
      const totalPoints = p.outcomes.reduce((sum, o) => sum + o.channel_points, 0);
      return `
        <div class="prediction-item">
          <div style="display:flex;justify-content:space-between;align-items:start;margin-bottom:8px">
            <h4>${escapeHtml(p.title)}</h4>
            <span class="prediction-status ${statusClass}">${p.status}</span>
          </div>
          <div class="prediction-outcomes">
            ${p.outcomes.map(o => {
              const pct = totalPoints > 0 ? Math.round((o.channel_points / totalPoints) * 100) : 0;
              return `
                <div class="prediction-outcome">
                  <div class="outcome-name">
                    <span class="outcome-color" style="background:${o.color}"></span>
                    ${escapeHtml(o.title)}
                  </div>
                  <div style="font-size:0.8rem;color:var(--text-muted)">${formatNumber(o.channel_points)} puntos (${pct}%)</div>
                  <div class="outcome-bar"><div class="outcome-fill" style="width:${pct}%;background:${o.color}"></div></div>
                  ${o.winner ? '<div style="margin-top:6px;font-size:0.75rem;color:var(--success)">Ganador</div>' : ''}
                </div>
              `;
            }).join('')}
          </div>
          ${p.status === 'ACTIVE' ? `
            <div style="margin-top:12px;display:flex;gap:6px">
              <button class="btn btn-success btn-sm" onclick="resolvePrediction('${p.id}', '${p.outcomes[0].id}')">${escapeHtml(p.outcomes[0].title)}</button>
              ${p.outcomes[1] ? `<button class="btn btn-success btn-sm" onclick="resolvePrediction('${p.id}', '${p.outcomes[1].id}')">${escapeHtml(p.outcomes[1].title)}</button>` : ''}
              <button class="btn btn-danger btn-sm" onclick="cancelPrediction('${p.id}')">Cancelar</button>
            </div>
          ` : ''}
        </div>
      `;
    }).join('');
  } else {
    container.innerHTML = '<div class="empty-state"><p>No hay predicciones</p></div>';
  }
}

function showPredictionModal() {
  showModal('Nueva Prediccion', `
    <div class="form-group">
      <label>Pregunta</label>
      <input type="text" id="predictionTitle" class="form-input" placeholder="Ej: Ganare esta partida?">
    </div>
    <div class="form-group">
      <label>Opcion 1</label>
      <input type="text" id="predictionOpt1" class="form-input" value="Si" placeholder="Opcion 1">
    </div>
    <div class="form-group">
      <label>Opcion 2</label>
      <input type="text" id="predictionOpt2" class="form-input" value="No" placeholder="Opcion 2">
    </div>
    <div class="form-group">
      <label>Duracion (minutos)</label>
      <input type="number" id="predictionDuration" class="form-input" value="2" min="1" max="180">
    </div>
  `, [
    { text: 'Cancelar', class: 'btn-secondary', action: 'closeModal()' },
    { text: 'Crear', class: 'btn-primary', action: 'createPrediction()' }
  ]);
}

async function createPrediction() {
  const body = {
    title: document.getElementById('predictionTitle').value,
    outcomes: [
      { title: document.getElementById('predictionOpt1').value || 'Si', color: 'BLUE' },
      { title: document.getElementById('predictionOpt2').value || 'No', color: 'PINK' }
    ],
    prediction_window: parseInt(document.getElementById('predictionDuration').value) * 60
  };
  const result = await api('/api/predictions', { method: 'POST', body });
  closeModal();
  if (result && result.data) {
    showToast('Prediccion creada!', 'success');
    loadPredictions();
  } else {
    showToast('Error al crear prediccion', 'error');
  }
}

async function resolvePrediction(predictionId, outcomeId) {
  await api('/api/predictions/' + predictionId, { method: 'PATCH', body: { id: predictionId, status: 'RESOLVED', winning_outcome_id: outcomeId } });
  showToast('Prediccion resuelta', 'success');
  loadPredictions();
}

async function cancelPrediction(predictionId) {
  if (!confirm('Cancelar esta prediccion?')) return;
  await api('/api/predictions/' + predictionId, { method: 'PATCH', body: { id: predictionId, status: 'CANCELED' } });
  showToast('Prediccion cancelada', 'success');
  loadPredictions();
}

// ===== POLLS =====
async function loadPolls() {
  const data = await api('/api/polls');
  const container = document.getElementById('pollsList');

  if (data && data.data && data.data.length > 0) {
    container.innerHTML = data.data.map(p => {
      const totalVotes = p.choices.reduce((sum, c) => sum + c.votes, 0);
      const statusClass = p.status === 'ACTIVE' ? 'active' : p.status === 'ENDED' ? 'ended' : 'canceled';
      return `
        <div class="poll-item">
          <div style="display:flex;justify-content:space-between;align-items:start;margin-bottom:8px">
            <h4>${escapeHtml(p.title)}</h4>
            <span class="poll-status ${statusClass}">${p.status}</span>
          </div>
          <div style="font-size:0.8rem;color:var(--text-muted);margin-bottom:12px">Votos totales: ${totalVotes} ${p.duration ? `| Duracion: ${p.duration/60} min` : ''}</div>
          <div class="poll-options">
            ${p.choices.map(c => {
              const pct = totalVotes > 0 ? Math.round((c.votes / totalVotes) * 100) : 0;
              return `
                <div class="poll-option">
                  <span class="poll-option-text">${escapeHtml(c.title)}</span>
                  <div class="poll-option-bar"><div class="poll-option-fill" style="width:${pct}%"></div></div>
                  <span class="poll-option-pct">${pct}%</span>
                </div>
              `;
            }).join('')}
          </div>
          ${p.status === 'ACTIVE' ? `
            <div style="margin-top:12px">
              <button class="btn btn-danger btn-sm" onclick="endPoll('${p.id}')">Finalizar</button>
            </div>
          ` : ''}
        </div>
      `;
    }).join('');
  } else {
    container.innerHTML = '<div class="empty-state"><p>No hay encuestas</p></div>';
  }
}

function showPollModal() {
  showModal('Nueva Encuesta', `
    <div class="form-group">
      <label>Pregunta</label>
      <input type="text" id="pollTitle" class="form-input" placeholder="Ej: Que juego juego hoy?">
    </div>
    <div class="form-group">
      <label>Opciones (una por linea)</label>
      <textarea id="pollChoices" class="form-input" rows="4" placeholder="Opcion 1&#10;Opcion 2&#10;Opcion 3">Opcion 1\nOpcion 2</textarea>
    </div>
    <div class="form-group">
      <label>Duracion (minutos)</label>
      <input type="number" id="pollDuration" class="form-input" value="5" min="1" max="1800">
    </div>
  `, [
    { text: 'Cancelar', class: 'btn-secondary', action: 'closeModal()' },
    { text: 'Crear', class: 'btn-primary', action: 'createPoll()' }
  ]);
}

async function createPoll() {
  const choicesText = document.getElementById('pollChoices').value.split('\n').filter(c => c.trim());
  if (choicesText.length < 2) return showToast('Necesitas al menos 2 opciones', 'warning');
  if (choicesText.length > 5) return showToast('Maximo 5 opciones', 'warning');

  const body = {
    title: document.getElementById('pollTitle').value,
    choices: choicesText.map(title => ({ title: title.trim() })),
    duration: parseInt(document.getElementById('pollDuration').value) * 60
  };
  const result = await api('/api/polls', { method: 'POST', body });
  closeModal();
  if (result && result.data) {
    showToast('Encuesta creada!', 'success');
    loadPolls();
  } else {
    showToast('Error al crear encuesta', 'error');
  }
}

async function endPoll(pollId) {
  await api('/api/polls/' + pollId, { method: 'PATCH', body: { id: pollId, status: 'TERMINATED' } });
  showToast('Encuesta finalizada', 'success');
  loadPolls();
}

// ===== MODAL =====
function showModal(title, body, buttons = []) {
  document.getElementById('modalTitle').textContent = title;
  document.getElementById('modalBody').innerHTML = body;
  document.getElementById('modalFooter').innerHTML = buttons.map(b => 
    `<button class="btn ${b.class}" onclick="${b.action}">${b.text}</button>`
  ).join('');
  document.getElementById('modalOverlay').classList.remove('hidden');
}

function closeModal() {
  document.getElementById('modalOverlay').classList.add('hidden');
}

document.addEventListener('click', (e) => {
  if (e.target.id === 'modalOverlay') closeModal();
});

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') closeModal();
});

// ===== TOAST =====
function showToast(message, type = 'info') {
  const container = document.getElementById('toastContainer');
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  const icons = {
    success: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="#10b981" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>',
    error: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="#ef4444" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>',
    warning: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="#f59e0b" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>',
    info: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="#3b82f6" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>'
  };
  toast.innerHTML = `${icons[type] || icons.info}<span>${message}</span>`;
  container.appendChild(toast);
  setTimeout(() => { toast.style.opacity = '0'; setTimeout(() => toast.remove(), 300); }, 3500);
}

// ===== CANVAS CHARTS =====
function drawLineChart(canvasId, labels, values, color, emptyId) {
  const canvas = document.getElementById(canvasId);
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const w = canvas.width = canvas.parentElement.clientWidth;
  const h = canvas.height = 200;
  ctx.clearRect(0, 0, w, h);

  if (!values || values.length < 2) {
    canvas.style.display = 'none';
    if (emptyId) document.getElementById(emptyId).style.display = '';
    return;
  }

  canvas.style.display = '';
  if (emptyId) document.getElementById(emptyId).style.display = 'none';

  const pad = { t: 20, r: 20, b: 30, l: 45 };
  const cw = w - pad.l - pad.r;
  const ch = h - pad.t - pad.b;
  const maxV = Math.max(...values, 1);
  const minV = 0;
  const range = maxV - minV || 1;

  ctx.strokeStyle = 'rgba(168, 85, 247, 0.15)';
  ctx.lineWidth = 1;
  for (let i = 0; i <= 4; i++) {
    const y = pad.t + ch - (i / 4) * ch;
    ctx.beginPath();
    ctx.moveTo(pad.l, y);
    ctx.lineTo(w - pad.r, y);
    ctx.stroke();
    ctx.fillStyle = '#6b5f8a';
    ctx.font = '11px Inter, sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText(Math.round(minV + (i / 4) * range), pad.l - 8, y + 4);
  }

  ctx.beginPath();
  ctx.moveTo(pad.l, pad.t + ch - ((values[0] - minV) / range) * ch);
  for (let i = 1; i < values.length; i++) {
    const x = pad.l + (i / (values.length - 1)) * cw;
    const y = pad.t + ch - ((values[i] - minV) / range) * ch;
    ctx.lineTo(x, y);
  }
  ctx.strokeStyle = color || '#a855f7';
  ctx.lineWidth = 2.5;
  ctx.stroke();

  const grad = ctx.createLinearGradient(0, pad.t, 0, h - pad.b);
  grad.addColorStop(0, (color || '#a855f7') + '40');
  grad.addColorStop(1, (color || '#a855f7') + '05');
  ctx.lineTo(pad.l + cw, pad.t + ch);
  ctx.lineTo(pad.l, pad.t + ch);
  ctx.closePath();
  ctx.fillStyle = grad;
  ctx.fill();

  if (labels && values.length <= 24) {
    ctx.fillStyle = '#6b5f8a';
    ctx.font = '10px Inter, sans-serif';
    ctx.textAlign = 'center';
    const step = Math.max(1, Math.floor(values.length / 8));
    for (let i = 0; i < values.length; i += step) {
      const x = pad.l + (i / (values.length - 1)) * cw;
      ctx.fillText(labels[i] || '', x, h - 8);
    }
  }
}

function drawBarChart(canvasId, labels, values, color, emptyId) {
  const canvas = document.getElementById(canvasId);
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const w = canvas.width = canvas.parentElement.clientWidth;
  const h = canvas.height = 200;
  ctx.clearRect(0, 0, w, h);

  if (!values || values.every(v => v === 0)) {
    canvas.style.display = 'none';
    if (emptyId) document.getElementById(emptyId).style.display = '';
    return;
  }

  canvas.style.display = '';
  if (emptyId) document.getElementById(emptyId).style.display = 'none';

  const pad = { t: 20, r: 20, b: 35, l: 35 };
  const cw = w - pad.l - pad.r;
  const ch = h - pad.t - pad.b;
  const maxV = Math.max(...values, 1);
  const barW = cw / labels.length * 0.7;
  const gap = cw / labels.length;

  ctx.strokeStyle = 'rgba(168, 85, 247, 0.15)';
  ctx.lineWidth = 1;
  for (let i = 0; i <= 4; i++) {
    const y = pad.t + ch - (i / 4) * ch;
    ctx.beginPath();
    ctx.moveTo(pad.l, y);
    ctx.lineTo(w - pad.r, y);
    ctx.stroke();
    ctx.fillStyle = '#6b5f8a';
    ctx.font = '11px Inter, sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText(Math.round((i / 4) * maxV), pad.l - 8, y + 4);
  }

  for (let i = 0; i < values.length; i++) {
    const x = pad.l + i * gap + (gap - barW) / 2;
    const barH = (values[i] / maxV) * ch;
    const y = pad.t + ch - barH;

    const grad = ctx.createLinearGradient(0, y, 0, pad.t + ch);
    grad.addColorStop(0, color || '#a855f7');
    grad.addColorStop(1, (color || '#a855f7') + '60');
    ctx.fillStyle = grad;

    ctx.beginPath();
    const r = Math.min(4, barW / 2);
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + barW - r, y);
    ctx.quadraticCurveTo(x + barW, y, x + barW, y + r);
    ctx.lineTo(x + barW, pad.t + ch);
    ctx.lineTo(x, pad.t + ch);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.fill();

    if (labels[i]) {
      ctx.fillStyle = '#6b5f8a';
      ctx.font = '10px Inter, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(labels[i], x + barW / 2, h - 10);
    }
  }
}

// ===== VIEWER TRACKING =====
let viewerTrackInterval = null;

function startViewerTracking() {
  if (viewerTrackInterval) clearInterval(viewerTrackInterval);
  viewerTrackInterval = setInterval(async () => {
    const dot = document.querySelector('.status-dot');
    if (dot && dot.classList.contains('live')) {
      await api('/api/stats/viewer-sample', { method: 'POST' });
    }
  }, 60000);
}

async function stopViewerTracking() {
  if (viewerTrackInterval) clearInterval(viewerTrackInterval);
  viewerTrackInterval = null;
}

// ===== FOLLOWER TRACKING =====
let followerTrackInterval = null;

function startFollowerTracking() {
  if (followerTrackInterval) clearInterval(followerTrackInterval);
  followerTrackInterval = setInterval(async () => {
    await api('/api/stats/follower-snapshot', { method: 'POST' });
  }, 300000);
}

// ===== AUTO-MOD =====
async function loadBannedWords() {
  const data = await api('/api/mod/automod/words');
  const container = document.getElementById('automodWordsList');
  if (data && data.words && data.words.length > 0) {
    container.innerHTML = data.words.map(w => `
      <div class="automod-word-tag">
        <span>${escapeHtml(w)}</span>
        <button class="automod-word-remove" onclick="removeBannedWord('${escapeAttr(w)}')">&times;</button>
      </div>
    `).join('');
  } else {
    container.innerHTML = '<div class="empty-state" style="padding:16px"><p>No hay palabras bloqueadas. Agrega una arriba.</p></div>';
  }
}

async function addBannedWord() {
  const input = document.getElementById('automodWordInput');
  const word = input.value.trim();
  if (!word) return;
  await api('/api/mod/automod/words', { method: 'POST', body: { words: [word] } });
  input.value = '';
  loadBannedWords();
  showToast(`"${word}" agregado a palabras bloqueadas`, 'success');
}

async function removeBannedWord(word) {
  await api('/api/mod/automod/words', { method: 'DELETE', body: { word } });
  loadBannedWords();
  showToast(`"${word}" removido`, 'info');
}

async function testAutoMod() {
  const input = document.getElementById('automodTestInput');
  const message = input.value.trim();
  if (!message) return;
  const result = await api('/api/mod/automod/check', { method: 'POST', body: { message } });
  const container = document.getElementById('automodTestResult');
  if (result && result.blocked) {
    container.innerHTML = `<div class="automod-result blocked">BLOQUEADO - Contiene la palabra: "${escapeHtml(result.word)}"</div>`;
  } else {
    container.innerHTML = `<div class="automod-result allowed">PERMITIDO - No contiene palabras bloqueadas</div>`;
  }
}

// ===== ACTION LOG =====
async function logAction(action, target, details) {
  await api('/api/mod/action-log', { method: 'POST', body: { action, target, details } });
}

async function loadActionLog() {
  const data = await api('/api/mod/action-log');
  const container = document.getElementById('actionLogList');
  if (data && data.data && data.data.length > 0) {
    container.innerHTML = data.data.map(entry => {
      const icons = {
        ban: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="#ef4444" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/></svg>',
        unban: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="#10b981" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="16 8 10 14 8 12"/></svg>',
        timeout: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="#f59e0b" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>',
        announce: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="#3b82f6" stroke-width="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>',
        mod: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="#a855f7" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>',
        vip: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="#c084fc" stroke-width="2"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>',
        chat: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="#60a5fa" stroke-width="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>'
      };
      const icon = icons[entry.action] || icons.chat;
      const time = new Date(entry.t).toLocaleString('es');
      return `
        <div class="action-log-entry">
          <div class="action-log-icon">${icon}</div>
          <div class="action-log-info">
            <span class="action-log-action">${escapeHtml(entry.action)}</span>
            <span class="action-log-target">${escapeHtml(entry.target)}</span>
            ${entry.details ? `<span class="action-log-details">${escapeHtml(entry.details)}</span>` : ''}
          </div>
          <div class="action-log-meta">
            <span class="action-log-moderator">${escapeHtml(entry.moderator)}</span>
            <span class="action-log-time">${time}</span>
          </div>
        </div>
      `;
    }).join('');
  } else {
    container.innerHTML = '<div class="empty-state"><p>No hay acciones registradas todavia</p></div>';
  }
}

// ===== EMOTES =====
async function loadGlobalEmotes() {
  const data = await api('/api/emotes/global');
  const container = document.getElementById('globalEmotes');
  if (data && data.data && data.data.length > 0) {
    container.innerHTML = data.data.slice(0, 80).map(e => {
      const url = e.images && e.images.url_1x ? e.images.url_1x : '';
      if (url) {
        return `<div class="emote-item" title="${escapeHtml(e.name)}"><img src="${url}" alt="${escapeHtml(e.name)}" loading="lazy"></div>`;
      }
      return `<div class="emote-item emote-text" title="${escapeHtml(e.name)}">${escapeHtml(e.name)}</div>`;
    }).join('');
  } else {
    container.innerHTML = '<div class="empty-state"><p>No se pudieron cargar los emotes</p></div>';
  }
}

// ===== THUMBNAIL =====
async function updateThumbnail() {
  const url = document.getElementById('thumbnailUrl').value.trim();
  if (!url) return showToast('Ingresa una URL de imagen', 'warning');
  if (!url.startsWith('https://')) return showToast('La URL debe ser HTTPS', 'warning');

  const result = await api('/api/stream/thumbnail', { method: 'PUT', body: { image_url: url } });
  if (result && (result.status === 200 || result.status === 204)) {
    showToast('Miniatura actualizada!', 'success');
    logAction('thumbnail', currentUser.display_name, 'Miniatura actualizada');
  } else {
    const errMsg = result?.data?.message || 'Error al actualizar miniatura';
    showToast(errMsg, 'error');
  }
}

// ===== UTILITIES =====
function escapeHtml(str) {
  if (!str) return '';
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

function escapeAttr(str) {
  if (!str) return '';
  return str.replace(/'/g, "\\'").replace(/"/g, '&quot;');
}

function formatNumber(n) {
  if (n === undefined || n === null) return '--';
  if (n >= 1000000) return (n / 1000000).toFixed(1) + 'M';
  if (n >= 1000) return (n / 1000).toFixed(1) + 'K';
  return n.toString();
}

function getTimeSince(date) {
  const diff = Math.floor((Date.now() - date.getTime()) / 1000);
  const h = Math.floor(diff / 3600);
  const m = Math.floor((diff % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}
