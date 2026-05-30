import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';
import { Water } from './WaterPlus';
import { Sky } from 'three/examples/jsm/objects/Sky';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader';
import Physic from './physics/physic';
import JetSki from './physics/jetski';  // Import your JetSki class
import * as dat from 'dat.gui';  // Import dat.GUI
import { buildTrack, WAYPOINTS } from './game/track.js';
import AIRacer from './game/airacer.js';
import Race from './game/race.js';
import HUD from './game/hud.js';
import Spray from './game/effects.js';
import Screens from './game/screens.js';

let camera, scene, renderer;
let controls, water, sun, sky;
let directionalLight; // Light variable

// --- Race game objects ---
let race, hud, screens, spray;
const aiRacers = [];     // AIRacer instances
const aiStart = [];      // their start positions (for reset)
let camShake = 0;        // current camera shake amount
const BASE_FOV = 55;

const AI_DEFS = [
  { name: 'RIVAL R', color: '#ff5252', hex: 0xff5252, baseSpeed: 41, start: [-40, -20] },
  { name: 'RIVAL B', color: '#5b8cff', hex: 0x5b8cff, baseSpeed: 39, start: [40, -20] },
  { name: 'RIVAL Y', color: '#ffce4d', hex: 0xffce4d, baseSpeed: 43, start: [0, -62] },
];
const maxSteeringAngle = Math.PI / 9;
const raycaster = new THREE.Raycaster();
const gltfloader = new GLTFLoader();
const physics = new Physic();
let steeringAngle = 0;
let throttle = 0;
const planeSize = 10000;

// --- Control + loop state ---
const keys = {};            // currently-held keys (by e.code)
let prevTime = performance.now();
let physicsAccumulator = 0; // for fixed-step integration
let bankAngle = 0;          // visual roll into turns
let pitchAngle = 0;         // visual nose pitch under acceleration

// --- Automatic gearbox ---
// Each gear pushes toward its own top speed (m/s); shifting up gives a fresh
// surge of power, just like a car. `power` is the throttle multiplier feeding
// the engine (terminal speed ~ 36.9 * sqrt(power) at default tuning).
const GEARS = [
  { label: '1', power: 0.06, top: 9 },
  { label: '2', power: 0.24, top: 18 },
  { label: '3', power: 0.58, top: 28 },
  { label: '4', power: 1.18, top: 40 },
  { label: '5', power: 1.99, top: 52 },
];
let gear = 0;          // current gear index
let gearLabel = 'N';   // shown in the HUD (N / R / 1..5)
let turboOn = false;   // Shift held => turbo

const jetSki = new JetSki();

class JET {
  constructor() {
    gltfloader.load('./assets/jetmodel/untitled.glb', (gltf) => {
      gltf.scene.scale.set(0.4, 0.4, 0.4);
      gltf.scene.position.set(5, 0, 10);
      this.jet = gltf.scene;
      scene.add(gltf.scene);
      spawnRacers(gltf.scene); // clone the pristine model BEFORE adding audio
      this.setupAudio();       // (cloning a THREE.Audio child would throw)
    });
  }

  update() {
    if (!this.jet) return;

    // Position from physics, plus a gentle floating bob on the water.
    const t = performance.now() * 0.001;
    const bob = Math.sin(t * 1.5) * 0.6 + Math.sin(t * 0.7 + 1.3) * 0.3;
    this.jet.position.set(
      physics.jetski.position.x,
      physics.jetski.position.y + bob,
      physics.jetski.position.z
    );

    // Yaw from physics; roll/pitch are visual feel layered on top.
    this.jet.rotation.set(
      physics.orientation.x + pitchAngle,
      physics.orientation.y,
      physics.orientation.z + bankAngle
    );
  }

  setupAudio() {
    const listener = new THREE.AudioListener();
    camera.add(listener);

    this.audio = new THREE.Audio(listener);

    const audioLoader = new THREE.AudioLoader();
    audioLoader.load('./assets/audio/videoplayback.mp3', (buffer) => {
      this.audio.setBuffer(buffer);
      this.audio.setLoop(true);
      this.audio.setVolume(0.5);
    });

    this.jet.add(this.audio);
  }

  playAudio() {
    if (this.audio && !this.jetSoundPlaying) {
      this.audio.play();
      this.jetSoundPlaying = true;
    }
  }

