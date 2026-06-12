/* ============================================
   NEONSTRIKE — Motor do jogo (Three.js)
   Arena 3D em primeira pessoa, ondas infinitas
   ============================================ */

const GAME = (() => {
  let scene, camera, renderer, clock;
  let playerRig, playerLight;
  let raycaster;

  const ARENA_SIZE = 60;

  // estado de runtime
  let state = null;
  let keys = {};
  let mouseLocked = false;
  let yaw = 0, pitch = 0;

  let enemies = [];
  let projectiles = [];
  let particles = [];
  let pickups = [];

  // input de toque (mobile)
  let touchMove = { x: 0, y: 0 }; // -1..1
  let touchLookId = null;
  let touchLookLast = { x: 0, y: 0 };

  let onGameOver = null;
  let onLevelUp = null;
  let onWaveChange = null;
  let onStatsChange = null;

  // -----------------------------------------------------------
  // INICIALIZAÇÃO
  // -----------------------------------------------------------
  function init(canvas) {
    scene = new THREE.Scene();
    scene.fog = new THREE.Fog(0x0b0a14, 18, 55);
    scene.background = new THREE.Color(0x0b0a14);

    camera = new THREE.PerspectiveCamera(75, window.innerWidth/window.innerHeight, 0.1, 1000);

    renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

    clock = new THREE.Clock();
    raycaster = new THREE.Raycaster();

    buildArena();
    setupLights();

    playerRig = new THREE.Object3D();
    playerRig.position.set(0, 1.7, 0);
    playerRig.add(camera);
    scene.add(playerRig);

    window.addEventListener('resize', onResize);
    setupInput(canvas);
  }

  function setupLights() {
    const ambient = new THREE.AmbientLight(0x4a3a7a, 0.6);
    scene.add(ambient);

    playerLight = new THREE.PointLight(0x00f0ff, 1.2, 18);
    playerLight.position.set(0, 2, 0);
    scene.add(playerLight);

    // Luzes neon decorativas nos cantos
    const corners = [
      [ARENA_SIZE/2-2, 4, ARENA_SIZE/2-2, 0xb14aff],
      [-ARENA_SIZE/2+2, 4, ARENA_SIZE/2-2, 0x00f0ff],
      [ARENA_SIZE/2-2, 4, -ARENA_SIZE/2+2, 0x00f0ff],
      [-ARENA_SIZE/2+2, 4, -ARENA_SIZE/2+2, 0xb14aff],
    ];
    corners.forEach(([x,y,z,c]) => {
      const l = new THREE.PointLight(c, 1.6, 26);
      l.position.set(x,y,z);
      scene.add(l);
    });
  }

  function buildArena() {
    // Piso com grade neon
    const floorGeo = new THREE.PlaneGeometry(ARENA_SIZE, ARENA_SIZE, 30, 30);
    const floorMat = new THREE.MeshStandardMaterial({
      color: 0x14122a, roughness: 0.85, metalness: 0.2,
      wireframe: false,
    });
    const floor = new THREE.Mesh(floorGeo, floorMat);
    floor.rotation.x = -Math.PI/2;
    scene.add(floor);

    // Linhas de grade neon
    const grid = new THREE.GridHelper(ARENA_SIZE, 30, 0xb14aff, 0x2d2750);
    grid.position.y = 0.01;
    scene.add(grid);

    // Paredes
    const wallMat = new THREE.MeshStandardMaterial({ color: 0x1a1733, roughness: 0.6, metalness: 0.4, emissive: 0x2d1f5a, emissiveIntensity: 0.15 });
    const wH = 6, wT = 1;
    const wallGeoX = new THREE.BoxGeometry(ARENA_SIZE+2, wH, wT);
    const wallGeoZ = new THREE.BoxGeometry(wT, wH, ARENA_SIZE+2);

    const w1 = new THREE.Mesh(wallGeoX, wallMat); w1.position.set(0, wH/2, -ARENA_SIZE/2); scene.add(w1);
    const w2 = new THREE.Mesh(wallGeoX, wallMat); w2.position.set(0, wH/2, ARENA_SIZE/2); scene.add(w2);
    const w3 = new THREE.Mesh(wallGeoZ, wallMat); w3.position.set(-ARENA_SIZE/2, wH/2, 0); scene.add(w3);
    const w4 = new THREE.Mesh(wallGeoZ, wallMat); w4.position.set(ARENA_SIZE/2, wH/2, 0); scene.add(w4);

    // Faixas neon no topo das paredes
    const stripeMat = new THREE.MeshBasicMaterial({ color: 0x00f0ff });
    [w1,w2,w3,w4].forEach(w => {
      const geo = w === w1 || w === w2 ? new THREE.BoxGeometry(ARENA_SIZE+2, 0.15, 0.15) : new THREE.BoxGeometry(0.15, 0.15, ARENA_SIZE+2);
      const stripe = new THREE.Mesh(geo, stripeMat);
      stripe.position.copy(w.position);
      stripe.position.y = wH - 0.2;
      scene.add(stripe);
    });

    // Pilares de cobertura no chão (obstáculos / cover)
    const pillarMat = new THREE.MeshStandardMaterial({ color: 0x232045, roughness: 0.5, metalness: 0.5, emissive: 0xb14aff, emissiveIntensity: 0.1 });
    const pPos = [[10,10],[-10,10],[10,-10],[-10,-10],[0,16],[0,-16],[16,0],[-16,0]];
    pPos.forEach(([x,z]) => {
      const h = 2 + Math.random()*1.5;
      const geo = new THREE.BoxGeometry(2.2, h, 2.2);
      const m = new THREE.Mesh(geo, pillarMat);
      m.position.set(x, h/2, z);
      m.userData.isObstacle = true;
      m.userData.halfSize = 1.1;
      scene.add(m);
    });
  }

  function onResize() {
    if (!camera || !renderer) return;
    camera.aspect = window.innerWidth/window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
    if (window.innerHeight > window.innerWidth && state && state.running && !state.paused && !state.gameOver) {
      pauseGame();
    }
  }

  // -----------------------------------------------------------
  // INPUT
  // -----------------------------------------------------------
  function setupInput(canvas) {
    document.addEventListener('keydown', e => keys[e.code] = true);
    document.addEventListener('keyup', e => keys[e.code] = false);

    canvas.addEventListener('click', () => {
      if (isTouchDevice()) return;
      if (!mouseLocked && state && state.running) canvas.requestPointerLock();
    });

    document.addEventListener('pointerlockchange', () => {
      mouseLocked = document.pointerLockElement === canvas;
      if (!mouseLocked && state && state.running && !state.paused && !isTouchDevice()) {
        pauseGame();
      }
    });

    document.addEventListener('mousemove', e => {
      if (!mouseLocked || !state || !state.running || state.paused) return;
      yaw -= e.movementX * 0.0022;
      pitch -= e.movementY * 0.0022;
      pitch = Math.max(-1.2, Math.min(1.2, pitch));
      playerRig.rotation.y = yaw;
      camera.rotation.x = pitch;
    });

    canvas.addEventListener('mousedown', e => {
      if (e.button === 0 && mouseLocked && state && state.running && !state.paused) {
        state.shooting = true;
      }
    });
    document.addEventListener('mouseup', () => state && (state.shooting = false));

    document.addEventListener('keydown', e => {
      if (!state) return;
      if (e.code === 'Space') { e.preventDefault(); tryUseSkill(); }
      if (e.code === 'Escape') {
        if (state.running && !state.gameOver) {
          if (state.paused) resumeGame(); else pauseGame();
        }
      }
    });

    setupTouchControls();
  }

  function isTouchDevice() {
    return window.matchMedia('(pointer: coarse)').matches;
  }

  function setupTouchControls() {
    // Joystick virtual (movimento)
    const joy = document.getElementById('touch-joystick');
    const knob = document.getElementById('touch-joystick-knob');
    if (!joy || !knob) return;

    let joyId = null;
    const joyRadius = 50;

    function joyMove(e) {
      const rect = joy.getBoundingClientRect();
      const cx = rect.left + rect.width/2;
      const cy = rect.top + rect.height/2;
      let dx = e.clientX - cx;
      let dy = e.clientY - cy;
      const dist = Math.min(joyRadius, Math.hypot(dx,dy));
      const ang = Math.atan2(dy,dx);
      dx = Math.cos(ang)*dist; dy = Math.sin(ang)*dist;
      knob.style.transform = `translate(${dx}px, ${dy}px)`;
      touchMove.x = dx/joyRadius;
      touchMove.y = dy/joyRadius;
    }
    function joyReset() {
      knob.style.transform = 'translate(0,0)';
      touchMove.x = 0; touchMove.y = 0;
      joyId = null;
    }
    joy.addEventListener('pointerdown', e => { joyId = e.pointerId; joyMove(e); });
    joy.addEventListener('pointermove', e => { if (e.pointerId === joyId) joyMove(e); });
    joy.addEventListener('pointerup', e => { if (e.pointerId === joyId) joyReset(); });
    joy.addEventListener('pointercancel', e => { if (e.pointerId === joyId) joyReset(); });

    // Área de mira (arraste do lado direito)
    const lookZone = document.getElementById('touch-look-zone');
    lookZone.addEventListener('pointerdown', e => {
      touchLookId = e.pointerId;
      touchLookLast.x = e.clientX;
      touchLookLast.y = e.clientY;
    });
    lookZone.addEventListener('pointermove', e => {
      if (e.pointerId !== touchLookId || !state || !state.running || state.paused) return;
      const dx = e.clientX - touchLookLast.x;
      const dy = e.clientY - touchLookLast.y;
      touchLookLast.x = e.clientX;
      touchLookLast.y = e.clientY;
      yaw -= dx * 0.0035;
      pitch -= dy * 0.0035;
      pitch = Math.max(-1.2, Math.min(1.2, pitch));
      playerRig.rotation.y = yaw;
      camera.rotation.x = pitch;
    });
    lookZone.addEventListener('pointerup', e => { if (e.pointerId === touchLookId) touchLookId = null; });
    lookZone.addEventListener('pointercancel', e => { if (e.pointerId === touchLookId) touchLookId = null; });

    // Botão de tiro
    const fireBtn = document.getElementById('touch-fire');
    fireBtn.addEventListener('pointerdown', e => {
      e.preventDefault();
      fireBtn.classList.add('active');
      if (state) state.shooting = true;
    });
    ['pointerup','pointercancel','pointerleave'].forEach(ev => fireBtn.addEventListener(ev, () => {
      fireBtn.classList.remove('active');
      if (state) state.shooting = false;
    }));

    // Botão de habilidade
    const skillBtn = document.getElementById('touch-skill');
    skillBtn.addEventListener('pointerdown', e => {
      e.preventDefault();
      skillBtn.classList.add('active');
      tryUseSkill();
      setTimeout(() => skillBtn.classList.remove('active'), 150);
    });
  }

  // -----------------------------------------------------------
  // START / RESET
  // -----------------------------------------------------------
  function startGame(playerData, callbacks) {
    onGameOver = callbacks.onGameOver;
    onLevelUp = callbacks.onLevelUp;
    onWaveChange = callbacks.onWaveChange;
    onStatsChange = callbacks.onStatsChange;

    // limpar entidades anteriores
    enemies.forEach(e => scene.remove(e.mesh));
    projectiles.forEach(p => scene.remove(p.mesh));
    particles.forEach(p => scene.remove(p.mesh));
    pickups.forEach(p => scene.remove(p.mesh));
    enemies = []; projectiles = []; particles = []; pickups = [];

    playerRig.position.set(0, 1.7, 0);
    yaw = 0; pitch = 0;
    playerRig.rotation.y = 0;
    camera.rotation.x = 0;

    const weapon = WEAPONS.find(w => w.id === playerData.equippedWeapon) || WEAPONS[0];
    const skill = SKILLS.find(s => s.id === playerData.equippedSkill) || SKILLS[0];

    state = {
      running: true,
      paused: false,
      gameOver: false,
      hp: 100,
      maxHp: 100,
      energy: 100,
      maxEnergy: 100,
      score: 0,
      coins: 0,
      kills: 0,
      xp: 0,
      level: playerData.level,
      wave: 1,
      enemiesRemainingInWave: 0,
      enemiesToSpawn: 0,
      spawnTimer: 0,
      waveBreakTimer: 3,
      shooting: false,
      lastShot: 0,
      weapon,
      skill,
      skillCooldownLeft: 0,
      skillActiveTimer: 0,
      shieldActive: false,
      overdriveActive: false,
      moveSpeed: 6.5,
    };

    spawnWave();
  }

  function pauseGame() {
    if (!state) return;
    state.paused = true;
    document.exitPointerLock();
  }
  function resumeGame() {
    if (!state) return;
    state.paused = false;
  }
  function quitGame() {
    state = null;
    enemies.forEach(e => scene.remove(e.mesh));
    projectiles.forEach(p => scene.remove(p.mesh));
    particles.forEach(p => scene.remove(p.mesh));
    pickups.forEach(p => scene.remove(p.mesh));
    enemies = []; projectiles = []; particles = []; pickups = [];
  }

  // -----------------------------------------------------------
  // ONDAS / SPAWN
  // -----------------------------------------------------------
  function spawnWave() {
    const w = state.wave;
    let count = 3 + Math.floor(w * 1.6);
    if (w % 5 === 0) count = Math.max(1, Math.floor(count * 0.4)); // ondas de boss têm menos inimigos comuns
    state.enemiesToSpawn = count;
    state.enemiesRemainingInWave = count + (w % 5 === 0 ? 1 : 0);
    state.spawnTimer = 0;
    SFX.waveStart();
    if (onWaveChange) onWaveChange(w);

    if (w % 5 === 0) spawnEnemy('boss');
  }

  function pickEnemyType(wave) {
    const available = ENEMY_TYPES.filter(e => !e.boss && e.minWave <= wave);
    return available[Math.floor(Math.random() * available.length)];
  }

  function spawnEnemy(forceType) {
    const type = forceType ? ENEMY_TYPES.find(e=>e.id===forceType) : pickEnemyType(state.wave);
    const waveScale = 1 + (state.wave - 1) * 0.18;

    const geo = type.boss
      ? new THREE.IcosahedronGeometry(type.size, 1)
      : new THREE.OctahedronGeometry(type.size, 0);
    const mat = new THREE.MeshStandardMaterial({
      color: type.color, emissive: type.color, emissiveIntensity: 0.5,
      roughness: 0.3, metalness: 0.6,
    });
    const mesh = new THREE.Mesh(geo, mat);

    // posição aleatória nas bordas
    const angle = Math.random() * Math.PI * 2;
    const dist = ARENA_SIZE/2 - 3;
    mesh.position.set(Math.cos(angle)*dist, type.size, Math.sin(angle)*dist);
    scene.add(mesh);

    const light = new THREE.PointLight(type.color, 0.8, 6);
    mesh.add(light);

    enemies.push({
      mesh, type,
      hp: type.hp * waveScale,
      maxHp: type.hp * waveScale,
      damage: type.damage,
      speed: type.speed,
      shootTimer: Math.random()*2,
      hitFlash: 0,
    });
  }

  // -----------------------------------------------------------
  // TIRO / DANO
  // -----------------------------------------------------------
  function fireWeapon() {
    const w = state.weapon;
    const now = performance.now();
    const fireRate = state.overdriveActive ? w.fireRate/2 : w.fireRate;
    if (now - state.lastShot < fireRate) return;
    state.lastShot = now;

    SFX.shoot(w.id);

    const pellets = w.pellets || 1;
    for (let i=0;i<pellets;i++) {
      const dir = new THREE.Vector3(0,0,-1);
      dir.applyQuaternion(camera.getWorldQuaternion(new THREE.Quaternion()));
      // spread
      dir.x += (Math.random()-0.5) * w.spread;
      dir.y += (Math.random()-0.5) * w.spread;
      dir.z += (Math.random()-0.5) * w.spread*0.3;
      dir.normalize();

      const geo = new THREE.SphereGeometry(0.12, 8, 8);
      const mat = new THREE.MeshBasicMaterial({ color: w.color });
      const mesh = new THREE.Mesh(geo, mat);
      const startPos = new THREE.Vector3();
      camera.getWorldPosition(startPos);
      mesh.position.copy(startPos);
      scene.add(mesh);

      const light = new THREE.PointLight(w.color, 1, 4);
      mesh.add(light);

      projectiles.push({
        mesh, dir, speed: w.projSpeed, damage: w.damage,
        splash: w.splash || 0, life: 2.2, color: w.color,
      });
    }

    // muzzle flash (luz rápida no jogador)
    playerLight.intensity = 2.2;
  }

  function damagePlayer(amount) {
    if (state.shieldActive) return;
    state.hp -= amount;
    SFX.playerHit();
    if (window.__damageFlash) window.__damageFlash();
    if (state.hp <= 0) {
      state.hp = 0;
      endGame(false);
    }
  }

  function addXP(amount) {
    state.xp += amount;
    let needed = xpForLevel(state.level);
    while (state.xp >= needed) {
      state.xp -= needed;
      state.level++;
      if (onLevelUp) onLevelUp(state.level);
      SFX.levelUp();
      needed = xpForLevel(state.level);
    }
  }

  function killEnemy(enemy, idx) {
    SFX.enemyDeath();
    spawnParticles(enemy.mesh.position, enemy.type.color, enemy.type.boss ? 40 : 12);
    state.score += enemy.type.score;
    state.coins += enemy.type.coin;
    state.kills++;
    addXP(enemy.type.score);
    scene.remove(enemy.mesh);
    enemies.splice(idx, 1);
    state.enemiesRemainingInWave--;

    if (state.enemiesRemainingInWave <= 0 && state.enemiesToSpawn <= 0) {
      state.wave++;
      state.waveBreakTimer = 3;
      state.hp = Math.min(state.maxHp, state.hp + 15); // bônus de cura entre ondas
      setTimeout(() => { if (state) spawnWave(); }, 3000);
    }
  }

  // -----------------------------------------------------------
  // HABILIDADES
  // -----------------------------------------------------------
  function tryUseSkill() {
    if (!state || !state.running || state.paused || state.gameOver) return;
    if (state.skillCooldownLeft > 0) return;

    const s = state.skill;
    SFX.skillActivate();
    state.skillCooldownLeft = s.cooldown;

    switch (s.id) {
      case 'dash': {
        const dir = new THREE.Vector3(0,0,-1);
        dir.applyAxisAngle(new THREE.Vector3(0,1,0), yaw);
        playerRig.position.addScaledVector(dir, 6);
        clampPlayerToArena();
        SFX.dash();
        break;
      }
      case 'shield':
        state.shieldActive = true;
        state.skillActiveTimer = 3000;
        break;
      case 'overdrive':
        state.overdriveActive = true;
        state.skillActiveTimer = 5000;
        break;
      case 'nova': {
        spawnParticles(playerRig.position, 0x00f0ff, 30);
        enemies.forEach(en => {
          const d = en.mesh.position.distanceTo(playerRig.position);
          if (d < 10) {
            en.hp -= 40;
            en.hitFlash = 0.3;
          }
        });
        SFX.explosion();
        break;
      }
      case 'heal':
        state.hp = Math.min(state.maxHp, state.hp + 50);
        break;
    }
  }

  // -----------------------------------------------------------
  // PARTÍCULAS
  // -----------------------------------------------------------
  function spawnParticles(pos, color, count) {
    for (let i=0;i<count;i++) {
      const geo = new THREE.BoxGeometry(0.15,0.15,0.15);
      const mat = new THREE.MeshBasicMaterial({ color });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.copy(pos);
      scene.add(mesh);
      const vel = new THREE.Vector3((Math.random()-0.5)*8, Math.random()*8, (Math.random()-0.5)*8);
      particles.push({ mesh, vel, life: 0.6 + Math.random()*0.4 });
    }
  }

  // -----------------------------------------------------------
  // COLISÃO COM ARENA
  // -----------------------------------------------------------
  function clampPlayerToArena() {
    const limit = ARENA_SIZE/2 - 1.5;
    playerRig.position.x = Math.max(-limit, Math.min(limit, playerRig.position.x));
    playerRig.position.z = Math.max(-limit, Math.min(limit, playerRig.position.z));
  }

  // -----------------------------------------------------------
  // GAME OVER
  // -----------------------------------------------------------
  function endGame(won) {
    if (!state || state.gameOver) return;
    state.gameOver = true;
    state.running = false;
    document.exitPointerLock();
    SFX.gameOver();
    if (onGameOver) onGameOver({
      wave: state.wave, kills: state.kills, score: state.score,
      coins: state.coins, level: state.level, won,
    });
  }

  // -----------------------------------------------------------
  // LOOP PRINCIPAL
  // -----------------------------------------------------------
  function update() {
    const dt = Math.min(clock.getDelta(), 0.1);

    if (state && state.running && !state.paused && !state.gameOver) {
      updatePlayer(dt);
      updateEnemies(dt);
      updateProjectiles(dt);
      updateParticles(dt);
      updateSkills(dt);

      if (state.shooting) fireWeapon();

      playerLight.intensity = Math.max(1.2, playerLight.intensity - dt*4);
      playerLight.position.copy(playerRig.position);
      playerLight.position.y += 0.5;

      if (onStatsChange) onStatsChange(getStatsSnapshot());
    }

    renderer.render(scene, camera);
    requestAnimationFrame(update);
  }

  function updatePlayer(dt) {
    const speed = state.moveSpeed * dt;
    const forward = new THREE.Vector3(0,0,-1).applyAxisAngle(new THREE.Vector3(0,1,0), yaw);
    const right = new THREE.Vector3(1,0,0).applyAxisAngle(new THREE.Vector3(0,1,0), yaw);

    const move = new THREE.Vector3();
    if (keys['KeyW']) move.add(forward);
    if (keys['KeyS']) move.sub(forward);
    if (keys['KeyD']) move.add(right);
    if (keys['KeyA']) move.sub(right);

    // joystick de toque
    if (Math.abs(touchMove.x) > 0.05 || Math.abs(touchMove.y) > 0.05) {
      move.addScaledVector(forward, -touchMove.y);
      move.addScaledVector(right, touchMove.x);
    }

    if (move.lengthSq() > 0) {
      move.normalize().multiplyScalar(speed);
      playerRig.position.add(move);
      clampPlayerToArena();
    }

    // regenerar energia lentamente
    state.energy = Math.min(state.maxEnergy, state.energy + dt*5);
  }

  function updateSkills(dt) {
    if (state.skillCooldownLeft > 0) {
      state.skillCooldownLeft -= dt*1000;
      if (state.skillCooldownLeft <= 0) {
        state.skillCooldownLeft = 0;
        SFX.skillReady();
      }
    }
    if (state.skillActiveTimer > 0) {
      state.skillActiveTimer -= dt*1000;
      if (state.skillActiveTimer <= 0) {
        state.skillActiveTimer = 0;
        state.shieldActive = false;
        state.overdriveActive = false;
      }
    }
  }

  function updateEnemies(dt) {
    // spawn gradual
    if (state.enemiesToSpawn > 0) {
      state.spawnTimer -= dt;
      if (state.spawnTimer <= 0) {
        spawnEnemy();
        state.enemiesToSpawn--;
        state.spawnTimer = 0.8;
      }
    }

    for (let i = enemies.length-1; i >= 0; i--) {
      const en = enemies[i];
      const dir = new THREE.Vector3().subVectors(playerRig.position, en.mesh.position);
      dir.y = 0;
      const dist = dir.length();
      dir.normalize();

      const stopDist = en.type.ranged ? 9 : 1.6;
      if (dist > stopDist) {
        en.mesh.position.addScaledVector(dir, en.speed * dt);
      }

      // rotação visual
      en.mesh.rotation.y += dt * 1.5;
      en.mesh.rotation.x += dt * 0.7;

      // flash de dano
      if (en.hitFlash > 0) {
        en.hitFlash -= dt;
        en.mesh.material.emissiveIntensity = 1.5;
      } else {
        en.mesh.material.emissiveIntensity = 0.5;
      }

      // ataque
      if (dist <= stopDist + 0.4) {
        en.shootTimer -= dt;
        if (en.shootTimer <= 0) {
          en.shootTimer = en.type.ranged ? 1.6 : 0.9;
          damagePlayer(en.damage);
        }
      }

      if (en.hp <= 0) killEnemy(en, i);
    }
  }

  function updateProjectiles(dt) {
    for (let i = projectiles.length-1; i >= 0; i--) {
      const p = projectiles[i];
      p.mesh.position.addScaledVector(p.dir, p.speed*dt);
      p.life -= dt;

      let hit = false;
      for (let j = enemies.length-1; j >= 0; j--) {
        const en = enemies[j];
        const d = p.mesh.position.distanceTo(en.mesh.position);
        if (d < en.type.size + 0.3) {
          en.hp -= p.damage;
          en.hitFlash = 0.15;
          SFX.hitEnemy();
          if (window.__hitMarker) window.__hitMarker();
          if (p.splash > 0) {
            enemies.forEach(other => {
              if (other !== en) {
                const d2 = p.mesh.position.distanceTo(other.mesh.position);
                if (d2 < p.splash) other.hp -= p.damage*0.5;
              }
            });
            spawnParticles(p.mesh.position, p.color, 10);
          }
          hit = true;
          break;
        }
      }

      if (hit || p.life <= 0 || Math.abs(p.mesh.position.x) > ARENA_SIZE || Math.abs(p.mesh.position.z) > ARENA_SIZE) {
        scene.remove(p.mesh);
        projectiles.splice(i, 1);
      }
    }
  }

  function updateParticles(dt) {
    for (let i = particles.length-1; i >= 0; i--) {
      const pt = particles[i];
      pt.mesh.position.addScaledVector(pt.vel, dt);
      pt.vel.y -= dt*12;
      pt.life -= dt;
      pt.mesh.scale.multiplyScalar(1 - dt*1.5);
      if (pt.life <= 0) {
        scene.remove(pt.mesh);
        particles.splice(i,1);
      }
    }
  }

  function getStatsSnapshot() {
    return {
      hp: state.hp, maxHp: state.maxHp,
      energy: state.energy, maxEnergy: state.maxEnergy,
      score: state.score, coins: state.coins,
      wave: state.wave, level: state.level, xp: state.xp,
      weapon: state.weapon, skill: state.skill,
      skillCooldownLeft: state.skillCooldownLeft,
      skillTotalCooldown: state.skill.cooldown,
    };
  }

  return {
    init, startGame, update, pauseGame, resumeGame, quitGame,
    get state() { return state; },
  };
})();
