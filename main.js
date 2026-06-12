/* ============================================
   NEONSTRIKE — main.js
   Login, persistência, menu, admin, integração
   ============================================ */

let currentUser = null;   // { username }
let playerData = null;    // ver defaultPlayerData()
let globalConfig = defaultGlobalConfig();
let realtimeChannel = null;

// ===========================================================
// UTIL
// ===========================================================
function toast(msg, isError=false) {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.className = 'toast show' + (isError ? ' error' : '');
  setTimeout(() => el.classList.remove('show'), 2600);
}

function showScreen(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.getElementById('screen-'+id).classList.add('active');
}

async function sha256(text) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2,'0')).join('');
}

// ===========================================================
// CONEXÃO / STATUS
// ===========================================================
function updateConnStatus() {
  const el = document.getElementById('connection-status');
  if (!supabase) {
    el.textContent = '⚠ banco de dados não configurado — veja config.js (modo local ativo)';
    el.className = 'conn-status error';
  } else {
    el.textContent = '✓ conectado ao banco de dados';
    el.className = 'conn-status ok';
  }
}

// ===========================================================
// LOCAL FALLBACK (caso Supabase não esteja configurado)
// ===========================================================
const LocalDB = {
  getUsers() { return JSON.parse(localStorage.getItem('ns_users') || '{}'); },
  saveUsers(u) { localStorage.setItem('ns_users', JSON.stringify(u)); },
  getConfig() { return JSON.parse(localStorage.getItem('ns_config') || 'null') || defaultGlobalConfig(); },
  saveConfig(c) { localStorage.setItem('ns_config', JSON.stringify(c)); },
};

// ===========================================================
// AUTENTICAÇÃO
// ===========================================================
async function registerUser(username, password) {
  const passHash = await sha256(password);

  if (supabase) {
    const { data: existing } = await supabase.from('players').select('username').eq('username', username).maybeSingle();
    if (existing) throw new Error('Esse nome de usuário já existe.');

    const newData = defaultPlayerData();
    const { error } = await supabase.from('players').insert({
      username, password_hash: passHash, data: newData,
    });
    if (error) throw new Error('Erro ao criar conta: ' + error.message);
    return newData;
  } else {
    const users = LocalDB.getUsers();
    if (users[username]) throw new Error('Esse nome de usuário já existe.');
    const newData = defaultPlayerData();
    users[username] = { password_hash: passHash, data: newData };
    LocalDB.saveUsers(users);
    return newData;
  }
}

async function loginUser(username, password) {
  const passHash = await sha256(password);

  if (supabase) {
    const { data, error } = await supabase.from('players').select('*').eq('username', username).maybeSingle();
    if (error || !data) throw new Error('Usuário não encontrado.');
    if (data.password_hash !== passHash) throw new Error('Senha incorreta.');
    if (data.data.banned) throw new Error('Esta conta foi banida.');
    return data.data;
  } else {
    const users = LocalDB.getUsers();
    const u = users[username];
    if (!u) throw new Error('Usuário não encontrado.');
    if (u.password_hash !== passHash) throw new Error('Senha incorreta.');
    if (u.data.banned) throw new Error('Esta conta foi banida.');
    return u.data;
  }
}

async function savePlayerData() {
  if (!currentUser) return;
  if (supabase) {
    const { error } = await supabase.from('players').update({ data: playerData }).eq('username', currentUser.username);
    if (error) console.error('Erro ao salvar:', error);
  } else {
    const users = LocalDB.getUsers();
    if (users[currentUser.username]) {
      users[currentUser.username].data = playerData;
      LocalDB.saveUsers(users);
    }
  }
}