  stopAudio() {
    if (this.audio && this.jetSoundPlaying) {
      this.audio.stop();
      this.jetSoundPlaying = false;
    }
  }
}

let jet = new JET();

// Clone the loaded jetski model for each AI opponent and register them.
function spawnRacers(template) {
  if (aiRacers.length) return; // once only
  AI_DEFS.forEach((def) => {
    const mesh = template.clone(true);
    mesh.traverse((o) => {
      if (o.isMesh && o.material) {
        o.material = o.material.clone();
        if (o.material.emissive) {
          o.material.emissive = new THREE.Color(def.hex);
          o.material.emissiveIntensity = 0.35;
        }
      }
    });
    const startPos = new THREE.Vector3(def.start[0], 0, def.start[1]);
    scene.add(mesh);
    const ai = new AIRacer(mesh, startPos, { name: def.name, baseSpeed: def.baseSpeed });
    aiRacers.push(ai);
    aiStart.push(startPos.clone());
    if (race) race.addAI(ai, def.name, def.color);
  });
}

const modes = {
  light: {
    backgroundColor: 0x87CEEB, // Light blue
    directionalLight: {
      color: 0xffffff, // White light
      intensity: 1
    },
    sky: {
      turbidity: 10,
      rayleigh: 2,
      mieCoefficient: 0.005,
      mieDirectionalG: 0.8
    }
  },
  dark: {
    backgroundColor: 0x000000, // Black
    directionalLight: {
      color: 0x444444, // Dim grey
      intensity: 0.5
    },
    sky: {
      turbidity: 2,
      rayleigh: 0.1,
      mieCoefficient: 0.1,
      mieDirectionalG: 0.1
    }
  }
};

let currentMode = 'light'; // Default mode

function applyMode(mode) {
  if (!modes[mode]) return;

  const config = modes[mode];

  // Update background color
  scene.background = new THREE.Color(config.backgroundColor);

  // Update directional light
  directionalLight.color.set(config.directionalLight.color);
  directionalLight.intensity = config.directionalLight.intensity;

  // Update sky
  const skyUniforms = sky.material.uniforms;
  skyUniforms['turbidity'].value = config.sky.turbidity;
  skyUniforms['rayleigh'].value = config.sky.rayleigh;
  skyUniforms['mieCoefficient'].value = config.sky.mieCoefficient;
  skyUniforms['mieDirectionalG'].value = config.sky.mieDirectionalG;
}

function init() {
  renderer = new THREE.WebGLRenderer();
  renderer.setPixelRatio(window.devicePixelRatio);
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.5;
  document.body.appendChild(renderer.domElement);

  scene = new THREE.Scene();

  camera = new THREE.PerspectiveCamera(55, window.innerWidth / window.innerHeight, 1, 20000);
  camera.position.set(30, 30, 100);

  sun = new THREE.Vector3();

  const waterGeometry = new THREE.PlaneGeometry(30000, 30000);
  water = new Water(waterGeometry, {
    textureWidth: 512,
    textureHeight: 512,
    waterNormals: new THREE.TextureLoader().load('assets/waternormals.jpg', function (texture) {
      texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
    }),
    sunDirection: new THREE.Vector3(),
    sunColor: 0xffffff,
    waterColor: 0x44a0e6,
    distortionScale: 3.7,
    fog: scene.fog !== undefined,
    side: THREE.DoubleSide
  });

  water.rotation.x = -Math.PI / 2;
  scene.add(water);

  sky = new Sky();
  sky.scale.setScalar(10000);
  scene.add(sky);

  const skyUniforms = sky.material.uniforms;
  skyUniforms['turbidity'].value = 10;
  skyUniforms['rayleigh'].value = 2;
  skyUniforms['mieCoefficient'].value = 0.005;
  skyUniforms['mieDirectionalG'].value = 0.8;

  const parameters = {
    elevation: 2,
    azimuth: 180
  };

  const pmremGenerator = new THREE.PMREMGenerator(renderer);
  let renderTarget;

  function updateSun() {
    const phi = THREE.MathUtils.degToRad(90 - parameters.elevation);
    const theta = THREE.MathUtils.degToRad(parameters.azimuth);

    sun.setFromSphericalCoords(1, phi, theta);

    sky.material.uniforms['sunPosition'].value.copy(sun);
    water.material.uniforms['sunDirection'].value.copy(sun).normalize();

    if (renderTarget !== undefined) renderTarget.dispose();
    renderTarget = pmremGenerator.fromScene(scene);
    scene.environment = renderTarget.texture;
  }
  updateSun();

  // Add Directional Light
  directionalLight = new THREE.DirectionalLight(0xffffff, 1);
  directionalLight.position.set(5, 5, 15);
  scene.add(directionalLight);

  controls = new OrbitControls(camera, renderer.domElement);
  controls.target.set(0, 10, 0);
  controls.minDistance = -5.0;
  controls.maxDistance = 1000000;
  controls.update();

  window.addEventListener('resize', onWindowResize);
  window.addEventListener('keydown', handleKeyDown);  // Handle light controls in keydown
  window.addEventListener('keyup', handleKeyUp);

  setupGUI();

  applyMode(currentMode); // Apply initial mode

  // --- Race setup ---
  buildTrack(scene);
  hud = new HUD();
  spray = new Spray(scene);
  race = new Race();
  race.setPlayer(() => physics.jetski.position, 'YOU');
  // Register any AI that finished loading before the race existed.
  aiRacers.forEach((ai, i) => race.addAI(ai, AI_DEFS[i].name, AI_DEFS[i].color));

  screens = new Screens({ onStart: startRace, onRestart: restartRace });
  race.onBeep = (label) => screens.beep(label);
  screens.showStart();

  // Hide the old dev overlay & tuning GUI for a clean game screen.
  const overlay = document.getElementById('overlay');
  if (overlay) overlay.style.display = 'none';
  controls.enabled = false;
}

