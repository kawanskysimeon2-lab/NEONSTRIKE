/* ============================================
   NEONSTRIKE — Configuração e dados do jogo
   ============================================ */

// ===========================================================
// CONFIGURAÇÃO DO SUPABASE
// ===========================================================
// 1. Crie uma conta gratuita em https://supabase.com
// 2. Crie um novo projeto
// 3. Vá em "Project Settings" > "API"
// 4. Copie a "Project URL" e a "anon public key" e cole abaixo
// 5. Rode o SQL do arquivo schema.sql no "SQL Editor" do Supabase
// ===========================================================
const SUPABASE_URL = 'COLE_SUA_URL_AQUI';       // ex: https://xxxxx.supabase.co
const SUPABASE_ANON_KEY = 'COLE_SUA_CHAVE_AQUI'; // chave "anon public"

let db = null;
try {
  if (SUPABASE_URL !== 'COLE_SUA_URL_AQUI' && SUPABASE_ANON_KEY !== 'COLE_SUA_CHAVE_AQUI') {
    db = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  }
} catch (e) { console.warn('Supabase não configurado ainda.', e); }

// Nome do usuário que será o OWNER (painel admin liberado).
// Troque pelo seu nome de usuário exato após criar a conta.
const OWNER_USERNAME = 'kawansky';

// ===========================================================
// ARMAS
// ===========================================================
const WEAPONS = [
  {
    id: 'pistol', name: 'Pistola Pulsar', icon: '🔫',
    desc: 'Confiável, sem limite de munição.',
    damage: 12, fireRate: 320, spread: 0.012, projSpeed: 90,
    color: 0x00f0ff, unlockLevel: 1, price: 0,
  },
  {
    id: 'smg', name: 'SMG Lâmina', icon: '🔪',
    desc: 'Tiro rápido, dano menor.',
    damage: 7, fireRate: 95, spread: 0.05, projSpeed: 100,
    color: 0xb14aff, unlockLevel: 3, price: 800,
  },
  {
    id: 'shotgun', name: 'Fragmentadora', icon: '💥',
    desc: '6 projéteis por tiro, curto alcance.',
    damage: 9, fireRate: 750, spread: 0.18, projSpeed: 80,
    pellets: 6, color: 0xffb020, unlockLevel: 5, price: 1500,
  },
  {
    id: 'railgun', name: 'Railgun Singular', icon: '⚡',
    desc: 'Dano altíssimo, recarrega lento.',
    damage: 90, fireRate: 1100, spread: 0.002, projSpeed: 220,
    color: 0xff3b5c, unlockLevel: 8, price: 3000,
  },
  {
    id: 'plasma', name: 'Canhão de Plasma', icon: '🌀',
    desc: 'Bola de plasma que explode em área.',
    damage: 35, fireRate: 600, spread: 0.03, projSpeed: 60,
    splash: 4, color: 0x2bffa8, unlockLevel: 12, price: 5000,
  },
];

// ===========================================================
// HABILIDADES
// ===========================================================
const SKILLS = [
  {
    id: 'dash', name: 'Impulso Neon', icon: '💨',
    desc: 'Avanço rápido na direção do movimento.',
    cooldown: 4000, unlockLevel: 1, price: 0,
  },
  {
    id: 'shield', name: 'Escudo de Pulso', icon: '🛡️',
    desc: 'Bloqueia todo dano por 3 segundos.',
    cooldown: 14000, unlockLevel: 4, price: 1200,
  },
  {
    id: 'overdrive', name: 'Overdrive', icon: '🔥',
    desc: 'Dobra sua taxa de tiro por 5 segundos.',
    cooldown: 16000, unlockLevel: 6, price: 1800,
  },
  {
    id: 'nova', name: 'Nova EMP', icon: '💫',
    desc: 'Explosão que dana e atordoa inimigos próximos.',
    cooldown: 18000, unlockLevel: 9, price: 2500,
  },
  {
    id: 'heal', name: 'Nanorregeneração', icon: '💚',
    desc: 'Recupera 50 de vida instantaneamente.',
    cooldown: 20000, unlockLevel: 7, price: 2000,
  },
];

// ===========================================================
// INIMIGOS — tipos que aparecem por onda
// ===========================================================
const ENEMY_TYPES = [
  { id: 'drone',   name: 'Drone',     hp: 30,  speed: 4.2, damage: 6,  color: 0xff3b5c, size: 1.0, score: 10, coin: 2, minWave: 1 },
  { id: 'runner',  name: 'Corredor',  hp: 18,  speed: 7.5, damage: 4,  color: 0xffb020, size: 0.8, score: 15, coin: 3, minWave: 2 },
  { id: 'tank',    name: 'Blindado',  hp: 120, speed: 2.0, damage: 14, color: 0xb14aff, size: 1.6, score: 35, coin: 8, minWave: 3 },
  { id: 'sniper',  name: 'Sentinela', hp: 25,  speed: 3.0, damage: 18, color: 0x2bffa8, size: 1.0, score: 25, coin: 6, minWave: 4, ranged: true },
  { id: 'swarm',   name: 'Enxame',    hp: 8,   speed: 8.5, damage: 3,  color: 0x00f0ff, size: 0.5, score: 8,  coin: 1, minWave: 2, swarm: true },
  { id: 'boss',    name: 'COLOSSO',  hp: 600, speed: 1.6, damage: 25, color: 0xff3b5c, size: 3.2, score: 200, coin: 100, minWave: 5, boss: true },
];

// ===========================================================
// PROGRESSÃO
// ===========================================================
function xpForLevel(level) {
  return Math.floor(100 * Math.pow(level, 1.5));
}

// ===========================================================
// ESTADO PADRÃO DE UM JOGADOR NOVO
// ===========================================================
function defaultPlayerData() {
  return {
    level: 1,
    xp: 0,
    coins: 0,
    kills: 0,
    wins: 0,
    bestWave: 0,
    unlockedWeapons: ['pistol'],
    equippedWeapon: 'pistol',
    unlockedSkills: ['dash'],
    equippedSkill: 'dash',
    banned: false,
  };
}

// ===========================================================
// CONFIG GLOBAL PADRÃO (controlada pelo painel admin)
// ===========================================================
function defaultGlobalConfig() {
  return {
    announcement: '',
    coinMultiplier: 1.0,
    xpMultiplier: 1.0,
    shopBasePrice: 800,
    theme: {
      gameName: 'NEONSTRIKE',
      primary: '#b14aff',
      secondary: '#00f0ff',
      bg: '#0b0a14',
    },
  };
}