// ===========================================================
// CONFIG GLOBAL (anúncios, economia, tema)
// ===========================================================
async function loadGlobalConfig() {
  if (supabase) {
    const { data } = await supabase.from('game_config').select('*').eq('id', 1).maybeSingle();
    if (data && data.config) {
      globalConfig = { ...defaultGlobalConfig(), ...data.config };
    } else {
      // cria linha inicial
      await supabase.from('game_config').insert({ id: 1, config: defaultGlobalConfig() });
      globalConfig = defaultGlobalConfig();
    }
  } else {
    globalConfig = LocalDB.getConfig();
  }
  applyTheme();
}

async function saveGlobalConfig() {
  if (supabase) {
    const { error } = await supabase.from('game_config').update({ config: globalConfig }).eq('id', 1);
    if (error) { toast('Erro ao salvar config: ' + error.message, true); return false; }
  } else {
    LocalDB.saveConfig(globalConfig);
  }
  applyTheme();
  return true;
}

function applyTheme() {
  const t = globalConfig.theme || defaultGlobalConfig().theme;
  document.documentElement.style.setProperty('--primary', t.primary);
  document.documentElement.style.setProperty('--secondary', t.secondary);
  document.documentElement.style.setProperty('--bg', t.bg);
  document.title = t.gameName || 'NEONSTRIKE';
  document.querySelectorAll('.brand h1').forEach(el => {
    el.innerHTML = (t.gameName || 'NEONSTRIKE').replace(/(.{1,4})$/, '<span>$1</span>');
  });
  document.querySelectorAll('.brand-small').forEach(el => {
    const adminTag = el.querySelector('.admin-tag');
    el.innerHTML = (t.gameName || 'NEONSTRIKE');
    if (adminTag) el.appendChild(adminTag);
  });

  // anúncio
  const banner = document.getElementById('announcement-banner');
  if (globalConfig.announcement && globalConfig.announcement.trim()) {
    banner.style.display = 'flex';
    document.getElementById('announcement-text').textContent = globalConfig.announcement;
  } else {
    banner.style.display = 'none';
  }
}

// ===========================================================
// LOGIN / REGISTER UI
// ===========================================================
document.querySelectorAll('.tab-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.auth-form').forEach(f => f.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById('form-'+btn.dataset.tab).classList.add('active');
  });
});

document.getElementById('form-login').addEventListener('submit', async (e) => {
  e.preventDefault();
  const username = document.getElementById('login-username').value.trim().toLowerCase();
  const password = document.getElementById('login-password').value;
  const msg = document.getElementById('login-msg');
  msg.textContent = ''; msg.className = 'auth-msg';

  try {
    playerData = await loginUser(username, password);
    currentUser = { username };
    msg.textContent = 'Login bem-sucedido!';
    msg.className = 'auth-msg success';
    setTimeout(() => enterMenu(), 300);
  } catch (err) {
    msg.textContent = err.message;
  }
});

document.getElementById('form-register').addEventListener('submit', async (e) => {
  e.preventDefault();
  const username = document.getElementById('reg-username').value.trim().toLowerCase();
  const password = document.getElementById('reg-password').value;
  const password2 = document.getElementById('reg-password2').value;
  const msg = document.getElementById('register-msg');
  msg.textContent = ''; msg.className = 'auth-msg';

  if (!/^[a-z0-9_]+$/.test(username)) {
    msg.textContent = 'Use apenas letras minúsculas, números e _.';
    return;
  }
  if (password !== password2) {
    msg.textContent = 'As senhas não coincidem.';
    return;
  }

  try {
    playerData = await registerUser(username, password);
    currentUser = { username };
    msg.textContent = 'Conta criada com sucesso!';
    msg.className = 'auth-msg success';
    setTimeout(() => enterMenu(), 300);
  } catch (err) {
    msg.textContent = err.message;
  }
});

// ===========================================================
// ENTRAR NO MENU
// ===========================================================
async function enterMenu() {
  await loadGlobalConfig();
  showScreen('menu');
  renderProfile();
  renderArsenal();
  renderSkills();
  renderShop();

  document.getElementById('player-name').textContent = currentUser.username;
  document.getElementById('player-avatar').textContent = currentUser.username[0].toUpperCase();

  if (currentUser.username === OWNER_USERNAME) {
    document.getElementById('btn-admin').style.display = 'flex';
  }

  subscribeRealtime();
}

