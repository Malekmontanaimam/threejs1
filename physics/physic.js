import * as THREE from 'three';
import Buoyancy from './Buoyancy';
import Drag from './drag';
import Thrust from './thrust';
import Weight from './weight';
import JetSki from './jetski';
import Water from './Water';

export default class Physic {
  
  constructor() {
    this.jetski=new JetSki();
    this.g = new THREE.Vector3(0,-9.82,0);
    this.water=new Water();
    this.totalForce = new THREE.Vector3(0,0,0);
    this.position = new THREE.Vector3(0,0,0);
    this.velocity = new THREE.Vector3(0,0,0);
    this.acceleration = new THREE.Vector3(0,0,0);
    this.buoyancy= new Buoyancy(this.jetski.VODPJ,this.water.rho,this.g);
    this.drag = new Drag(this.jetski.dragCon,this.jetski.A,this.water.rho,this.water.waterVelocity);
    this.thrust = new  Thrust(this.jetski.powerEngine,this.jetski.velocityFan);
    this.weight= new Weight(this.jetski.mass,this.g);
    this.deltaT=0.1;
    this.lastUpdateTime=Date.now();

  }
calc_totForce(){
  let TF= new THREE.Vector3(0,0,0);
  TF.add(this.thrust.thrust_force);
  TF.add(this.drag.drag_force);
  TF.add(this.weight.weight_force);
  TF.add(this.buoyancy.buoyancy_force);
  this.totalForce.copy(TF);
}

calc_acceleration(){
  let TF = new THREE.Vector3(0,0,0);
  TF.copy(this.totalForce);
  let acc =new THREE.Vector3(0,0,0);

  acc.copy(TF.divideScalar(this.jetski.mass));
  this.acceleration.copy(acc);
  this.jetski.acceleration.copy(acc);
}
calc_velocity(){
  let acc = this.acceleration;
  let vel =new THREE.Vector3(0,0,0);

  vel.copy(acc.multiplyScalar(this.deltaT));
  this.velocity.copy(vel);
  this.jetski.velocity.copy(vel);
}

calc_distance(){
  let des = new THREE.Vector3(0,0,0);
  let vel=this.velocity;
  des.copy(vel.multiplyScalar(this.deltaT));
  this.jetski.position.add(des);


}

  update() {
   

    const currentTime=Date.now();
    const elapsedTime = (currentTime - this.lastUpdateTime) / 1000; // Convert to seconds

    if (elapsedTime >= 0.4) {
      this.deltaT = elapsedTime; // Update deltaT
      this.lastUpdateTime = currentTime; // Reset last update time
    }

    this.weight.update();
    this.thrust.update();
    this.drag.update();
    this.buoyancy.update();

   
    this.calc_totForce();
    this.calc_acceleration();
    this.calc_velocity();
    this.calc_distance();
   
  }
}
