// Entities: the player, enemies, bullets, particles, power-ups and floating text.
// Plain objects with update/draw helpers; the Game owns the lists and the loop.

import { ARENA, ENEMY_TYPES, PALETTE, PLAYER } from './config.js';
import { clamp, distanceSq, randomAngle, randomChoice, randomRange } from './random.js';

export function createPlayer() {
  return {
    x: ARENA.width / 2,
    y: ARENA.height / 2 + 120,
    vx: 0,
    vy: 0,
    radius: PLAYER.radius,
    angle: -Math.PI / 2,
    hp: PLAYER.maxHp,
    maxHp: PLAYER.maxHp,
    speed: PLAYER.speed,
    fireRate: PLAYER.fireRate,
    fireTimer: 0,
    bulletSpeed: PLAYER.bulletSpeed,
    bulletDamage: PLAYER.bulletDamage,
    projectiles: 1,
    pierce: 0,
    ricochet: false,
    magnetRadius: PLAYER.magnetRadius,
    dashCooldown: PLAYER.dashCooldown,
    dashCharges: PLAYER.dashCharges,
    dashStock: PLAYER.dashCharges,
    dashTimer: 0,
    dashRecharge: 0,
    dashing: false,
    invuln: 0,
    shieldTime: 0,
    overdriveTime: 0,
    alive: true,
    trail: [],
  };
}

export function createEnemy(kind, x, y, wave, rng) {
  const def = ENEMY_TYPES[kind];
  const hpScale = 1 + (wave - 1) * 0.12;
  const enemy = {
    kind,
    x,
    y,
    vx: 0,
    vy: 0,
    radius: def.radius,
    hp: Math.round(def.hp * hpScale),
    maxHp: Math.round(def.hp * hpScale),
    speed: def.speed * randomRange(rng, 0.9, 1.1),
    damage: def.damage,
    score: def.score,
    angle: 0,
    flash: 0,
    wobble: randomRange(rng, 0, Math.PI * 2),
    shootTimer: randomRange(rng, 1.2, 2.4),
    chargeState: 'idle', // brute: idle -> windup -> charge -> recover
    chargeTimer: 0,
    attackTimer: randomRange(rng, 2, 4), // boss
    phase: 1, // boss
    summoned: false,
    dead: false,
  };
  if (kind === 'boss') {
    enemy.hp = Math.round(def.hp * (wave >= 10 ? 1.35 : 1));
    enemy.maxHp = enemy.hp;
  }
  return enemy;
}

export function createBullet(x, y, angle, speed, damage, friendly, pierce, ricochet) {
  return {
    x, y,
    vx: Math.cos(angle) * speed,
    vy: Math.sin(angle) * speed,
    radius: friendly ? 5 : 7,
    damage,
    friendly,
    pierce: pierce || 0,
    ricochet: !!ricochet,
    hitSet: new Set(),
    life: 1.6,
    dead: false,
  };
}

export function createParticle(x, y, color, count, speed, life, size) {
  const parts = [];
  for (let i = 0; i < count; i++) {
    const a = Math.random() * Math.PI * 2;
    const s = speed * (0.3 + Math.random() * 0.7);
    parts.push({
      x, y,
      vx: Math.cos(a) * s,
      vy: Math.sin(a) * s,
      color,
      life: life * (0.5 + Math.random() * 0.5),
      maxLife: life,
      size: size * (0.6 + Math.random() * 0.8),
      dead: false,
    });
  }
  return parts;
}

export function createFloater(x, y, text, color) {
  return { x, y, text, color, life: 0.9, maxLife: 0.9, dead: false };
}

export function createPowerup(x, y, kind, rng) {
  return {
    x, y, kind,
    radius: 13,
    bob: randomRange(rng, 0, Math.PI * 2),
    life: 12,
    dead: false,
  };
}