// Reset the player jetski to the start line.
function resetPlayer() {
  physics.jetski.position.set(0, 0, 0);
  physics.position.set(0, 0, 0);
  physics.jetski.velocity.set(0, 0, 0);
  physics.velocity.set(0, 0, 0);
  physics.acceleration.set(0, 0, 0);
  physics.angularVelocity.set(0, 0, 0);
  physics.orientation.set(0, 0, 0);
  throttle = 0; steeringAngle = 0; gear = 0; gearLabel = 'N';
  bankAngle = 0; pitchAngle = 0;
}

function resetAI() {
  aiRacers.forEach((ai, i) => {
    ai.pos.copy(aiStart[i]);
    ai.yaw = 0; ai.speed = 0; ai.bank = 0;
    ai.nextWP = 1; ai.laps = 0; ai.finished = false; ai.finishTime = 0;
    ai.mesh.position.copy(aiStart[i]);
    ai.mesh.rotation.set(0, 0, 0);
  });
}

function startRace() {
  resetPlayer();
  resetAI();
  race.start();            // begins the 3-2-1 countdown
  screens.hideAll();
  prevTime = performance.now();
  physicsAccumulator = 0;
}

function restartRace() {
  startRace();
}

function handleKeyDown(e) {
  keys[e.code] = true;

  // One-shot toggles (use e.key so layout/case is consistent)
  const k = e.key.toLowerCase();
  if (k === 'l') { // Toggle light
    directionalLight.visible = !directionalLight.visible;
  }
  if (k === 'i') { // Increase light intensity
    directionalLight.intensity += 1;
  }
  if (k === 'k') { // Decrease light intensity
    directionalLight.intensity -= 1;
  }
  if (k === 'm' && !e.repeat) { // Toggle day/night mode
    currentMode = currentMode === 'light' ? 'dark' : 'light';
    applyMode(currentMode);
  }
  if (k === ' ' && !e.repeat) { // Space starts the race from menu / results
    e.preventDefault();
    if (race && race.state === 'menu') startRace();
    else if (race && race.state === 'finished') restartRace();
  }
}

function handleKeyUp(e) {
  keys[e.code] = false;
}

// Automatic gearbox: shift up near the top of the current gear, shift down
// (with hysteresis) when speed drops. Resets to neutral when not accelerating.
function updateGearbox(speed, forward) {
  if (!forward) { gear = 0; return; }
  if (gear < GEARS.length - 1 && speed > GEARS[gear].top * 0.92) {
    gear++;
  } else if (gear > 0 && speed < GEARS[gear - 1].top * 0.8) {
    gear--;
  }
}

