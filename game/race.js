import { WAYPOINTS, LAPS, CHECKPOINT_RADIUS } from './track.js';

const N = WAYPOINTS.length;

// Owns the whole race: countdown, AI + player progress, lap counting,
// live positions and timing. main.js reads its public fields each frame.
export default class Race {
  constructor() {
    this.state = 'menu';       // menu | countdown | racing | finished
    this.totalLaps = LAPS;
    this.timeMs = 0;
    this.countdownTimer = 0;
    this.countdownLabel = '';
    this.onBeep = null;        // (label) => void, fired on each countdown tick

    this.racers = [];          // wrapper objects (player + AI)
    this.player = null;
  }

  setPlayer(getPos, name = 'YOU') {
    this.player = {
      isPlayer: true, name, color: '#33ddff',
      getPos, ai: null, nextWP: 1, laps: 0, finished: false, finishTime: 0,
    };
    this.racers.push(this.player);
  }

  addAI(ai, name, color) {
    this.racers.push({
      isPlayer: false, name, color,
      getPos: () => ai.pos, ai, nextWP: 1, laps: 0, finished: false, finishTime: 0,
    });
  }

  start() {
    this.state = 'countdown';
    this.countdownTimer = 0;
    this.countdownLabel = '';
    this.timeMs = 0;
    for (const r of this.racers) {
      r.nextWP = 1; r.laps = 0; r.finished = false; r.finishTime = 0;
    }
  }

  update(dt) {
    if (this.state === 'countdown') {
      this.countdownTimer += dt;
      const label = this._countdownLabel(this.countdownTimer);
      if (label !== this.countdownLabel) {
        this.countdownLabel = label;
        if (this.onBeep) this.onBeep(label);
      }
      if (this.countdownTimer >= 3.9) this.state = 'racing';
      return;
    }

    if (this.state !== 'racing') return;

    this.timeMs += dt * 1000;

    // AI move; AI tracks its own laps/nextWP, mirror onto the wrapper.
    for (const r of this.racers) {
      if (r.ai) {
        r.ai.update(dt);
        r.nextWP = r.ai.nextWP;
        r.laps = r.ai.laps;
        if (!r.finished && r.laps >= this.totalLaps) {
          r.finished = true; r.finishTime = this.timeMs;
          r.ai.finished = true; r.ai.finishTime = this.timeMs;
        }
      } else {
        this._advancePlayer(r);
      }
    }

    if (this.player.finished) {
      this.state = 'finished';
    }
  }

  _advancePlayer(r) {
    if (r.finished) return;
    const target = WAYPOINTS[r.nextWP];
    if (r.getPos().distanceTo(target) < CHECKPOINT_RADIUS) {
      if (r.nextWP === 0) r.laps++;
      r.nextWP = (r.nextWP + 1) % N;
      if (r.laps >= this.totalLaps) {
        r.finished = true;
        r.finishTime = this.timeMs;
      }
    }
  }

  _countdownLabel(t) {
    if (t < 1) return '3';
    if (t < 2) return '2';
    if (t < 3) return '1';
    return 'GO!';
  }

  // Progress metric so racers can be ranked from leader to last.
  _progress(r) {
    const stepsDone = (r.nextWP - 1 + N) % N;
    const dist = r.getPos().distanceTo(WAYPOINTS[r.nextWP]);
    return r.laps * 1e6 + stepsDone * 1e4 - dist;
  }

  standings() {
    return [...this.racers].sort((a, b) => {
      // Finished racers rank by finish time; otherwise by track progress.
      if (a.finished && b.finished) return a.finishTime - b.finishTime;
      if (a.finished) return -1;
      if (b.finished) return 1;
      return this._progress(b) - this._progress(a);
    });
  }

  playerPosition() {
    return this.standings().indexOf(this.player) + 1;
  }

  playerLap() {
    return Math.min(this.player.laps + 1, this.totalLaps);
  }
}
