export class Phase {
  name: string;
  days: number;

  constructor(name: string, days: number) {
    this.name = name;
    this.days = days;
  }
}

export class Phases {
  private phases: Phase[] = [];
  length: number;

  constructor(phases: Phase[]) {
    this.phases = phases;
    this.length = phases.length;
  }

  public First(): Phase {
    return this.phases[0];
  }

  public Last(): Phase {
    return this.phases[this.phases.length - 1];
  }

  public Next(phase: Phase): Phase | undefined {
    if (phase === this.Last()) {
      return phase;
    }

    for (let i = 0; i < this.phases.length; i++) {
      if (this.phases[i] === phase) {
        return this.phases[++i];
      }
    }
  }

  public Return(phase: Phase): Phase | undefined {
    if (phase === this.First()) {
      return phase;
    }

    for (let i = 0; i < this.phases.length; i++) {
      if (this.phases[i] === phase) {
        return this.phases[--i];
      }
    }
  }

  public Phase(position: number): Phase | undefined {
    if (position > this.length || position < 0) return undefined;
    return this.phases[position];
  }
}
