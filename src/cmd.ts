import { EventEmitter } from "eventemitter3";

export default class Cmd extends EventEmitter {
  private tmp: Promise<void> = Promise.resolve();

  asyncOn(event: string, handler: (...args: any[]) => Promise<void> | void) {
    this.on(event, (...args: any[]) => {
      this.tmp = this.tmp.then(() => handler(...args)); // store promise onto chain
    });
  }

  async asyncEmit(event: string, ...args: any[]): Promise<boolean> {
    const listening = this.emit(event, ...args);
    const p = this.tmp; // get promise out of tmp
    // in case promise rejects
    this.tmp = Promise.resolve(); // clear out previous promise chain
    await p; // wait for promise to resolve
    return listening;
  }

  async parseArgs(args: Array<string>): Promise<boolean> {
    return await this.asyncEmit(args[0], args.slice(1));
  }
}