function subscribeRealtime() {
  if (!supabase) return;
  if (realtimeChannel) supabase.removeChannel(realtimeChannel);
  realtimeChannel = supabase.channel('game_config_changes')
    .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'game_config' }, (payload) => {
      globalConfig = { ...defaultGlobalConfig(), ...payload.new.config };
      applyTheme();
    })
    .subscribe();
}

// ===========================================================
// RENDER: PERFIL
// ===========================================================
function renderProfile() {
  document.getElementById('profile-level').textContent = playerData.level;
  document.getElementById('player-level-tag').textContent = 'Nv. ' + playerData.level;
  const needed = xpForLevel(playerData.level);
  document.getElementById('profile-xp-text').textContent = `${playerData.xp} / ${needed} XP`;
  document.getElementById('profile-xp-bar').style.width = Math.min(100, (playerData.xp/needed)*100) + '%';
  document.getElementById('stat-coins').textContent = playerData.coins;
  document.getElementById('stat-kills').textContent = playerData.kills;
  document.getElementById('stat-wins').textContent = playerData.wins;
  document.getElementById('stat-bestwave').textContent = playerData.bestWave;
}

// ===========================================================
// RENDER: ARSENAL
// ===========================================================
function renderArsenal() {
  const list = document.getElementById('weapon-list');
  list.innerHTML = '';
  WEAPONS.forEach(w => {
    const unlocked = playerData.unlockedWeapons.includes(w.id);
    const equipped = playerData.equippedWeapon === w.id;
    const row = document.createElement('div');
    row.className = 'item-row' + (equipped ? ' equipped' : '') + (!unlocked ? ' locked' : '');
    row.innerHTML = `
      <span class="item-icon">${w.icon}</span>
      <div class="item-body">
        <div class="item-name">${w.name} ${unlocked ? '' : `<span style="color:var(--muted);font-size:.7rem">(Nv. ${w.unlockLevel})</span>`}</div>
        <div class="item-desc">${w.desc} · Dano ${w.damage}</div>
      </div>
      ${renderItemAction('weapon', w, unlocked, equipped)}
    `;
    list.appendChild(row);
  });
}

function renderSkills() {
  const list = document.getElementById('skill-list');
  list.innerHTML = '';
  SKILLS.forEach(s => {
    const unlocked = playerData.unlockedSkills.includes(s.id);
    const equipped = playerData.equippedSkill === s.id;
    const row = document.createElement('div');
    row.className = 'item-row' + (equipped ? ' equipped' : '') + (!unlocked ? ' locked' : '');
    row.innerHTML = `
      <span class="item-icon">${s.icon}</span>
      <div class="item-body">
        <div class="item-name">${s.name} ${unlocked ? '' : `<span style="color:var(--muted);font-size:.7rem">(Nv. ${s.unlockLevel})</span>`}</div>
        <div class="item-desc">${s.desc} · Recarga ${(s.cooldown/1000).toFixed(0)}s</div>
      </div>
      ${renderItemAction('skill', s, unlocked, equipped)}
    `;
    list.appendChild(row);
  });
}

function renderItemAction(kind, item, unlocked, equipped) {
  if (unlocked) {
    if (equipped) return `<button class="item-action equip-btn is-equipped" disabled>EQUIPADO</button>`;
    return `<button class="item-action equip-btn" onclick="equipItem('${kind}','${item.id}')">EQUIPAR</button>`;
  }
  return `<button class="item-action" disabled>BLOQUEADO</button>`;
}

function equipItem(kind, id) {
  SFX.click();
  if (kind === 'weapon') playerData.equippedWeapon = id;
  else playerData.equippedSkill = id;
  savePlayerData();
  renderArsenal();
  renderSkills();
  toast('Equipado!');
}

