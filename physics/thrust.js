import * as THREE from 'three';

export default class Thrust {
  constructor( power ,  velocityFan ) {
    this.power = power;

    this.velocityFan = velocityFan;

    this.thrust_force = new THREE.Vector3();
  }


  calculateThrust() {
    const thrustMagnitude =  this.power * this.velocityFan.length()  ;
    this.thrust_force.setZ(thrustMagnitude);
    return this.thrust_force;
  }


  update() {
    this.thrust_force = this.calculateThrust();
  }
}