// Wave composition and spawning: each wave is a queue of enemies released over
// time from the arena edges, with a boss on waves 5 and 10.

import { WAVE_TABLE } from './config.js';
import { createEnemy, edgeSpawn } from './entities.js';
import { randomChoice } from './random.js';

export function buildWaveQueue(wave, rng) {
  const table = WAVE_TABLE[wave - 1] || WAVE_TABLE[WAVE_TABLE.length - 1];
  const queue = [];
  for (const [kind, count] of Object.entries(table)) {
    for (let i = 0; i < count; i++) queue.push(kind);
  }
  // Shuffle the queue so the wave arrives as a mixed swarm, boss last.
  const boss = queue.filter((k) => k === 'boss');
  const rest = queue.filter((k) => k !== 'boss');
  for (let i = rest.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [rest[i], rest[j]] = [rest[j], rest[i]];
  }
  return [...rest, ...boss];
}

export function nextSpawnDelay(wave, remaining) {
  // Early waves trickle in; later waves arrive faster.
  const base = Math.max(0.35, 0.9 - wave * 0.06);
  return remaining > 12 ? base * 0.6 : base;
}

// Release the next enemy from the queue at an arena edge.
export function spawnNext(game) {
  const kind = game.spawnQueue.shift();
  if (!kind) return null;
  const pos = edgeSpawn(game.rng, 30);
  const enemy = createEnemy(kind, pos.x, pos.y, game.wave, game.rng);
  game.enemies.push(enemy);
  return enemy;
}

// Pick three distinct upgrade cards for the between-wave draft.
export function draftUpgrades(pool, rng) {
  const copy = [...pool];
  const picked = [];
  while (picked.length < 3 && copy.length > 0) {
    const i = Math.floor(rng() * copy.length);
    picked.push(copy.splice(i, 1)[0]);
  }
  return picked;
}

export { randomChoice };