// Spawn position just outside a random arena edge.
export function edgeSpawn(rng, margin) {
  const side = Math.floor(rng() * 4);
  const m = margin || 30;
  if (side === 0) return { x: randomRange(rng, 0, ARENA.width), y: -m };
  if (side === 1) return { x: ARENA.width + m, y: randomRange(rng, 0, ARENA.height) };
  if (side === 2) return { x: randomRange(rng, 0, ARENA.width), y: ARENA.height + m };
  return { x: -m, y: randomRange(rng, 0, ARENA.height) };
}

export function updatePlayer(player, input, dt, game) {
  if (!player.alive) return;
  const move = input.moveVector();
  player.angle = Math.atan2(input.mouse.y - player.y, input.mouse.x - player.x);

  // Dash: a burst with invulnerability frames, then a recharge.
  if ((input.wasPressed(' ') || input.wasPressed('Shift')) && player.dashStock > 0 && !player.dashing) {
    player.dashing = true;
    player.dashTimer = PLAYER.dashTime;
    player.dashStock -= 1;
    player.dashRecharge = player.dashCooldown;
    player.invuln = Math.max(player.invuln, PLAYER.invulnTime);
    game.audio.sfx('dash');
    game.addParticles(player.x, player.y, PALETTE.playerGlow, 10, 220, 0.35, 3);
  }
  if (player.dashRecharge > 0) {
    player.dashRecharge -= dt;
    if (player.dashRecharge <= 0 && player.dashStock < player.dashCharges) {
      player.dashStock += 1;
      player.dashRecharge = player.dashStock < player.dashCharges ? player.dashCooldown : 0;
    }
  }

  const speed = player.dashing ? PLAYER.dashSpeed : player.speed;
  const tx = move.x * speed;
  const ty = move.y * speed;
  player.vx += (tx - player.vx) * Math.min(1, dt * 14);
  player.vy += (ty - player.vy) * Math.min(1, dt * 14);
  if (player.dashing) {
    player.dashTimer -= dt;
    if (player.dashTimer <= 0) player.dashing = false;
  }
  player.x = clamp(player.x + player.vx * dt, player.radius, ARENA.width - player.radius);
  player.y = clamp(player.y + player.vy * dt, player.radius, ARENA.height - player.radius);
  if (player.invuln > 0) player.invuln -= dt;
  if (player.shieldTime > 0) player.shieldTime -= dt;
  if (player.overdriveTime > 0) player.overdriveTime -= dt;

  // The Lumen Core slowly mends a warden who stands close to it.
  const coreDx = player.x - ARENA.width / 2;
  const coreDy = player.y - ARENA.height / 2;
  if (coreDx * coreDx + coreDy * coreDy < PLAYER.coreHealRadius * PLAYER.coreHealRadius) {
    player.hp = Math.min(player.maxHp, player.hp + PLAYER.coreHealRate * dt);
  }

  player.trail.push({ x: player.x, y: player.y, life: 0.25 });
  if (player.trail.length > 14) player.trail.shift();
  for (const t of player.trail) t.life -= dt;

  // Firing: hold mouse (or J) to shoot toward the cursor.
  player.fireTimer -= dt;
  const rate = player.fireRate * (player.overdriveTime > 0 ? 2 : 1);
  if (input.mouse.down || input.held('j')) {
    if (player.fireTimer <= 0) {
      player.fireTimer = 1 / rate;
      firePlayerBullets(game, player);
    }
  }
}

export function firePlayerBullets(game, player) {
  const n = player.projectiles;
  const spread = 0.14;
  for (let i = 0; i < n; i++) {
    const offset = n === 1 ? 0 : (i - (n - 1) / 2) * spread;
    const angle = player.angle + offset;
    const bx = player.x + Math.cos(angle) * (player.radius + 6);
    const by = player.y + Math.sin(angle) * (player.radius + 6);
    game.bullets.push(createBullet(bx, by, angle, player.bulletSpeed, player.bulletDamage, true, player.pierce, player.ricochet));
  }
  game.audio.sfx('shoot');
  game.addParticles(
    player.x + Math.cos(player.angle) * (player.radius + 4),
    player.y + Math.sin(player.angle) * (player.radius + 4),
    PALETTE.bullet, 2, 120, 0.15, 2.5,
  );
}