// ===========================================================
// RENDER: LOJA (compra com moedas — só itens já desbloqueados por nível mas não comprados)
// ===========================================================
function renderShop() {
  const list = document.getElementById('shop-list');
  list.innerHTML = '';

  const buyableWeapons = WEAPONS.filter(w => w.unlockLevel <= playerData.level && !playerData.unlockedWeapons.includes(w.id));
  const buyableSkills = SKILLS.filter(s => s.unlockLevel <= playerData.level && !playerData.unlockedSkills.includes(s.id));

  if (buyableWeapons.length === 0 && buyableSkills.length === 0) {
    list.innerHTML = `<div class="item-desc" style="padding:10px 0">Nada disponível agora. Suba de nível para desbloquear novos itens na loja!</div>`;
    return;
  }

  buyableWeapons.forEach(w => {
    const price = Math.round(w.price * (globalConfig.coinMultiplier > 0 ? 1 : 1));
    const row = document.createElement('div');
    row.className = 'item-row';
    row.innerHTML = `
      <span class="item-icon">${w.icon}</span>
      <div class="item-body">
        <div class="item-name">${w.name}</div>
        <div class="item-desc">${w.desc}</div>
      </div>
      <button class="item-action buy-btn" ${playerData.coins < price ? 'disabled' : ''} onclick="buyItem('weapon','${w.id}',${price})">💰 ${price}</button>
    `;
    list.appendChild(row);
  });

  buyableSkills.forEach(s => {
    const price = s.price;
    const row = document.createElement('div');
    row.className = 'item-row';
    row.innerHTML = `
      <span class="item-icon">${s.icon}</span>
      <div class="item-body">
        <div class="item-name">${s.name}</div>
        <div class="item-desc">${s.desc}</div>
      </div>
      <button class="item-action buy-btn" ${playerData.coins < price ? 'disabled' : ''} onclick="buyItem('skill','${s.id}',${price})">💰 ${price}</button>
    `;
    list.appendChild(row);
  });
}

function buyItem(kind, id, price) {
  if (playerData.coins < price) { toast('Moedas insuficientes!', true); return; }
  playerData.coins -= price;
  if (kind === 'weapon') playerData.unlockedWeapons.push(id);
  else playerData.unlockedSkills.push(id);
  SFX.coinPickup();
  savePlayerData();
  renderProfile();
  renderArsenal();
  renderSkills();
  renderShop();
  toast('Item comprado!');
}

// ===========================================================
// JOGO
// ===========================================================
let canvasInitialized = false;

document.getElementById('btn-play').addEventListener('click', () => {
  showScreen('game');
  if (!canvasInitialized) {
    GAME.init(document.getElementById('game-canvas'));
    GAME.update();
    canvasInitialized = true;
  }
  resetGameOverlay();
});

document.getElementById('btn-start-wave').addEventListener('click', () => {
  document.getElementById('overlay-start').classList.add('hidden');
  GAME.startGame(playerData, {
    onGameOver: handleGameOver,
    onLevelUp: handleLevelUp,
    onWaveChange: handleWaveChange,
    onStatsChange: handleStatsChange,
  });
  document.getElementById('hud-weapon-name').textContent = WEAPONS.find(w=>w.id===playerData.equippedWeapon).name.toUpperCase();
  document.getElementById('hud-skill-name').textContent = SKILLS.find(s=>s.id===playerData.equippedSkill).icon + ' ' + SKILLS.find(s=>s.id===playerData.equippedSkill).name;
  document.getElementById('game-canvas').requestPointerLock();
});

document.getElementById('btn-resume').addEventListener('click', () => {
  document.getElementById('overlay-pause').classList.add('hidden');
  GAME.resumeGame();
  document.getElementById('game-canvas').requestPointerLock();
});

document.getElementById('btn-quit').addEventListener('click', () => {
  GAME.quitGame();
  showScreen('menu');
});

