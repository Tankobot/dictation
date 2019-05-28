/** File for all Game Related Code */

import { Terminal } from "xterm";
import chalk from "chalk";

import { feedWrap, VWord, feedTablify, Justify } from "./text";
import { Prompter, formatDiff, clear } from "./prompt";
import * as setup from "./setup";
import Cmd from "./cmd";
import { Resources, units, Planet, Planets, zeroRes } from "./planet";
import { Trade, Transfer } from "./transfer";

import media from "./media";

let devIndicator = false; // track whether to enable extra debugging

/** Master Game Logic */
export class Game {
  public hError = (reason: Error) => {
    if (typeof reason === "string") {
      this.term.writeln(chalk.magentaBright(reason));
    } else {
      this.term.writeln(chalk.magentaBright(reason.message));
    }
    throw reason;
  };

  public prompter: Prompter;
  public cmd: Cmd;
  public gameOver = false;
  public currentDay: number = 0;
  public planets: Planets;
  /** Amount of resources being transfered each day from one planet to another. */
  public trade = new Trade();
  /** Sum of all quality of life over game run. */
  public qolScore = 0;

  constructor(private term: Terminal) {
    // create console
    this.prompter = new Prompter(term, chalk.cyanBright("> "));

    // setup commands
    const cmd = new Cmd();

    cmd.on("error", this.hError); // do not suppress errors

    cmd.asyncOn("", () => {}); // nothing command

    cmd.asyncOn("dev", () => {
      devIndicator = !devIndicator;
    });

    cmd.asyncOn("help", () => this.help());

    cmd.asyncOn("check", async (args: Array<string>) => {
      const names = args[1] === undefined ? [args[0]] : [args[0], args[1]];
      // verify names make sense
      for (let name of names) {
        if (Object.keys(this.planets).indexOf(name) === -1) {
          this.listPlanets();
          return; // exit fast
        }
      }
      await this.check(this.planets[names[0]], this.planets[names[1]]);
    });

    cmd.asyncOn("forward", async (args: Array<string>) => {
      const days = Number(args[0]);
      if (isNaN(days)) {
        this.error(`"${args[0]}" is not a number`);
        return;
      }
      await this.forward(days);
    });

    cmd.asyncOn("transfer", async (args: string[]) => {
      const res = args[0];
      if (Object.keys(setup.refStd).indexOf(res) === -1) {
        this.listOptions("resources", Object.keys(setup.refStd));
        return;
      }
      let amt: number;
      try {
        amt = Number(args[1]);
      } catch (e) {
        this.error(`"${args[1]}" is not a number`);
        return;
      }
      const fromP = this.planets[args[2]];
      const toP = this.planets[args[3]];
      if (fromP === undefined || toP === undefined) {
        this.listPlanets();
        return;
      }
      await this.transfer(res, amt, fromP, toP);
    });

    this.cmd = cmd;

    // create the planets
    const planets: { [name: string]: Planet } = {};
    for (let name in setup.planets) {
      planets[name] = new Planet(name, (setup.planets as any)[name]);
      if (name === "earth") {
        planets[name].available = Object.assign({}, setup.earthAvailable);
      }
    }
    this.planets = planets;
  }

  get textWidth(): number {
    return this.term.cols;
  }

  writelnWrap(s: string): void {
    this.term.writeln(feedWrap(s, this.textWidth));
  }

  center(s: string): string {
    const w = new VWord(s);
    if (w.length > this.textWidth) {
      throw new Error("cannot center text longer than terminal width");
    } else {
      const padding = " ".repeat(Math.floor((this.textWidth - w.length) / 2));
      return padding + s;
    }
  }

  async play(): Promise<void> {
    this.term.focus();

    this.term.writeln("\n");
    this.term.writeln(this.center(media.title));
    this.term.writeln("");

    this.writelnWrap(media.introduction);
    this.term.writeln("");
    this.help(); // print out help information
    this.term.writeln("");

    // start game with 1 year of progress
    // this.term.writeln("Waiting one year automatically...");
    // await this.forward(365, 1);

    this.writelnWrap(chalk`Press {cyanBright (S)} to start the game.`);
    setImmediate(() => this.term.scrollToTop()); // wait for screen to render
    await new Promise(resolve => {
      const f = this.term.onKey(e => {
        if (e.key.toLowerCase() == "s") {
          resolve();
          f.dispose();
        }
      });
    });

    this.gameOver = false;
    while (!this.gameOver) {
      const args = await this.prompter.fromPrompt();
      // enable developer info
      if (devIndicator) {
        this.term.writeln(JSON.stringify(args));
      }
      // check that a valid command was given
      const success = await this.cmd.parseArgs(args).catch(this.hError); // do not suppress errors
      if (!success) {
        this.term.writeln(chalk.redBright("Commands:"));
        for (let c of media.commands) {
          this.term.writeln(`  ${c}`);
        }
      }
    }
  }

  endGame() {
    this.gameOver = true;
    this.writelnWrap(chalk.redBright("All the planets are dead..."));
    this.writelnWrap(`You survived ${this.currentDay} years.`);
    this.writelnWrap(
      `The total quality of life you provided was ${
        this.qolScore
      }, or (${this.qolScore.toExponential(5)}).`
    );
    this.writelnWrap(`Thank you for playing ${media.title}.`);
    this.writelnWrap("You can restart the game by refreshing the page.");
  }

  /** Print out the help information. */
  async help(): Promise<void> {
    this.writelnWrap(media.help);
  }

  error(msg: string): void {
    this.term.writeln(chalk.redBright(msg));
  }

