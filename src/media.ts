import chalk from "chalk";

import { ask } from "./text";

function subCmdName(s: string): string {
  return s.replace(/(^|\s)\w+(\s|$)/g, c => chalk.redBright(c));
}

function subReqParam(s: string): string {
  return s.replace(/<.*?>/g, p => chalk.greenBright(p));
}

function subOptParam(s: string): string {
  return s.replace(/\[.*?\]/, opt => chalk.blueBright(opt));
}

function subCmd(s: string): string {
  return subCmdName(subReqParam(subOptParam(s)));
}

const commands = [
  "help",
  "check <planet> [planetTo]",
  "forward <years>",
  "transfer <res> <amt> <from> <to>"
];

const _ = {
  title: chalk`{rgb(255,0,255)  Dictation }`,
  introduction: [
    "  Welcome to Dictation, the game where you choose the fate of the planets in your domain.",
    "By moving resources between the planets, you decide the quality of life of the populations living on them.",
    "You will make your decisions through this computer terminal that will track time and resources.",
    "Water, food, energy, and populations make up the resources available to you.",
    "Remember, the fate of the people are in your hands. Good luck!"
  ].join(" "),
  help: [
    chalk.redBright("Help:\n"),
    "  Dictation is played by giving the game commands.",
    `For example, typing "transfer population 12e5 earth mars" and hitting ${chalk.bold(
      "(RETURN)"
    )} will cause 12x10^5 = 1,200,000 people to be transfered from Earth to Mars every year.`,
    "The other commands are detailed below:",
    `\n\n${commands
      .map(s => `  ${s}`)
      .map(s => subCmd(s))
      .join("\n")}\n\n`,
    'Angle brackets such as "<" and ">" indicate a required parameter while square brackets such as "[" and "]" indicate an optional parameter.',
    "Planet names should be given in all lowercase.",
    "Dictation will try to predict what you are going to type and will display the prediction in green.",
    chalk`To accept the prediction press {bold (SPACE)}.`,
    "The parameter formats are given below:",
    [
      "\n\n  <planet>: planet name",
      "  [planetTo]: planet name to check transfers to",
      "  <years>: number of years to simulate per second",
      "  <res>: resource name",
      "  <amt>: amount of resource to transfer per year",
      "  <from>: name of planet to take resources from",
      "  <to>: name of planet to send resources to\n\n"
    ]
      .map(s => subReqParam(s))
      .map(s => subOptParam(s))
      .join("\n"),
    `Remember, to display this help again just use the command ${subCmd(
      "help"
    )}.`
  ].join(" "),
  commands,

  // dialogs that show up when various conditions are met
  dialog: {
    good: [ask<{ planet: string }>("^PLANET is thriving!")]
  }
};

export default _;