// Smoothly resolve held keys into throttle/steering each frame.
function updateControls(dt) {
  const forward = keys['ArrowUp'] || keys['KeyW'];
  const reverse = keys['ArrowDown'] || keys['KeyS'];
  const left    = keys['ArrowLeft'] || keys['KeyA'];
  const right   = keys['ArrowRight'] || keys['KeyD'];
  turboOn = (keys['ShiftLeft'] || keys['ShiftRight']) && forward;

  const speed = physics.jetski.velocity.length();

  // Throttle target comes from the current gear (+ turbo), or reverse.
  let throttleTarget = 0;
  if (forward) {
    updateGearbox(speed, true);
    throttleTarget = GEARS[gear].power * (turboOn ? 1.6 : 1);
    gearLabel = GEARS[gear].label;
  } else if (reverse) {
    gear = 0;
    gearLabel = 'R';
    throttleTarget = -0.5;
  } else {
    gear = 0;
    gearLabel = 'N';
  }
  throttle += (throttleTarget - throttle) * Math.min(1, dt * 6);

  // Engine note rises with revs inside a gear, drops on each upshift.
  if (jet && jet.audio) {
    const rev = forward ? THREE.MathUtils.clamp(speed / GEARS[gear].top, 0.2, 1) : 0.25;
    jet.audio.setPlaybackRate(0.85 + rev * 0.9 + (turboOn ? 0.3 : 0));
  }

  // Steering: build toward max while held, auto-center on release
  let steerTarget = 0;
  if (left) steerTarget = -maxSteeringAngle;
  else if (right) steerTarget = maxSteeringAngle;
  steeringAngle += (steerTarget - steeringAngle) * Math.min(1, dt * 6);

  // Visual lean: roll into the turn, scaled by how fast we're going
  const bankTarget = -steeringAngle * Math.min(speed / 12, 1) * 1.3;
  bankAngle += (bankTarget - bankAngle) * Math.min(1, dt * 5);

  // Visual pitch: nose lifts a touch under forward acceleration
  const pitchTarget = THREE.MathUtils.clamp(-physics.acceleration.z * 0.012, -0.25, 0.25);
  pitchAngle += (pitchTarget - pitchAngle) * Math.min(1, dt * 3);
}

function setupGUI() {
  const gui = new dat.GUI();
  gui.domElement.style.display = 'none'; // hidden by default for a clean game UI

  const params = jetSki.getParams();
  const guiParams = {
    mass: params.mass,
    dragCon: params.dragCon,
    A: params.A,
    powerEngine: params.powerEngine,
    length: params.length,
    startRace: () => { if (race) startRace(); },
    mode: 'light'
  };

  gui.add(guiParams, 'mass', 50, 2000).onChange(value => jetSki.setParams({ ...jetSki.getParams(), mass: value }));
  gui.add(guiParams, 'dragCon', 0.1, 1.0).onChange(value => jetSki.setParams({ ...jetSki.getParams(), dragCon: value }));
  gui.add(guiParams, 'A', 0.5, 5.0).onChange(value => jetSki.setParams({ ...jetSki.getParams(), A: value }));
  gui.add(guiParams, 'powerEngine', 50000, 100000).onChange(value => jetSki.setParams({ ...jetSki.getParams(), powerEngine: value }));
  gui.add(guiParams, 'length', 1.0, 10.0).onChange(value => jetSki.setParams({ ...jetSki.getParams(), length: value }));
  gui.add(guiParams, 'startRace');
  gui.add(guiParams, 'mode', ['light', 'dark']).onChange(value => { currentMode = value; applyMode(currentMode); });
}

function onWindowResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}

let lastState = 'menu';

// Main loop: drives the race state machine, physics, effects, HUD and camera.
function animate() {
  requestAnimationFrame(animate);

  const now = performance.now();
  let dt = (now - prevTime) / 1000;
  prevTime = now;
  dt = Math.min(dt, 0.05); // clamp to avoid huge steps after a stall

  const state = race ? race.state : 'menu';

  // Advance race timing / countdown / AI.
  if (state === 'countdown' || state === 'racing') race.update(dt);

  if (state === 'racing') {
    updateControls(dt);

    // Fixed-step integration => frame-rate independent, stable physics.
    physicsAccumulator += dt;
    const step = physics.deltaT;
    let steps = 0;
    while (physicsAccumulator >= step && steps < 8) {
      physics.update(steeringAngle, throttle);
      physicsAccumulator -= step;
      steps++;
    }
    if (jet) jet.update();
    emitSpray();
  }

  if (spray) spray.update(dt);

  handleStateTransitions(state);
  updateScreens(state);
  updateCamera(dt, state);
  drawHUD(state);

  render();
}