export function updateEnemies(game, dt) {
  const player = game.player;
  for (const e of game.enemies) {
    if (e.dead) continue;
    if (e.flash > 0) e.flash -= dt;
    const dx = player.x - e.x;
    const dy = player.y - e.y;
    const dist = Math.hypot(dx, dy) || 1;
    const nx = dx / dist;
    const ny = dy / dist;

    switch (e.kind) {
      case 'drifter':
      case 'mini': {
        e.vx += (nx * e.speed - e.vx) * Math.min(1, dt * 3);
        e.vy += (ny * e.speed - e.vy) * Math.min(1, dt * 3);
        break;
      }
      case 'wisp': {
        e.wobble += dt * 6;
        const px = -ny * Math.sin(e.wobble) * 0.8;
        const py = nx * Math.sin(e.wobble) * 0.8;
        e.vx += ((nx + px) * e.speed - e.vx) * Math.min(1, dt * 4);
        e.vy += ((ny + py) * e.speed - e.vy) * Math.min(1, dt * 4);
        break;
      }
      case 'spitter': {
        // Keep a firing distance, then shoot orbs at the player.
        const want = 260;
        const approach = dist > want + 40 ? 1 : dist < want - 40 ? -0.7 : 0;
        e.vx += (nx * e.speed * approach - e.vx) * Math.min(1, dt * 3);
        e.vy += (ny * e.speed * approach - e.vy) * Math.min(1, dt * 3);
        e.shootTimer -= dt;
        if (e.shootTimer <= 0 && dist < 520 && player.alive) {
          e.shootTimer = 2.2;
          const a = Math.atan2(dy, dx);
          game.enemyBullets.push(createBullet(e.x, e.y, a, 210, e.damage, false, 0, false));
          game.audio.sfx('hit');
        }
        break;
      }
      case 'splitter': {
        e.vx += (nx * e.speed - e.vx) * Math.min(1, dt * 3);
        e.vy += (ny * e.speed - e.vy) * Math.min(1, dt * 3);
        break;
      }
      case 'brute': {
        // Telegraph, then charge at the player.
        if (e.chargeState === 'idle') {
          e.vx += (nx * e.speed - e.vx) * Math.min(1, dt * 2);
          e.vy += (ny * e.speed - e.vy) * Math.min(1, dt * 2);
          e.chargeTimer += dt;
          if (e.chargeTimer > 2.4 && dist < 420) { e.chargeState = 'windup'; e.chargeTimer = 0; }
        } else if (e.chargeState === 'windup') {
          e.vx *= Math.max(0, 1 - dt * 6);
          e.vy *= Math.max(0, 1 - dt * 6);
          e.chargeTimer += dt;
          if (e.chargeTimer > 0.55) {
            e.chargeState = 'charge';
            e.chargeTimer = 0;
            e.vx = nx * 340;
            e.vy = ny * 340;
            game.audio.sfx('dash');
          }
        } else if (e.chargeState === 'charge') {
          e.chargeTimer += dt;
          if (e.chargeTimer > 0.6) { e.chargeState = 'recover'; e.chargeTimer = 0; }
        } else {
          e.vx *= Math.max(0, 1 - dt * 5);
          e.vy *= Math.max(0, 1 - dt * 5);
          e.chargeTimer += dt;
          if (e.chargeTimer > 0.9) { e.chargeState = 'idle'; e.chargeTimer = 0; }
        }
        break;
      }
      case 'boss': {
        updateBoss(game, e, dt, nx, ny, dist);
        break;
      }
      default: break;
    }
    e.x += e.vx * dt;
    e.y += e.vy * dt;
    e.x = clamp(e.x, -60, ARENA.width + 60);
    e.y = clamp(e.y, -60, ARENA.height + 60);
  }
}

