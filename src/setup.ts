import { Resources, PlanetaryState } from "./planet";

/** Convert from degrees to radians. */
function rad(d: number): number {
  return ((2 * Math.PI) / 360) * d;
}

function perYearToDay(x: number): number {
  return (1 + x) ** (1 / 365) - 1;
}

/** Resources consumed by one person per day. */
export const refStd: Resources = {
  water: 350,
  food: 1.878,
  energy: 1e10,
  population: 1
};

export const generation = 365 * 25;

function perGenToDay(x: number): number {
  return (1 + x) ** (1 / generation) - 1;
}

/** Initial data about the planets from NASA factsheet. */
export namespace planets {
  /** Example inner planet. */
  export const earth: PlanetaryState = {
    gravity: 9.8,
    distance: 149.6e6,
    period: 365.2,
    theta: 0.0,

    initResources: {
      water: 1.39e21,
      food: refStd.food * 7.53e9 * 365 * 10e3,
      energy: 5.97e24 * 1e-6,

      population: 7.53e9
    }
  };

  /** Another inner planet, */
  export const mars: PlanetaryState = {
    gravity: 3.7,
    distance: 227.9e6,
    period: 687,
    theta: Math.PI / 4,

    // mostly made up
    initResources: {
      water: 2.1e19,
      food: refStd.food * refStd.population * 365 * 1e3,
      energy: earth.initResources.energy / 1e3,

      population: 3.43e9
    }
  };

  export const mercury: PlanetaryState = {
    gravity: 3.7,
    distance: 57.9e6,
    period: 88.0,
    theta: rad(10.0),
    
    initResources: {
      water: 4.3e9,
      food: earth.initResources.food * 1.43e-6,
      energy: earth.initResources.energy * 0.412,

      population: 4.52e5
    }
  };

  export const venus: PlanetaryState = {
    gravity: 8.9,
    distance: 108.2e6, 
    period: 224.7,
    theta: 2 * Math.PI / 3,

    initResources: {
      water: 5.4e18,
      food: earth.initResources.food * 0.9, 
      energy: earth.initResources.energy * 1.215,
      population: 2.89e9
    }
  };

  export const jupiter: PlanetaryState = {
    gravity: 23.1,
    distance: 778.6e6,
    period: 4331,
    theta: -7 * Math.PI /12,

    initResources: {
      water: earth.initResources.water * 85,
      food: earth.initResources.food * 81, 
      energy: earth.initResources.energy * 317.8,

      population: 5.014e10
    }
  };

  export const saturn: PlanetaryState = {
    gravity: 9.0,
    distance: 1433.5e6,
    period: 10747,
    theta: 4 * Math.PI / 13 ,

    initResources: {
      water: earth.initResources.water * 42,
      food: earth.initResources.food * 39, 
      energy: earth.initResources.energy * 95.2,

      population: 1.9e10
    }
  };

  export const uranus: PlanetaryState = {
    gravity: 8.7,
    distance: 2872.5e6,
    period: 30589,
    theta: -Math.PI / 3,

    initResources: {
      water: earth.initResources.water * 16.43,
      food: earth.initResources.food * 14.98, 
      energy: earth.initResources.energy * 14.5,
      population: 1.2e9
    }
  };

  export const neptune: PlanetaryState = {
    gravity: 11.0,
    distance: 4495.1e6,
    period: 59800,
    theta: 19 * Math.PI / 23,

    initResources: {
      water: earth.initResources.water * 19.21,
      food: earth.initResources.food * 17.53, 
      energy: earth.initResources.energy * 17.1,
      population: 2.4e9
    }
  };
}

export const earthAvailable: Resources = {} as any;
for (let name of Object.keys(planets.earth.initResources)) {
  earthAvailable[name] = refStd[name] * planets.earth.initResources.population;
}

export interface SetupData {
  planets: {
    mercury: PlanetaryState;
    venus: PlanetaryState;
    earth: PlanetaryState;
    mars: PlanetaryState;
    jupiter: PlanetaryState;
    saturn: PlanetaryState;
    uranus: PlanetaryState;
    neptune: PlanetaryState;
  };
}
