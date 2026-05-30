import * as THREE from 'three';

// Pooled spray/wake particles. Emit a burst at the jetski's stern each frame
// scaled by speed; particles arc up, fall, fade, and recycle.
export default class Spray {
  constructor(scene, count = 260) {
    this.count = count;
    this.pos = new Float32Array(count * 3);
    this.vel = new Float32Array(count * 3);
    this.life = new Float32Array(count); // seconds remaining
    this.maxLife = new Float32Array(count);

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(this.pos, 3));
    const alpha = new Float32Array(count);
    this.alpha = alpha;
    geo.setAttribute('alpha', new THREE.BufferAttribute(alpha, 1));

    // Custom material so each particle can fade individually.
    const mat = new THREE.ShaderMaterial({
      uniforms: { uSize: { value: 70 } },
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      vertexShader: `
        attribute float alpha;
        varying float vAlpha;
        uniform float uSize;
        void main() {
          vAlpha = alpha;
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          gl_PointSize = uSize * (1.0 / -mv.z) * (0.4 + alpha);
          gl_Position = projectionMatrix * mv;
        }`,
      fragmentShader: `
        varying float vAlpha;
        void main() {
          vec2 d = gl_PointCoord - vec2(0.5);
          float r = dot(d, d);
          if (r > 0.25) discard;
          float soft = smoothstep(0.25, 0.0, r);
          gl_FragColor = vec4(vec3(0.85, 0.95, 1.0), vAlpha * soft * 0.85);
        }`,
    });

    this.points = new THREE.Points(geo, mat);
    this.points.frustumCulled = false;
    this.cursor = 0;
    scene.add(this.points);
  }

  // origin: stern world position; back/side: unit dirs; intensity: 0..1
  emit(origin, back, side, intensity) {
    const bursts = Math.floor(intensity * 6);
    for (let n = 0; n < bursts; n++) {
      const i = this.cursor;
      this.cursor = (this.cursor + 1) % this.count;
      const i3 = i * 3;
      const spread = (Math.random() - 0.5) * 2;
      this.pos[i3] = origin.x + side.x * spread * 6;
      this.pos[i3 + 1] = origin.y + 1;
      this.pos[i3 + 2] = origin.z + side.z * spread * 6;
      const up = 9 + Math.random() * 12 * intensity;
      const b = 6 + Math.random() * 10;
      this.vel[i3] = back.x * b + side.x * spread * 8;
      this.vel[i3 + 1] = up;
      this.vel[i3 + 2] = back.z * b + side.z * spread * 8;
      this.maxLife[i] = 0.5 + Math.random() * 0.5;
      this.life[i] = this.maxLife[i];
    }
  }

  update(dt) {
    for (let i = 0; i < this.count; i++) {
      if (this.life[i] <= 0) { this.alpha[i] = 0; continue; }
      this.life[i] -= dt;
      const i3 = i * 3;
      this.vel[i3 + 1] -= 22 * dt; // gravity
      this.pos[i3] += this.vel[i3] * dt;
      this.pos[i3 + 1] += this.vel[i3 + 1] * dt;
      this.pos[i3 + 2] += this.vel[i3 + 2] * dt;
      if (this.pos[i3 + 1] < 0) { this.life[i] = 0; }
      this.alpha[i] = Math.max(0, this.life[i] / this.maxLife[i]);
    }
    this.points.geometry.attributes.position.needsUpdate = true;
    this.points.geometry.attributes.alpha.needsUpdate = true;
  }
}
