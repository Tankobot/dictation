import chalk from "chalk";

import { ask } from "./text";

export default {
  title: chalk`{rgb(255,0,255)  Dictation }`,
  introduction: [
    "  Welcome to Dictation, the game where you choose the fate of the planets in your domain.",
    "By moving resources between the planets, you decide the quality of life of the populations living on them.",
    "You will make your decisions through this computer terminal that will track time and resources.",
    "Water, food, energy, and populations make up the resources available to you.",
    "Remember, the fate of the people are in your hands. Good luck!"
  ].join(" "),
  help: chalk`Help: {red TODO}`,

  // dialogs that show up when various conditions are met
  dialog: {
    good: [ask<{ planet: string }>("^PLANET is thriving!")]
  }
};
