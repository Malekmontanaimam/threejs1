import * as THREE from 'three';
export default class Drag {
    constructor(coefficient, area, fluidDensity, velocity) {
      this.coefficient = coefficient; // drag coefficient (dimensionless)
      this.area = area; // cross-sectional area of the jetski in m^2
      this.fluidDensity = fluidDensity; // density of the fluid (water or air) in kg/m^3
      this.velocity = velocity; // velocity of the jetski in m/s
      this.drag_force = new THREE.Vector3(
        -0.5 * this.coefficient * this.area * this.fluidDensity * this.velocity.length() * this.velocity.x,
        -0.5 * this.coefficient * this.area * this.fluidDensity * this.velocity.length() * this.velocity.y,
        -0.5 * this.coefficient * this.area * this.fluidDensity * this.velocity.length() * this.velocity.z
      );
    }
    drag_forceChange() {
      var drag_force = new THREE.Vector3(
        -this.velocity.x,
        -this.velocity.y,
        -this.velocity.z
      );
      this.drag_force = drag_force.multiplyScalar(
        0.5 * this.coefficient * this.area * this.fluidDensity * this.velocity.length()
      );
    }
    update() {
      this.drag_forceChange();
    }
  }