function handleStateTransitions(state) {
  if (state !== lastState) {
    if (state === 'racing' && lastState === 'countdown') jet.playAudio();
    if (state === 'finished') {
      jet.stopAudio();
      screens.showResults(race.standings(), race.player);
    }
    lastState = state;
  }
}

function updateScreens(state) {
  if (state === 'countdown') screens.showCountdown(race.countdownLabel);
  else if (state === 'racing') screens.hideCountdown();
}

function drawHUD(state) {
  if (!hud) return;
  if (state === 'menu') { hud.clear(); return; }
  const speed = physics.jetski.velocity.length();
  hud.draw({
    speedKmh: speed * 3.6,
    gear: gearLabel,
    turbo: turboOn,
    lap: race.playerLap(),
    totalLaps: race.totalLaps,
    position: race.playerPosition(),
    totalRacers: race.racers.length,
    timeMs: race.timeMs,
    racers: race.racers,
  });
}

// Spray a burst of wake particles from the jetski's stern, scaled by speed.
function emitSpray() {
  if (!jet.jet || !spray) return;
  const speed = physics.jetski.velocity.length();
  const yaw = physics.orientation.y;
  const forward = new THREE.Vector3(Math.sin(yaw), 0, Math.cos(yaw));
  const back = forward.clone().multiplyScalar(-1);
  const side = new THREE.Vector3(-forward.z, 0, forward.x);
  const stern = physics.jetski.position.clone().add(back.clone().multiplyScalar(6));
  const turnAmt = Math.min(Math.abs(steeringAngle) / maxSteeringAngle, 1);
  const intensity = THREE.MathUtils.clamp(speed / 26, 0, 1) * (turboOn ? 1.3 : 1) + turnAmt * 0.4;
  if (intensity > 0.05) spray.emit(stern, back, side, Math.min(intensity, 1.4));
}

function render() {
  water.material.uniforms['time'].value += 1.0 / 60.0;
  renderer.render(scene, camera);
}

function setFov(target, dt) {
  camera.fov += (target - camera.fov) * Math.min(1, dt * 3);
  camera.updateProjectionMatrix();
}

// Cinematic camera: slow orbit in the menu, dynamic chase cam while racing
// with speed-driven FOV and shake.
function updateCamera(dt, state) {
  if (!jet.jet) return;
  const p = physics.jetski.position;

  if (state === 'menu') {
    const t = performance.now() * 0.0002;
    const R = 150, H = 70;
    const desired = new THREE.Vector3(p.x + Math.sin(t) * R, H, p.z + Math.cos(t) * R);
    camera.position.lerp(desired, Math.min(1, dt * 2));
    camera.lookAt(p.x, 8, p.z);
    setFov(BASE_FOV, dt);
    return;
  }

  const yaw = physics.orientation.y;
  const quat = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, yaw, 0));
  const worldPosition = new THREE.Vector3(p.x, p.y, p.z);
  const offset = new THREE.Vector3(0, 55, -150).applyQuaternion(quat);
  const desired = worldPosition.clone().add(offset);

  const speed = physics.jetski.velocity.length();
  const targetShake = state === 'racing' ? (speed / 52) * (turboOn ? 2.4 : 1.2) : 0;
  camShake += (targetShake - camShake) * Math.min(1, dt * 4);
  desired.x += (Math.random() - 0.5) * camShake;
  desired.y += (Math.random() - 0.5) * camShake;

  camera.position.lerp(desired, Math.min(1, dt * (state === 'countdown' ? 3.5 : 2.6)));
  const ahead = new THREE.Vector3(0, 8, 40).applyQuaternion(quat);
  camera.lookAt(worldPosition.clone().add(ahead));

  const fovTarget = BASE_FOV + (state === 'racing' ? (speed / 52) * 22 + (turboOn ? 6 : 0) : 0);
  setFov(fovTarget, dt);
}

init();
animate();

