import "./style.scss";
import "../node_modules/xterm/dist/xterm.css";

import * as WebFont from "webfontloader";
import { Terminal } from "xterm";
import * as fit from "xterm/lib/addons/fit/fit";
import chalk from "chalk";

import { Howl, Howler } from "howler";

// We know that chalk will work here.
chalk.enabled = true;
chalk.level = 3;

Terminal.applyAddon(fit);

/** Create and fit a new terminal into the screen. */
function createTerminal(): Terminal {
  const terminalDiv: HTMLDivElement = document.getElementById(
    "terminal"
  ) as any;

  const term = new Terminal({
    fontFamily: "'Space Mono', monospace",
    //fontWeight: "bold",
    fontSize: 20,
    cursorBlink: true,
    cols: 50,
    rows: 25,
    convertEol: true
  });

  term.open(terminalDiv);

  let screen = term.element
    .getElementsByClassName("xterm-screen")
    .item(0) as HTMLDivElement;
  let width = screen.style.width;
  terminalDiv.style.maxWidth = width;

  fit.fit(term);

  return term;
}

/** Execute the game. */
async function main(): Promise<void> {
  let term = createTerminal();

  const { Game } = await import("./game");

  let game = new Game(term);

  let sound = new Howl({
    src: ['./audio/10 Arpanauts.mp3'],
    autoplay: true,
    loop: true,
    volume: 0.1
  });


  await game.play();
  
  await sound.play();
}

WebFont.load({
  google: {
    families: ["Space Mono"]
  },
  active: main
});