document.getElementById('btn-back-menu').addEventListener('click', () => {
  GAME.quitGame();
  showScreen('menu');
  renderProfile();
  renderArsenal();
  renderSkills();
  renderShop();
});

function resetGameOverlay() {
  document.getElementById('overlay-start').classList.remove('hidden');
  document.getElementById('overlay-pause').classList.add('hidden');
  document.getElementById('overlay-gameover').classList.add('hidden');
}

// hooks chamados pelo pause via Escape
const origPause = GAME.pauseGame;

function handleStatsChange(stats) {
  // barras
  document.getElementById('hud-hp-bar').style.width = Math.max(0,(stats.hp/stats.maxHp)*100) + '%';
  document.getElementById('hud-hp-val').textContent = Math.max(0, Math.round(stats.hp));
  document.getElementById('hud-energy-bar').style.width = (stats.energy/stats.maxEnergy)*100 + '%';
  document.getElementById('hud-energy-val').textContent = Math.round(stats.energy);
  document.getElementById('hud-score').textContent = stats.score;
  document.getElementById('hud-coins-game').textContent = stats.coins;
  document.getElementById('hud-wave').textContent = 'ONDA ' + stats.wave;

  document.getElementById('hud-weapon-name').textContent = stats.weapon.name.toUpperCase();
  document.getElementById('hud-skill-name').textContent = stats.skill.icon + ' ' + stats.skill.name;
  const cdPct = stats.skillTotalCooldown > 0 ? Math.max(0, (stats.skillCooldownLeft/stats.skillTotalCooldown)*100) : 0;
  document.getElementById('hud-skill-cd').style.width = (100-cdPct) + '%';

  // pausa via Escape (verifica se foi pausado externamente)
  const st = GAME.state;
  if (st && st.paused && document.getElementById('overlay-pause').classList.contains('hidden') && st.running && !st.gameOver) {
    document.getElementById('overlay-pause').classList.remove('hidden');
  }
}

window.__hitMarker = () => {
  const el = document.getElementById('hit-marker');
  el.classList.remove('show');
  void el.offsetWidth;
  el.classList.add('show');
};
window.__damageFlash = () => {
  const el = document.getElementById('damage-vignette');
  el.classList.remove('show');
  void el.offsetWidth;
  el.classList.add('show');
  setTimeout(() => el.classList.remove('show'), 200);
};

function handleWaveChange(wave) {
  addKillFeed(`🌊 Onda ${wave} começou!`);
}

function handleLevelUp(level) {
  const toastEl = document.getElementById('levelup-toast');
  document.getElementById('levelup-num').textContent = level;
  toastEl.classList.remove('show');
  void toastEl.offsetWidth;
  toastEl.classList.add('show');
}

function addKillFeed(text) {
  const feed = document.getElementById('kill-feed');
  const el = document.createElement('div');
  el.className = 'kill-feed-item';
  el.textContent = text;
  feed.appendChild(el);
  setTimeout(() => el.remove(), 3200);
}

async function handleGameOver(result) {
  document.getElementById('overlay-gameover').classList.remove('hidden');
  document.getElementById('overlay-pause').classList.add('hidden');
  document.getElementById('gameover-title').textContent = 'VOCÊ MORREU';
  document.getElementById('go-wave').textContent = result.wave;
  document.getElementById('go-kills').textContent = result.kills;
  document.getElementById('go-score').textContent = result.score;

  const coinMult = globalConfig.coinMultiplier || 1;
  const xpMult = globalConfig.xpMultiplier || 1;
  const earnedCoins = Math.round(result.coins * coinMult);
  const earnedXP = Math.round(result.score * 0.5 * xpMult);

  document.getElementById('go-coins').textContent = earnedCoins;
  document.getElementById('go-xp').textContent = earnedXP;

  // atualizar dados do jogador
  playerData.coins += earnedCoins;
  playerData.kills += result.kills;
  if (result.wave - 1 > playerData.bestWave) playerData.bestWave = result.wave - 1;
  playerData.level = result.level;

  // recalcular xp acumulado de forma simples (aplica multiplicador via XP extra)
  let extraXP = earnedXP;
  let needed = xpForLevel(playerData.level);
  playerData.xp += extraXP;
  while (playerData.xp >= needed) {
    playerData.xp -= needed;
    playerData.level++;
    needed = xpForLevel(playerData.level);
  }

  await savePlayerData();
}

