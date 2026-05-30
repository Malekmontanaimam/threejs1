import { formatTime } from './hud.js';

// All full-screen DOM overlays: start menu, 3-2-1-GO countdown, and the
// results board. Also owns a tiny WebAudio beeper for the countdown.
export default class Screens {
  constructor({ onStart, onRestart }) {
    this.onStart = onStart;
    this.onRestart = onRestart;

    this.root = document.createElement('div');
    this.root.id = 'screens';
    document.body.appendChild(this.root);

    this._buildStart();
    this._buildCountdown();
    this._buildResults();

    this.audioCtx = null;
  }

  _buildStart() {
    const s = document.createElement('div');
    s.className = 'screen start-screen';
    s.innerHTML = `
      <div class="title">JETSKI <span>GP</span></div>
      <div class="subtitle">Race 3 opponents across the bay</div>
      <button class="btn" id="startBtn">START RACE</button>
      <div class="controls">
        <b>W / ↑</b> accelerate &nbsp;·&nbsp; <b>A·D / ←→</b> steer &nbsp;·&nbsp;
        <b>Shift</b> turbo &nbsp;·&nbsp; <b>S / ↓</b> reverse
      </div>`;
    this.root.appendChild(s);
    this.startScreen = s;
    s.querySelector('#startBtn').addEventListener('click', () => this.onStart());
  }

  _buildCountdown() {
    const c = document.createElement('div');
    c.className = 'screen countdown hidden';
    c.innerHTML = `<div class="count-num"></div>`;
    this.root.appendChild(c);
    this.countdown = c;
    this.countNum = c.querySelector('.count-num');
  }

  _buildResults() {
    const r = document.createElement('div');
    r.className = 'screen results-screen hidden';
    r.innerHTML = `
      <div class="title">RESULTS</div>
      <ol class="standings" id="standingsList"></ol>
      <button class="btn" id="againBtn">RACE AGAIN</button>`;
    this.root.appendChild(r);
    this.results = r;
    this.standingsList = r.querySelector('#standingsList');
    r.querySelector('#againBtn').addEventListener('click', () => this.onRestart());
  }

  showStart() {
    this.startScreen.classList.remove('hidden');
    this.countdown.classList.add('hidden');
    this.results.classList.add('hidden');
  }

  hideAll() {
    this.startScreen.classList.add('hidden');
    this.countdown.classList.add('hidden');
    this.results.classList.add('hidden');
  }

  showCountdown(label) {
    this.startScreen.classList.add('hidden');
    this.results.classList.add('hidden');
    this.countdown.classList.remove('hidden');
    if (this.countNum.textContent !== label) {
      this.countNum.textContent = label;
      this.countNum.classList.toggle('go', label === 'GO!');
      // retrigger pop animation
      this.countNum.style.animation = 'none';
      void this.countNum.offsetWidth;
      this.countNum.style.animation = '';
    }
  }

  hideCountdown() { this.countdown.classList.add('hidden'); }

  showResults(standings, playerWrapper) {
    this.results.classList.remove('hidden');
    this.standingsList.innerHTML = standings.map((r, i) => {
      const time = r.finished ? formatTime(r.finishTime) : 'DNF';
      const me = r === playerWrapper ? ' me' : '';
      return `<li class="${me}"><span class="pos">${i + 1}</span>
        <span class="nm">${r.name}</span><span class="tm">${time}</span></li>`;
    }).join('');
  }

  beep(label) {
    try {
      if (!this.audioCtx) this.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      const ctx = this.audioCtx;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const go = label === 'GO!';
      osc.frequency.value = go ? 880 : 440;
      gain.gain.value = 0.0001;
      osc.connect(gain); gain.connect(ctx.destination);
      const t = ctx.currentTime;
      gain.gain.exponentialRampToValueAtTime(0.25, t + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + (go ? 0.5 : 0.18));
      osc.start(t); osc.stop(t + (go ? 0.55 : 0.2));
    } catch (e) { /* audio optional */ }
  }
}
