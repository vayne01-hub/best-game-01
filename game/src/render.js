// Canvas rendering: the arena, the Lumen Core, every entity, particles and
// floating text. The DOM carries the HUD and the screens; the canvas draws the world.

import { ARENA, PALETTE } from './config.js';

const ENEMY_COLORS = {
  drifter: PALETTE.drifter,
  wisp: PALETTE.wisp,
  spitter: PALETTE.spitter,
  sniper: PALETTE.sniper,
  orbiter: PALETTE.orbiter,
  splitter: PALETTE.splitter,
  mini: PALETTE.mini,
  brute: PALETTE.brute,
  boss: PALETTE.boss,
};

export function drawWorld(ctx, game, time) {
  const { width, height } = ARENA;
  // Background: deep space with a vignette and a faint grid.
  ctx.fillStyle = PALETTE.background;
  ctx.fillRect(0, 0, width, height);
  ctx.strokeStyle = PALETTE.grid;
  ctx.lineWidth = 1;
  for (let x = 80; x < width; x += 80) {
    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, height); ctx.stroke();
  }
  for (let y = 80; y < height; y += 80) {
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(width, y); ctx.stroke();
  }
  // Distant stars.
  for (const star of game.stars) {
    const tw = 0.35 + 0.3 * Math.sin(time * star.twinkle + star.phase);
    ctx.globalAlpha = tw;
    ctx.fillStyle = '#cfe4ff';
    ctx.fillRect(star.x, star.y, star.size, star.size);
  }
  ctx.globalAlpha = 1;
  drawCore(ctx, game, time);
}

