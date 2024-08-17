import * as THREE from 'three';

export default class Rudder {
  constructor(jetski) {
    this.coefficient = 1.2; // Hydrodynamic coefficient (dimensionless)
    this.area = 0.2; // Steering surface area in m^2
    this.leverArmLength =jetski.length/3; // Lever arm length in meters
    this.fluidDensity = 1000; // Density of water in kg/m^3
    this.velocity = jetski.velocity; // Velocity of the jet ski in m/s
    this.steeringAngle = 0; // Initial steering angle in radians
    this.torque = new THREE.Vector3(0, 0, 0); // Initial torque vector
    this.dampingFactor = 2;
    
  }

  calculateTorque() {
    
    const relativeVelocity = this.velocity.length();
    const hydrodynamicForce = 0.5 * this.fluidDensity * Math.pow(relativeVelocity, 2) * this.coefficient * this.area;

   
    const torqueMagnitude = hydrodynamicForce * this.leverArmLength * Math.sin(this.steeringAngle);

   
    this.torque.set(0, torqueMagnitude, 0);
  }
  applyDamping() {
   
    const dampingFactor = this.dampingFactor + this.velocity.length() * this.velocityDampingCoefficient;
    this.torque.multiplyScalar(dampingFactor);
  }

  update(steeringAngle) {
    this.steeringAngle = steeringAngle; // Update the steering angle
    this.calculateTorque();
    this.torque.multiplyScalar(this.dampingFactor);
  }
}
