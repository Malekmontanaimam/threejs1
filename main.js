import './style.css';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';
import { Water } from './WaterPlus';
import { Sky } from 'three/examples/jsm/objects/Sky';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader';
import Physic from './physics/Physic';
let camera, scene, renderer;
let controls, water, sun;

const raycaster = new THREE.Raycaster();
const gltfloader = new GLTFLoader();
const physics = new Physic();

const planeSize = 10000; // Define the size of the water plane

class JET {
  constructor() {
    gltfloader.load('./assets/jetmodel/scene.gltf', (gltf) => {
      gltf.scene.scale.set(0.4, 0.4, 0.4);
      gltf.scene.position.set(5, 0, 10); // Initial position on the water surface

      this.speed = {
        vel: 0,
        rot: 0
      };

      gltf.scene.rotation.y = 9.5;

      this.jet = gltf.scene;
      scene.add(gltf.scene);
      animate();
    });
  }

  stop() {
    this.speed.rot = 0;
    this.speed.vel = 0;
  }

  update() {
    if (this.jet) {
      this.jet.rotation.y += this.speed.rot;
      this.jet.translateZ(this.speed.vel);

      // Adjust the jetski height based on the water surface
      const waveHeight = getWaveHeight(this.jet.position.x, this.jet.position.z);
      this.jet.position.y = waveHeight + 2; // Adjust to keep the jetski above the water surface

      // Check if the jet ski is at the edge of the plane
      if (Math.abs(this.jet.position.x) > planeSize / 2 || Math.abs(this.jet.position.z) > planeSize / 2) {
        // Refresh the page if the jet ski is at the edge of the plane
        window.location.reload();
      }
    }
  }
}

let jet = new JET();

function getWaveHeight(x, z) {
  // Simple wave function for demonstration
  const waveFrequency = 0.17;
  const waveAmplitude = 0.6;
  return Math.sin(x * waveFrequency) * waveAmplitude + Math.cos(z * waveFrequency) * waveAmplitude;
}

init();

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

  water = new Water(
    waterGeometry,
    {
      textureWidth: 512,
      textureHeight: 512,
      waterNormals: new THREE.TextureLoader().load('assets/waternormals.jpg', function (texture) {
        texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
      }),
      sunDirection: new THREE.Vector3(),
      sunColor: 0xffffff,
      waterColor: 0x44a0e6, // Nice blue-green water color
      distortionScale: 3.7,
      fog: scene.fog !== undefined,
      side: THREE.DoubleSide
    }
  );

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
  const sceneEnv = new THREE.Scene();

  let renderTarget;

  function updateSun() {
    const phi = THREE.MathUtils.degToRad(90 - parameters.elevation);
    const theta = THREE.MathUtils.degToRad(parameters.azimuth);

    sun.setFromSphericalCoords(1, phi, theta);

    sky.material.uniforms['sunPosition'].value.copy(sun);
    water.material.uniforms['sunDirection'].value.copy(sun).normalize();

    if (renderTarget !== undefined) renderTarget.dispose();

    sceneEnv.add(sky);
    renderTarget = pmremGenerator.fromScene(sceneEnv);
    scene.add(sky);

    scene.environment = renderTarget.texture;
  }

  updateSun();

  controls = new OrbitControls(camera, renderer.domElement);
  controls.target.set(0, 10, 0);
  controls.minDistance = -5.0;
  controls.maxDistance = 10000;
  controls.update();

  window.addEventListener('resize', onWindowResize);

  window.addEventListener('keydown', function (e) {
    if (e.key === "ArrowUp") {
      jet.speed.vel = -1;
    }
    if (e.key === "ArrowDown") {
      jet.speed.vel = 1;
    }
    if (e.key === "ArrowRight") {
      jet.speed.rot = -Math.PI / 180;
    }
    if (e.key === "ArrowLeft") {
      jet.speed.rot = Math.PI / 180;
    }
  });

  window.addEventListener('keyup', function (e) {
    jet.stop();
  });
}

function onWindowResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}

function animate() {
  render();
  updateCamera();
  controls.update();

  physics.update();
  jet.jet.position.add(physics.jetski.position);

  
  if (jet) jet.update();
  document.getElementById('acceleration').innerText = `Acceleration: (${physics.acceleration.x},${physics.acceleration.y},${physics.acceleration.z})`;
  document.getElementById('position').innerText = `Position: (${physics.jetski.position.x.toFixed(2)}, ${physics.jetski.position.y.toFixed(2)}, ${physics.jetski.position.z.toFixed(2)})`;
  document.getElementById('thrust').innerText = `Thrust: ${physics.thrust.power},${physics.thrust.velocityFan.x}`;
  document.getElementById('velocity').innerText = `Velocity: (${physics.velocity.x.toFixed(2)}, ${physics.velocity.y.toFixed(2)}, ${physics.velocity.z.toFixed(2)})`;
  document.getElementById('drag').innerText = `Drag: (${physics.drag.coefficient},${physics.drag.area},${physics.drag.fluidDensity},${physics.drag.velocity.z})`;
  document.getElementById('deltaT').innerText = `Delta T: ${physics.deltaT}`;
  requestAnimationFrame(animate);
}

function render() {
  water.material.uniforms['time'].value += 1.0 / 60.0;
  renderer.render(scene, camera);
}

function updateCamera() {
  if (jet.jet) {
    const offset = new THREE.Vector3(100, 100, 300); // Adjust the offset to follow behind the jet ski
    const targetPosition = jet.jet.position.clone().add(offset.applyMatrix4(jet.jet.matrixWorld));

    camera.position.lerp(targetPosition, 0.1); // Smooth follow effect
    camera.lookAt(jet.jet.position);
  }
}