  /** Print valid options. */
  listOptions(kind: string, opts: string[]): void {
    this.error(`Valid ${kind}:`);
    for (let name of opts) {
      this.error(`  ${name}`);
    }
  }

  /** Print names of all planets in the solar system. */
  listPlanets(): void {
    this.listOptions("planets", Object.keys(this.planets));
  }

  /** Produce the resources in the form of a table. */
  dataResources(av: Resources, ra?: Resources): string[][] {
    const data: string[][] = [];

    for (let resource in av) {
      const row: string[] = [`  ${resource}:`];

      // get amount of resource available
      const available: number = av[resource];
      row.push(`${available.toExponential(2)}${units[resource]}`);

      // only add rate information if necessary
      if (ra !== undefined) {
        row.push(formatDiff(ra[resource]));
      } else {
        row.push("");
      }

      data.push(row);
    }

    return data;
  }

  /** Print 3 column data (name, amt, dx). */
  printData(data: string[][]): void {
    this.term.writeln(
      feedTablify(data, [Justify.right, Justify.left, Justify.left])
    );
  }

  /** Print available resources and their changes over time. */
  printResources(av: Resources, ra?: Resources): void {
    this.printData(this.dataResources(av, ra));
  }

  /** Print the current status of a planet. */
  showPlanetStatus(planet: Planet): void {
    this.term.writeln(`${planet.fname}:`);
    const data = [
      ["  orbit:", `${Math.round(planet.deg)}${units.angle}`],
      ["  qol:", `${planet.totalQol.toExponential(2)}`]
    ];
    this.printData(
      data.concat(this.dataResources(planet.available, planet.rate))
    );
  }

  sumAll(resName: keyof Resources): number {
    return Object.values(this.planets)
      .map(p => p.available[resName])
      .reduce((prev, curr) => prev + curr, 0);
  }

  summarize(): void {
    this.writelnWrap(`Total QOL: ${this.qolScore.toExponential(3)}`);

    this.writelnWrap("Sum of all planets:");
    const sumRes: Resources = {} as any;
    for (let resName of Object.keys(setup.refStd)) {
      sumRes[resName] = this.sumAll(resName);
    }
    this.printResources(sumRes);

    this.term.writeln("Planet QOL's:");
    const data: string[][] = [];
    for (let planet of Object.values(this.planets)) {
      data.push([
        `  ${planet.name}:`,
        `${planet.totalQol.toExponential(3)}`,
        formatDiff(planet.qolRate)
      ]);
    }
    this.printData(data);
  }

  async check(planet: Planet, planetTo?: Planet) {
    this.showPlanetStatus(planet);

    // provide extra info if necessary
    if (planetTo !== undefined) {
      // print transfer information
      const res = this.trade.getTransfer(planet, planetTo);

      this.term.writeln(
        chalk.blueBright(
          `Transfers from ${planet.name.toUpperCase()} to ${planetTo.name.toUpperCase()}`
        )
      );
      const data = [
        [
          "  distance:",
          `${planet.distance(planetTo).toExponential(2)}${units.distance}`
        ]
      ];
      this.printData(data.concat(this.dataResources(res)));

      // print other planet's status
      this.showPlanetStatus(planetTo);
    }
  }

  /** Step simulation at a (dps, days per second), refreshing screen every period (visPer). */
  async forward(dps: number, visPer = 1000 / 10) {
    // check validity of arguments
    if (!(0 < dps) && !(dps < Number.MAX_SAFE_INTEGER)) {
      throw new Error(`number ${dps} is out of bounds`);
    }
    if (!(0 < visPer)) {
      throw new Error(`visual period ${visPer} <= 0`);
    }

    // bind abort option
    let abort = false;
    const aborter = this.term.onKey(e => {
      if (e.key === "q") {
        abort = true;
        aborter.dispose();
      }
    });

    await clear(this.term);
    let queue = 0;
    while (!abort) {
      await clear(this.term, true);
      // prevent spending too much time in update loop
      let overslept = false;
      const sp = sleep(visPer).then(() => {
        overslept = true;
      });

      this.term.writeln(chalk`Hit {cyanBright (Q)} to stop.`);
      this.term.writeln(`Date: ${this.currentDay}`);

      this.summarize();

      // add to the queue if needed
      if (queue < 1) queue += (dps * visPer) / 1000;

      for (; queue >= 1 && !overslept; queue--) {
        const someAlive = await new Promise<boolean>(resolve => {
          // prevent updates from starving the event loop
          setImmediate(() => {
            resolve(this.update());
          });
        });

        if (!someAlive) {
          this.endGame();
          aborter.dispose();
          return;
        }
      }

      await sp; // ensure that minimum amount of time has passed
    }
  }

  /** Update the game world by one day, returns false if all planets died. */
  async update(): Promise<boolean> {
    let someAlive = false;
    // process planets
    for (let planet of Object.values(this.planets)) {
      planet.step();
      someAlive = someAlive || !planet.dead;
      this.qolScore += planet.totalQol;
    }

    // process transfers
    this.trade.forward();

    this.currentDay += 1;

    return someAlive;
  }

  async transfer(resource: string, amount: number, fromP: Planet, toP: Planet) {
    this.term.writeln(
      `Setting up continual transfer of \n  ${formatDiff(
        amount
      )} \n${resource} from ${fromP.name.toUpperCase()} to ${toP.name.toUpperCase()}...`
    );
    const amts: Resources = zeroRes();
    amts[resource] = amount;
    this.trade.applyTransfer(new Transfer(fromP, toP, amts));
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => {
    setTimeout(() => resolve(), ms);
  });
}