function drawCore(ctx, game, time) {
  const cx = ARENA.width / 2;
  const cy = ARENA.height / 2;
  const pulse = 1 + 0.06 * Math.sin(time * 2.2);
  // Heal aura.
  ctx.save();
  ctx.globalAlpha = 0.08;
  ctx.fillStyle = PALETTE.coreGlow;
  ctx.beginPath();
  ctx.arc(cx, cy, 150 * pulse, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
  // Crystal: a rotating diamond with a glow.
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(time * 0.25);
  ctx.shadowColor = PALETTE.coreGlow;
  ctx.shadowBlur = 30;
  ctx.fillStyle = PALETTE.core;
  ctx.beginPath();
  ctx.moveTo(0, -34 * pulse);
  ctx.lineTo(22 * pulse, 0);
  ctx.lineTo(0, 34 * pulse);
  ctx.lineTo(-22 * pulse, 0);
  ctx.closePath();
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.strokeStyle = 'rgba(255,255,255,0.85)';
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.restore();
  ctx.save();
  ctx.fillStyle = 'rgba(255,255,255,0.9)';
  ctx.font = '600 11px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('LUMEN CORE', cx, cy + 52);
  ctx.restore();
}

export function drawEntities(ctx, game) {
  // Power-ups.
  for (const p of game.powerups) {
    const bobY = Math.sin(p.bob) * 3;
    const color = p.kind === 'heart' ? '#ff6b81' : p.kind === 'shield' ? '#7fe7ff' : p.kind === 'overdrive' ? '#ffd166' : '#ff9f1c';
    ctx.save();
    ctx.translate(p.x, p.y + bobY);
    ctx.shadowColor = color;
    ctx.shadowBlur = 14;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(0, 0, p.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#0b1020';
    ctx.font = 'bold 13px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const glyph = p.kind === 'heart' ? '♥' : p.kind === 'shield' ? '⛨' : p.kind === 'overdrive' ? '⚡' : '✹';
    ctx.fillText(glyph, 0, 1);
    ctx.restore();
  }

  // Enemy bullets.
  for (const b of game.enemyBullets) {
    ctx.save();
    ctx.shadowColor = PALETTE.enemyBullet;
    ctx.shadowBlur = 12;
    ctx.fillStyle = PALETTE.enemyBullet;
    ctx.beginPath();
    ctx.arc(b.x, b.y, b.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  // Enemies, each drawn by kind so the player reads the threat at a glance.
  for (const e of game.enemies) {
    drawEnemy(ctx, e);
  }

  // Player bullets.
  for (const b of game.bullets) {
    ctx.save();
    ctx.shadowColor = PALETTE.bullet;
    ctx.shadowBlur = 10;
    ctx.fillStyle = PALETTE.bullet;
    ctx.beginPath();
    ctx.arc(b.x, b.y, b.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  drawPlayer(ctx, game);
  drawParticles(ctx, game);
  drawFloaters(ctx, game);
}

function drawEnemy(ctx, e) {
  const color = ENEMY_COLORS[e.kind] || PALETTE.drifter;
  // Sniper telegraph: a dashed aim line the player can step out of. It brightens
  // once the aim locks (the last part of the charge), warning the shot is coming.
  if (e.kind === 'sniper' && e.chargeState === 'aim') {
    ctx.save();
    const locked = e.chargeTimer >= 0.55;
    ctx.globalAlpha = locked ? 0.75 : 0.35 + 0.2 * Math.sin(e.chargeTimer * 30);
    ctx.strokeStyle = PALETTE.danger;
    ctx.lineWidth = locked ? 2 : 1;
    ctx.setLineDash([10, 8]);
    ctx.beginPath();
    ctx.moveTo(e.x, e.y);
    ctx.lineTo(e.x + Math.cos(e.aimAngle) * 720, e.y + Math.sin(e.aimAngle) * 720);
    ctx.stroke();
    ctx.restore();
  }
  ctx.save();
  ctx.translate(e.x, e.y);
  ctx.shadowColor = color;
  ctx.shadowBlur = e.kind === 'boss' ? 26 : 12;
  ctx.fillStyle = e.flash > 0 ? '#ffffff' : color;
  ctx.strokeStyle = e.flash > 0 ? '#ffffff' : color;
  ctx.lineWidth = 2;
  if (e.kind === 'drifter' || e.kind === 'mini') {
    ctx.beginPath();
    ctx.arc(0, 0, e.radius, 0, Math.PI * 2);
    ctx.fill();
  } else if (e.kind === 'wisp') {
    ctx.beginPath();
    for (let i = 0; i < 3; i++) {
      const a = (i / 3) * Math.PI * 2 + e.wobble;
      ctx.moveTo(0, 0);
      ctx.lineTo(Math.cos(a) * e.radius, Math.sin(a) * e.radius);
    }
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(0, 0, e.radius * 0.45, 0, Math.PI * 2);
    ctx.fill();
  } else if (e.kind === 'spitter') {
    ctx.beginPath();
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2 - Math.PI / 2;
      const r = i % 2 === 0 ? e.radius : e.radius * 0.5;
      ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
    }
    ctx.closePath();
    ctx.fill();
  } else if (e.kind === 'sniper') {
    // A kite with a bright eye; the eye swells while the shot charges.
    ctx.beginPath();
    ctx.moveTo(0, -e.radius);
    ctx.lineTo(e.radius * 0.8, 0);
    ctx.lineTo(0, e.radius);
    ctx.lineTo(-e.radius * 0.8, 0);
    ctx.closePath();
    ctx.fill();
    const charging = e.chargeState === 'aim';
    ctx.fillStyle = charging ? '#ffffff' : 'rgba(0,0,0,0.4)';
    ctx.beginPath();
    ctx.arc(0, 0, e.radius * (charging ? 0.34 + 0.18 * (e.chargeTimer / 0.85) : 0.3), 0, Math.PI * 2);
    ctx.fill();
  } else if (e.kind === 'orbiter') {
    // A spinning triangular ring around a small core.
    ctx.rotate(e.orbitPhase);
    ctx.beginPath();
    for (let i = 0; i < 3; i++) {
      const a = (i / 3) * Math.PI * 2;
      ctx.lineTo(Math.cos(a) * e.radius, Math.sin(a) * e.radius);
    }
    ctx.closePath();
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(0, 0, e.radius * 0.42, 0, Math.PI * 2);
    ctx.fill();
  } else if (e.kind === 'splitter') {
    ctx.beginPath();
    ctx.arc(0, 0, e.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.7)';
    ctx.beginPath();
    ctx.arc(0, 0, e.radius * 0.5, 0, Math.PI * 2);
    ctx.stroke();
  } else if (e.kind === 'brute') {
    const telegraph = e.chargeState === 'windup';
    ctx.rotate(telegraph ? 0 : e.wobble * 0.2);
    ctx.fillRect(-e.radius, -e.radius, e.radius * 2, e.radius * 2);
    if (telegraph) {
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 3;
      ctx.strokeRect(-e.radius - 4, -e.radius - 4, (e.radius + 4) * 2, (e.radius + 4) * 2);
    }
  } else if (e.kind === 'boss') {
    ctx.rotate(e.wobble * 0.4);
    ctx.beginPath();
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      const r = i % 2 === 0 ? e.radius : e.radius * 0.62;
      ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
    }
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.beginPath();
    ctx.arc(0, 0, e.radius * 0.45, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(0, 0, e.radius * 0.16, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();

  // Health bar for tough enemies.
  if ((e.kind === 'brute' || e.kind === 'splitter' || e.kind === 'spitter' || e.kind === 'sniper' || e.kind === 'boss') && e.hp < e.maxHp) {
    const w = e.radius * 2;
    ctx.save();
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillRect(e.x - w / 2, e.y - e.radius - 12, w, 5);
    ctx.fillStyle = color;
    ctx.fillRect(e.x - w / 2, e.y - e.radius - 12, w * Math.max(0, e.hp / e.maxHp), 5);
    ctx.restore();
  }
}

function drawPlayer(ctx, game) {
  const p = game.player;
  if (!p.alive) return;
  ctx.save();
  // Trail.
  for (const t of p.trail) {
    if (t.life <= 0) continue;
    ctx.globalAlpha = Math.max(0, t.life) * 1.6;
    ctx.fillStyle = PALETTE.playerGlow;
    ctx.beginPath();
    ctx.arc(t.x, t.y, 5, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
  ctx.translate(p.x, p.y);
  if (p.invuln > 0 && Math.floor(p.invuln * 20) % 2 === 0) ctx.globalAlpha = 0.45;
  ctx.rotate(p.angle);
  ctx.shadowColor = PALETTE.playerGlow;
  ctx.shadowBlur = 18;
  ctx.fillStyle = p.shieldTime > 0 ? '#b8f7ff' : PALETTE.player;
  ctx.beginPath();
  ctx.moveTo(18, 0);
  ctx.lineTo(-12, -11);
  ctx.lineTo(-6, 0);
  ctx.lineTo(-12, 11);
  ctx.closePath();
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.restore();
  // Shield ring.
  if (p.shieldTime > 0) {
    ctx.save();
    ctx.strokeStyle = 'rgba(127,231,255,0.8)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.radius + 8, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }
}

function drawParticles(ctx, game) {
  for (const p of game.particles) {
    ctx.save();
    ctx.globalAlpha = Math.max(0, p.life / p.maxLife);
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

function drawFloaters(ctx, game) {
  ctx.save();
  ctx.textAlign = 'center';
  ctx.font = '700 15px system-ui, sans-serif';
  for (const f of game.floaters) {
    ctx.globalAlpha = Math.max(0, f.life / f.maxLife);
    ctx.fillStyle = f.color;
    ctx.fillText(f.text, f.x, f.y);
  }
  ctx.restore();
}
