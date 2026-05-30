import * as THREE from 'three';

// Closed-loop circuit on the water. Coordinates are in metres (world units).
// The player spawns at WAYPOINTS[0] facing +z toward WAYPOINTS[1].
const S = 0.65; // overall track scale (tunes lap length)
const RAW = [
  [0, 0],
  [0, 250],
  [120, 450],
  [350, 520],
  [560, 420],
  [640, 180],
  [560, -60],
  [650, -300],
  [430, -440],
  [180, -400],
  [30, -200],
];

export const WAYPOINTS = RAW.map((p) => new THREE.Vector3(p[0] * S, 0, p[1] * S));
export const LAPS = 3;
export const CHECKPOINT_RADIUS = 55; // how close counts as "passed"

// Perpendicular (across-track) direction at a waypoint, used to lay out gates.
export function gatePerp(i) {
  const N = WAYPOINTS.length;
  const next = WAYPOINTS[(i + 1) % N];
  const prev = WAYPOINTS[(i - 1 + N) % N];
  const tangent = next.clone().sub(prev).setY(0).normalize();
  return new THREE.Vector3(-tangent.z, 0, tangent.x); // rotate tangent 90°
}

export function buildTrack(scene) {
  const group = new THREE.Group();
  const N = WAYPOINTS.length;

  for (let i = 0; i < N; i++) {
    const wp = WAYPOINTS[i];
    const perp = gatePerp(i);
    const isStart = i === 0;
    const half = isStart ? 75 : 48;
    const color = isStart ? 0x22ff66 : 0xff5522;

    // A buoy on each side forms a gate to drive through.
    [-1, 1].forEach((side) => {
      const buoy = makeBuoy(color);
      buoy.position.copy(wp.clone().add(perp.clone().multiplyScalar(half * side)));
      group.add(buoy);
    });

    if (isStart) group.add(makeStartLine(wp, perp, half));
  }

  scene.add(group);
  return group;
}

function makeBuoy(color) {
  const g = new THREE.Group();
  const body = new THREE.Mesh(
    new THREE.CylinderGeometry(4, 6, 18, 12),
    new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 0.5, roughness: 0.5 })
  );
  body.position.y = 7;
  const ball = new THREE.Mesh(
    new THREE.SphereGeometry(5.5, 14, 10),
    new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xffffff, emissiveIntensity: 0.4 })
  );
  ball.position.y = 18;
  g.add(body, ball);
  return g;
}

function makeStartLine(wp, perp, half) {
  const tex = checkerTexture();
  const mesh = new THREE.Mesh(
    new THREE.PlaneGeometry(half * 2, 26),
    new THREE.MeshBasicMaterial({ map: tex, transparent: true, opacity: 0.9, side: THREE.DoubleSide })
  );
  mesh.rotation.x = -Math.PI / 2; // lay flat on the water

  const holder = new THREE.Group();
  holder.add(mesh);
  holder.position.copy(wp).setY(1.5);
  holder.rotation.y = Math.atan2(perp.x, perp.z); // align across the track
  return holder;
}

function checkerTexture() {
  const c = document.createElement('canvas');
  c.width = 128; c.height = 16;
  const ctx = c.getContext('2d');
  const cols = 16, w = c.width / cols;
  for (let x = 0; x < cols; x++) {
    for (let y = 0; y < 2; y++) {
      ctx.fillStyle = (x + y) % 2 ? '#ffffff' : '#111111';
      ctx.fillRect(x * w, y * 8, w, 8);
    }
  }
  const tex = new THREE.CanvasTexture(c);
  return tex;
}
