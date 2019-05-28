import chalk from "chalk";

import * as sim from "./sim";
// circular import sort of
import * as setup from "./setup";

/** Container for resources. */
export interface Resources {
  /** General requirement for discoverability. */
  [key: string]: number;
  /** Amount of water in liters. */
  water: number;
  /** Amount of edible food in kilograms. */
  food: number;
  /** Net obtainable energy in joules. */
  energy: number;

  /** Current population living on planet. */
  population: number;
}

/** Some string helpers for giving units to resources. */
export const units: { [name: string]: string } = {
  water: "L", // liters
  food: "kg", // kilograms
  energy: "J", // joules
  population: "",

  // extra units
  angle: "_deg", // degrees
  distance: "m" // meters
};
for (const key in units) {
  units[key] = chalk.magentaBright(units[key]);
}

/** Simply return a resource object with all zeroes. */
export function zeroRes(): Resources {
  return {
    water: 0,
    food: 0,
    energy: 0,
    population: 0
  };
}

/** Invert a collection of resource values. */
export function invert(res: Resources): Resources {
  let newRes: any = {};
  for (let resName of Object.keys(res)) {
    newRes[resName] = -res[resName];
  }
  return newRes;
}

/** Facts about a planet. */
export interface PlanetaryState {
  /** Surface gravity of planet (m/s^2). */
  gravity: number;
  /** Distance from the sun in meters. */
  distance: number;
  /** Orbital period around the sun in Earth days. */
  period: number;
  /** Orbital theta position (rad). */
  theta: number;

  initResources: Resources;
}

/** Track State of Planetary Objects */
export class Planet {
  /** Physical status of the planet. */
  public info: PlanetaryState;
  /** Resources that have not been "mined" yet. */
  public raw: Resources;
  /** Resources that are currently available. */
  public available: Resources;
  /** Percent change in resources (since last day). */
  public rate: Resources;
  public qolRate: number = 0;

  constructor(public name: string, state: PlanetaryState) {
    this.info = Object.assign({}, state);
    this.raw = Object.assign({}, state.initResources); // avoid reference
    this.available = {
      water: 0,
      food: 0,
      energy: 0,
      population: state.initResources.population // copy population
    };
    this.rate = zeroRes();
  }

  /** Return true if no population exists. */
  get dead(): boolean {
    return this.available.population === 0;
  }

  /** Formatted name with dead indicator if necessary. */
  get fname(): string {
    return chalk`{blueBright ${this.name.toUpperCase()}} {redBright ${
      this.dead ? "(DEAD)" : ""
    }}`;
  }

  /** Calculate current abundance of a raw material. */
  abundance(resName: keyof Resources): number {
    const original = this.info.initResources[resName];
    return this.raw[resName] / original;
  }

  /** Process change of resource and return percent available changed. */
  mu(resName: keyof Resources): number {
    const oldAmt = this.raw[resName];
    const reqAmt = this.available.population * refPlanet.waterPerCapita;

    let mining = reqAmt;
    mining *= 1 + sim.gainFactor;
    mining *= this.abundance(resName);
    mining = Math.min(oldAmt, mining);

    this.raw[resName] -= mining;
    const oldAvl = this.available[resName];
    this.available[resName] += mining - reqAmt;
    this.available[resName] = Math.max(0, this.available[resName]);

    if (oldAvl === 0) {
      return 0;
    } else {
      return (mining - reqAmt) / oldAvl;
    }
  }

  /** Avereage water per person, will error on pop=0. */
  get waterPerCapita(): number {
    return this.available.water / this.available.population;
  }

  /** Average food per person, will error on pop=0. */
  get foodPerCapita(): number {
    return this.available.food / this.available.population;
  }

  /** Average energy per person, will error on pop=0. */
  get energyPerCapita(): number {
    return this.available.energy / this.available.population;
  }

  /** How much the people's thirst is quenched. */
  get quench(): number {
    return (
      Math.sqrt(this.waterPerCapita / refPlanet.waterPerCapita) -
      sim.thirstFactor
    );
  }

  /** How much the people's hunger is satisfied. */
  get fullness(): number {
    return (
      Math.sqrt(this.foodPerCapita / refPlanet.foodPerCapita) - sim.hungerFactor
    );
  }

  /** Average qol per person. */
  get qolPerCapita(): number {
    if (this.available.population === 0) {
      return 0;
    } else {
      return this.quench + this.fullness;
    }
  }

  /** Average productivity per capita of the planet. */
  get productivity(): number {
    return this.qolPerCapita / refPlanet.qolPerCapita;
  }

  /** Birth rate per day. */
  get birthRate(): number {
    if (this.quench < 0) {
      return -sim.quenchDieOff;
    } else if (this.fullness < 0) {
      return -sim.hungerDieOff;
    } else {
      return (
        Math.sign(this.productivity) * this.productivity ** 2 * sim.birthRate
      );
    }
  }

  /** Perform births for a day and return percent changed. */
  birth(): number {
    this.available.population -= 1;
    this.available.population *= 1 + this.birthRate;
    this.available.population = Math.round(this.available.population);
    return this.birthRate;
  }

  /** Number to measure quality of life. */
  get totalQol(): number {
    return this.qolPerCapita * this.available.population;
  }

  /** X position of the planet. */
  get x(): number {
    return this.info.distance * Math.cos(this.info.theta);
  }

  /** Y position of the planet. */
  get y(): number {
    return this.info.distance * Math.sin(this.info.theta);
  }

  /** Theta of the planet, but in degrees. */
  get deg(): number {
    return this.info.theta * (180 / Math.PI);
  }

  /** Escape factor. */
  get escape(): number {
    return this.info.gravity ** 2;
  }

  /** Calculate distance to another planet. */
  distance(planet: Planet) {
    const dx = planet.x - this.x;
    const dy = planet.y - this.y;
    return Math.sqrt(dx ** 2 + dy ** 2);
  }

  /** Step forward a single day for this planet. */
  step() {
    const oldQol = this.totalQol;

    if (this.available.population === 0) {
      return; // nothing will happen if population is zero
    }

    // perform resource updates
    this.rate.water = this.mu("water");
    this.rate.food = this.mu("food");
    this.rate.energy = this.mu("energy");

    // perform population growth/demise
    this.rate.population = this.birth();

    this.info.theta += (2 * Math.PI) / this.info.period; // perform rotation
    this.info.theta %= 2 * Math.PI;

    this.qolRate = this.totalQol / oldQol - 1;
  }

  /** Simulate the planet forward in time. */
  forward(days: number) {
    for (let i = 0; i < days; i++) this.step();
  }
}

export const refPlanet = new Planet("Reference", {
  distance: 1,
  gravity: 1,
  period: 1,
  theta: 1,
  initResources: setup.refStd
});
Object.assign(refPlanet.available, setup.refStd);

export type Planets = { [name: string]: Planet };
