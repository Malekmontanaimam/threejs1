import * as THREE from 'three';
import { WAYPOINTS, CHECKPOINT_RADIUS } from './track.js';

// Lightweight kinematic opponent: steers toward the next waypoint, slows for
// sharp turns, and is tuned by a per-racer skill so the field spreads out.
export default class AIRacer {
  constructor(mesh, startPos, opts = {}) {
    this.mesh = mesh;
    this.pos = startPos.clone();
    this.yaw = 0; // facing +z
    this.speed = 0;
    this.name = opts.name || 'CPU';

    this.baseSpeed = opts.baseSpeed ?? 40;   // m/s cruising speed
    this.maxTurn = opts.maxTurn ?? 1.3;      // rad/s
    this.accel = opts.accel ?? 1.6;          // how fast it reaches target speed

    // Race progress tracking (shared scheme with the player).
    this.nextWP = 1;
    this.laps = 0;
    this.finished = false;
    this.finishTime = 0;

    this.bank = 0;
  }

  update(dt) {
    if (this.finished) {
      // Coast to a stop after crossing the line.
      this.speed += (0 - this.speed) * Math.min(1, dt * 1.5);
    } else {
      const target = WAYPOINTS[this.nextWP];
      const dx = target.x - this.pos.x;
      const dz = target.z - this.pos.z;
      const desiredYaw = Math.atan2(dx, dz);

      // Turn toward the target, limited by max turn rate.
      const diff = shortestAngle(desiredYaw - this.yaw);
      const turn = THREE.MathUtils.clamp(diff, -this.maxTurn * dt, this.maxTurn * dt);
      this.yaw += turn;

      // Ease off the throttle when we have to turn hard.
      const turnPenalty = THREE.MathUtils.clamp(Math.abs(diff) / (Math.PI / 2), 0, 1);
      const speedTarget = this.baseSpeed * (1 - 0.55 * turnPenalty);
      this.speed += (speedTarget - this.speed) * Math.min(1, dt * this.accel);

      // Advance along the heading.
      this.pos.x += Math.sin(this.yaw) * this.speed * dt;
      this.pos.z += Math.cos(this.yaw) * this.speed * dt;

      this._checkpoint();
      this.bank += (-THREE.MathUtils.clamp(diff, -0.5, 0.5) - this.bank) * Math.min(1, dt * 4);
    }

    // Place the model with a gentle bob.
    const t = performance.now() * 0.001;
    const bob = Math.sin(t * 1.5 + this.pos.x) * 0.5;
    this.mesh.position.set(this.pos.x, bob, this.pos.z);
    this.mesh.rotation.set(0, this.yaw, this.bank);
  }

  _checkpoint() {
    const target = WAYPOINTS[this.nextWP];
    if (this.pos.distanceTo(target) < CHECKPOINT_RADIUS) {
      if (this.nextWP === 0) this.laps++;
      this.nextWP = (this.nextWP + 1) % WAYPOINTS.length;
    }
  }

  getPos() { return this.pos; }
}

export function shortestAngle(a) {
  while (a > Math.PI) a -= Math.PI * 2;
  while (a < -Math.PI) a += Math.PI * 2;
  return a;
}
