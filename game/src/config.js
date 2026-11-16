// LUMEN SIEGE — configuration: arena, palette, enemies, waves and upgrades.
// Every number here is a tuning decision; the game reads them, never hardcodes them.

export const ARENA = { width: 1280, height: 720 };

export const PALETTE = {
  background: '#070a18',
  grid: 'rgba(90, 120, 255, 0.07)',
  core: '#7fe7ff',
  coreGlow: '#35b6ff',
  player: '#ffe066',
  playerGlow: '#ffb347',
  bullet: '#fff3a3',
  enemyBullet: '#ff5d8f',
  drifter: '#ff6b6b',
  wisp: '#c77dff',
  spitter: '#5eead4',
  sniper: '#38bdf8',
  orbiter: '#4ade80',
  splitter: '#f472b6',
  mini: '#fb923c',
  brute: '#fb7185',
  boss: '#e879f9',
  particle: '#9be7ff',
  text: '#e8f1ff',
  dim: '#8ea0c9',
  danger: '#ff5470',
  gold: '#ffd166',
};

export const PLAYER = {
  radius: 14,
  speed: 265,
  maxHp: 100,
  fireRate: 6, // shots per second
  bulletSpeed: 640,
  bulletDamage: 12,
  bulletRadius: 5,
  dashSpeed: 720,
  dashTime: 0.18,
  dashCooldown: 2.4,
  dashCharges: 1,
  invulnTime: 0.35,
  coreHealRadius: 150,
  coreHealRate: 3, // hp per second near the core
  magnetRadius: 90,
};

// Enemy definitions: hp, speed, radius, contact damage, score, behaviour.
export const ENEMY_TYPES = {
  drifter: { hp: 22, speed: 74, radius: 14, damage: 10, score: 50, kind: 'drifter' },
  wisp: { hp: 11, speed: 158, radius: 10, damage: 8, score: 80, kind: 'wisp' },
  spitter: { hp: 34, speed: 52, radius: 16, damage: 12, score: 120, kind: 'spitter' },
  sniper: { hp: 30, speed: 58, radius: 13, damage: 16, score: 180, kind: 'sniper' },
  orbiter: { hp: 26, speed: 98, radius: 12, damage: 10, score: 140, kind: 'orbiter' },
  splitter: { hp: 44, speed: 62, radius: 18, damage: 12, score: 150, kind: 'splitter' },
  mini: { hp: 9, speed: 132, radius: 8, damage: 6, score: 30, kind: 'mini' },
  brute: { hp: 130, speed: 40, radius: 26, damage: 20, score: 250, kind: 'brute' },
  boss: { hp: 950, speed: 46, radius: 48, damage: 25, score: 5000, kind: 'boss' },
};

// Wave composition: how many of each enemy a wave spawns (boss waves add a boss).
// Waves 1-10; wave 5 spawns a lesser herald, wave 10 the Void Herald. Victory follows wave 10.
export const WAVE_TABLE = [
  { drifter: 6 },
  { drifter: 8, wisp: 3 },
  { drifter: 9, wisp: 5, spitter: 2 },
  { drifter: 10, wisp: 6, spitter: 3, splitter: 2, brute: 1 },
  { drifter: 8, wisp: 6, spitter: 3, splitter: 3, brute: 1, boss: 1 },
  { drifter: 12, wisp: 8, spitter: 4, splitter: 3, brute: 2 },
  { drifter: 12, wisp: 10, spitter: 5, splitter: 4, brute: 2 },
  { drifter: 14, wisp: 12, spitter: 6, splitter: 5, brute: 3 },
  { drifter: 16, wisp: 14, spitter: 7, splitter: 6, brute: 3 },
  { drifter: 14, wisp: 12, spitter: 6, splitter: 5, brute: 2, boss: 1 },
];

export const FINAL_WAVE = 10;
// Late-wave modifier: on waves 8-10 the Void periodically surges — extra enemies
// pour in at the edges while the wave is still being fought.
export const SURGE = { firstWave: 8, interval: 15, maxPerWave: 3, count: 5 };
export const COMBO_WINDOW = 2.5; // seconds between kills to keep the combo alive
export const COMBO_STEP = 4; // kills per +1 multiplier, capped at x8
export const POWERUP_DROP_CHANCE = 0.12;

// Upgrade cards offered between waves. Each has an id, a name, a description and
// an apply(player) that mutates the player's stats. Drafted 3 at a time, no repeats.
export const UPGRADE_POOL = [
  {
    id: 'spread', name: 'Twin Ember', icon: '✦✦',
    desc: '+1 projectile per shot (max 4).',
    apply: (p) => { p.projectiles = Math.min(4, p.projectiles + 1); },
  },
  {
    id: 'rapid', name: 'Rapid Coil', icon: '≫',
    desc: '+25% fire rate.',
    apply: (p) => { p.fireRate *= 1.25; },
  },
  {
    id: 'heavy', name: 'Heavy Rounds', icon: '⬢',
    desc: '+40% bullet damage.',
    apply: (p) => { p.bulletDamage *= 1.4; },
  },
  {
    id: 'pierce', name: 'Piercing Light', icon: '→→',
    desc: 'Bullets pierce +1 enemy.',
    apply: (p) => { p.pierce += 1; },
  },
  {
    id: 'shield', name: 'Aegis Plating', icon: '⛨',
    desc: '+25 max HP and heal 25.',
    apply: (p) => { p.maxHp += 25; p.hp = Math.min(p.maxHp, p.hp + 25); },
  },
  {
    id: 'magnet', name: 'Lumen Magnet', icon: '◎',
    desc: '+70% pickup radius.',
    apply: (p) => { p.magnetRadius *= 1.7; },
  },
  {
    id: 'dash', name: 'Phase Dash', icon: '»»',
    desc: 'Dash recharges 35% faster, +1 charge (max 2).',
    apply: (p) => { p.dashCooldown *= 0.65; p.dashCharges = Math.min(2, p.dashCharges + 1); p.dashStock = p.dashCharges; },
  },
  {
    id: 'overdrive', name: 'Overdrive', icon: '⚡',
    desc: '+15% move speed, +15% fire rate.',
    apply: (p) => { p.speed *= 1.15; p.fireRate *= 1.15; },
  },
  {
    id: 'ricochet', name: 'Ricochet', icon: '↗↘',
    desc: 'Bullets bounce to the nearest enemy once.',
    apply: (p) => { p.ricochet = true; },
  },
  {
    id: 'repair', name: 'Core Mend', icon: '✚',
    desc: 'Heal 50 and +10 max HP.',
    apply: (p) => { p.maxHp += 10; p.hp = Math.min(p.maxHp, p.hp + 50); },
  },
];

export const POWERUP_TYPES = ['heart', 'shield', 'overdrive', 'bomb'];