function updateBoss(game, boss, dt, nx, ny, dist) {
  const player = game.player;
  // Phase 2 below half health: faster, angrier.
  if (boss.phase === 1 && boss.hp < boss.maxHp * 0.5) {
    boss.phase = 2;
    boss.speed *= 1.4;
    game.addParticles(boss.x, boss.y, PALETTE.boss, 40, 320, 0.7, 4);
    game.audio.sfx('boss');
    game.floaters.push(createFloater(boss.x, boss.y - 60, 'THE HERALD RAGES', PALETTE.boss));
  }
  // Drift toward the player, slowly.
  boss.vx += (nx * boss.speed - boss.vx) * Math.min(1, dt * 2);
  boss.vy += (ny * boss.speed - boss.vy) * Math.min(1, dt * 2);
  boss.attackTimer -= dt;
  if (boss.attackTimer <= 0 && player.alive) {
    boss.attackTimer = boss.phase === 2 ? 1.6 : 2.2;
    const attack = game.rng() < 0.45 ? 'radial' : game.rng() < 0.6 ? 'spread' : 'summon';
    if (attack === 'radial') {
      const count = boss.phase === 2 ? 16 : 12;
      for (let i = 0; i < count; i++) {
        const a = (i / count) * Math.PI * 2 + boss.wobble;
        game.enemyBullets.push(createBullet(boss.x, boss.y, a, 170, 14, false, 0, false));
      }
      game.audio.sfx('boss');
    } else if (attack === 'spread') {
      const base = Math.atan2(player.y - boss.y, player.x - boss.x);
      for (let i = -2; i <= 2; i++) {
        game.enemyBullets.push(createBullet(boss.x, boss.y, base + i * 0.16, 260, 14, false, 0, false));
      }
      game.audio.sfx('hit');
    } else {
      for (let i = 0; i < 3; i++) {
        const pos = edgeSpawn(game.rng, 30);
        game.enemies.push(createEnemy('drifter', pos.x, pos.y, game.wave, game.rng));
      }
      game.floaters.push(createFloater(boss.x, boss.y - 60, 'SUMMONED', PALETTE.boss));
    }
    boss.wobble += 0.5;
  }
}

export function updateBullets(game, dt) {
  for (const b of game.bullets) {
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    b.life -= dt;
    if (b.x < -20 || b.x > ARENA.width + 20 || b.y < -20 || b.y > ARENA.height + 20 || b.life <= 0) b.dead = true;
  }
  for (const b of game.enemyBullets) {
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    b.life -= dt;
    if (b.x < -20 || b.x > ARENA.width + 20 || b.y < -20 || b.y > ARENA.height + 20 || b.life <= 0) b.dead = true;
  }
}

export function updateParticles(game, dt) {
  for (const p of game.particles) {
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.vx *= Math.max(0, 1 - dt * 3);
    p.vy *= Math.max(0, 1 - dt * 3);
    p.life -= dt;
    if (p.life <= 0) p.dead = true;
  }
  for (const f of game.floaters) {
    f.y -= 42 * dt;
    f.life -= dt;
    if (f.life <= 0) f.dead = true;
  }
}

export function updatePowerups(game, dt) {
  const player = game.player;
  for (const p of game.powerups) {
    p.bob += dt * 3;
    p.life -= dt;
    if (p.life <= 0) { p.dead = true; continue; }
    const d2 = distanceSq(p.x, p.y, player.x, player.y);
    const pull = player.magnetRadius * player.magnetRadius;
    if (player.alive && d2 < pull) {
      const d = Math.sqrt(d2) || 1;
      const pullSpeed = 320 * (1 - d / player.magnetRadius);
      p.x += ((player.x - p.x) / d) * pullSpeed * dt;
      p.y += ((player.y - p.y) / d) * pullSpeed * dt;
    }
    if (player.alive && d2 < (p.radius + player.radius) * (p.radius + player.radius)) {
      p.dead = true;
      game.collectPowerup(p.kind);
    }
  }
}

// Splits a splitter into two minis at its position.
export function splitEnemy(game, enemy) {
  for (let i = 0; i < 2; i++) {
    const a = randomAngle(game.rng);
    const mini = createEnemy('mini', enemy.x + Math.cos(a) * 20, enemy.y + Math.sin(a) * 20, game.wave, game.rng);
    game.enemies.push(mini);
  }
}

export { randomChoice };
