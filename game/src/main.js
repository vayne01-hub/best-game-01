// LUMEN SIEGE — bootstrap: wires the Game to the DOM HUD and screens.
// With ?shot=<scene> in the URL it renders one deterministic scene for screenshots
// instead of starting the interactive loop.

import { Game } from './game.js';
import { runShot } from './shots.js';

// The DOM HUD: every method the Game calls to show state on screen.
class Hud {
  constructor() {
    this.scoreEl = document.getElementById('score');
    this.bestEl = document.getElementById('best');
    this.waveEl = document.getElementById('wave');
    this.hpFill = document.getElementById('hpfill');
    this.dashPips = document.getElementById('dashpips');
    this.comboEl = document.getElementById('combo');
    this.hud = document.getElementById('hud');
    this.bossBar = document.getElementById('bossbar');
    this.bossFill = document.getElementById('bossfill');
    this.bannerEl = document.getElementById('banner');
    this.screens = {
      title: document.getElementById('title-screen'),
      upgrade: document.getElementById('upgrade-screen'),
      pause: document.getElementById('pause-screen'),
      end: document.getElementById('end-screen'),
    };
    this.cardsEl = document.getElementById('cards');
    this._bannerTimer = null;
  }

  showScreen(name) {
    for (const [key, el] of Object.entries(this.screens)) {
      el.classList.toggle('hidden', key !== name);
    }
    this.hud.classList.toggle('hidden', name === 'title');
    if (name !== 'upgrade') this.cardsEl.innerHTML = '';
  }

  setBest(best) {
    this.bestEl.textContent = String(best);
    const titleBest = document.getElementById('title-best');
    if (titleBest) titleBest.textContent = String(best);
  }

  setWave(wave) {
    this.waveEl.textContent = String(wave);
  }

  setMuted(muted) {
    document.getElementById('muted').classList.toggle('hidden', !muted);
  }

  showBanner(text) {
    this.bannerEl.textContent = text;
    this.bannerEl.classList.remove('hidden');
    // Restart the CSS animation each time a banner shows.
    void this.bannerEl.offsetWidth;
    this.bannerEl.style.animation = 'none';
    void this.bannerEl.offsetWidth;
    this.bannerEl.style.animation = '';
    if (this._bannerTimer) clearTimeout(this._bannerTimer);
    this._bannerTimer = setTimeout(() => this.bannerEl.classList.add('hidden'), 2400);
  }

  showUpgrades(choices) {
    this.cardsEl.innerHTML = '';
    choices.forEach((choice, i) => {
      const card = document.createElement('div');
      card.className = 'card';
      card.innerHTML = `<div class="icon">${choice.icon}</div><h3></h3><p></p><span class="key">PRESS ${i + 1} OR CLICK</span>`;
      card.querySelector('h3').textContent = choice.name;
      card.querySelector('p').textContent = choice.desc;
      card.addEventListener('click', () => window.__game.pickUpgrade(i));
      this.cardsEl.appendChild(card);
    });
    this.showScreen('upgrade');
  }

  showEnd(won, score, best, wave, kills) {
    document.getElementById('end-title').textContent = won ? 'VICTORY' : 'GAME OVER';
    document.getElementById('end-sub').textContent = won
      ? 'The Void Herald is broken. The Lumen Core burns bright — the siege is over, Warden.'
      : 'The Void swallows the light… this time. The Core remembers your stand.';
    document.getElementById('end-score').textContent = String(score);
    document.getElementById('end-best').textContent = String(best);
    document.getElementById('end-wave').textContent = String(wave);
    document.getElementById('end-kills').textContent = String(kills);
    this.showScreen('end');
  }

  // Called every frame; only touches the DOM when a value changed.
  sync(game) {
    const score = String(game.score);
    if (this.scoreEl.textContent !== score) this.scoreEl.textContent = score;
    const best = String(game.best);
    if (this.bestEl.textContent !== best) this.bestEl.textContent = best;
    const wave = String(Math.max(1, game.wave));
    if (this.waveEl.textContent !== wave) this.waveEl.textContent = wave;
    const hpPct = Math.max(0, Math.round((game.player.hp / game.player.maxHp) * 100));
    this.hpFill.style.width = `${hpPct}%`;
    this.hpFill.classList.toggle('low', hpPct <= 30);
    const pips = '◆'.repeat(game.player.dashStock) + '◇'.repeat(Math.max(0, game.player.dashCharges - game.player.dashStock));
    if (this.dashPips.textContent !== pips) this.dashPips.textContent = pips;
    const mult = game.comboMultiplier();
    if (game.combo >= 4 && game.state === 'playing') {
      this.comboEl.classList.remove('hidden');
      this.comboEl.textContent = `COMBO ×${mult} — ${game.combo} KILLS`;
    } else {
      this.comboEl.classList.add('hidden');
    }
    if (game.boss) {
      this.bossBar.classList.remove('hidden');
      this.bossFill.style.width = `${Math.max(0, (game.boss.hp / game.boss.maxHp) * 100)}%`;
    } else {
      this.bossBar.classList.add('hidden');
    }
  }
}

const canvas = document.getElementById('game');
const hud = new Hud();
const game = new Game(canvas, hud);

// Test and screenshot hooks: the game's own API, used by the play-test script.
window.__game = {
  game,
  state: () => game.state,
  score: () => game.score,
  wave: () => game.wave,
  enemies: () => game.enemies.length,
  start: () => game.startGame(),
  pickUpgrade: (i) => game.pickUpgrade(i),
  damage: (n) => {
    game.player.invuln = 0;
    game.player.shieldTime = 0;
    game.hurtPlayer(n, game.player.x, game.player.y);
  },
};

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
if (shot) {
  runShot(game, hud, shot, Number(params.get('seed') || 1));
} else {
  game.start();
}
