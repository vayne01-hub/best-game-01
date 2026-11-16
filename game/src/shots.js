// Deterministic screenshot scenes: ?shot=title|play|boss|victory&seed=N renders
// one fixed moment of the real game (seeded RNG, fixed simulated time, no wall
// clock) and sets window.__shotReady when the frame is painted. The scenes use
// the game's own update and render code — nothing here is a mock.

import { ARENA } from './config.js';
import { createEnemy } from './entities.js';
import { mulberry32 } from './random.js';

const STEP = 1 / 60;

function scriptedInput(game, aimX, aimY, moveX, moveY, firing) {
  game.input.setMouse(aimX, aimY, firing);
  game.input.setKey('w', moveY < 0);
  game.input.setKey('s', moveY > 0);
  game.input.setKey('a', moveX < 0);
  game.input.setKey('d', moveX > 0);
}

// Run the game forward N fixed steps with scripted input.
function simulate(game, seconds, drive) {
  const steps = Math.round(seconds / STEP);
  for (let i = 0; i < steps; i++) {
    if (drive) drive(i * STEP, game);
    game.update(STEP);
    game.input.endFrame();
  }
}

function seedEnemies(game, specs, rng) {
  for (const [kind, x, y] of specs) {
    const e = createEnemy(kind, x, y, game.wave, rng);
    game.enemies.push(e);
  }
}

export function runShot(game, hud, scene, seed) {
  game.rng = mulberry32(seed);
  game.audio.enabled = false; // screenshots need no sound
  const rng = game.rng;

  if (scene === 'title') {
    game.showTitle();
    // Let the ambient drift populate the arena behind the title.
    for (let i = 0; i < Math.round(2.5 / STEP); i++) game.updateAmbient(STEP);
    game.render();
    hud.sync(game);
  } else if (scene === 'play') {
    game.startGame();
    game.state = 'playing';
    game.wave = 3;
    game.score = 2450;
    game.combo = 6;
    game.comboTimer = 2.0;
    game.player.hp = 78;
    game.player.shieldTime = 2; // survive the scripted take, shield ring reads as intent
    game.player.x = 430;
    game.player.y = 430;
    hud.bannerEl.classList.add('hidden');
    seedEnemies(game, [
      ['drifter', 820, 220], ['drifter', 900, 380], ['wisp', 760, 520],
      ['wisp', 980, 180], ['spitter', 1010, 300], ['splitter', 700, 150],
      ['mini', 640, 480], ['brute', 1080, 480],
    ], rng);
    game.spawnQueue = [];
    simulate(game, 1.6, (t) => {
      const a = t * 1.4;
      scriptedInput(game, 880 + Math.cos(a) * 260, 330 + Math.sin(a) * 180, Math.cos(a * 0.7), Math.sin(a * 0.7), true);
    });
    // Frame the warden in the lower-left third, aiming at the swarm.
    game.player.x = 470;
    game.player.y = 430;
    game.player.angle = Math.atan2(300 - 430, 880 - 470);
    game.input.setMouse(880, 300, true);
    game.render();
    hud.sync(game);
  } else if (scene === 'boss') {
    game.startGame();
    game.state = 'playing';
    game.wave = 10;
    game.score = 12840;
    game.combo = 9;
    game.comboTimer = 2.2;
    game.player.hp = 64;
    game.player.shieldTime = 3; // survive the scripted take, shield ring reads as intent
    game.player.x = 380;
    game.player.y = 520;
    hud.bannerEl.classList.add('hidden');
    const boss = createEnemy('boss', 880, 300, 10, rng);
    boss.hp = Math.round(boss.maxHp * 0.62);
    game.enemies.push(boss);
    game.boss = boss;
    seedEnemies(game, [
      ['drifter', 700, 180], ['wisp', 1050, 480], ['spitter', 1120, 220],
    ], rng);
    game.spawnQueue = [];
    simulate(game, 2.2, (t) => {
      const a = t * 1.1;
      scriptedInput(game, 880, 300, Math.cos(a), Math.sin(a), true);
      if (Math.abs(t - 1.1) < STEP) game.input.setKey(' ', true);
      else game.input.setKey(' ', false);
    });
    // Frame the warden in the lower-left, aiming up at the Herald.
    game.player.x = 430;
    game.player.y = 500;
    game.player.angle = Math.atan2(300 - 500, 880 - 430);
    game.input.setMouse(880, 300, true);
    game.render();
    hud.sync(game);
  } else if (scene === 'victory') {
    game.resetWorld();
    game.score = 15480;
    game.kills = 214;
    game.wave = 10;
    game.player.hp = 41;
    game.player.alive = false; // the warden stands down; the screen carries the moment
    game.addParticles(ARENA.width / 2, ARENA.height / 2, '#7fe7ff', 40, 260, 1.2, 3.5);
    game.addParticles(ARENA.width / 2, ARENA.height / 2, '#ffd166', 30, 200, 1.0, 3);
    game.winGame();
    game.render();
    hud.sync(game);
  } else {
    // Unknown scene: fall back to the title.
    game.showTitle();
    game.render();
    hud.sync(game);
  }

  window.__shotReady = true;
}
