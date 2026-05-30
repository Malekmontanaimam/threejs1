import * as THREE from 'three';

export default class Drag {
  constructor(coefficient, area, fluidDensity, velocity, direction) {
    this.coefficient = coefficient; // drag coefficient (dimensionless)
    this.area = area; // cross-sectional area of the jetski in m^2
    this.fluidDensity = fluidDensity; // density of the fluid in kg/m^3
    this.velocity = velocity; // live reference to the jetski velocity vector
    this.direction = direction;
    this.drag_force = new THREE.Vector3(0, 0, 0);
    this.update();
  }

  drag_forceChange() {
    // Quadratic drag that always opposes the ACTUAL velocity vector:
    //   F = -0.5 * Cd * A * rho * |v| * v
    // This is the physically correct form. The previous version projected
    // drag onto each axis using the heading angle, which zeroed out drag on
    // any axis perpendicular to the heading -> velocity in that axis never
    // decayed and the craft accelerated without bound (the 1295 km/h bug).
    const speed = this.velocity.length();
    const k = 0.5 * this.coefficient * this.area * this.fluidDensity;
    this.drag_force.copy(this.velocity).multiplyScalar(-k * speed);
  }

  update() {
    this.drag_forceChange();
  }
}
