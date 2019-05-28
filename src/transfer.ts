import {
  Resources,
  invert as invertRes,
  zeroRes,
  Planet,
  Planets
} from "./planet";
import * as sim from "./sim";

// const pairRgx = /^(.*)\n(.*)$/; // "<from>\n<to>"

/** Object managing a transfer between two planets. */
export class Transfer {
  constructor(
    public sender: Planet,
    public receiver: Planet,
    public amounts: Resources = zeroRes()
  ) {}

  /** Indicate if sender and receiver fit indexing order. */
  get ordered(): boolean {
    return this.sender.name < this.receiver.name;
  }

  /** Produce unique index for transfer (independent of ordering). */
  get index(): string {
    return [this.sender.name, this.receiver.name].sort().join("\n");
  }

  /** Returns true if other transfer refers to same planets. */
  similar(t: Transfer): boolean {
    return this.index === t.index;
  }

  /** Create an identical transfer with inverted perspective. */
  invert(): Transfer {
    return new Transfer(this.receiver, this.sender, invertRes(this.amounts));
  }

  /** Return an identical transfer that is ordered. */
  naturalInversion(): Transfer {
    return this.ordered ? this : this.invert();
  }

  /** Produce a transfer matching the ordering of the current one. */
  sameInversion(t: Transfer): Transfer {
    if (!this.similar(t)) {
      throw new Error("transfer does not have matching planets");
    }
    return t.ordered === this.ordered ? t : t.invert();
  }

  /** Add a transfer to this transfer. */
  apply(t: Transfer): void {
    // account for possible inversion
    const tRes = this.sameInversion(t).amounts;
    for (let name in tRes) {
      this.amounts[name] += tRes[name];
    }
  }

  /** Calculate energy cost of transfer. */
  private costOf(amt: number): number {
    const escape = amt >= 0 ? this.sender.escape : this.receiver.escape;
    // base multiplier
    let cost = Math.abs(amt);
    // escape cost from planet's gravity
    cost *= escape;
    // cost of distance becomes more efficient for larger distances
    cost *= Math.sqrt(this.sender.distance(this.receiver));
    // correct the magnitude of the cost
    return cost * sim.transferFactor;
  }

  /** Calculate the total cost of transfering a set of resources. */
  private totalCost(amts: number[]) {
    return amts.reduce((total, amt) => total + this.costOf(amt), 0);
  }

  private oneWay(
    sender: Planet,
    receiver: Planet,
    amounts: Resources,
    total: number,
    factor: number
  ) {
    for (let [name, amt] of Object.entries(amounts)) {
      const safeAmt = Math.min(sender.available[name], Math.abs(amt) * factor);
      sender.available[name] -= safeAmt;
      receiver.available[name] += safeAmt;
    }
    // remove necessary energy
    sender.available.energy -= total;
    // ensure remaining energy is non-negative
    sender.available.energy = Math.max(sender.available.energy, 0);
  }

  /** Perform the transfer between the two planets. */
  execute(): void {
    // the planet sending resources pays the energy cost
    // note potential BUG where energy transfer should be prioritized first

    // split up transfers
    const sending: Resources = {} as any;
    const receiving: Resources = {} as any;
    for (let [name, amt] of Object.entries(this.amounts)) {
      if (amt >= 0) {
        sending[name] = amt;
      } else {
        receiving[name] = amt;
      }
    }

    // sending amounts
    const sendTotal = this.totalCost(Object.values(sending));
    // percent of resources that can actually be sent
    const sendFactor = Math.min(this.sender.available.energy / sendTotal, 1);
    // perform send portion
    this.oneWay(this.sender, this.receiver, sending, sendTotal, sendFactor);

    // receiving amounts
    const receiveTotal = this.totalCost(Object.values(receiving));
    // percent of resources that can actually be received
    const receiveFactor = Math.min(
      this.receiver.available.energy / receiveTotal,
      1
    );
    // perform receive portion
    this.oneWay(
      this.receiver,
      this.sender,
      receiving,
      receiveTotal,
      receiveFactor
    );
  }
}

/** Facilitate continual transfer of resources between planets. */
export class Trade {
  /** Collection of all active transfers. */
  private transfers: { [namePair: string]: Transfer } = {};

  constructor() {}

  /** Retrieve resources information from a transfer. */
  getTransfer(p1: Planet, p2: Planet): Resources {
    const tempTansfer = new Transfer(p1, p2);
    this.ensureTransfer(p1, p2);
    let realTransfer = this.transfers[tempTansfer.index];
    return Object.assign({}, tempTansfer.sameInversion(realTransfer).amounts);
  }

  /** Apply a transfer to the trading system. */
  applyTransfer(t: Transfer): void {
    this.ensureTransfer(t.sender, t.receiver);
    this.transfers[t.index].apply(t);
  }

  /** Ensures that a transfer exists and return true if one was created. */
  private ensureTransfer(p1: Planet, p2: Planet): boolean {
    const transfer = new Transfer(p1, p2);
    let realTransfer = this.transfers[transfer.index];
    if (realTransfer === undefined) {
      // create a transfer if one does not exist
      this.transfers[transfer.index] = transfer.naturalInversion();
      return true;
    } else {
      return false;
    }
  }

  /** Process all transfers. */
  forward() {
    for (let transfer of Object.values(this.transfers)) {
      transfer.execute();
    }
  }
}
