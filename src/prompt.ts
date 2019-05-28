/** xTerm Prompt Support */

import { Terminal } from "xterm";
import { split } from "shlex";
import * as ansi from "ansi-escapes";
import chalk from "chalk";
import { autocomplete } from "./autocomplete";

const recordable = /^(\.|-|\w| |")$/;

/** Represent a position on the screen. */
export interface Position {
  x: number;
  y: number;
}

/** Get cursor position from a terminal. */
export async function getCursor(term: Terminal): Promise<Position> {
  return new Promise<Position>(resolve => {
    let record = "";

    const listener = term.onData(data => {
      // this assumes that no process interrupts the key stream from the terminal
      record += data;

      const match = record.match(/\x1b\[(\d*?);(\d*?)R/);
      if (match) {
        // will error on null match
        const y = Number(match[1]) - 1;
        const x = Number(match[2]) - 1;
        listener.dispose();
        resolve({ x: x, y: y });
      }
    });

    term.write(ansi.cursorGetPosition);
  });
}

/** Use to track multiple cursor positions. */
export class CursorPosition {
  public x: number = 0;
  public y: number = 0;

  constructor(private term: Terminal) {}

  /** Save current position of cursor. */
  async save(): Promise<this> {
    const position = await getCursor(this.term);
    this.x = position.x;
    this.y = position.y;
    return this;
  }

  /** Restore cursor to previously saved position. */
  restore() {
    this.term.write(ansi.cursorTo(this.x, this.y));
  }
}

/** Clears the screen after the cursor and then returns cursor back. */
export async function clear(term: Terminal, reset = false): Promise<void> {
  if (reset) term.write(ansi.cursorTo(0, 0));

  const pos = await new CursorPosition(term).save();

  term.write(
    (ansi.eraseEndLine + "\n").repeat(term.rows - 1) + ansi.eraseEndLine
  );

  pos.y = 0;
  pos.restore();
}

/** Provide user input abilities. */
export class Prompter {
  public history: string[][] = [];

  constructor(public term: Terminal, public prompt = "> ") {}

  abbreviate(width: number, data: string): string {
    return data.slice(Math.min(0, -width));
  }

  private printPrompt(): void {
    // prepare prompt line
    {
      let buffer = "";
      buffer += ansi.eraseLine; // clear current prompt
      buffer += ansi.cursorTo(0); // move cursor to left side
      this.term.write(buffer);
    }

    // print prompt
    this.term.write(this.prompt);
  }

  private updateText(
    cursor: CursorPosition,
    s: string,
    width: number,
    phantom = false
  ): void {
    cursor.restore();
    let rendered = this.abbreviate(width, s);
    if (phantom) {
      this.term.write(ansi.eraseEndLine);
      rendered = chalk.bgGreen.white(rendered);
    }
    this.term.write(rendered);
  }

  /** Wait for user to type input and press enter. */
  async getInput(width = -1): Promise<string> {
    const originalPosition = await new CursorPosition(this.term).save();

    return new Promise(resolve => {
      let data: string[] = [];
      this.history.push(data); // store data into history
      // let hIndex = 0;
      const listener = (key: string, ev: KeyboardEvent): void => {
        if (ev.key === "Enter") {
          this.term.off("key", listener); // remove input listener
          this.term.writeln(""); // move to the next line
          return resolve(data.join("")); // return data to promise
        } /*else if (ev.key === "ArrowUp") { // HISTORY IS NOT WORKING
          hIndex = Math.max(hIndex - 1, 0);
          data = this.history[hIndex].slice(); // copy data from history
        } else if (ev.key === "ArrowDown") {
          hIndex = Math.min(hIndex + 1, this.history.length - 1);
          data = this.history[hIndex].slice(); // copy data from history
        } */ else if (
          ev.key === "Backspace"
        ) {
          data.pop(); // remove character from input
        } else if (key.match(recordable)) {
          // autocomplete if the user enters a space
          if (ev.key === " ") {
            data = autocomplete(data);
          }
          data.push(key); // add character to input
        } else {
          return; // nothing of note, so exit fast
        }

        // refresh input line
        // print autocomplete prediction
        this.updateText(
          originalPosition,
          autocomplete(data).join(""),
          width,
          true
        );
        // print what has been typed
        this.updateText(originalPosition, data.join(""), width);
      };
      this.term.on("key", listener);
    });
  }

  /** Get input and shlex split it. */
  async getArgs(width = -1): Promise<string[]> {
    return split(await this.getInput(width));
  }

  /** Use a prompt to get input. */
  async fromPrompt(): Promise<string[]> {
    this.printPrompt();
    const position = await getCursor(this.term);
    return this.getArgs(this.term.cols - position.x);
  }
}

/** Add color and format difference. */
export function formatDiff(dx: number, prec = 3): string {
  const sign = Math.sign(dx) >= 0 ? "+" : "";
  const n = dx.toPrecision(prec);

  let color: string = "whiteBright";
  if (dx > 0) {
    color = "greenBright";
  } else if (dx === 0) {
    color = "yellowBright";
  } else if (dx < 0) {
    color = "redBright";
  }

  return (chalk as any)[color](`(${sign}${n})`);
}
