import { WAYPOINTS } from './track.js';

// Canvas-based race HUD: analog speedometer + gear, lap/time/position panel,
// and a live minimap. Drawn every frame on a transparent overlay canvas.
export default class HUD {
  constructor() {
    const c = document.createElement('canvas');
    c.id = 'hud';
    Object.assign(c.style, {
      position: 'fixed', inset: '0', width: '100%', height: '100%',
      pointerEvents: 'none', zIndex: '50',
    });
    document.body.appendChild(c);
    this.canvas = c;
    this.ctx = c.getContext('2d');
    this.resize();
    window.addEventListener('resize', () => this.resize());

    // Precompute the minimap track bounds.
    const xs = WAYPOINTS.map((w) => w.x);
    const zs = WAYPOINTS.map((w) => w.z);
    this.bounds = {
      minX: Math.min(...xs), maxX: Math.max(...xs),
      minZ: Math.min(...zs), maxZ: Math.max(...zs),
    };
  }

  resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.canvas.width = window.innerWidth * dpr;
    this.canvas.height = window.innerHeight * dpr;
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.w = window.innerWidth;
    this.h = window.innerHeight;
  }

  // data: { speedKmh, gear, turbo, lap, totalLaps, position, totalRacers, timeMs, racers }
  draw(data) {
    const ctx = this.ctx;
    ctx.clearRect(0, 0, this.w, this.h);
    this._panel(ctx, data);
    this._speedo(ctx, data);
    this._minimap(ctx, data);
  }

  _panel(ctx, d) {
    ctx.save();
    ctx.font = '700 15px Arial';
    const x = 22, y = 24, lh = 30, w = 200;
    this._roundRect(ctx, x - 12, y - 18, w, lh * 3 + 16, 10);
    ctx.fillStyle = 'rgba(8,18,30,0.55)';
    ctx.fill();

    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#cfe8ff';
    ctx.font = '600 13px Arial';
    ctx.fillText('LAP', x, y);
    ctx.fillText('TIME', x, y + lh);
    ctx.fillText('POS', x, y + lh * 2);

    ctx.fillStyle = '#ffffff';
    ctx.font = '800 20px Arial';
    ctx.textAlign = 'right';
    const rx = x + w - 28;
    ctx.fillText(`${d.lap}/${d.totalLaps}`, rx, y);
    ctx.fillText(formatTime(d.timeMs), rx, y + lh);
    ctx.fillStyle = d.position === 1 ? '#ffd54a' : '#ffffff';
    ctx.fillText(`${ordinal(d.position)}/${d.totalRacers}`, rx, y + lh * 2);
    ctx.restore();
  }

  _speedo(ctx, d) {
    const r = 92;
    const cx = this.w - r - 40;
    const cy = this.h - r - 36;
    const start = Math.PI * 0.78;
    const end = Math.PI * 2.22;
    const maxKmh = 220;

    ctx.save();
    // Dial background
    ctx.beginPath();
    ctx.arc(cx, cy, r + 12, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(8,18,30,0.55)';
    ctx.fill();

    // Track arc
    ctx.lineWidth = 9;
    ctx.strokeStyle = 'rgba(255,255,255,0.18)';
    ctx.beginPath();
    ctx.arc(cx, cy, r, start, end);
    ctx.stroke();

    // Filled arc up to current speed
    const frac = Math.min(d.speedKmh / maxKmh, 1);
    const ang = start + (end - start) * frac;
    const grad = ctx.createLinearGradient(cx - r, cy, cx + r, cy);
    grad.addColorStop(0, '#36d1ff');
    grad.addColorStop(0.6, '#46ff9c');
    grad.addColorStop(1, '#ff5a3c');
    ctx.strokeStyle = d.turbo ? '#ff8a2a' : grad;
    ctx.beginPath();
    ctx.arc(cx, cy, r, start, ang);
    ctx.stroke();

    // Needle
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx + Math.cos(ang) * (r - 10), cy + Math.sin(ang) * (r - 10));
    ctx.stroke();

    // Digital readout
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ffffff';
    ctx.font = '800 30px Arial';
    ctx.fillText(`${Math.round(d.speedKmh)}`, cx, cy + 6);
    ctx.fillStyle = '#9fbdd6';
    ctx.font = '600 12px Arial';
    ctx.fillText('km/h', cx, cy + 26);

    // Gear badge
    ctx.fillStyle = d.turbo ? '#ff8a2a' : '#1b2a3a';
    this._roundRect(ctx, cx - 22, cy - r - 2, 44, 30, 7);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.font = '800 20px Arial';
    ctx.fillText(String(d.gear), cx, cy - r + 14);
    if (d.turbo) {
      ctx.fillStyle = '#ff8a2a';
      ctx.font = '800 13px Arial';
      ctx.fillText('TURBO', cx, cy - r - 14);
    }
    ctx.restore();
  }

  _minimap(ctx, d) {
    const size = 150;
    const pad = 22;
    const x0 = this.w - size - pad;
    const y0 = pad;

    ctx.save();
    this._roundRect(ctx, x0 - 8, y0 - 8, size + 16, size + 16, 10);
    ctx.fillStyle = 'rgba(8,18,30,0.5)';
    ctx.fill();

    const b = this.bounds;
    const spanX = b.maxX - b.minX || 1;
    const spanZ = b.maxZ - b.minZ || 1;
    const span = Math.max(spanX, spanZ) * 1.15;
    const map = (p) => ({
      x: x0 + size / 2 + ((p.x - (b.minX + spanX / 2)) / span) * size,
      y: y0 + size / 2 + ((p.z - (b.minZ + spanZ / 2)) / span) * size,
    });

    // Track outline
    ctx.beginPath();
    WAYPOINTS.forEach((w, i) => {
      const p = map(w);
      i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y);
    });
    ctx.closePath();
    ctx.strokeStyle = 'rgba(255,255,255,0.6)';
    ctx.lineWidth = 3;
    ctx.stroke();

    // Start/finish dot
    const s = map(WAYPOINTS[0]);
    ctx.fillStyle = '#22ff66';
    ctx.beginPath(); ctx.arc(s.x, s.y, 4, 0, Math.PI * 2); ctx.fill();

    // Racers
    for (const r of d.racers) {
      const p = map(r.getPos());
      ctx.beginPath();
      ctx.arc(p.x, p.y, r.isPlayer ? 5 : 4, 0, Math.PI * 2);
      ctx.fillStyle = r.color;
      ctx.fill();
      if (r.isPlayer) { ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.stroke(); }
    }
    ctx.restore();
  }

  _roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  clear() { this.ctx.clearRect(0, 0, this.w, this.h); }
}

export function formatTime(ms) {
  const total = Math.max(0, ms);
  const m = Math.floor(total / 60000);
  const s = Math.floor((total % 60000) / 1000);
  const cs = Math.floor((total % 1000) / 10);
  return `${m}:${String(s).padStart(2, '0')}.${String(cs).padStart(2, '0')}`;
}

function ordinal(n) {
  if (n === 1) return '1st';
  if (n === 2) return '2nd';
  if (n === 3) return '3rd';
  return `${n}th`;
}
