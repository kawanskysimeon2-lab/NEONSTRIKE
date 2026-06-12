/* ============================================
   NEONSTRIKE — Áudio sintetizado (Web Audio API)
   Não depende de arquivos de som externos.
   ============================================ */

const SFX = (() => {
  let ctx = null;
  function getCtx() {
    if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)();
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  }

  function osc(type, freq, dur, vol, slideTo, attack=0.005) {
    const c = getCtx();
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, c.currentTime);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, c.currentTime + dur);
    g.gain.setValueAtTime(0, c.currentTime);
    g.gain.linearRampToValueAtTime(vol, c.currentTime + attack);
    g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + dur);
    o.connect(g); g.connect(c.destination);
    o.start(); o.stop(c.currentTime + dur + 0.05);
  }

  function noise(dur, vol, filterFreq) {
    const c = getCtx();
    const bufferSize = c.sampleRate * dur;
    const buffer = c.createBuffer(1, bufferSize, c.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;
    const src = c.createBufferSource();
    src.buffer = buffer;
    const g = c.createGain();
    g.gain.setValueAtTime(vol, c.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + dur);
    const f = c.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = filterFreq || 2000;
    src.connect(f); f.connect(g); g.connect(c.destination);
    src.start(); src.stop(c.currentTime + dur);
  }

  return {
    init() { getCtx(); },

    shoot(weaponId) {
      switch (weaponId) {
        case 'smg':     osc('square', 700, 0.06, 0.07, 300); break;
        case 'shotgun': noise(0.18, 0.25, 1200); osc('square', 150, 0.12, 0.1, 60); break;
        case 'railgun': osc('sawtooth', 1800, 0.25, 0.18, 80); noise(0.2, 0.1, 4000); break;
        case 'plasma':  osc('sine', 400, 0.18, 0.15, 120); break;
        default:        osc('square', 900, 0.07, 0.08, 350); break;
      }
    },
    hitEnemy() { osc('triangle', 1200, 0.08, 0.12, 500); },
    explosion() { noise(0.4, 0.3, 700); osc('sawtooth', 120, 0.4, 0.2, 30); },
    enemyDeath() { osc('sawtooth', 500, 0.18, 0.12, 60); noise(0.15, 0.12, 900); },
    playerHit() { noise(0.18, 0.2, 500); osc('square', 180, 0.18, 0.12, 80); },
    levelUp() {
      [0,1,2].forEach((i)=> setTimeout(()=> osc('triangle', 440 * Math.pow(1.26, i), 0.25, 0.12, 440*Math.pow(1.26,i)*1.5), i*90));
    },
    skillActivate() { osc('sine', 300, 0.3, 0.15, 900); },
    skillReady() { osc('sine', 600, 0.1, 0.08, 800); },
    waveStart() {
      osc('square', 180, 0.5, 0.1, 90);
      setTimeout(()=>osc('square', 240, 0.4, 0.08, 120), 150);
    },
    coinPickup() { osc('triangle', 900, 0.08, 0.08, 1400); },
    gameOver() {
      [400, 320, 240, 160].forEach((f,i)=> setTimeout(()=> osc('sawtooth', f, 0.35, 0.12, f*0.7), i*150));
    },
    click() { osc('sine', 600, 0.05, 0.06, 800); },
    dash() { noise(0.15, 0.1, 3000); osc('sine', 1000, 0.15, 0.08, 1800); },
  };
})();

// Inicializa o contexto de áudio no primeiro clique (exigência dos navegadores)
document.addEventListener('click', () => SFX.init(), { once: true });