// ===========================================================
// LOGOUT
// ===========================================================
document.getElementById('btn-logout').addEventListener('click', () => {
  currentUser = null;
  playerData = null;
  if (realtimeChannel) supabase && supabase.removeChannel(realtimeChannel);
  document.getElementById('btn-admin').style.display = 'none';
  document.getElementById('login-username').value = '';
  document.getElementById('login-password').value = '';
  showScreen('login');
});

// ===========================================================
// PAINEL ADMIN
// ===========================================================
document.getElementById('btn-admin').addEventListener('click', async () => {
  showScreen('admin');
  await loadAdminPlayers();
  loadAdminConfigForms();
  refreshAdminStats();
});
document.getElementById('btn-admin-back').addEventListener('click', () => showScreen('menu'));

document.querySelectorAll('.admin-nav-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.admin-nav-btn').forEach(b=>b.classList.remove('active'));
    document.querySelectorAll('.admin-panel').forEach(p=>p.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById('admin-'+btn.dataset.panel).classList.add('active');
  });
});

let allPlayersCache = [];

async function loadAdminPlayers() {
  if (supabase) {
    const { data, error } = await supabase.from('players').select('username, data');
    if (error) { toast('Erro ao carregar jogadores: '+error.message, true); return; }
    allPlayersCache = data;
  } else {
    const users = LocalDB.getUsers();
    allPlayersCache = Object.entries(users).map(([username, u]) => ({ username, data: u.data }));
  }
  renderAdminPlayers(allPlayersCache);
}

