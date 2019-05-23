/** File for all Game Related Code */

import { Terminal } from "xterm";
import chalk from "chalk";

import { feedWrap, VWord, feedTablify, Justify } from "./text";
import { Prompter, formatDiff, getCursor } from "./prompt";
import * as setup from "./setup";
import Cmd from "./cmd";
import { Resources, units, Planet, Planets, zeroRes } from "./planet";
import { Trade, Transfer } from "./transfer";

import media from "./media";
import * as ansi from "ansi-escapes";

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
      let days: number;
      try {
        days = Number(args[0]);
      } catch (e) {
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
    this.writelnWrap(media.help);

    this.term.writeln("");

    // start game with 1 year of progress
    // this.term.writeln("Waiting one year automatically...");
    // await this.forward(365, 1);

    this.term.scrollToTop();

    while (true) {
      const args = await this.prompter.fromPrompt();
      // enable developer info
      if (devIndicator) {
        this.term.writeln(JSON.stringify(args));
      }
      // check that a valid command was given
      const success = await this.cmd.parseArgs(args).catch(this.hError); // do not suppress errors
      if (!success) {
        this.term.writeln(chalk.redBright("Commands:"));
        for (let c of [
          "check <planet> [planetTo]",
          "forward <days>",
          "transfer <res> <amt> <from> <to>"
        ]) {
          this.term.writeln(`  ${c}`);
        }
      }
    }
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
        const rate: number = ra[resource];
        row.push(formatDiff(rate));
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
    this.term.writeln(chalk.blueBright(`${planet.name.toUpperCase()}:`));
    const data = [["  orbit:", `${Math.round(planet.deg)}${units.angle}`]];
    this.printData(
      data.concat(this.dataResources(planet.available, planet.rate))
    );
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

  async forward(days: number, subdivide = 10, wait = 5000) {
    // TODO redo this and turn it into a continuous update mechanism

    // bind abort option
    this.term.writeln("Hit (q) to stop.");
    let abort = false;
    const aborter = (key: string) => {
      if (key === "q") {
        abort = true;
      }
    };
    this.term.on("key", aborter);

    wait = Math.min(wait, wait * (days / subdivide));
    subdivide = Math.min(subdivide, days); // don't waste time

    // perform all updates
    for (let i = 0; i < subdivide; i++) {
      // split updates into sizable portions
      let daysLeft = Math.round(((subdivide - i) / subdivide) * days);
      // provide simple feedback
      this.term.writeln(`Waiting ${daysLeft} days...`);
      let prevQol = this.qolScore;

      // calculate number of rounds (days) needed to wait for this portion
      let rounds: number;
      if (i === subdivide - 1) {
        rounds = days % subdivide;
      } else {
        rounds = Math.floor(days / subdivide);
      }
      // ensure current execution does not halt
      const pUpdate = new Promise<void>(resolve => {
        setImmediate(() => {
          for (let r = 0; r < rounds; r++) this.update();
          resolve();
        });
      });

      // execute sleep and update at the same time
      await Promise.all([pUpdate, sleep(wait / subdivide)]);

      // give ongoing status
      this.term.writeln(
        `  QOL: ${this.qolScore} ${formatDiff(this.qolScore - prevQol)}`
      );

      // abort if necessary
      if (abort) {
        break;
      }
    }

    // unbind abort option
    this.term.off("key", aborter);
  }

  /** Update the game world by one day. */
  async update() {
    // process planets
    for (let planet of Object.values(this.planets)) {
      planet.step();
      this.qolScore += planet.totalQol;
    }

    // process transfers
    this.trade.forward();
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
