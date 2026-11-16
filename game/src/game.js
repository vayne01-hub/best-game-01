// LUMEN SIEGE — the game itself: state machine, loop, collisions, scoring,
// waves, upgrades, and the HUD. One Game owns the world; main.js boots it.

import { ARENA, COMBO_STEP, COMBO_WINDOW, FINAL_WAVE, PALETTE, PLAYER, POWERUP_TYPES, UPGRADE_POOL } from './config.js';
import { AudioEngine } from './audio.js';
import { createEnemy, createFloater, createParticle, createPlayer, createPowerup, splitEnemy, updateBullets, updateEnemies, updateParticles, updatePlayer, updatePowerups } from './entities.js';
import { Input } from './input.js';
import { mulberry32, clamp, distanceSq, randomChoice } from './random.js';
import { drawEntities, drawWorld } from './render.js';
import { buildWaveQueue, draftUpgrades, nextSpawnDelay, spawnNext } from './waves.js';

export const BEST_KEY = 'lumen-siege-best';

export class Game {
  constructor(canvas, hud) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.hud = hud; // DOM handles: { score, best, wave, hpFill, hpText, dashPips, combo, bossBar, bossWrap, banner, ... }
    this.input = new Input(canvas);
    this.audio = new AudioEngine();
    this.rng = mulberry32((Math.random() * 0xffffffff) >>> 0);
    this.state = 'title'; // title | playing | upgrade | paused | victory | gameover
    this.prevState = 'title';
    this.time = 0;
    this.player = createPlayer();
    this.enemies = [];
    this.bullets = [];
    this.enemyBullets = [];
    this.particles = [];
    this.floaters = [];
    this.powerups = [];
    this.spawnQueue = [];
    this.spawnTimer = 0;
    this.wave = 0;
    this.score = 0;
    this.kills = 0;
    this.combo = 0;
    this.comboTimer = 0;
    this.best = this.loadBest();
    this.shake = 0;
    this.hitStop = 0;
    this.upgradeChoices = [];
    this.boss = null;
    this.stars = [];
    for (let i = 0; i < 90; i++) {
      this.stars.push({
        x: Math.random() * ARENA.width,
        y: Math.random() * ARENA.height,
        size: Math.random() < 0.8 ? 1 : 2,
        twinkle: 0.5 + Math.random() * 2,
        phase: Math.random() * Math.PI * 2,
      });
    }
    this._raf = 0;
    this._last = 0;
    this._onVisibility = () => {
      if (document.hidden && this.state === 'playing') this.pauseGame();
    };
  }

  loadBest() {
    try {
      return Number(localStorage.getItem(BEST_KEY) || 0) || 0;
    } catch (err) {
      return 0;
    }
  }

  saveBest() {
    if (this.score > this.best) {
      this.best = this.score;
      try { localStorage.setItem(BEST_KEY, String(this.best)); } catch (err) { /* private mode */ }
    }
  }

  start() {
    this.input.attach();
    document.addEventListener('visibilitychange', this._onVisibility);
    this._last = performance.now();
    const loop = (now) => {
      const dt = Math.min(0.05, (now - this._last) / 1000);
      this._last = now;
      this.frame(dt);
      this._raf = requestAnimationFrame(loop);
    };
    this._raf = requestAnimationFrame(loop);
    this.showTitle();
  }

  destroy() {
    cancelAnimationFrame(this._raf);
    this.input.detach();
    document.removeEventListener('visibilitychange', this._onVisibility);
    this.audio.stopMusic();
  }

  // ---------- state transitions ----------

  showTitle() {
    this.state = 'title';
    this.resetWorld();
    this.hud.showScreen('title');
    this.hud.setBest(this.best);
  }

  startGame() {
    this.resetWorld();
    this.state = 'playing';
    this.hud.showScreen(null);
    this.audio.resume();
    this.audio.startMusic();
    this.startWave(1);
  }

  resetWorld() {
    this.player = createPlayer();
    this.enemies = [];
    this.bullets = [];
    this.enemyBullets = [];
    this.particles = [];
    this.floaters = [];
    this.powerups = [];
    this.spawnQueue = [];
    this.wave = 0;
    this.score = 0;
    this.kills = 0;
    this.combo = 0;
    this.comboTimer = 0;
    this.boss = null;
    this.shake = 0;
    this.hitStop = 0;
  }

  startWave(n) {
    this.wave = n;
    this.spawnQueue = buildWaveQueue(n, this.rng);
    this.spawnTimer = 0.8;
    this.boss = null;
    this.hud.setWave(n);
    this.showBanner(n === FINAL_WAVE ? `FINAL WAVE ${n} — THE VOID HERALD` : `WAVE ${n}`);
    if (this.spawnQueue.includes('boss')) this.audio.sfx('boss');
    else this.audio.sfx('wave');
  }

  waveCleared() {
    const bonus = 100 * this.wave;
    this.score += bonus;
    this.floaters.push(createFloater(ARENA.width / 2, ARENA.height / 2 - 80, `WAVE CLEAR +${bonus}`, PALETTE.gold));
    if (this.wave >= FINAL_WAVE) {
      this.winGame();
      return;
    }
    this.state = 'upgrade';
    this.upgradeChoices = draftUpgrades(UPGRADE_POOL, this.rng);
    this.hud.showUpgrades(this.upgradeChoices);
    this.audio.sfx('upgrade');
  }

  pickUpgrade(index) {
    const choice = this.upgradeChoices[index];
    if (!choice || this.state !== 'upgrade') return;
    choice.apply(this.player);
    this.floaters.push(createFloater(this.player.x, this.player.y - 30, choice.name.toUpperCase(), PALETTE.gold));
    this.audio.sfx('pickup');
    this.hud.showScreen(null);
    this.state = 'playing';
    this.startWave(this.wave + 1);
  }

  pauseGame() {
    if (this.state !== 'playing') return;
    this.prevState = 'playing';
    this.state = 'paused';
    this.hud.showScreen('pause');
  }

  resumeGame() {
    if (this.state !== 'paused') return;
    this.state = 'playing';
    this.hud.showScreen(null);
  }

  winGame() {
    this.state = 'victory';
    this.saveBest();
    this.audio.sfx('victory');
    this.audio.stopMusic();
    this.hud.showEnd(true, this.score, this.best, this.wave, this.kills);
  }

  loseGame() {
    this.state = 'gameover';
    this.saveBest();
    this.audio.sfx('gameover');
    this.audio.stopMusic();
    this.addParticles(this.player.x, this.player.y, PALETTE.player, 50, 380, 0.9, 4);
    this.hud.showEnd(false, this.score, this.best, this.wave, this.kills);
  }

  // ---------- per-frame ----------

  frame(dt) {
    this.time += dt;
    this.handleGlobalKeys();
    if (this.state === 'playing') {
      if (this.hitStop > 0) {
        this.hitStop -= dt;
      } else {
        this.update(dt);
      }
    } else if (this.state === 'title') {
      this.updateAmbient(dt);
    } else if (this.state === 'victory' || this.state === 'gameover') {
      updateParticles(this, dt);
    }
    this.render();
    this.hud.sync(this);
    this.input.endFrame();
  }

  handleGlobalKeys() {
    const input = this.input;
    if (input.wasPressed('m')) {
      const muted = this.audio.toggleMute();
      this.hud.setMuted(muted);
    }
    if (this.state === 'title' && (input.wasPressed('Enter') || input.wasPressed('mouse'))) {
      this.audio.resume();
      this.startGame();
    } else if (this.state === 'playing' && (input.wasPressed('p') || input.wasPressed('Escape'))) {
      this.pauseGame();
    } else if (this.state === 'paused' && (input.wasPressed('p') || input.wasPressed('Escape') || input.wasPressed('Enter'))) {
      this.resumeGame();
    } else if (this.state === 'upgrade') {
      if (input.wasPressed('1')) this.pickUpgrade(0);
      if (input.wasPressed('2')) this.pickUpgrade(1);
      if (input.wasPressed('3')) this.pickUpgrade(2);
    } else if ((this.state === 'victory' || this.state === 'gameover') && (input.wasPressed('Enter') || input.wasPressed('r') || input.wasPressed('mouse'))) {
      this.startGame();
    }
  }

  update(dt) {
    updatePlayer(this.player, this.input, dt, this);
    // Spawning.
    if (this.spawnQueue.length > 0) {
      this.spawnTimer -= dt;
      if (this.spawnTimer <= 0) {
        spawnNext(this);
        this.spawnTimer = nextSpawnDelay(this.wave, this.spawnQueue.length);
      }
    }
    updateEnemies(this, dt);
    updateBullets(this, dt);
    updateParticles(this, dt);
    updatePowerups(this, dt);
    this.collide();
    this.prune();

    // Combo decay.
    if (this.comboTimer > 0) {
      this.comboTimer -= dt;
      if (this.comboTimer <= 0) this.combo = 0;
    }
    if (this.shake > 0) this.shake = Math.max(0, this.shake - dt * 26);

    // Track the boss for its health bar.
    this.boss = this.enemies.find((e) => e.kind === 'boss' && !e.dead) || null;

    // Wave clear: queue empty and no enemies left.
    if (this.spawnQueue.length === 0 && this.enemies.length === 0 && this.state === 'playing') {
      this.waveCleared();
    }
  }

  // Ambient drift behind the title screen: a few wisps float by, nothing shoots.
  updateAmbient(dt) {
    updateParticles(this, dt);
    if (this.enemies.length < 6 && Math.random() < dt * 0.7) {
      const kinds = ['drifter', 'wisp', 'spitter'];
      const kind = kinds[Math.floor(Math.random() * kinds.length)];
      const x = Math.random() * ARENA.width;
      const y = Math.random() * ARENA.height;
      const e = createEnemy(kind, x, y, 1, this.rng);
      e.vx = (Math.random() - 0.5) * 40;
      e.vy = (Math.random() - 0.5) * 40;
      this.enemies.push(e);
    }
    for (const e of this.enemies) {
      e.x += e.vx * dt;
      e.y += e.vy * dt;
      e.wobble += dt;
      if (e.x < -40) e.x = ARENA.width + 40;
      if (e.x > ARENA.width + 40) e.x = -40;
      if (e.y < -40) e.y = ARENA.height + 40;
      if (e.y > ARENA.height + 40) e.y = -40;
    }
  }

  collide() {
    const player = this.player;
    // Player bullets vs enemies.
    for (const b of this.bullets) {
      if (b.dead) continue;
      for (const e of this.enemies) {
        if (e.dead || b.hitSet.has(e)) continue;
        const rr = b.radius + e.radius;
        if (distanceSq(b.x, b.y, e.x, e.y) < rr * rr) {
          b.hitSet.add(e);
          // Prism Rounds: a rolled crit doubles this hit's damage.
          let dmg = b.damage;
          let crit = false;
          if (player.critChance > 0 && Math.random() < player.critChance) {
            crit = true;
            dmg *= 2;
          }
          this.damageEnemy(e, dmg, b, crit);
          if (b.pierce > 0) {
            b.pierce -= 1;
          } else if (b.ricochet) {
            b.ricochet = false;
            const next = this.nearestEnemy(b.x, b.y, e);
            if (next) {
              const a = Math.atan2(next.y - b.y, next.x - b.x);
              const speed = Math.hypot(b.vx, b.vy);
              b.vx = Math.cos(a) * speed;
              b.vy = Math.sin(a) * speed;
              continue;
            }
            b.dead = true;
          } else {
            b.dead = true;
          }
          if (b.dead) break;
        }
      }
    }
    // Enemies vs player.
    if (player.alive && player.invuln <= 0) {
      for (const e of this.enemies) {
        if (e.dead) continue;
        const rr = e.radius + player.radius - 2;
        if (distanceSq(e.x, e.y, player.x, player.y) < rr * rr) {
          this.hurtPlayer(e.damage, e.x, e.y);
          // The enemy bounces off so one touch is not a death spiral.
          const a = Math.atan2(e.y - player.y, e.x - player.x);
          e.x = player.x + Math.cos(a) * (rr + 2);
          e.y = player.y + Math.sin(a) * (rr + 2);
          if (e.kind !== 'boss' && e.kind !== 'brute') {
            e.vx = Math.cos(a) * 160;
            e.vy = Math.sin(a) * 160;
          }
          break;
        }
      }
    }
    // Enemy bullets vs player.
    if (player.alive && player.invuln <= 0) {
      for (const b of this.enemyBullets) {
        if (b.dead) continue;
        const rr = b.radius + player.radius - 2;
        if (distanceSq(b.x, b.y, player.x, player.y) < rr * rr) {
          b.dead = true;
          this.hurtPlayer(b.damage, b.x, b.y);
          break;
        }
      }
    }
  }

  damageEnemy(enemy, damage, bullet, crit = false) {
    enemy.hp -= damage;
    enemy.flash = 0.08;
    this.addParticles(bullet.x, bullet.y, '#ffffff', 3, 140, 0.2, 2);
    // Boss hits spark harder, so chewing through the Herald feels physical.
    if (enemy.kind === 'boss') {
      this.addParticles(bullet.x, bullet.y, PALETTE.boss, 5, 210, 0.3, 3);
    }
    // Floating damage number on every hit; crits read bigger and hotter.
    if (this.floaters.length < 70) {
      this.floaters.push(createFloater(
        bullet.x + (Math.random() * 16 - 8), bullet.y - 6,
        `${Math.round(damage)}`,
        crit ? '#ffb347' : 'rgba(255,255,255,0.95)',
        crit ? { life: 0.7, size: 20, vy: 62 } : { life: 0.5, size: 13, vy: 58 },
      ));
    }
    this.audio.sfx('hit');
    if (enemy.hp <= 0 && !enemy.dead) {
      enemy.dead = true;
      this.killEnemy(enemy);
    }
  }

  killEnemy(enemy) {
    const mult = this.comboMultiplier();
    const gained = enemy.score * mult;
    this.score += gained;
    this.kills += 1;
    this.combo += 1;
    this.comboTimer = this.player.comboWindow ?? COMBO_WINDOW;
    // Siphon Core: every 4th kill feeds a little hull back to the warden.
    if (this.player.siphon > 0 && this.player.alive) {
      this.player.siphonCounter += 1;
      if (this.player.siphonCounter >= 4) {
        this.player.siphonCounter = 0;
        const heal = 3 * this.player.siphon;
        if (this.player.hp < this.player.maxHp) {
          this.player.hp = Math.min(this.player.maxHp, this.player.hp + heal);
          this.floaters.push(createFloater(this.player.x, this.player.y - 26, `+${heal} HP`, '#7dff9a'));
        }
      }
    }
    const color = enemy.kind === 'boss' ? PALETTE.boss : PALETTE.gold;
    this.floaters.push(createFloater(enemy.x, enemy.y - 14, `+${gained}`, color));
    const big = enemy.kind === 'boss' || enemy.kind === 'brute';
    this.addParticles(enemy.x, enemy.y, this.enemyColor(enemy.kind), big ? 34 : 16, big ? 320 : 240, 0.55, 3.5);
    this.audio.sfx(big ? 'bigExplode' : 'explode');
    // Juice scaled to the event: every kill stops time for a beat and kicks the
    // camera; bigger prey kicks harder, the Herald hardest of all.
    this.shake = Math.min(16, this.shake + (enemy.kind === 'boss' ? 14 : big ? 8 : enemy.kind === 'mini' ? 1.5 : 3.5));
    this.hitStop = enemy.kind === 'boss' ? 0.12 : big ? 0.06 : 0.022;
    if (enemy.kind === 'splitter') splitEnemy(this, enemy);
    if (enemy.kind === 'boss') {
      this.addParticles(enemy.x, enemy.y, PALETTE.boss, 60, 420, 1, 4);
      this.floaters.push(createFloater(ARENA.width / 2, 200, 'HERALD DOWN', PALETTE.boss));
    }
    // Power-up drop.
    if (enemy.kind !== 'mini' && this.rng() < 0.12) {
      const kind = randomChoice(this.rng, POWERUP_TYPES);
      this.powerups.push(createPowerup(enemy.x, enemy.y, kind, this.rng));
    }
  }

  hurtPlayer(damage, fromX, fromY) {
    const player = this.player;
    if (player.shieldTime > 0 || !player.alive) return;
    player.hp -= damage;
    player.invuln = PLAYER.invulnTime;
    this.combo = 0;
    this.comboTimer = 0;
    this.shake = Math.min(16, this.shake + 8);
    this.audio.sfx('hurt');
    this.addParticles(player.x, player.y, '#ff5470', 18, 280, 0.5, 3.5);
    if (player.hp <= 0) {
      player.hp = 0;
      player.alive = false;
      this.loseGame();
    }
  }

  collectPowerup(kind) {
    const player = this.player;
    if (kind === 'heart') {
      player.hp = Math.min(player.maxHp, player.hp + 20);
      this.floaters.push(createFloater(player.x, player.y - 24, '+20 HP', '#ff6b81'));
    } else if (kind === 'shield') {
      player.shieldTime = 5;
      this.floaters.push(createFloater(player.x, player.y - 24, 'SHIELD', '#7fe7ff'));
    } else if (kind === 'overdrive') {
      player.overdriveTime = 8;
      this.floaters.push(createFloater(player.x, player.y - 24, 'OVERDRIVE', '#ffd166'));
    } else if (kind === 'bomb') {
      for (const e of this.enemies) {
        if (!e.dead) this.damageEnemy(e, 100, { x: e.x, y: e.y });
      }
      this.floaters.push(createFloater(player.x, player.y - 24, 'NOVA BOMB', '#ff9f1c'));
      this.shake = 14;
    }
    this.audio.sfx('pickup');
  }

  nearestEnemy(x, y, except) {
    let best = null;
    let bestD = Infinity;
    for (const e of this.enemies) {
      if (e.dead || e === except) continue;
      const d = distanceSq(x, y, e.x, e.y);
      if (d < bestD) { bestD = d; best = e; }
    }
    return best;
  }

  comboMultiplier() {
    return Math.min(8, 1 + Math.floor(this.combo / COMBO_STEP));
  }

  enemyColor(kind) {
    return {
      drifter: PALETTE.drifter, wisp: PALETTE.wisp, spitter: PALETTE.spitter,
      sniper: PALETTE.sniper, orbiter: PALETTE.orbiter,
      splitter: PALETTE.splitter, mini: PALETTE.mini, brute: PALETTE.brute, boss: PALETTE.boss,
    }[kind] || PALETTE.particle;
  }

  addParticles(x, y, color, count, speed, life, size) {
    for (const p of createParticle(x, y, color, count, speed, life, size)) this.particles.push(p);
  }

  showBanner(text) {
    this.hud.showBanner(text);
  }

  prune() {
    this.enemies = this.enemies.filter((e) => !e.dead);
    this.bullets = this.bullets.filter((b) => !b.dead);
    this.enemyBullets = this.enemyBullets.filter((b) => !b.dead);
    this.particles = this.particles.filter((p) => !p.dead);
    this.floaters = this.floaters.filter((f) => !f.dead);
    this.powerups = this.powerups.filter((p) => !p.dead);
  }

  render() {
    const ctx = this.ctx;
    ctx.save();
    if (this.shake > 0.5) {
      ctx.translate((Math.random() - 0.5) * this.shake, (Math.random() - 0.5) * this.shake);
    }
    drawWorld(ctx, this, this.time);
    drawEntities(ctx, this);
    ctx.restore();
    // Dim the world behind overlays that are not the HUD.
    if (this.state === 'title' || this.state === 'paused' || this.state === 'upgrade') {
      ctx.fillStyle = 'rgba(4, 6, 16, 0.45)';
      ctx.fillRect(0, 0, ARENA.width, ARENA.height);
    }
  }
}
