class Thrust {
    constructor(power, efficiency, density) {
      this.power = power; // power of the engine in watts
      this.efficiency = efficiency; // efficiency of the propeller (0-1)
      this.density = density; // density of the fluid (air or water) in kg/m^3
      this.thrust_force = new Vector3(
        this.power * this.efficiency / (this.density * 0.5),
        0,
       0
      );
    }
  
    thrust_forceChange() {
      var thrust_force = new Vector3(0, 0, 1);
      this.thrust_force = thrust_force.multiplyScalar(
        this.power * this.efficiency / (this.density * 0.5)
      );
    }
  
    update() {
      this.thrust_forceChange();
    }
  }