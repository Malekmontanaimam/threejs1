import * as THREE from 'three';
import Water from './Water';

export default class JetSki {
  constructor() {
    this.water = new Water();
    this.mass = 1000;                         
    this.VODPJ = this.mass / this.water.rho;  
    this.dragCon = 0.5;                       
    this.A = 1.0;                            
    this.powerEngine = 75000;                
    this.velocityFan = new THREE.Vector3(10, 0, 0);
    this.position = new THREE.Vector3();
    this.velocity = new THREE.Vector3();
    this.acceleration = new THREE.Vector3();
    this.length = 3.0;
    this.momentOfInertia = (1 / 12) * this.mass * Math.pow(this.length / 2, 2);
  }

  getParams() {
    return {
      mass: this.mass,
      dragCon: this.dragCon,
      A: this.A,
      powerEngine: this.powerEngine,
      length: this.length
    };
  }
  setParams(params) {
    this.mass = params.mass ?? this.mass;
    this.dragCon = params.dragCon ?? this.dragCon;
    this.A = params.A ?? this.A;
    this.powerEngine = params.powerEngine ?? this.powerEngine;
    this.length = params.length ?? this.length;
    
    // Recalculate any derived values if needed
    this.VODPJ = this.mass / this.water.rho;
    this.momentOfInertia = (1 / 12) * this.mass * Math.pow(this.length / 2, 2);
   //  console.log("Updated JetSki Params:", this.getParams());
    // if (this.physic) {
    //   this.physic.updateDependentProperties();
    // }
  }
 
}