function renderAdminPlayers(players) {
  const body = document.getElementById('admin-players-body');
  body.innerHTML = '';
  players.forEach(p => {
    const isOwner = p.username === OWNER_USERNAME;
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${p.username} ${isOwner ? '<span class="badge-owner">OWNER</span>' : ''}</td>
      <td><input type="number" value="${p.data.level}" data-field="level" min="1"></td>
      <td><input type="number" value="${p.data.coins}" data-field="coins" min="0"></td>
      <td>${p.data.kills}</td>
      <td>${p.data.banned ? '<span class="badge-banned">BANIDO</span>' : '<span class="badge-active">ATIVO</span>'}</td>
      <td>
        <button class="mini-btn" onclick="adminSavePlayer('${p.username}', this)">SALVAR</button>
        ${!isOwner ? `<button class="mini-btn danger" onclick="adminToggleBan('${p.username}', ${!p.data.banned})">${p.data.banned ? 'DESBANIR' : 'BANIR'}</button>` : ''}
      </td>
    `;
    body.appendChild(tr);
  });
}

document.getElementById('admin-search').addEventListener('input', (e) => {
  const q = e.target.value.toLowerCase();
  renderAdminPlayers(allPlayersCache.filter(p => p.username.includes(q)));
});

async function adminSavePlayer(username, btnEl) {
  const tr = btnEl.closest('tr');
  const level = parseInt(tr.querySelector('[data-field="level"]').value) || 1;
  const coins = parseInt(tr.querySelector('[data-field="coins"]').value) || 0;

  const player = allPlayersCache.find(p => p.username === username);
  player.data.level = level;
  player.data.coins = coins;

  if (supabase) {
    const { error } = await supabase.from('players').update({ data: player.data }).eq('username', username);
    if (error) { toast('Erro: '+error.message, true); return; }
  } else {
    const users = LocalDB.getUsers();
    users[username].data = player.data;
    LocalDB.saveUsers(users);
  }
  toast(`Jogador ${username} atualizado!`);
}

async function adminToggleBan(username, banned) {
  const player = allPlayersCache.find(p => p.username === username);
  player.data.banned = banned;

  if (supabase) {
    const { error } = await supabase.from('players').update({ data: player.data }).eq('username', username);
    if (error) { toast('Erro: '+error.message, true); return; }
  } else {
    const users = LocalDB.getUsers();
    users[username].data = player.data;
    LocalDB.saveUsers(users);
  }
  toast(banned ? `${username} foi banido.` : `${username} foi desbanido.`);
  renderAdminPlayers(allPlayersCache);
}

// --- Anúncio ---
function loadAdminConfigForms() {
  document.getElementById('announce-input').value = globalConfig.announcement || '';
  document.getElementById('eco-coin-mult').value = globalConfig.coinMultiplier;
  document.getElementById('eco-xp-mult').value = globalConfig.xpMultiplier;
  document.getElementById('eco-shop-base').value = globalConfig.shopBasePrice;
  document.getElementById('theme-gamename').value = globalConfig.theme.gameName;
  document.getElementById('theme-primary').value = globalConfig.theme.primary;
  document.getElementById('theme-secondary').value = globalConfig.theme.secondary;
  document.getElementById('theme-bg').value = globalConfig.theme.bg;
}

document.getElementById('btn-save-announce').addEventListener('click', async () => {
  globalConfig.announcement = document.getElementById('announce-input').value.trim();
  const ok = await saveGlobalConfig();
  document.getElementById('announce-status').textContent = ok ? '✓ Publicado para todos os jogadores!' : '';
  if (ok) setTimeout(()=> document.getElementById('announce-status').textContent='', 3000);
});

document.getElementById('btn-save-economy').addEventListener('click', async () => {
  globalConfig.coinMultiplier = parseFloat(document.getElementById('eco-coin-mult').value) || 1;
  globalConfig.xpMultiplier = parseFloat(document.getElementById('eco-xp-mult').value) || 1;
  globalConfig.shopBasePrice = parseInt(document.getElementById('eco-shop-base').value) || 800;
  const ok = await saveGlobalConfig();
  document.getElementById('economy-status').textContent = ok ? '✓ Economia atualizada globalmente!' : '';
  if (ok) setTimeout(()=> document.getElementById('economy-status').textContent='', 3000);
});

document.getElementById('btn-save-theme').addEventListener('click', async () => {
  globalConfig.theme = {
    gameName: document.getElementById('theme-gamename').value.trim() || 'NEONSTRIKE',
    primary: document.getElementById('theme-primary').value,
    secondary: document.getElementById('theme-secondary').value,
    bg: document.getElementById('theme-bg').value,
  };
  const ok = await saveGlobalConfig();
  document.getElementById('theme-status').textContent = ok ? '✓ Tema salvo e aplicado!' : '';
  if (ok) setTimeout(()=> document.getElementById('theme-status').textContent='', 3000);
});

document.getElementById('btn-reset-theme').addEventListener('click', async () => {
  globalConfig.theme = defaultGlobalConfig().theme;
  loadAdminConfigForms();
  await saveGlobalConfig();
  toast('Tema restaurado ao padrão.');
});

// --- Estatísticas ---
async function refreshAdminStats() {
  let players = allPlayersCache;
  if (supabase) {
    const { data } = await supabase.from('players').select('data');
    if (data) players = data;
  }
  document.getElementById('gstat-players').textContent = players.length;
  document.getElementById('gstat-kills').textContent = players.reduce((s,p)=>s+(p.data.kills||0),0);
  document.getElementById('gstat-coins').textContent = players.reduce((s,p)=>s+(p.data.coins||0),0);
  document.getElementById('gstat-toplevel').textContent = players.reduce((m,p)=>Math.max(m,p.data.level||1),0);
}
document.getElementById('btn-refresh-stats').addEventListener('click', refreshAdminStats);

// ===========================================================
// INIT
// ===========================================================
updateConnStatus();
loadGlobalConfig();
