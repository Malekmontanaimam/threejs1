import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';
import { Water } from './WaterPlus';
import { Sky } from 'three/examples/jsm/objects/Sky';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader';
import Physic from './physics/physic';
import JetSki from './physics/jetski';  // Import your JetSki class
import * as dat from 'dat.gui';  // Import dat.GUI

let camera, scene, renderer;
let controls, water, sun;
const steeringRate = Math.PI / 180;
const maxSteeringAngle = Math.PI / 9;
const raycaster = new THREE.Raycaster();
const gltfloader = new GLTFLoader();
const physics = new Physic();
let steeringAngle = 0;
let throttle = 0.8;
const planeSize = 10000;
let isRunning = false; 

const jetSki = new JetSki();

class JET {
  constructor() {
    gltfloader.load('./assets/jetmodel/untitled.glb', (gltf) => {
      gltf.scene.scale.set(0.4, 0.4, 0.4);
      gltf.scene.position.set(5, 0, 10);
      this.jet = gltf.scene;
      scene.add(gltf.scene);
      this.setupAudio(); 
      animate();  // Start animation loop
    });
  }

  update() {
    if (this.jet) {
      this.jet.position.copy(physics.jetski.position);
      this.jet.rotation.copy(physics.orientation);
    }
  }
  setupAudio() {
    // Create an AudioListener and add it to the camera
    const listener = new THREE.AudioListener();
    camera.add(listener);

    // Create a global audio source
    this.audio = new THREE.Audio(listener);

    // Load a sound and set it as the Audio object's buffer
    const audioLoader = new THREE.AudioLoader();
    audioLoader.load('./assets/audio/videoplayback.mp3', (buffer) => {
      this.audio.setBuffer(buffer);
      this.audio.setLoop(true);
      this.audio.setVolume(0.5);  // Adjust volume as needed
    });

    // Attach the audio to the jet, but don't play it yet
    this.jet.add(this.audio);
  }
  playAudio() {
    if (this.audio && !this.jetSoundPlaying) { // Play only if not already playing
      this.audio.play();
      this.jetSoundPlaying = true;
    }
  }

  stopAudio() {
    if (this.audio && this.jetSoundPlaying) { // Stop if currently playing
      this.audio.stop();
      this.jetSoundPlaying = false;
    }
  }
}

let jet = new JET();

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

  const sky = new Sky();
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

  controls = new OrbitControls(camera, renderer.domElement);
  controls.target.set(0, 10, 0);
  controls.minDistance = -5.0;
  controls.maxDistance = 1000000;
  controls.update();

  window.addEventListener('resize', onWindowResize);
  window.addEventListener('keydown', handleKeyDown);
  window.addEventListener('keyup', handleKeyUp);

  setupGUI();
}

function handleKeyDown(e) {
  if (e.key === "ArrowUp") {
    throttle = 1;
  }
  if (e.key === "ArrowDown") {
    throttle = 0;
  }
  if (e.key === "ArrowRight") {
    steeringAngle = steeringRate;
    if (steeringAngle > maxSteeringAngle) {
      steeringAngle = maxSteeringAngle;
    }
  }
  if (e.key === "ArrowLeft") {
    steeringAngle = -steeringRate;
    if (steeringAngle < -maxSteeringAngle) {
      steeringAngle = -maxSteeringAngle;
    }
  }
}

function handleKeyUp(e) {
  if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
    if (steeringAngle > 0) {
      steeringAngle -= steeringRate;
      if (steeringAngle < 0) {
        steeringAngle = 0;
      }
    } else if (steeringAngle < 0) {
      steeringAngle += steeringRate;
      if (steeringAngle > 0) {
        steeringAngle = 0;
      }
    }
  }
}

function setupGUI() {
  const gui = new dat.GUI();

  const params = jetSki.getParams();

  const guiParams = {
    mass: params.mass,
    dragCon: params.dragCon,
    A: params.A,
    powerEngine: params.powerEngine,
    length: params.length,
    startSimulation: function () {
      isRunning = true;
      jet.playAudio();
      animate();  // Start animation loop
    },
    stopSimulation: function () {
      jet.stopAudio();
      isRunning = false;  // Stop animation loop
    }
  };

  gui.add(guiParams, 'mass', 50, 2000).onChange(value => jetSki.setParams({
    ...jetSki.getParams(), mass: value }));
 gui.add(guiParams, 'dragCon', 0.1, 1.0).onChange(value => jetSki.setParams({ ...jetSki.getParams(), dragCon: value }));
 gui.add(guiParams, 'A', 0.5, 5.0).onChange(value => jetSki.setParams({ ...jetSki.getParams(), A: value }));
 gui.add(guiParams, 'powerEngine', 50000, 100000).onChange(value => jetSki.setParams({ ...jetSki.getParams(), powerEngine: value }));
 gui.add(guiParams, 'length', 1.0, 10.0).onChange(value => jetSki.setParams({ ...jetSki.getParams(), length: value }));
gui.add(guiParams, 'startSimulation');
  gui.add(guiParams, 'stopSimulation');
}

function onWindowResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}

function animate() {
  if (!isRunning) return;

  render();
  updateCamera();
  controls.update();

  physics.update(steeringAngle, throttle);

  if (jet) jet.update();

  document.getElementById('acceleration').innerText = `Acceleration: (${physics.acceleration.z.toFixed(2)})`;
  document.getElementById('position').innerText = `Position: (${physics.jetski.position.x.toFixed(2)}, ${physics.jetski.position.y.toFixed(2)}, ${physics.jetski.position.z.toFixed(2)})`;
  document.getElementById('thrust').innerText = `Thrust: ${physics.thrust.powerEngine}, ${physics.thrust.velocityFan.x}`;
  document.getElementById('velocity').innerText = `Velocity: (${physics.jetski.velocity.x.toFixed(2)}, ${physics.velocity.y.toFixed(2)}, ${physics.jetski.velocity.z.toFixed(2)})`;
  document.getElementById('drag').innerText = `Drag: (${physics.drag.coefficient}, ${physics.drag.area}, ${physics.drag.fluidDensity}, ${physics.drag.drag_force.z})`;
  document.getElementById('deltaT').innerText = `Delta T: ${physics.deltaT}`;

  requestAnimationFrame(animate);
}

function render() {
  water.material.uniforms['time'].value += 1.0 / 60.0;
  renderer.render(scene, camera);
}

function updateCamera() {
  if (jet.jet) {
    const offset = new THREE.Vector3(100, 100, 300);
    const worldPosition = new THREE.Vector3();
    jet.jet.getWorldPosition(worldPosition);
    const offsetRotated = offset.clone().applyQuaternion(jet.jet.quaternion);
    const targetPosition = worldPosition.clone().add(offsetRotated);
    camera.position.copy(targetPosition);
    camera.lookAt(worldPosition);
  }
}

init();
